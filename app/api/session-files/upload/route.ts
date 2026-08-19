/**
 * Generic server-side proxy for client uploads of session artifacts.
 *
 * Uploads file content to xAI Files (server-side, with the xAI API key kept
 * private) and inserts a row into the appropriate session_* DB table.
 *
 * Used by the session view to persist:
 *   - "facial"   → session_facial
 *   - "tool"     → session_tool
 *   - "eeg"      → session_eeg
 *   - "screen"   → session_screenshots
 *
 * Audio chunks stay in Supabase Storage (handled separately).
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { uploadFileToXAI } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 30;

type DataKind = "facial" | "tool" | "eeg" | "screen";

const ALLOWED_KINDS = new Set<DataKind>(["facial", "tool", "eeg", "screen"]);

interface UploadRequest {
  sessionId: string;
  kind: DataKind;
  fileName: string;
  mimeType: string;
  /** base64-encoded file contents */
  data: string;
  /** Optional fields the caller wants stored on the DB row */
  timestampMs?: number;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
  // Tool-specific
  toolName?: string;
  toolAction?: string;
  // EEG-specific
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
      bandPowers,
      deviceName,
      sampleCount,
    } = body;

    if (!sessionId || !kind || !fileName || !mimeType || !base64) {
      return jsonError(400, "sessionId, kind, fileName, mimeType, and data are required");
    }

    if (!ALLOWED_KINDS.has(kind)) {
      return jsonError(400, `kind must be one of: ${[...ALLOWED_KINDS].join(", ")}`);
    }

    // Verify session ownership
    const { data: session } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return jsonError(403, "Forbidden");
    }

    // Upload to xAI Files
    let xaiFileId: string;
    try {
      const uploaded = await uploadFileToXAI(fileName, mimeType, base64);
      xaiFileId = uploaded.file_id;
    } catch (err) {
      console.error(`[session-files/upload] xAI upload failed for kind=${kind}:`, err);
      return jsonError(502, err instanceof Error ? err.message : "xAI upload failed");
    }

    const ts = typeof timestampMs === "number" ? timestampMs : Date.now();
    const idx = typeof chunkIndex === "number" ? chunkIndex : 0;

    // Insert into the appropriate table
    let dbResult: { error: unknown };

    switch (kind) {
      case "facial": {
        dbResult = await supabase.from("session_facial").insert({
          session_id: sessionId,
          user_id: user.id,
          timestamp_ms: ts,
          chunk_index: idx,
          xai_file_id: xaiFileId,
          metadata: metadata ?? {},
        });
        break;
      }
      case "tool": {
        dbResult = await supabase.from("session_tool").insert({
          session_id: sessionId,
          user_id: user.id,
          timestamp_ms: ts,
          xai_file_id: xaiFileId,
          tool_name: toolName,
          tool_action: toolAction,
          metadata: metadata ?? {},
        });
        break;
      }
      case "eeg": {
        dbResult = await supabase.from("session_eeg").insert({
          session_id: sessionId,
          user_id: user.id,
          timestamp_ms: ts,
          chunk_index: idx,
          xai_file_id: xaiFileId,
          device_name: deviceName ?? null,
          sample_count: sampleCount ?? null,
          band_powers: bandPowers ?? null,
        });
        break;
      }
      case "screen": {
        dbResult = await supabase.from("session_screenshots").insert({
          session_id: sessionId,
          user_id: user.id,
          timestamp_ms: ts,
          xai_file_id: xaiFileId,
        });
        break;
      }
    }

    if (dbResult.error) {
      const msg = (dbResult.error as { message?: string }).message ?? "DB insert failed";
      console.error(`[session-files/upload] DB insert failed for kind=${kind}:`, msg);
      // Best-effort cleanup of xAI file
      const { deleteFileFromXAI } = await import("@/lib/xai-files");
      await deleteFileFromXAI(xaiFileId).catch(() => {});
      return jsonError(500, msg);
    }

    return NextResponse.json({ success: true, xai_file_id: xaiFileId });
  } catch (err) {
    console.error("[session-files/upload] Internal error:", err);
    return jsonError(500, "Internal server error");
  }
}
