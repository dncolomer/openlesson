// Session media / evidence persistence
import { createClient } from "@/lib/supabase/client";
import type {
  FacialDataPoint,
  LogToolUsageResult,
  SessionScreenshot,
  RecentAudioChunk,
  RecentTranscript,
  RecentToolEvent,
  RecentFacialData,
  RecentEEGData,
  ToolName,
  ToolAction,
  UserCalibration,
} from "@/lib/domain/types";
import {
  powRowsForSensorKind,
  type SessionSensorKind,
} from "@/lib/session-sensor-pow";

async function loadSessionPowRows(sessionId: string, sinceMs?: number) {
  const supabase = createClient();
  let query = supabase
    .from("proof_of_work")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });
  if (typeof sinceMs === "number") {
    query = query.gte("timestamp_ms", sinceMs);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as Array<Record<string, unknown>>;
}

function powKindRows(rows: Array<Record<string, unknown>>, kind: SessionSensorKind) {
  return powRowsForSensorKind(rows, kind);
}

function mimeToExtension(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  switch (base) {
    case "audio/mp4": return "mp4";
    case "audio/m4a": return "m4a";
    case "audio/mpeg":
    case "audio/mp3": return "mp3";
    case "audio/ogg": return "ogg";
    case "audio/opus": return "opus";
    case "audio/wav":
    case "audio/wave":
    case "audio/x-wav": return "wav";
    case "audio/flac": return "flac";
    case "audio/aac": return "aac";
    case "audio/webm": return "ogg"; // webm+opus → re-label as ogg for xAI
    default: return "mp4";
  }
}

// ---- Audio Storage ----

export async function saveSessionAudio(
  sessionId: string,
  audioBlob: Blob
): Promise<string> {
  const { uploadSessionFile } = await import("@/lib/session-files-client");
  const contentType = audioBlob.type || "audio/mp4";
  const ext = mimeToExtension(contentType);
  const timestamp = Date.now();
  const fileName = `${sessionId}_${timestamp}.${ext}`;
  const result = await uploadSessionFile({
    sessionId,
    kind: "audio",
    fileName,
    mimeType: contentType,
    data: audioBlob,
    timestampMs: timestamp,
    metadata: { sensor_kind: "audio" },
  });
  if (!result.success || !result.xai_file_id) {
    throw new Error(result.error || "Audio upload failed");
  }
  return result.xai_file_id;
}

const MIN_AUDIO_SIZE_BYTES = 10240; // 10KB - minimum size for meaningful audio

export async function saveAudioChunk(
  sessionId: string,
  chunkBlob: Blob,
  chunkIndex: number,
  timestamp: number
): Promise<string | null> {
  if (chunkBlob.size < MIN_AUDIO_SIZE_BYTES) {
    console.log("[saveAudioChunk] Skipping - audio too small:", chunkBlob.size, "bytes (min:", MIN_AUDIO_SIZE_BYTES, ")");
    return null;
  }

  const ts = Date.now();
  const contentType = chunkBlob.type || "audio/mp4";
  const ext = mimeToExtension(contentType);
  const fileName = `chunk_${chunkIndex}_${ts}.${ext}`;
  const { uploadSessionFile } = await import("@/lib/session-files-client");
  const result = await uploadSessionFile({
    sessionId,
    kind: "audio",
    fileName,
    mimeType: contentType,
    data: chunkBlob,
    timestampMs: timestamp,
    chunkIndex,
    metadata: { sensor_kind: "audio" },
  });
  if (!result.success || !result.xai_file_id) {
    throw new Error(result.error || "Audio chunk upload failed");
  }
  return result.xai_file_id;
}

export async function saveBrowserTranscript(
  sessionId: string,
  transcript: string,
  chunkIndex: number,
  timestamp: number,
): Promise<string | null> {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const res = await fetch("/api/session-transcripts/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      transcript: text,
      chunkIndex,
      timestampMs: timestamp,
      metadata: {
        source: "browser-web-speech",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Transcript upload failed (${res.status})`);
  }

  const body = (await res.json()) as { xai_file_id?: string };
  return body.xai_file_id || null;
}

export async function getSessionAudio(sessionId: string): Promise<Blob | null> {
  const rows = await loadSessionPowRows(sessionId);
  const audio = powKindRows(rows, "audio").at(-1);
  const fileId = typeof audio?.xai_file_id === "string" ? audio.xai_file_id : "";
  if (!fileId) return null;
  const res = await fetch(`/api/session-files/download?sessionId=${encodeURIComponent(sessionId)}&fileId=${encodeURIComponent(fileId)}`);
  if (!res.ok) return null;
  return res.blob();
}

export async function saveFacialData(
  sessionId: string,
  facialData: FacialDataPoint[],
  chunkIndex: number,
  timestamp: number
): Promise<string> {
  const { uploadSessionFile } = await import("@/lib/session-files-client");
  const payload = JSON.stringify({ sessionId, timestamp, data: facialData });
  const fileName = `${sessionId}_facial_${chunkIndex}_${timestamp}.json`;

  const result = await uploadSessionFile({
    sessionId,
    kind: "facial",
    fileName,
    mimeType: "application/json",
    data: payload,
    timestampMs: timestamp,
    chunkIndex,
  });

  if (!result.success) {
    console.error("[saveFacialData] Upload failed:", result.error);
    throw new Error(`Facial data upload failed: ${result.error}`);
  }
  return result.xai_file_id || "";
}

// ---- Tool Usage Tracking ----

export async function logToolUsage(
  sessionId: string,
  toolName: ToolName,
  toolAction: ToolAction,
  timestampMs: number,
  toolData: Record<string, unknown> = {}
): Promise<LogToolUsageResult> {
  try {
    const { uploadSessionFile } = await import("@/lib/session-files-client");
    const fileName = `${sessionId}_tool_${timestampMs}.json`;
    const result = await uploadSessionFile({
      sessionId,
      kind: "tool",
      fileName,
      mimeType: "application/json",
      data: JSON.stringify(toolData),
      timestampMs,
      metadata: toolData,
      toolName,
      toolAction,
    });

    return {
      success: result.success,
      uploadOk: result.success,
      insertOk: result.success,
      error: result.error,
    };
  } catch (e) {
    return {
      success: false,
      uploadOk: false,
      insertOk: false,
      error: String((e as Error)?.message ?? e),
    };
  }
}

// ---- EEG Data Logging ----

export async function logEEGData(
  sessionId: string,
  timestampMs: number,
  chunkIndex: number,
  bandPowers: { delta: number; theta: number; alpha: number; beta: number; gamma: number }
): Promise<boolean> {
  try {
    const { uploadSessionFile } = await import("@/lib/session-files-client");
    const eegDataJson = JSON.stringify({
      timestamp_ms: timestampMs,
      chunk_index: chunkIndex,
      band_powers: bandPowers,
    });
    const fileName = `${sessionId}_eeg_${chunkIndex}_${timestampMs}.json`;

    const result = await uploadSessionFile({
      sessionId,
      kind: "eeg",
      fileName,
      mimeType: "application/json",
      data: eegDataJson,
      timestampMs,
      chunkIndex,
      bandPowers,
    });

    if (!result.success) {
      console.warn("[logEEGData] Upload failed (non-critical):", result.error);
    }
    return true;
  } catch (e) {
    console.warn("[logEEGData] Failed (non-critical):", e);
    return true;
  }
}

// ---- EEG Storage ----

export async function saveSessionEEG(
  sessionId: string,
  eegData: {
    channels: Record<string, number[]>;
    bandPowers: Record<string, number> | null;
    sampleRateHz?: number;
    startedAtMs?: number;
    endedAtMs?: number;
    sampleCounts?: Record<string, number>;
    deviceStatus?: Record<string, unknown> | null;
  },
  deviceName?: string,
  chunkIndex?: number,
  timestamp?: number
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const ts = timestamp || Date.now();
  const idx = chunkIndex ?? 0;
  const sampleCount = Object.values(eegData.channels).reduce((sum, samples) => sum + samples.length, 0);
  const fileName = `${sessionId}_eeg_${idx}_${ts}.json`;

  console.log("[saveSessionEEG] Saving:", { sessionId, fileName, deviceName, channels: Object.keys(eegData.channels) });

  const { uploadSessionFile } = await import("@/lib/session-files-client");
  const result = await uploadSessionFile({
    sessionId,
    kind: "eeg",
    fileName,
    mimeType: "application/json",
    data: JSON.stringify(eegData),
    timestampMs: ts,
    chunkIndex: idx,
    bandPowers: eegData.bandPowers,
    deviceName: deviceName || null,
    sampleCount,
  });

  if (!result.success) {
    throw new Error(result.error || "EEG upload failed");
  }

  // Also save summary into session metadata (this stays in our DB)
  if (eegData.bandPowers) {
    const { data: sessionRow } = await supabase
      .from("sessions")
      .select("metadata")
      .eq("id", sessionId)
      .single();

    const existingMeta = sessionRow?.metadata || {};
    await supabase
      .from("sessions")
      .update({ metadata: { ...existingMeta, eegSummary: eegData.bandPowers } })
      .eq("id", sessionId);
  }

  console.log("[saveSessionEEG] Done!");
}

// ---- Screen Capture Storage ----

export async function saveScreenshot(
  sessionId: string,
  screenshotBlob: Blob,
  timestamp: number
): Promise<string | null> {
  const fileName = `${sessionId}_screen_${timestamp}.png`;

  console.log("[saveScreenshot] Saving:", { sessionId, fileName, size: screenshotBlob.size });

  const { uploadSessionFile } = await import("@/lib/session-files-client");
  const result = await uploadSessionFile({
    sessionId,
    kind: "screen",
    fileName,
    mimeType: "image/png",
    data: screenshotBlob,
    timestampMs: timestamp,
  });

  if (!result.success) {
    console.error("[saveScreenshot] Upload failed:", result.error);
    return null;
  }

  console.log("[saveScreenshot] Done!");
  return result.xai_file_id || null;
}

export async function getSessionScreenshots(sessionId: string): Promise<SessionScreenshot[]> {
  const rows = powKindRows(await loadSessionPowRows(sessionId), "screen");
  return rows.map((row) => ({
    id: String(row.id || ""),
    sessionId: String(row.session_id || sessionId),
    userId: String(row.user_id || ""),
    timestamp: Number(row.timestamp_ms || 0),
    xaiFileId: String(row.xai_file_id || ""),
    createdAt: String(row.created_at || ""),
  }));
}

/**
 * Returns a URL the browser can use to fetch a screenshot.
 * Screenshots now live on xAI Files; we proxy the download through our
 * server so the xAI key stays private.
 */
export async function getScreenshotUrl(xaiFileId: string): Promise<string | null> {
  if (!xaiFileId) return null;
  return `/api/session-files/download?fileId=${encodeURIComponent(xaiFileId)}`;
}

// ---- Recent Data Fetching for Analysis ----

export async function getRecentAudioChunks(sessionId: string, ms: number): Promise<RecentAudioChunk[]> {
  const cutoffTime = Date.now() - ms;
  const rows = powKindRows(await loadSessionPowRows(sessionId, cutoffTime), "audio");
  return rows.map((row) => {
    const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
    return {
      id: String(row.id || ""),
      sessionId: String(row.session_id || sessionId),
      timestamp: Number(row.timestamp_ms || 0),
      storagePath: String(row.xai_file_id || meta.storage_path || ""),
      chunkIndex: Number(row.chunk_index || 0),
    };
  });
}

export async function getRecentTranscripts(sessionId: string, ms: number): Promise<RecentTranscript[]> {
  const cutoffTime = Date.now() - ms;
  const rows = powKindRows(await loadSessionPowRows(sessionId, cutoffTime), "transcript");
  return rows.map((row) => {
    const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
    return {
      id: String(row.id || ""),
      sessionId: String(row.session_id || sessionId),
      xaiFileId: String(row.xai_file_id || ""),
      wordCount: Number(meta.word_count || 0),
      timestamp: Number(row.timestamp_ms || 0),
    };
  });
}

export async function getRecentToolEvents(sessionId: string, ms: number): Promise<RecentToolEvent[]> {
  const cutoffTime = Date.now() - ms;
  const rows = powKindRows(await loadSessionPowRows(sessionId, cutoffTime), "tool");
  return rows.map((row) => ({
    id: String(row.id || ""),
    sessionId: String(row.session_id || sessionId),
    timestamp: Number(row.timestamp_ms || 0),
    toolName: String(row.tool_name || "tool"),
    toolAction: String(row.tool_action || ""),
    xaiFileId: String(row.xai_file_id || ""),
  }));
}

export async function getRecentFacialData(sessionId: string, ms: number): Promise<RecentFacialData[]> {
  const cutoffTime = Date.now() - ms;
  const rows = powKindRows(await loadSessionPowRows(sessionId, cutoffTime), "facial");
  return rows.map((row) => ({
    id: String(row.id || ""),
    sessionId: String(row.session_id || sessionId),
    timestamp: Number(row.timestamp_ms || 0),
    xaiFileId: String(row.xai_file_id || ""),
  }));
}

export async function getRecentEEGData(sessionId: string, ms: number): Promise<RecentEEGData[]> {
  const cutoffTime = Date.now() - ms;
  const rows = powKindRows(await loadSessionPowRows(sessionId, cutoffTime), "eeg");
  return rows.map((row) => {
    const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
    return {
      id: String(row.id || ""),
      sessionId: String(row.session_id || sessionId),
      timestamp: Number(row.timestamp_ms || 0),
      xaiFileId: String(row.xai_file_id || ""),
      chunkIndex: Number(row.chunk_index || 0),
      bandPowers: (meta.band_powers || row.band_powers || null) as RecentEEGData["bandPowers"],
    };
  });
}

export async function getRecentScreenshots(sessionId: string, ms: number): Promise<SessionScreenshot[]> {
  const cutoffTime = Date.now() - ms;
  const rows = powKindRows(await loadSessionPowRows(sessionId, cutoffTime), "screen");
  return rows.map((row) => ({
    id: String(row.id || ""),
    sessionId: String(row.session_id || sessionId),
    userId: String(row.user_id || ""),
    timestamp: Number(row.timestamp_ms || 0),
    xaiFileId: String(row.xai_file_id || ""),
    createdAt: String(row.created_at || ""),
  }));
}

export async function deleteSessionScreenshots(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Server-side cleanup of xAI screenshot files (just for this kind would be
  // overkill; the unified cleanup endpoint handles all session artifacts)
  try {
    await fetch(`/api/session-files/cleanup?sessionId=${sessionId}`, { method: "POST" });
  } catch (e) {
    console.warn("[deleteSessionScreenshots] cleanup failed (non-critical):", e);
  }

  console.log("[deleteSessionScreenshots] Proof of work for session is preserved:", sessionId);
}

// ---- Full Session Data Fetching (for Analytics) ----

export async function getAllTranscripts(sessionId: string): Promise<RecentTranscript[]> {
  return getRecentTranscripts(sessionId, Date.now());
}

export async function getAllEEGData(sessionId: string): Promise<RecentEEGData[]> {
  return getRecentEEGData(sessionId, Date.now());
}

export async function getAllFacialData(sessionId: string): Promise<RecentFacialData[]> {
  return getRecentFacialData(sessionId, Date.now());
}

export async function getAllToolEvents(sessionId: string): Promise<RecentToolEvent[]> {
  return getRecentToolEvents(sessionId, Date.now());
}

export async function getAllAudioChunks(sessionId: string): Promise<RecentAudioChunk[]> {
  return getRecentAudioChunks(sessionId, Date.now());
}

// ---- User Calibration (session statistics from past probes) ----

export async function getUserCalibration(
  userId: string,
   
  supabaseClient?: any
): Promise<UserCalibration> {
  const supabase = supabaseClient || createClient();

  // Get all user's sessions with probes
   
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(`
      id,
      problem,
      created_at,
      probes
    `)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(20) as { data: Array<{ id: string; problem: string; created_at: string; probes: Array<{ gap_score: number; signals: string[] }> }> | null; error: Error | null };

  if (error || !sessions) {
    console.warn("[getUserCalibration] Failed to fetch sessions:", error);
    return {
      sessionCount: 0,
      avgGapScore: 0.5,
      trend: "stable",
      recentTopics: [],
      commonGaps: [],
    };
  }

  const sessionCount = sessions.length;

  if (sessionCount === 0) {
    return {
      sessionCount: 0,
      avgGapScore: 0.5,
      trend: "stable",
      recentTopics: [],
      commonGaps: [],
    };
  }

  // Calculate average gap score
  let totalGapScore = 0;
  let probeCount = 0;
  const allSignals: string[] = [];

  for (const session of sessions) {
     
    const probes = session.probes as any[];
    if (probes) {
      for (const probe of probes) {
        totalGapScore += probe.gap_score || 0;
        probeCount++;
        if (probe.signals) {
          allSignals.push(...probe.signals);
        }
      }
    }
  }

  const avgGapScore = probeCount > 0 ? totalGapScore / probeCount : 0.5;

  // Determine trend by comparing recent sessions to older ones
  let trend: "improving" | "declining" | "stable" = "stable";
  
  if (sessionCount >= 4) {
    const recentSessions = sessions.slice(0, Math.floor(sessionCount / 2));
    const olderSessions = sessions.slice(Math.floor(sessionCount / 2));

    const recentAvg = calculateAvgGap(recentSessions);
    const olderAvg = calculateAvgGap(olderSessions);

    if (recentAvg < olderAvg - 0.1) {
      trend = "improving"; // Lower gap = better understanding
    } else if (recentAvg > olderAvg + 0.1) {
      trend = "declining";
    }
  }

  // Get recent topics
  const recentTopics = sessions.slice(0, 5).map(s => s.problem);

  // Get common gaps (most frequent signals)
  const signalCounts = new Map<string, number>();
  for (const signal of allSignals) {
    signalCounts.set(signal, (signalCounts.get(signal) || 0) + 1);
  }
  const commonGaps = Array.from(signalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signal]) => signal);

  return {
    sessionCount,
    avgGapScore: Math.round(avgGapScore * 100) / 100,
    trend,
    recentTopics,
    commonGaps,
  };
}

 
function calculateAvgGap(sessions: { probes: { gap_score: number }[] }[]): number {
  let total = 0;
  let count = 0;
  for (const session of sessions) {
     
    const probes = session.probes as any[];
    if (probes) {
      for (const probe of probes) {
        total += probe.gap_score || 0;
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0.5;
}

