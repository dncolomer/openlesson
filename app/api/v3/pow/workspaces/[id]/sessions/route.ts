import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { HeadlessSessionError } from "@/lib/pow-api/headless-session";
import {
  headlessErrorStatus,
  startHeadlessSessionForWorkspace,
} from "@/lib/pow-api/headless-session-run";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";
export const maxDuration = 180;

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  try {
    const session = await startHeadlessSessionForWorkspace({
      supabase,
      auth,
      workspaceId,
      args: body,
    });
    return NextResponse.json(
      await withProofOfWorkApiResponse(session, {
        endpoint: "start_session",
        workspace_id: workspaceId,
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof HeadlessSessionError) {
      return errorResponse(headlessErrorStatus(error), error.code as never, error.message, error.details);
    }
    return errorResponse(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to start session",
    );
  }
}
