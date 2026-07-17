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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const timestamp = Date.now();
  const contentType = audioBlob.type || "audio/mp4";
  const ext = mimeToExtension(contentType);
  const path = `${user.id}/${sessionId}_${timestamp}.${ext}`;

  console.log("[saveSessionAudio] Saving audio:", { sessionId, path, contentType, size: audioBlob.size });

  const { error } = await supabase.storage
    .from("session-audio")
    .upload(path, audioBlob, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("[saveSessionAudio] Upload error:", error);
    throw new Error(error.message);
  }

  console.log("[saveSessionAudio] Upload success, updating session...");

  // Update session with audio path
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ audio_path: path })
    .eq("id", sessionId);

  if (updateError) {
    console.error("[saveSessionAudio] Update session error:", updateError);
    throw new Error(updateError.message);
  }

  console.log("[saveSessionAudio] Done!");

  return path;
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

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("[saveAudioChunk] Auth error:", authError);
    throw new Error("Not authenticated");
  }
  if (!user) throw new Error("Not authenticated");

  const ts = Date.now();
  const contentType = chunkBlob.type || "audio/mp4";
  const ext = mimeToExtension(contentType);
  const path = `${user.id}/${sessionId}/chunk_${chunkIndex}_${ts}.${ext}`;

  console.log("[saveAudioChunk] Saving:", { sessionId, chunkIndex, path, size: chunkBlob.size, contentType });

  const { error } = await supabase.storage
    .from("session-audio")
    .upload(path, chunkBlob, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("[saveAudioChunk] Upload error:", error);
    throw error;
  }

  // Insert record to session_audio so the chunk remains linked to the session.
  const { error: insertError } = await supabase
    .from("session_audio")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      storage_path: path,
      chunk_index: chunkIndex,
      timestamp_ms: timestamp,
    });

  if (insertError) {
    console.error("[saveAudioChunk] Failed to insert session_audio record:", insertError);
    // Don't throw - the file is uploaded, just log the warning
  }

  console.log("[saveAudioChunk] Success:", path);
  return path;
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
  const supabase = createClient();

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("audio_path")
    .eq("id", sessionId)
    .single();

  if (!sessionRow?.audio_path) return null;

  const { data, error } = await supabase.storage
    .from("session-audio")
    .download(sessionRow.audio_path);

  if (error || !data) return null;
  return data;
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
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("session_screenshots")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    console.error("[getSessionScreenshots] Error:", error);
    return [];
  }

   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    timestamp: row.timestamp_ms,
    xaiFileId: row.xai_file_id,
    createdAt: row.created_at,
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
  const supabase = createClient();
  const cutoffTime = Date.now() - ms;
  
  const { data, error } = await supabase
    .from("session_audio")
    .select("*")
    .eq("session_id", sessionId)
    .gte("timestamp_ms", cutoffTime)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    console.error("[getRecentAudioChunks] Error:", error);
    return [];
  }

   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
    chunkIndex: row.chunk_index,
  }));
}

export async function getRecentTranscripts(sessionId: string, ms: number): Promise<RecentTranscript[]> {
  const supabase = createClient();
  const cutoffTime = Date.now() - ms;

  const { data, error } = await supabase
    .from("session_transcript")
    .select("id, session_id, xai_file_id, word_count, timestamp_ms")
    .eq("session_id", sessionId)
    .gte("timestamp_ms", cutoffTime)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row: { id: string; session_id: string; xai_file_id: string; word_count: number; timestamp_ms: number }) => ({
    id: row.id,
    sessionId: row.session_id,
    xaiFileId: row.xai_file_id,
    wordCount: row.word_count,
    timestamp: row.timestamp_ms,
  }));
}

export async function getRecentToolEvents(sessionId: string, ms: number): Promise<RecentToolEvent[]> {
  const supabase = createClient();
  const cutoffTime = Date.now() - ms;

  const { data, error } = await supabase
    .from("session_tool")
    .select("*")
    .eq("session_id", sessionId)
    .gte("timestamp_ms", cutoffTime)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    console.error("[getRecentToolEvents] Error:", error);
    return [];
  }

   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    toolName: row.tool_name,
    toolAction: row.tool_action,
    xaiFileId: row.xai_file_id,
  }));
}

export async function getRecentFacialData(sessionId: string, ms: number): Promise<RecentFacialData[]> {
  const supabase = createClient();
  const cutoffTime = Date.now() - ms;

  const { data, error } = await supabase
    .from("session_facial")
    .select("*")
    .eq("session_id", sessionId)
    .gte("timestamp_ms", cutoffTime)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    console.error("[getRecentFacialData] Error:", error);
    return [];
  }

   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    xaiFileId: row.xai_file_id,
  }));
}

export async function getRecentEEGData(sessionId: string, ms: number): Promise<RecentEEGData[]> {
  const supabase = createClient();
  const cutoffTime = Date.now() - ms;

  const { data, error } = await supabase
    .from("session_eeg")
    .select("*")
    .eq("session_id", sessionId)
    .gte("timestamp_ms", cutoffTime)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    console.error("[getRecentEEGData] Error:", error);
    return [];
  }

   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    xaiFileId: row.xai_file_id,
    chunkIndex: row.chunk_index,
    bandPowers: row.band_powers,
  }));
}

export async function getRecentScreenshots(sessionId: string, ms: number): Promise<SessionScreenshot[]> {
  const supabase = createClient();
  const cutoffTime = Date.now() - ms;

  const { data, error } = await supabase
    .from("session_screenshots")
    .select("*")
    .eq("session_id", sessionId)
    .gte("timestamp_ms", cutoffTime)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    console.error("[getRecentScreenshots] Error:", error);
    return [];
  }

   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    timestamp: row.timestamp_ms,
    xaiFileId: row.xai_file_id,
    createdAt: row.created_at,
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

  // Remove the screenshot DB rows for this session
  await supabase
    .from("session_screenshots")
    .delete()
    .eq("session_id", sessionId);

  console.log("[deleteSessionScreenshots] Deleted screenshots for session:", sessionId);
}

// ---- Full Session Data Fetching (for Analytics) ----

export async function getAllTranscripts(sessionId: string): Promise<RecentTranscript[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_transcript")
    .select("id, session_id, xai_file_id, word_count, timestamp_ms")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) return [];
  return data.map((row: { id: string; session_id: string; xai_file_id: string; word_count: number; timestamp_ms: number }) => ({
    id: row.id,
    sessionId: row.session_id,
    xaiFileId: row.xai_file_id,
    wordCount: row.word_count,
    timestamp: row.timestamp_ms,
  }));
}

export async function getAllEEGData(sessionId: string): Promise<RecentEEGData[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_eeg")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) return [];
   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    xaiFileId: row.xai_file_id,
    chunkIndex: row.chunk_index,
    bandPowers: row.band_powers,
  }));
}

export async function getAllFacialData(sessionId: string): Promise<RecentFacialData[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_facial")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) return [];
   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    xaiFileId: row.xai_file_id,
  }));
}

export async function getAllToolEvents(sessionId: string): Promise<RecentToolEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_tool")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) return [];
   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    toolName: row.tool_name,
    toolAction: row.tool_action,
    xaiFileId: row.xai_file_id,
  }));
}

export async function getAllAudioChunks(sessionId: string): Promise<RecentAudioChunk[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_audio")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) return [];
   
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
    chunkIndex: row.chunk_index,
  }));
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
      probes (gap_score, signals)
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

