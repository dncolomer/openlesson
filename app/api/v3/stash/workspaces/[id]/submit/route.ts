/**
 * Stash API — Submit decision (System 2).
 * Flushes all buffered PoW units through the regular PoW API, then resets memory.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import {
  bufferSubjectId,
  submitBufferedProofOfWork,
} from "@/lib/pow-api/stash-api";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id, title, root_topic, workspace_goal")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  const subjectId = bufferSubjectId(auth);
  const flush = await submitBufferedProofOfWork({
    workspaceId,
    subjectId,
    auth,
    workspace: {
      id: workspace.id,
      user_id: workspace.user_id || auth.user_id || "",
      organization_id: workspace.organization_id ?? auth.organization_id,
    },
    supabase,
  });

  if (!flush.ok) {
    return errorResponse(502, "internal_error", flush.error);
  }

  return NextResponse.json(
    {
      decision: "submit",
      system: flush.system,
      system_label: "System 2",
      flushed: flush.flushed,
      empty: flush.empty,
      proof_of_work: flush.proof_of_work,
      buffer_remaining: flush.buffer_remaining,
      workspace_id: workspaceId,
      user_id: auth.user_id,
      guest_user_id: auth.guest_user_id,
      note: flush.empty
        ? "No buffered proof of work — nothing to submit."
        : "Buffered units flushed to PoW API as System 2 (submit); buffer reset.",
    },
    { status: flush.empty ? 200 : 201 },
  );
}
