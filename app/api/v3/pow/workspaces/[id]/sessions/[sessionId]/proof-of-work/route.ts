import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { HeadlessSessionError } from "@/lib/pow-api/headless-session";
import {
  headlessErrorStatus,
  ingestHeadlessProofForWorkspace,
} from "@/lib/pow-api/headless-session-run";
import { loadManagedWorkspace } from "@/lib/pow-api/workspace-management";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RouteProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId, sessionId } = await params;
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) return errorResponse(404, "workspace_not_found", "Workspace not found");
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  try {
    const session = await ingestHeadlessProofForWorkspace({
      supabase,
      auth,
      workspaceId,
      sessionId,
      args: body,
    });
    return NextResponse.json(
      await withProofOfWorkApiResponse(session, {
        endpoint: "upload_proof_of_work",
        workspace_id: workspaceId,
      }),
    );
  } catch (error) {
    if (error instanceof HeadlessSessionError) {
      return errorResponse(headlessErrorStatus(error), error.code as never, error.message, error.details);
    }
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to ingest proof of work",
    );
  }
}
