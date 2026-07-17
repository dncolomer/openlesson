import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createAgentWorkspace } from "@/lib/agent-v2/create-agent-workspace";
import { parseOpaqueWorkspaceCreateRequest } from "@/lib/agent-v2/opaque-evaluation";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";
import { checkWorkspaceCreation, workspaceLimitErrorResponse } from "@/lib/workspace-limits";
import { resolveUserBilling } from "@/lib/organization/resolve-user-billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  if (!auth.user_id && !auth.guest_user_id) {
    return errorResponse(403, "forbidden", "A real user or guest API key is required to create workspaces");
  }
  if (auth.guest_user_id && !auth.organization_id) {
    return errorResponse(403, "forbidden", "Guest workspace creation requires organization context");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  const opaqueRequest = parseOpaqueWorkspaceCreateRequest(body);
  const initialPrompt = typeof body.initial_prompt === "string" ? body.initial_prompt.trim() : "";
  if (!opaqueRequest && !initialPrompt) {
    return errorResponse(
      400,
      "validation_error",
      "initial_prompt is required unless evaluation_mode is opaque with protocol"
    );
  }

  if (auth.user_id) {
    const billing = await resolveUserBilling(supabase, auth.user_id);
    if ("error" in billing) {
      return errorResponse(500, "internal_error", billing.error);
    }

    const workspaceCheck = await checkWorkspaceCreation(
      supabase,
      auth.user_id,
      billing.userProfile
    );

    if (!workspaceCheck.allowed) {
      const payload = workspaceLimitErrorResponse(workspaceCheck);
      return errorResponse(403, "workspace_limit_reached", payload.error, payload);
    }
  }

  try {
    const created = await createAgentWorkspace(supabase, auth, body);

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        {
          workspace: created.workspace,
          blocks: created.blocks,
          files: created.files,
          evaluation_mode: created.privacy.evaluation_mode,
          privacy: created.privacy,
        },
        {
          endpoint: "create_workspace",
          workspace_id: created.workspace.id as string,
          workspace_title:
            typeof created.workspace.title === "string" ? created.workspace.title : null,
          conversion_goal:
            typeof created.workspace.conversion_goal === "string"
              ? created.workspace.conversion_goal
              : null,
        },
      ),
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workspace";
    if (message.includes("Unsupported file type") || message.includes("at most") || message.includes("10 MB")) {
      return errorResponse(400, "validation_error", message);
    }
    console.error("[agent/workspaces] Create failed:", error);
    return errorResponse(500, "internal_error", message);
  }
}