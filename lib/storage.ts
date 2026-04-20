// ============================================
// SUPABASE-ONLY SESSION STORAGE
// All data lives in Supabase DB + Storage
// ============================================

import { createClient } from "@/lib/supabase/client";
import { generateEmbedding } from "@/lib/openrouter-client";

// ---- Types ----

// Request types for the session planner
export type RequestType = "question" | "task" | "suggestion" | "checkpoint" | "feedback";

export interface Probe {
  id: string;
  timestamp: number; // ms since session start
  gapScore: number;
  signals: string[];
  text: string;
  expandedText?: string;
  starred?: boolean;
  isRevealed?: boolean; // user has clicked to reveal this question
  requestType?: RequestType; // type of request (question, task, suggestion, checkpoint, feedback)
  planStepId?: string; // links to SessionPlanStep.id for step context
  archived?: boolean; // probe has been resolved/archived
  focused?: boolean; // user is focusing on this probe for analysis context
  suggestedTools?: ToolName[]; // ILE tools that would help with this probe (ephemeral, not persisted)
}

// Session Plan types for the Session Planner feature
export interface SessionPlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  type: RequestType;
  order: number;
}

export interface SessionPlan {
  id: string;
  sessionId: string;
  userId: string;
  goal: string;
  strategy: string;
  description?: string; // Brief summary for display purposes
  steps: SessionPlanStep[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validates that plan steps are safe to persist to the database.
 * Throws an error if steps are empty or any step has an empty description.
 * This is the last line of defense — no invalid steps should ever reach the DB.
 */
export function validatePlanSteps(steps: SessionPlanStep[]): void {
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    throw new Error("Cannot persist plan with empty steps array");
  }
  const emptyDescriptions = steps.filter(s => !s.description || !s.description.trim());
  if (emptyDescriptions.length > 0) {
    throw new Error(
      `Cannot persist plan: ${emptyDescriptions.length}/${steps.length} steps have empty descriptions`
    );
  }
}

export type SessionStatus = "active" | "paused" | "completed";
export type ObserverMode = "off" | "passive" | "active";
export type Frequency = "rare" | "balanced" | "frequent";

export interface Session {
  id: string;
  problem: string;
  startedAt: string; // ISO string
  endedAt?: string;
  durationMs: number;
  status: SessionStatus;
  probes: Probe[];
  objectives: string[];
  hasAudio: boolean;
  audioPath?: string;
  report?: string;
  reportGeneratedAt?: string;
  transcript?: string;
  planTitle?: string;
  planningPrompt?: string; // Custom instructions for plan generation
  metadata: {
    observerMode?: ObserverMode;
    frequency?: Frequency;
    eegSummary?: Record<string, number> | null;
    whiteboardData?: string | null;
    notebookData?: string | null;
    tutoringLanguage?: string;
    autoAdvance?: boolean;
  };
}

// ---- Helpers: map DB rows → Session ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbSession(s: any, probes: Probe[] = []): Session {
  const metadata = s.metadata || {};
  return {
    id: s.id,
    problem: s.problem,
    startedAt: s.created_at,
    endedAt: s.ended_at ?? undefined,
    durationMs: s.duration_ms || 0,
    status: s.status || "completed",
    probes,
    objectives: s.objectives || [],
    hasAudio: !!s.audio_path,
    audioPath: s.audio_path ?? undefined,
    report: s.report ?? undefined,
    reportGeneratedAt: s.report_generated_at ?? undefined,
    transcript: s.transcript ?? undefined,
    planTitle: metadata.title ?? undefined,
    planningPrompt: s.planning_prompt ?? undefined,
    metadata: metadata,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbProbe(p: any): Probe {
  return {
    id: p.id,
    timestamp: p.timestamp_ms,
    gapScore: p.gap_score,
    signals: p.signals || [],
    text: p.text,
    expandedText: p.expanded_text ?? undefined,
    starred: p.starred ?? false,
    isRevealed: p.is_revealed ?? false,
    requestType: p.request_type ?? "question",
    planStepId: p.plan_step_id ?? undefined,
    archived: p.archived ?? false,
    focused: p.focused ?? false,
  };
}

// ---- Session CRUD ----

export async function createSession(problem: string, title?: string, planningPrompt?: string, tutoringLanguage?: string): Promise<Session> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const metadata: Record<string, unknown> = {};
  if (title) metadata.title = title;
  if (tutoringLanguage) metadata.tutoringLanguage = tutoringLanguage;

  const { data, error } = await supabase
    .from("sessions")
    .insert({ 
      user_id: user.id, 
      problem, 
      status: "active",
      planning_prompt: planningPrompt || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create session");
  return mapDbSession(data);
}

export async function getSession(id: string): Promise<Session | null> {
  const supabase = createClient();

  const { data: sessionRow, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  console.log("[getSession] DB row:", { id, error, hasAudio: sessionRow?.audio_path });

  if (!sessionRow) return null;

  const { data: probeRows } = await supabase
    .from("probes")
    .select("*")
    .eq("session_id", id)
    .order("timestamp_ms", { ascending: true });

  return mapDbSession(sessionRow, (probeRows || []).map(mapDbProbe));
}

export async function getSessions(): Promise<Session[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!sessionRows) return [];

  // Batch-load all probes for these sessions
  const sessionIds = sessionRows.map((s: { id: string }) => s.id);
  const { data: allProbes } = await supabase
    .from("probes")
    .select("*")
    .in("session_id", sessionIds)
    .order("timestamp_ms", { ascending: true });

  const probesBySession = new Map<string, Probe[]>();
  for (const p of allProbes || []) {
    const mapped = mapDbProbe(p);
    const existing = probesBySession.get(p.session_id) || [];
    existing.push(mapped);
    probesBySession.set(p.session_id, existing);
  }

  return sessionRows.map((s: { id: string }) => mapDbSession(s, probesBySession.get(s.id) || []));
}

export async function saveSession(session: Session): Promise<void> {
  const supabase = createClient();

  await supabase
    .from("sessions")
    .update({
      problem: session.problem,
      status: session.status,
      duration_ms: session.durationMs,
      ended_at: session.endedAt || null,
      audio_path: session.audioPath || null,
      report: session.report || null,
      report_generated_at: session.reportGeneratedAt || null,
      transcript: session.transcript || null,
      metadata: session.metadata,
    })
    .eq("id", session.id);
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Delete audio from Storage
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("audio_path")
    .eq("id", id)
    .single();

  if (sessionRow?.audio_path) {
    await supabase.storage.from("session-audio").remove([sessionRow.audio_path]);
  }

  // Delete EEG data from Storage
  const { data: eegRows } = await supabase
    .from("session_eeg")
    .select("storage_path")
    .eq("session_id", id);

  if (eegRows && eegRows.length > 0) {
    await supabase.storage
      .from("session-eeg")
      .remove(eegRows.map((r: { storage_path: string }) => r.storage_path));
  }

  // Cascade delete handles probes, eeg rows
  await supabase.from("sessions").delete().eq("id", id);
}

// ---- Probe CRUD ----

export async function addProbe(
  sessionId: string,
  probe: Omit<Probe, "id">
): Promise<Probe> {
  // Validate that probe text is not empty
  const probeText = probe.text?.trim();
  if (!probeText) {
    throw new Error("Cannot create probe with empty text");
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("probes")
    .insert({
      session_id: sessionId,
      timestamp_ms: probe.timestamp,
      gap_score: probe.gapScore,
      signals: probe.signals,
      text: probeText,
      expanded_text: probe.expandedText || null,
      request_type: probe.requestType || "question",
      plan_step_id: probe.planStepId || null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to insert probe");
  
  const savedProbe = mapDbProbe(data);
  
  await logToolUsage(
    sessionId,
    "probe",
    "generate",
    probe.timestamp,
    {
      probeId: savedProbe.id,
      timestamp: probe.timestamp,
      content: {
        text: probeText,
        gapScore: probe.gapScore,
        signals: probe.signals,
        requestType: probe.requestType || "question",
        planStepId: probe.planStepId,
      },
    }
  );
  
  return savedProbe;
}

export async function updateProbeExpanded(probeId: string, expandedText: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ expanded_text: expandedText })
    .eq("id", probeId);
}

export async function toggleProbeStarred(probeId: string, starred: boolean): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ starred })
    .eq("id", probeId);
}

export async function updateProbeRevealed(probeId: string, isRevealed: boolean): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ is_revealed: isRevealed })
    .eq("id", probeId);
}

export async function archiveProbe(probeId: string): Promise<void> {
  const supabase = createClient();
  
  const { data: probe } = await supabase
    .from("probes")
    .select("session_id, timestamp_ms, text, gap_score, signals, request_type, plan_step_id")
    .eq("id", probeId)
    .single();
  
  if (!probe) return;
  
  const archivedAt = Date.now();
  
  await supabase
    .from("probes")
    .update({ archived: true })
    .eq("id", probeId);
    
  await logToolUsage(
    probe.session_id,
    "probe",
    "archive",
    archivedAt,
    {
      probeId,
      timestamp: probe.timestamp_ms,
      archivedAt,
      content: {
        text: probe.text,
        gapScore: probe.gap_score,
        signals: probe.signals,
        requestType: probe.request_type,
        planStepId: probe.plan_step_id,
      },
    }
  );
}

export async function unarchiveProbe(probeId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ archived: false })
    .eq("id", probeId);
}

export async function toggleProbeFocused(probeId: string, focused: boolean): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ focused })
    .eq("id", probeId);
}

export async function resetSessionProbes(sessionId: string): Promise<void> {
  const supabase = createClient();
  // Delete all probes for this session (keeps audio/EEG data intact)
  await supabase
    .from("probes")
    .delete()
    .eq("session_id", sessionId);
}

/**
 * Destructively restart a session: wipes probes, transcripts, plans,
 * EEG recordings, audio, and resets the session row to `active` while
 * preserving the original `problem`, `metadata.planTitle`, and ownership.
 *
 * This is irreversible — the report, transcript, probes, and recordings
 * are permanently deleted. Callers should confirm with the user first.
 */
export async function restartSession(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch audio path to remove from Storage
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("audio_path")
    .eq("id", id)
    .single();

  if (sessionRow?.audio_path) {
    await supabase.storage.from("session-audio").remove([sessionRow.audio_path]);
  }

  // Remove EEG blobs from Storage, then their rows
  const { data: eegRows } = await supabase
    .from("session_eeg")
    .select("storage_path")
    .eq("session_id", id);

  if (eegRows && eegRows.length > 0) {
    await supabase.storage
      .from("session-eeg")
      .remove(eegRows.map((r: { storage_path: string }) => r.storage_path));
  }

  // Delete children explicitly (no ON DELETE CASCADE triggers on UPDATE)
  await supabase.from("probes").delete().eq("session_id", id);
  await supabase.from("session_eeg").delete().eq("session_id", id);
  await supabase.from("session_transcripts").delete().eq("session_id", id);
  await supabase.from("session_plans").delete().eq("session_id", id);

  // Reset the session row to a fresh "active" state.
  // We preserve: problem, user_id, plan linkage, created_at, metadata (minus any run-specific fields).
  await supabase
    .from("sessions")
    .update({
      status: "active",
      duration_ms: 0,
      ended_at: null,
      audio_path: null,
      report: null,
      report_generated_at: null,
      transcript: null,
      session_started_at: null,
    })
    .eq("id", id);
}

export async function startSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("sessions")
    .update({ status: "active" })
    .eq("id", sessionId);
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("sessions")
    .update({ status })
    .eq("id", sessionId);
}

export async function pauseSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, "paused");
}

export async function resumeSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, "active");
}

// ---- In-memory session helpers (for active recording) ----

export function addProbeToSession(
  session: Session,
  probe: Probe
): Session {
  return {
    ...session,
    probes: [...session.probes, probe],
  };
}

export function endSession(
  session: Session,
  durationMs: number,
  status: SessionStatus = "completed"
): Session {
  return {
    ...session,
    endedAt: new Date().toISOString(),
    durationMs,
    status,
  };
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
  const path = `${user.id}/${sessionId}_${timestamp}.webm`;
  const contentType = audioBlob.type || "audio/webm";

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
  const path = `${user.id}/${sessionId}/chunk_${chunkIndex}_${ts}.webm`;
  const contentType = chunkBlob.type || "audio/webm";

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

  // Insert record to session_audio table so transcribe-chunks can find it
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

export interface FacialDataPoint {
  timestamp: number;
  facePresent: boolean;
  
  // Raw low-level indicators
  eyeOpennessLeft: number;
  eyeOpennessRight: number;
  gazeOffsetX: number;
  gazeOffsetY: number;
  mouthOpenness: number;
  mouthCornerLeft: number;
  mouthCornerRight: number;
  eyebrowLeftInner: number;
  eyebrowLeftOuter: number;
  eyebrowRightInner: number;
  eyebrowRightOuter: number;
  noseTipY: number;
  faceWidth: number;
  faceHeight: number;
  pupilLeftX: number;
  pupilLeftY: number;
  pupilRightX: number;
  pupilRightY: number;
  lipCornerLeftX: number;
  lipCornerLeftY: number;
  lipCornerRightX: number;
  lipCornerRightY: number;
  upperLipY: number;
  lowerLipY: number;
  
  // Head pose
  headPitch: number;
  headYaw: number;
  headRoll: number;
  
  // Derived states
  gazeDirection: "at_camera" | "away" | "unknown";
  headPose: { pitch: number; yaw: number; roll: number };
  mouthState: "open" | "closed";
  faceDistance: "optimal" | "too_close" | "too_far";
  
  // Inferred high-level indicators
  emotion: "neutral" | "happy" | "confused" | "frustrated" | "surprised" | "bored" | "thinking";
  attentionLevel: "high" | "medium" | "low";
  confusionScore: number;
  frustrationScore: number;
  engagementScore: number;
  processingScore: number;
  smileScore: number;
}

export async function saveFacialData(
  sessionId: string,
  facialData: FacialDataPoint[],
  chunkIndex: number,
  timestamp: number
): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/${sessionId}/facial_chunk_${chunkIndex}_${timestamp}.json`;
  const payload = { sessionId, timestamp, data: facialData };

  const { error } = await supabase.storage
    .from("session-facial")
    .upload(path, JSON.stringify(payload), { contentType: "application/json", upsert: false });

  if (error) {
    console.error("[saveFacialData] Upload error:", error);
    throw new Error(`Facial data upload failed: ${error.message}`);
  }
  return path;
}

// ---- Tool Usage Tracking ----

export type ToolName = "chat" | "canvas" | "notebook" | "grokipedia" | "exercise" | "reading" | "rag" | "help" | "data-input" | "logs" | "goals" | "probe" | "session_plan";

export type ToolAction =
  | "open"
  | "close"
  | "send_message"
  | "canvas_draw"
  | "canvas_save"
  | "notebook_edit"
  | "notebook_save"
  | "rag_query"
  | "rag_select_chunk"
  | "prep_material_load"
  | "help_view"
  | "generate"
  | "archive"
  | "advance"
  | "revert"
  // Probe / Tutor panel interactions
  | "open_resources"
  | "open_practice"
  | "ask_assistant"
  | "toggle_focus"
  | "nav_prev"
  | "nav_next"
  | "nav_jump"
  // Session plan panel interactions
  | "step_expand"
  | "step_collapse"
  | "rollback"
  | "force_advance"
  | "cancel_advance";

export interface LogToolUsageResult {
  /** True only if BOTH the storage upload and the DB insert succeeded. */
  success: boolean;
  /** True if the Storage upload itself succeeded (independent of DB insert). */
  uploadOk: boolean;
  /** True if the `session_tool` row insert succeeded. */
  insertOk: boolean;
  /** Primary error message, if any. */
  error?: string;
}

export async function logToolUsage(
  sessionId: string,
  toolName: ToolName,
  toolAction: ToolAction,
  timestampMs: number,
  toolData: Record<string, unknown> = {}
): Promise<LogToolUsageResult> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, uploadOk: false, insertOk: false, error: "not authenticated" };
    }

    const toolDataJson = JSON.stringify(toolData);
    const toolStoragePath = `${user.id}/${sessionId}/tool_${timestampMs}.json`;

    let uploadOk = false;
    let uploadError: string | undefined;
    try {
      const { error } = await supabase.storage
        .from("session-tool")
        .upload(toolStoragePath, toolDataJson, {
          contentType: "application/json",
          upsert: true,
        });
      if (error) {
        uploadError = error.message;
      } else {
        uploadOk = true;
      }
    } catch (e) {
      uploadError = String((e as Error)?.message ?? e);
    }

    let insertOk = false;
    let insertError: string | undefined;
    const { error: dbError } = await supabase
      .from("session_tool")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        timestamp_ms: timestampMs,
        storage_path: toolStoragePath,
        tool_name: toolName,
        tool_action: toolAction,
        metadata: toolData,
      });
    if (dbError) {
      insertError = dbError.message;
    } else {
      insertOk = true;
    }

    const success = uploadOk && insertOk;
    const error = !success
      ? [uploadError && `upload: ${uploadError}`, insertError && `db: ${insertError}`]
          .filter(Boolean)
          .join("; ") || undefined
      : undefined;

    return { success, uploadOk, insertOk, error };
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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const eegDataJson = JSON.stringify({
      timestamp_ms: timestampMs,
      chunk_index: chunkIndex,
      band_powers: bandPowers,
    });
    const eegStoragePath = `${user.id}/${sessionId}/eeg_chunk_${chunkIndex}_${timestampMs}.json`;

    try {
      await supabase.storage
        .from("session-eeg")
        .upload(eegStoragePath, eegDataJson, {
          contentType: "application/json",
          upsert: true,
        });
    } catch (e) {
      console.warn("[logEEGData] Storage upload failed (non-critical):", e);
    }

    const { error } = await supabase
      .from("session_eeg")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        timestamp_ms: timestampMs,
        storage_path: eegStoragePath,
        chunk_index: chunkIndex,
        band_powers: bandPowers,
      });

    if (error) {
      console.warn("[logEEGData] DB insert failed (non-critical):", error.message);
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
  eegData: { channels: Record<string, number[]>; bandPowers: Record<string, number> | null },
  deviceName?: string,
  chunkIndex?: number,
  timestamp?: number
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const ts = timestamp || Date.now();
  const idx = chunkIndex ?? 0;
  const path = `${user.id}/${sessionId}/eeg_chunk_${idx}_${ts}.json`;
  const blob = new Blob([JSON.stringify(eegData)], { type: "application/json" });

  console.log("[saveSessionEEG] Saving:", { sessionId, path, deviceName, channels: Object.keys(eegData.channels) });

  await supabase.storage
    .from("session-eeg")
    .upload(path, blob, { contentType: "application/json", upsert: true });

  const sampleCount = Object.values(eegData.channels)[0]?.length || 0;

  await supabase.from("session_eeg").insert({
    session_id: sessionId,
    user_id: user.id,
    timestamp_ms: ts,
    storage_path: path,
    chunk_index: idx,
    device_name: deviceName || null,
    sample_count: sampleCount,
    band_powers: eegData.bandPowers,
  });

  // Also save summary into session metadata
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

export interface SessionScreenshot {
  id: string;
  sessionId: string;
  userId: string;
  timestamp: number;
  storagePath: string;
  createdAt: string;
}

export async function saveScreenshot(
  sessionId: string,
  screenshotBlob: Blob,
  timestamp: number
): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/${sessionId}/screen_${timestamp}.png`;
  const contentType = "image/png";

  console.log("[saveScreenshot] Saving:", { sessionId, path, size: screenshotBlob.size });

  const { error } = await supabase.storage
    .from("session-screens")
    .upload(path, screenshotBlob, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("[saveScreenshot] Upload error:", error);
    // Don't throw - screenshots are optional
    return null;
  }

  // Also record in database for easier querying
  const { error: dbError } = await supabase
    .from("session_screenshots")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      timestamp_ms: timestamp,
      storage_path: path,
    });

  if (dbError) {
    console.error("[saveScreenshot] DB insert error:", dbError);
    // Screenshot is saved, just not recorded - continue
  }

  console.log("[saveScreenshot] Done!");
  return path;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  }));
}

export async function getScreenshotUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  
  const { data } = await supabase.storage
    .from("session-screens")
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  return data?.signedUrl || null;
}

// ---- Recent Data Fetching for Analysis ----

export interface RecentAudioChunk {
  id: string;
  sessionId: string;
  timestamp: number;
  storagePath: string;
  chunkIndex: number;
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
    chunkIndex: row.chunk_index,
  }));
}

export interface RecentTranscript {
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
}

export async function getRecentTranscripts(sessionId: string, ms: number): Promise<RecentTranscript[]> {
  const supabase = createClient();
  const cutoffTime = Date.now() - ms;
  
  const { data, error } = await supabase
    .from("session_transcript")
    .select("id, session_id, content, timestamp_ms")
    .eq("session_id", sessionId)
    .gte("timestamp_ms", cutoffTime)
    .not("content", "is", null)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row: { id: string; session_id: string; content: string; timestamp_ms: number }) => ({
    id: row.id,
    sessionId: row.session_id,
    content: row.content,
    timestamp: row.timestamp_ms,
  }));
}

export interface RecentToolEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  toolName: string;
  toolAction: string;
  storagePath: string;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    toolName: row.tool_name,
    toolAction: row.tool_action,
    storagePath: row.storage_path,
  }));
}

export interface RecentFacialData {
  id: string;
  sessionId: string;
  timestamp: number;
  storagePath: string;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
  }));
}

export interface RecentEEGData {
  id: string;
  sessionId: string;
  timestamp: number;
  storagePath: string;
  chunkIndex: number;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
    chunkIndex: row.chunk_index,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  }));
}

export async function deleteSessionScreenshots(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get all screenshot paths for this session
  const { data: screenshots } = await supabase
    .from("session_screenshots")
    .select("storage_path")
    .eq("session_id", sessionId);

  if (screenshots && screenshots.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paths = screenshots.map((s: any) => s.storage_path as string);
    
    // Delete from storage
    await supabase.storage
      .from("session-screens")
      .remove(paths);

    // Delete from database
    await supabase
      .from("session_screenshots")
      .delete()
      .eq("session_id", sessionId);
  }

  console.log("[deleteSessionScreenshots] Deleted screenshots for session:", sessionId);
}

// ---- Full Session Data Fetching (for Analytics) ----

export async function getAllTranscripts(sessionId: string): Promise<RecentTranscript[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_transcript")
    .select("id, session_id, content, timestamp_ms")
    .eq("session_id", sessionId)
    .not("content", "is", null)
    .order("timestamp_ms", { ascending: true });

  if (error || !data) return [];
  return data.map((row: { id: string; session_id: string; content: string; timestamp_ms: number }) => ({
    id: row.id,
    sessionId: row.session_id,
    content: row.content,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    toolName: row.tool_name,
    toolAction: row.tool_action,
    storagePath: row.storage_path,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp_ms,
    storagePath: row.storage_path,
    chunkIndex: row.chunk_index,
  }));
}

// ---- Analytics Helpers ----

export function getSessionStats(session: Session) {
  const probeCount = session.probes.length;
  const avgGapScore =
    probeCount > 0
      ? session.probes.reduce((sum, p) => sum + p.gapScore, 0) / probeCount
      : 0;

  const durationMinutes = Math.round(session.durationMs / 60000);
  const probesPerMinute = durationMinutes > 0 ? probeCount / durationMinutes : 0;

  const peakProbe = session.probes.reduce(
    (max, p) => (p.gapScore > max.gapScore ? p : max),
    { gapScore: 0 } as Probe
  );

  return {
    probeCount,
    avgGapScore: Math.round(avgGapScore * 100) / 100,
    durationMinutes,
    probesPerMinute: Math.round(probesPerMinute * 10) / 10,
    peakGapScore: peakProbe.gapScore,
    peakGapTime: peakProbe.timestamp,
  };
}

// ---- RAG: Retrieve Relevant Transcript Chunks ----

export interface RetrievedChunk {
  id: string;
  content: string;
  sessionId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface RetrieveOptions {
  limit?: number;
  sessionId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any;
}

export async function retrieveRelevantChunks(
  userId: string,
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { limit = 3, sessionId = null, supabaseClient } = options;

  // Use provided supabase client or create new one
  const supabase = supabaseClient || createClient();

  console.log("[retrieveRelevantChunks] Query:", query);
  console.log("[retrieveRelevantChunks] UserId:", userId);
  console.log("[retrieveRelevantChunks] SessionId:", sessionId);

  // Check if any transcript chunks exist for this user
  const { count, error: countError } = await supabase
    .from("transcript_rag_chunks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  
  console.log("[retrieveRelevantChunks] Total chunks for user:", count, "error:", countError);

  // Check how many have embeddings
  const { count: embedCount, error: embedError } = await supabase
    .from("transcript_rag_chunks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("embedding", "is", null);
  
  console.log("[retrieveRelevantChunks] Chunks with embeddings:", embedCount, "error:", embedError);

  // Generate embedding for the query
  const embedding = await generateEmbedding(query);
  if (!embedding) {
    console.warn("[retrieveRelevantChunks] Failed to generate embedding");
    return [];
  }

  console.log("[retrieveRelevantChunks] Generated embedding, length:", embedding.length);

  // Get all chunks with embeddings for this user (skip session filter for now to debug)
  const { data: chunks, error } = await supabase
    .from("transcript_rag_chunks")
    .select("id, session_id, content, created_at, embedding")
    .eq("user_id", userId)
    .not("embedding", "is", null)
    .limit(limit * 3);

  console.log("[retrieveRelevantChunks] Query result:", { count: chunks?.length, error });

  console.log("[retrieveRelevantChunks] Query result:", { count: chunks?.length, error, sessionIdProvided: !!sessionId });

  if (!chunks || chunks.length === 0) {
    console.log("[retrieveRelevantChunks] No chunks with embeddings, falling back to recent chunks");
    
    const { data: recentChunks, error: recentError } = await supabase
      .from("transcript_rag_chunks")
      .select("id, session_id, content, created_at")
      .eq("user_id", userId)
      .neq("session_id", sessionId || "")
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (recentError) {
      console.error("[retrieveRelevantChunks] Fallback query error:", recentError);
      return [];
    }
    
    if (!recentChunks || recentChunks.length === 0) {
      return [];
    }
    
    return recentChunks.map((c: { id: string; content: string; session_id: string; created_at: string }) => ({
      id: c.id,
      content: c.content,
      sessionId: c.session_id,
      createdAt: c.created_at,
      metadata: { similarity: 0, fallback: true },
    }));
  }

  // Calculate cosine similarity manually
  function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum: number, val: number) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum: number, val: number) => sum + val * val, 0));
    return dotProduct / (magA * magB);
  }

  const chunksWithSimilarity = chunks
    .map((c: { id: string; content: string; session_id: string; created_at: string; embedding: unknown }): { id: string; content: string; sessionId: string; createdAt: string; similarity: number } | null => {
      let emb: number[] = [];
      if (Array.isArray(c.embedding)) {
        emb = c.embedding as number[];
      } else if (typeof c.embedding === "string") {
        try {
          emb = JSON.parse(c.embedding);
        } catch {
          console.warn("[retrieveRelevantChunks] Failed to parse embedding:", c.id);
        }
      }
      if (emb.length === 0) return null;
      const sim = cosineSimilarity(embedding, emb);
      console.log("[retrieveRelevantChunks] Similarity for chunk:", c.id.slice(0, 8), "len:", emb.length, "sim:", sim);
      return {
        id: c.id,
        content: c.content,
        sessionId: c.session_id,
        createdAt: c.created_at,
        similarity: sim,
      };
    })
    .filter((c: { id: string; content: string; sessionId: string; createdAt: string; similarity: number } | null): c is { id: string; content: string; sessionId: string; createdAt: string; similarity: number } => c !== null)
    .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
    .slice(0, limit);

  console.log("[retrieveRelevantChunks] Vector search result:", chunksWithSimilarity.length, "top similarity:", chunksWithSimilarity[0]?.similarity);

  return chunksWithSimilarity.map((c: { id: string; content: string; sessionId: string; createdAt: string; similarity: number }) => ({
    id: c.id,
    content: c.content,
    sessionId: c.sessionId,
    createdAt: c.createdAt,
    metadata: { similarity: c.similarity },
  }));
}

// ---- RAG: Get User Calibration ----

export interface UserCalibration {
  sessionCount: number;
  avgGapScore: number;
  trend: "improving" | "declining" | "stable";
  recentTopics: string[];
  commonGaps: string[];
}

export async function getUserCalibration(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any
): Promise<UserCalibration> {
  const supabase = supabaseClient || createClient();

  // Get all user's sessions with probes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateAvgGap(sessions: { probes: { gap_score: number }[] }[]): number {
  let total = 0;
  let count = 0;
  for (const session of sessions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ---- Learning Plans ----

export interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: "active" | "completed" | "paused";
  created_at: string;
  is_public?: boolean;
  author_id?: string;
  author_username?: string;
  remix_count?: number;
  original_plan_id?: string;
  // YouTube/source fields
  source_type?: "topic" | "youtube";
  source_url?: string;
  source_summary?: string;
  // Plan notes (README-like)
  notes?: string;
  // AI-generated cover image
  cover_image_url?: string;
}

export interface PlanNode {
  id: string;
  plan_id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: "not_started" | "in_progress" | "completed";
}

export async function getLearningPlans(): Promise<LearningPlan[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await supabase
    .from("learning_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data || []).map((p: any) => ({
    id: p.id,
    title: p.root_topic,
    root_topic: p.root_topic,
    status: p.status || "active",
    created_at: p.created_at,
  }));
}

export async function getPlanNodes(planId: string): Promise<PlanNode[]> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await supabase
    .from("plan_nodes")
    .select("*")
    .eq("plan_id", planId);

  return (data || []).map((n: any) => ({
    id: n.id,
    plan_id: n.plan_id,
    title: n.title,
    description: n.description || "",
    is_start: n.is_start || false,
    next_node_ids: n.next_node_ids || [],
    status: n.status || "not_started",
  }));
}

export async function getIncompleteNodes(): Promise<(PlanNode & { planTitle: string })[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await supabase
    .from("learning_plans")
    .select("id, root_topic")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!plans || plans.length === 0) return [];

  const planIds = plans.map((p: any) => p.id);
  const planTitles = new Map(plans.map((p: any) => [p.id, p.root_topic]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nodes } = await supabase
    .from("plan_nodes")
    .select("*")
    .in("plan_id", planIds)
    .in("status", ["not_started", "in_progress"]);

  return (nodes || []).map((n: any) => ({
    id: n.id,
    plan_id: n.plan_id,
    title: n.title,
    description: n.description || "",
    is_start: n.is_start || false,
    next_node_ids: n.next_node_ids || [],
    status: n.status || "not_started",
    planTitle: planTitles.get(n.plan_id) || "",
  }));
}

export async function getPlanById(planId: string): Promise<LearningPlan | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("learning_plans")
    .select(`
      id,
      root_topic,
      status,
      created_at,
      is_public,
      author_id,
      user_id,
      remix_count,
      original_plan_id,
      source_type,
      source_url,
      source_summary,
      notes,
      profiles:author_id (username)
    `)
    .eq("id", planId)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    title: data.root_topic,
    root_topic: data.root_topic,
    status: data.status || "active",
    created_at: data.created_at,
    is_public: data.is_public,
    author_id: data.author_id,
    author_username: data.profiles?.username || "anonymous",
    remix_count: data.remix_count || 0,
    original_plan_id: data.original_plan_id,
    source_type: data.source_type || "topic",
    source_url: data.source_url,
    source_summary: data.source_summary,
    notes: data.notes || undefined,
  };
}

export async function updatePlanNotes(planId: string, notes: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("learning_plans")
    .update({ notes })
    .eq("id", planId)
    .eq("user_id", user.id);

  if (error) throw new Error("Failed to update plan notes: " + error.message);
}

export async function getUserById(userId: string): Promise<{ username: string } | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  return data;
}

export async function forkPlan(
  sourcePlanId: string,
  userId: string
): Promise<{ planId: string; nodesCount: number }> {
  const supabase = createClient();

  const { data: sourcePlan, error: planError } = await supabase
    .from("learning_plans")
    .select("*")
    .eq("id", sourcePlanId)
    .single();

  if (planError || !sourcePlan) {
    throw new Error("Source plan not found");
  }

  const { data: sourceNodes, error: nodesError } = await supabase
    .from("plan_nodes")
    .select("*")
    .eq("plan_id", sourcePlanId);

  if (nodesError) {
    throw new Error("Could not fetch source nodes");
  }

  const { data: newPlan, error: createError } = await supabase
    .from("learning_plans")
    .insert({
      user_id: userId,
      root_topic: sourcePlan.root_topic,
      status: "active",
      is_public: false,
      author_id: userId,
      original_plan_id: sourcePlanId,
    })
    .select()
    .single();

  if (createError) {
    throw new Error("Could not create new plan");
  }

  const nodeIdMap = new Map<string, string>();
  const newNodes = sourceNodes.map((node: any) => {
    const newId = crypto.randomUUID();
    nodeIdMap.set(node.id, newId);
    return {
      plan_id: newPlan.id,
      title: node.title,
      description: node.description,
      is_start: node.is_start,
      next_node_ids: (node.next_node_ids || []).map((id: string) => nodeIdMap.get(id) || id),
      status: "not_started",
      position_x: node.position_x,
      position_y: node.position_y,
    };
  });

  const { error: insertError } = await supabase.from("plan_nodes").insert(newNodes);

  if (insertError) {
    await supabase.from("learning_plans").delete().eq("id", newPlan.id);
    throw new Error("Could not copy nodes");
  }

  await supabase
    .from("learning_plans")
    .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
    .eq("id", sourcePlanId);

  return { planId: newPlan.id, nodesCount: newNodes.length };
}

export async function updatePlanVisibility(
  planId: string,
  userId: string,
  isPublic: boolean
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("learning_plans")
    .update({ is_public: isPublic, author_id: userId })
    .eq("id", planId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Could not update plan visibility");
  }
}

// ---- Session Plans (Session Planner feature) ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbSessionPlan(p: any): SessionPlan {
  return {
    id: p.id,
    sessionId: p.session_id,
    userId: p.user_id,
    goal: p.goal,
    strategy: p.strategy || "",
    description: p.description ?? undefined,
    steps: (p.steps || []) as SessionPlanStep[],
    currentStepIndex: p.current_step_index || 0,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function createSessionPlan(
  sessionId: string,
  plan: { goal: string; strategy: string; description?: string; steps: SessionPlanStep[] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any
): Promise<SessionPlan> {
  // Validate steps before allowing any DB write
  validatePlanSteps(plan.steps);

  const supabase = supabaseClient || createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("session_plans")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      goal: plan.goal,
      strategy: plan.strategy,
      description: plan.description || null,
      steps: plan.steps,
      current_step_index: 0,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create session plan");
  return mapDbSessionPlan(data);
}

export async function getSessionPlan(
  sessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any
): Promise<SessionPlan | null> {
  const supabase = supabaseClient || createClient();

  const { data, error } = await supabase
    .from("session_plans")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return mapDbSessionPlan(data);
}

export async function updateSessionPlan(
  planId: string,
  updates: {
    goal?: string;
    strategy?: string;
    steps?: SessionPlanStep[];
    currentStepIndex?: number;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any
): Promise<SessionPlan> {
  const supabase = supabaseClient || createClient();

  // Validate steps before allowing any DB write
  if (updates.steps !== undefined) {
    validatePlanSteps(updates.steps);
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.goal !== undefined) updateData.goal = updates.goal;
  if (updates.strategy !== undefined) updateData.strategy = updates.strategy;
  if (updates.steps !== undefined) updateData.steps = updates.steps;
  if (updates.currentStepIndex !== undefined) updateData.current_step_index = updates.currentStepIndex;

  const { data, error } = await supabase
    .from("session_plans")
    .update(updateData)
    .eq("id", planId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to update session plan");
  return mapDbSessionPlan(data);
}

// ============================================
// CONTENT-BASED DEDUPLICATION
// Avoids saving unchanged data during heartbeats
// ============================================

interface DeduplicatorCache {
  [key: string]: string;
}

const MAX_DEDUP_CACHE_SIZE = 100;
const deduplicatorCache: DeduplicatorCache = {};

/** Evict oldest entries when cache exceeds MAX_DEDUP_CACHE_SIZE */
function evictDedupCache(): void {
  const keys = Object.keys(deduplicatorCache);
  if (keys.length > MAX_DEDUP_CACHE_SIZE) {
    // Remove the first (oldest) entries to get back under the limit
    const toRemove = keys.slice(0, keys.length - MAX_DEDUP_CACHE_SIZE);
    for (const key of toRemove) {
      delete deduplicatorCache[key];
    }
  }
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface DeduplicatedSaveResult {
  saved: boolean;
  skipped: boolean;
  hash?: string;
}

export async function saveWithDedupString(
  content: string,
  key: string
): Promise<DeduplicatedSaveResult> {
  const hash = await hashContent(content);

  if (deduplicatorCache[key] === hash) {
    return { saved: false, skipped: true, hash };
  }

  deduplicatorCache[key] = hash;
  evictDedupCache();
  return { saved: true, skipped: false, hash };
}

export async function saveWithDedupBlob(
  blob: Blob,
  key: string
): Promise<DeduplicatedSaveResult> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (deduplicatorCache[key] === hash) {
    return { saved: false, skipped: true, hash };
  }

  deduplicatorCache[key] = hash;
  evictDedupCache();
  return { saved: true, skipped: false, hash };
}

export function clearDedupCache(): void {
  Object.keys(deduplicatorCache).forEach((key) => delete deduplicatorCache[key]);
  console.log("[Deduplicator] Cache cleared");
}

export function getDedupCacheSize(): number {
  return Object.keys(deduplicatorCache).length;
}
