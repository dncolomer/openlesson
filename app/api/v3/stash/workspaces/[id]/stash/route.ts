/**
 * Stash API — Stash decision (System 1).
 * Flushes all buffered PoW units through the regular PoW API, then resets memory.
 * TAPBench sessions include exercise + remaining time; expired tokens are rejected.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse, getServiceClient } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import {
  bufferSubjectId,
  stashBufferedProofOfWork,
  stashExerciseResponseFields,
} from "@/lib/pow-api/stash-api";
import { resolveStashTapbenchFromRequest } from "@/lib/pow-api/stash-tapbench-auth";
import type { AuthContext } from "@/lib/pow-api/types";

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

  const apiAuth = await authenticateRequest(req, "workspaces:write");
  let auth: AuthContext;
  let supabase;
  let tapbenchCtx = null as ReturnType<
    typeof import("@/lib/pow-api/stash-api").stashTapbenchContextFromResolved
  > | null;

  if (apiAuth instanceof NextResponse) {
    supabase = await getServiceClient();
    const tb = await resolveStashTapbenchFromRequest(req, supabase, {
      body,
      workspaceId,
      requireToken: true,
    });
    if (tb.mode === "error") {
      return NextResponse.json(
        { error: { code: tb.code, message: tb.message, ...(tb.body || {}) } },
        { status: tb.status },
      );
    }
    if (tb.mode !== "ok") return apiAuth;
    tapbenchCtx = tb.tapbench;
    // Real UUID guest from mint — required for guest-scoped PoW (not a synthetic string).
    auth = {
      user_id: null as string | null,
      guest_user_id: tb.tapbench.guest_user_id,
      organization_id: null as string | null,
      is_org_admin: false,
      key_id: `tapbench:${tb.tapbench.linkId}`,
      scopes: ["workspaces:write" as const],
    };
  } else {
    auth = apiAuth.auth;
    supabase = apiAuth.supabase;
    const tb = await resolveStashTapbenchFromRequest(req, supabase, {
      body,
      workspaceId,
    });
    if (tb.mode === "error") {
      return NextResponse.json(
        { error: { code: tb.code, message: tb.message, ...(tb.body || {}) } },
        { status: tb.status },
      );
    }
    if (tb.mode === "ok") {
      tapbenchCtx = tb.tapbench;
      // Attribute flush to the TAPBench guest subject (human TAP parity).
      if (tb.tapbench.guest_user_id) {
        auth = {
          ...auth,
          user_id: null,
          guest_user_id: tb.tapbench.guest_user_id,
        };
      }
    }
  }

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
  // Fill org id for billing/collection when session-token-only auth
  if (tapbenchCtx && !auth.organization_id && workspace.organization_id) {
    auth = { ...auth, organization_id: workspace.organization_id };
  }

  const subjectId = bufferSubjectId(auth);
  const flush = await stashBufferedProofOfWork({
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
      decision: "stash",
      system: flush.system,
      system_label: "System 1",
      flushed: flush.flushed,
      empty: flush.empty,
      proof_of_work: flush.proof_of_work,
      buffer_remaining: flush.buffer_remaining,
      workspace_id: workspaceId,
      user_id: auth.user_id,
      guest_user_id: auth.guest_user_id,
      ...stashExerciseResponseFields(tapbenchCtx),
      note: flush.empty
        ? "No buffered proof of work — nothing to stash."
        : tapbenchCtx
          ? "Buffered units flushed to PoW API as System 1 (stash) with tapbench pow flag; buffer reset."
          : "Buffered units flushed to PoW API as System 1 (stash); buffer reset.",
    },
    { status: flush.empty ? 200 : 201 },
  );
}
