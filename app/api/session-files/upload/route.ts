/**
 * Generic server-side proxy for client uploads of session artifacts.
 *
 * Uploads file content to xAI Files and inserts proof_of_work.
 * Product code does not delete those rows or files.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  organizationIdFromSession,
  uploadOrgScopedXaiFile,
} from "@/lib/organization/org-xai-files";
import { insertWorkspaceProofOfWorkRow } from "@/lib/pow-api/workspace-proof-of-work";
import {
  sensorPowInsertPayload,
  workspaceIdForSession,
  type SessionSensorKind,
} from "@/lib/session-sensor-pow";

export const runtime = "nodejs";
export const maxDuration = 30;

type DataKind = "facial" | "tool" | "eeg" | "screen" | "audio";

const ALLOWED_KINDS = new Set<DataKind>(["facial", "tool", "eeg", "screen", "audio"]);

interface UploadRequest {
  sessionId: string;
  kind: DataKind;
  fileName: string;
  mimeType: string;
  data: string;
  timestampMs?: number;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
  toolName?: string;
  toolAction?: string;
  bandPowers?: Record<string, number> | null;
  deviceName?: string | null;
  sampleCount?: number;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = (await req.json()) as UploadRequest;
    const {
      sessionId,
      kind,
      fileName,
      mimeType,
      data: base64,
      timestampMs,
      chunkIndex,
      metadata,
      toolName,
      toolAction,
      deviceName,
      sampleCount,
    } = body;

    if (!sessionId || !kind || !fileName || !mimeType || !base64) {
      return jsonError(400, "sessionId, kind, fileName, mimeType, and data are required");
    }

    if (!ALLOWED_KINDS.has(kind)) {
      return jsonError(400, `kind must be one of: ${[...ALLOWED_KINDS].join(", ")}`);
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return jsonError(403, "Forbidden");
    }

    const workspaceId = await workspaceIdForSession(supabase, sessionId);
    if (!workspaceId) {
      return jsonError(400, "Session is missing a Learning Map");
    }

    let xaiFileId: string;
    try {
      const organizationId = await organizationIdFromSession(supabase, sessionId);
      const uploaded = await uploadOrgScopedXaiFile(fileName, mimeType, base64, {
        organizationId,
        collectionFields: {
          session_id: sessionId,
          user_id: user.id,
          kind,
        },
      });
      xaiFileId = uploaded.file_id;
    } catch (err) {
      console.error(`[session-files/upload] xAI upload failed for kind=${kind}:`, err);
      return jsonError(502, err instanceof Error ? err.message : "xAI upload failed");
    }

    const { error } = await insertWorkspaceProofOfWorkRow(
      supabase,
      sensorPowInsertPayload({
        sessionId,
        userId: user.id,
        workspaceId,
        kind: kind as SessionSensorKind,
        xaiFileId,
        fileName,
        mimeType,
        timestampMs,
        chunkIndex,
        metadata,
        toolName,
        toolAction,
        deviceName,
        sampleCount,
      }),
    );

    if (error) {
      const msg = error.message ?? "DB insert failed";
      console.error(`[session-files/upload] PoW insert failed for kind=${kind}:`, msg);
      return jsonError(500, msg);
    }

    return NextResponse.json({ success: true, xai_file_id: xaiFileId });
  } catch (err) {
    console.error("[session-files/upload] Internal error:", err);
    return jsonError(500, "Internal server error");
  }
}
