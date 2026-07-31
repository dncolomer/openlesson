/**
 * Stash API ingest — same PoW payload types as Proof-of-Work API.
 * Units are stored in temporary memory until POST .../stash or .../submit.
 * With a valid TAPBench session token, the response includes the exercise + remaining time.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import {
  bufferSubjectId,
  getStashBufferSize,
  ingestStashUnit,
  stashExerciseResponseFields,
} from "@/lib/pow-api/stash-api";
import { resolveStashTapbenchFromRequest } from "@/lib/pow-api/stash-tapbench-auth";
import { getServiceClient } from "@/lib/pow-api/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const { id: workspaceId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  // Prefer API key auth; TAPBench session can also authorize when present.
  const apiAuth = await authenticateRequest(req, "workspaces:write");
  let auth;
  let supabase;

  if (apiAuth instanceof NextResponse) {
    // Fall back to service client + TAPBench token-only path
    supabase = await getServiceClient();
    const tb = await resolveStashTapbenchFromRequest(req, supabase, {
      body,
      workspaceId,
      requireToken: true,
    });
    if (tb.mode === "error") {
      return NextResponse.json(
        {
          error: { code: tb.code, message: tb.message, ...(tb.body || {}) },
        },
        { status: tb.status },
      );
    }
    if (tb.mode !== "ok") {
      return apiAuth;
    }
    auth = {
      user_id: null as string | null,
      guest_user_id: tb.tapbench.guest_user_id,
      organization_id: null as string | null,
      is_org_admin: false,
      key_id: `tapbench:${tb.tapbench.linkId}`,
      scopes: ["workspaces:write" as const],
    };
    const tapbenchCtx = tb.tapbench;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, user_id, organization_id, guest_user_id")
      .eq("id", workspaceId)
      .single();

    if (!workspace) {
      return errorResponse(404, "workspace_not_found", "Workspace not found");
    }
    if (workspace.organization_id) {
      auth = { ...auth, organization_id: workspace.organization_id };
    }

    const subjectId = bufferSubjectId(auth);
    const ingested = ingestStashUnit(workspaceId, subjectId, body);
    if (!ingested.ok) {
      return errorResponse(400, ingested.code, ingested.message);
    }

    const buffered = getStashBufferSize(workspaceId, subjectId);
    return NextResponse.json(
      {
        buffered: true,
        unit: {
          id: ingested.unit.id,
          type: ingested.unit.type,
          type_raw: ingested.unit.type_raw,
          mime_type: ingested.unit.mime_type,
          file_name: ingested.unit.file_name ?? null,
          block_id: ingested.unit.block_id ?? tapbenchCtx.block_id,
          session_id: ingested.unit.session_id,
          tool_name: ingested.unit.tool_name,
          tool_action: ingested.unit.tool_action,
          timestamp_ms: ingested.unit.timestamp_ms,
          buffered_at: ingested.unit.buffered_at,
        },
        buffer_count: buffered,
        workspace_id: workspaceId,
        user_id: auth.user_id,
        guest_user_id: auth.guest_user_id,
        ...stashExerciseResponseFields(tapbenchCtx),
        next: {
          stash: `POST /api/v3/stash/workspaces/${workspaceId}/stash`,
          submit: `POST /api/v3/stash/workspaces/${workspaceId}/submit`,
        },
        note: "Proof of work is held temporarily until Stash (System 1) or Submit (System 2). TAPBench session active.",
      },
      { status: 202 },
    );
  }

  auth = apiAuth.auth;
  supabase = apiAuth.supabase;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  const tb = await resolveStashTapbenchFromRequest(req, supabase, {
    body,
    workspaceId,
  });
  if (tb.mode === "error") {
    return NextResponse.json(
      {
        error: { code: tb.code, message: tb.message, ...(tb.body || {}) },
      },
      { status: tb.status },
    );
  }
  const tapbenchCtx = tb.mode === "ok" ? tb.tapbench : null;
  if (tapbenchCtx?.guest_user_id) {
    auth = {
      ...auth,
      user_id: null,
      guest_user_id: tapbenchCtx.guest_user_id,
    };
  }

  const subjectId = bufferSubjectId(auth);
  const ingested = ingestStashUnit(workspaceId, subjectId, body);
  if (!ingested.ok) {
    return errorResponse(400, ingested.code, ingested.message);
  }

  const buffered = getStashBufferSize(workspaceId, subjectId);

  return NextResponse.json(
    {
      buffered: true,
      unit: {
        id: ingested.unit.id,
        type: ingested.unit.type,
        type_raw: ingested.unit.type_raw,
        mime_type: ingested.unit.mime_type,
        file_name: ingested.unit.file_name ?? null,
        block_id: ingested.unit.block_id ?? tapbenchCtx?.block_id ?? null,
        session_id: ingested.unit.session_id,
        tool_name: ingested.unit.tool_name,
        tool_action: ingested.unit.tool_action,
        timestamp_ms: ingested.unit.timestamp_ms,
        buffered_at: ingested.unit.buffered_at,
      },
      buffer_count: buffered,
      workspace_id: workspaceId,
      user_id: auth.user_id,
      guest_user_id: auth.guest_user_id,
      ...stashExerciseResponseFields(tapbenchCtx),
      next: {
        stash: `POST /api/v3/stash/workspaces/${workspaceId}/stash`,
        submit: `POST /api/v3/stash/workspaces/${workspaceId}/submit`,
      },
      note: tapbenchCtx
        ? "Proof of work is held temporarily until Stash (System 1) or Submit (System 2). TAPBench session active."
        : "Proof of work is held temporarily until Stash (System 1) or Submit (System 2).",
    },
    { status: 202 },
  );
}
