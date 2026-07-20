/**
 * Stash API ingest — same PoW payload types as Proof-of-Work API.
 * Units are stored in temporary memory until POST .../stash or .../submit.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import {
  bufferSubjectId,
  getStashBufferSize,
  ingestStashUnit,
} from "@/lib/pow-api/stash-api";

export const runtime = "nodejs";
export const maxDuration = 30;

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
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
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
        block_id: ingested.unit.block_id,
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
      next: {
        stash: `POST /api/v3/stash/workspaces/${workspaceId}/stash`,
        submit: `POST /api/v3/stash/workspaces/${workspaceId}/submit`,
      },
      note: "Proof of work is held temporarily until Stash (System 1) or Submit (System 2).",
    },
    { status: 202 },
  );
}
