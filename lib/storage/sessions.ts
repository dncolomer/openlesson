// Session & probe persistence (client-side Supabase helpers)
import { createClient } from "@/lib/supabase/client";
import {
  type Probe,
  type Session,
  type SessionStatus,
  isUuid,
} from "@/lib/domain/types";
import { logToolUsage } from "@/lib/storage/media";

// ---- Helpers: map DB rows → Session ----

 
function mapDbSession(s: any, probes: Probe[] = []): Session {
  const metadata = s.metadata || {};
  const storedObjectives = metadata.objectives;
  return {
    id: s.id,
    problem: s.problem,
    startedAt: s.created_at,
    endedAt: s.ended_at ?? undefined,
    durationMs: s.duration_ms || 0,
    status: s.status || "completed",
    probes,
    objectives: Array.isArray(storedObjectives) ? storedObjectives : [],
    hasAudio: !!s.audio_path,
    audioPath: s.audio_path ?? undefined,
    report: s.report ?? undefined,
    reportGeneratedAt: s.report_generated_at ?? undefined,
    transcript: s.transcript ?? undefined,
    workspaceTitle: metadata.title ?? undefined,
    planningPrompt: s.planning_prompt ?? undefined,
    metadata: metadata,
  };
}

 
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

export async function createSession(problem: string, title?: string, planningPrompt?: string, tutoringLanguage?: string, workspaceId?: string): Promise<Session> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const metadata: Record<string, unknown> = {};
  if (title) metadata.title = title;
  if (tutoringLanguage) metadata.tutoringLanguage = tutoringLanguage;
  if (workspaceId) metadata.workspace_id = workspaceId;

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

  // Delete audio from Supabase Storage (audio still lives there)
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("audio_path")
    .eq("id", id)
    .single();

  if (sessionRow?.audio_path) {
    await supabase.storage.from("session-audio").remove([sessionRow.audio_path]);
  }

  // Delete xAI files (transcripts, eeg, tool, facial, screens) — done via API route
  // since we can't expose XAI_API_KEY to the browser.
  try {
    await fetch(`/api/session-files/cleanup?sessionId=${id}`, { method: "POST" });
  } catch (e) {
    console.warn("[deleteSession] xAI cleanup failed (non-critical):", e);
  }

  // Cascade delete handles all DB rows
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
  // Guard against non-UUID ids (e.g. "1", "probe_1") that can sneak in
  // from LLM output when a probe list was rendered without real UUIDs.
  if (!isUuid(probeId)) {
    console.warn(`[archiveProbe] skipping non-UUID probeId: ${JSON.stringify(probeId)}`);
    return;
  }

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
 * preserving the original `problem`, `metadata.workspaceTitle`, and ownership.
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

  // Cleanup xAI files for this session (transcripts, eeg, tool, facial, screens)
  try {
    await fetch(`/api/session-files/cleanup?sessionId=${id}`, { method: "POST" });
  } catch (e) {
    console.warn("[restartSession] xAI cleanup failed (non-critical):", e);
  }

  // Delete children explicitly (no ON DELETE CASCADE triggers on UPDATE)
  await supabase.from("probes").delete().eq("session_id", id);
  await supabase.from("session_eeg").delete().eq("session_id", id);
  await supabase.from("session_transcript").delete().eq("session_id", id);
  await supabase.from("session_facial").delete().eq("session_id", id);
  await supabase.from("session_tool").delete().eq("session_id", id);
  await supabase.from("session_screenshots").delete().eq("session_id", id);
  await supabase.from("session_analysis").delete().eq("session_id", id);
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

export async function updateSessionStatus(sessionId: string, status: SessionStatus, durationMs?: number): Promise<void> {
  const supabase = createClient();
  const update: { status: SessionStatus; duration_ms?: number } = { status };
  if (typeof durationMs === "number") update.duration_ms = durationMs;

  await supabase
    .from("sessions")
    .update(update)
    .eq("id", sessionId);
}

export async function pauseSession(sessionId: string, durationMs?: number): Promise<void> {
  await updateSessionStatus(sessionId, "paused", durationMs);
}

export async function resumeSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, "active");
}

// ---- In-memory session helpers (for active recording) ----

