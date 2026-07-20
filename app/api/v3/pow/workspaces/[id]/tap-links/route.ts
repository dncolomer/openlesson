import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { CreateTapLinkError, createWorkspaceTapLink } from "@/lib/pow-api/create-tap-link";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "tap:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id } = await params;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", id)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let query = supabase
    .from("workspace_tap_sessions")
    .select("id, workspace_id, block_id, status, requested_duration_seconds, duration_seconds, focus_block_ids, overall_score, created_at, started_at, completed_at, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id")
    .eq("workspace_id", id)
    .order("created_at", { ascending: false });

  if (auth.guest_user_id) {
    query = query.eq("guest_user_id", auth.guest_user_id);
  } else if (!auth.is_org_admin && auth.user_id) {
    query = query.or(`user_id.eq.${auth.user_id},assigned_user_id.eq.${auth.user_id}`);
  }

  const { data: links, error } = await query;

  if (error) {
    console.error("[agent/tap-links:list] Query error:", error);
    return errorResponse(500, "internal_error", "Failed to list TAP links");
  }

  return NextResponse.json(
    await withProofOfWorkApiResponse(
      { tap_links: links || [] },
      { endpoint: "list_tap_links", workspace_id: id }
    )
  );
}

/** Create a TAP link scoped to the entire workspace (omit block_id). For block-scoped links use POST .../blocks/{block_id}/tap-links. */
export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "tap:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const blockId =
    typeof body.block_id === "string" && body.block_id.trim()
      ? body.block_id.trim()
      : typeof body.blockId === "string" && body.blockId.trim()
        ? body.blockId.trim()
        : null;

  try {
    const tapLink = await createWorkspaceTapLink({
      supabase,
      auth,
      workspaceId,
      blockId,
      body,
      baseUrl: baseUrl(req),
    });

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { tap_link: tapLink },
        {
          endpoint: "create_tap_link",
          workspace_id: workspaceId,
          block_id: blockId,
          tap_minutes: Math.round(tapLink.requested_duration_seconds / 60),
        }
      ),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof CreateTapLinkError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error("[agent/tap-links] Create error:", error);
    return errorResponse(500, "internal_error", "Failed to create TAP link");
  }
}