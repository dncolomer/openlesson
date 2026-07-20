import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { listAgentWorkspaces } from "@/lib/pow-api/agent-workspace-ops";
import {
  WORKSPACE_CREATE_UI_ONLY_ERROR_CODE,
  WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS,
  WORKSPACE_CREATE_UI_ONLY_MESSAGE,
} from "@/lib/pow-api/workspace-create-ui-only";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";

/**
 * GET /api/v3/pow/workspaces — list workspaces accessible to the API key (MCP list_workspaces twin).
 * POST /api/v3/pow/workspaces — programmatic create is disabled (UI-only at /workspace/new).
 */
export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const url = new URL(req.url);
  try {
    const payload = await listAgentWorkspaces(supabase, auth, {
      status: url.searchParams.get("status"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    });
    return NextResponse.json(
      await withProofOfWorkApiResponse(payload, { endpoint: "list_workspaces" }),
    );
  } catch (error) {
    return errorResponse(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to list workspaces",
    );
  }
}

/**
 * POST /api/v3/pow/workspaces — programmatic workspace create is disabled.
 * Workspaces must be created manually via the product UI (/workspace/new).
 */
export async function POST(_req: NextRequest) {
  return errorResponse(
    WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS,
    WORKSPACE_CREATE_UI_ONLY_ERROR_CODE,
    WORKSPACE_CREATE_UI_ONLY_MESSAGE,
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
