import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { HeadlessSessionError, presentHeadlessSession } from "@/lib/pow-api/headless-session";
import { headlessErrorStatus, requireWorkspaceSession } from "@/lib/pow-api/headless-session-run";
import { loadManagedWorkspace } from "@/lib/pow-api/workspace-management";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId, sessionId } = await params;
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) return errorResponse(404, "workspace_not_found", "Workspace not found");
  try {
    const session = await requireWorkspaceSession(workspaceId, sessionId);
    return NextResponse.json(
      await withProofOfWorkApiResponse(presentHeadlessSession(session), {
        endpoint: "get_session",
        workspace_id: workspaceId,
      }),
    );
  } catch (error) {
    if (error instanceof HeadlessSessionError) {
      return errorResponse(headlessErrorStatus(error), error.code as never, error.message, error.details);
    }
    throw error;
  }
}
