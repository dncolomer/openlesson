/**
 * Stash API — Submit decision (System 2).
 * Flushes all buffered PoW units through the regular PoW API, then resets memory.
 * TAPBench sessions include exercise + remaining time; expired tokens are rejected.
 */

import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import {
  bufferSubjectId,
  stashExerciseResponseFields,
  submitBufferedProofOfWork,
} from "@/lib/pow-api/stash-api";
import { authenticateStashRequest } from "@/lib/pow-api/authenticate-stash-request";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const { id: workspaceId } = await params;

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    body = {};
  }

  const stashAuth = await authenticateStashRequest(req, workspaceId, body);
  if (!stashAuth.ok) return stashAuth.response;
  let { auth, supabase, tapbenchCtx } = stashAuth;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id, title, root_topic, workspace_goal")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }
  if (!tapbenchCtx && !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }
  if (tapbenchCtx && !auth.organization_id && workspace.organization_id) {
    auth = { ...auth, organization_id: workspace.organization_id };
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
    tapbench: tapbenchCtx,
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
      ...stashExerciseResponseFields(tapbenchCtx),
      note: flush.empty
        ? "No buffered proof of work — nothing to submit."
        : tapbenchCtx
          ? "Buffered units flushed to PoW API as System 2 (submit) with tapbench pow flag; buffer reset."
          : "Buffered units flushed to PoW API as System 2 (submit); buffer reset.",
    },
    { status: flush.empty ? 200 : 201 },
  );
}
