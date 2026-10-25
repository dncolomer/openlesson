// Session & probe persistence (client-side Supabase helpers)
import { createClient } from "@/lib/supabase/client";
import {
  type Probe,
  type Session,
  type SessionStatus,
  isUuid,
} from "@/lib/domain/types";
import { logToolUsage } from "@/lib/storage/media";
import { isIleSessionUnsavedExit } from "@/lib/learn-session-name";

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
    hasAudio: false,
    audioPath: undefined,
    report: undefined,
    reportGeneratedAt: undefined,
    transcript: undefined,
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

export async function createSession(
  problem: string,
  title?: string,
  planningPrompt?: string,
  tutoringLanguage?: string,
  workspaceId?: string,
  /** Merged into session metadata (e.g. session_mode for TAP Learning Project Mode). */
  extraMetadata?: Record<string, unknown>,
): Promise<Session> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const metadata: Record<string, unknown> = { ...(extraMetadata || {}) };
  if (title) metadata.title = title;
  if (tutoringLanguage) metadata.tutoringLanguage = tutoringLanguage;
  if (workspaceId) metadata.workspace_id = workspaceId;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      problem,
      status: "active",
      kind: "learn",
      workspace_id: workspaceId || null,
      planning_prompt: planningPrompt || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      probes: [],
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

  if (error) {
    console.error("[getSession] Failed to load session:", id, error.message);
  }

  if (!sessionRow) return null;

  const probeRows = Array.isArray(sessionRow.probes) ? sessionRow.probes : [];
  return mapDbSession(sessionRow, probeRows.map(mapDbProbe));
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

  return sessionRows
    .filter((s: { metadata?: unknown }) => !isIleSessionUnsavedExit(s.metadata))
    .map((s: { id: string; probes?: unknown }) =>
      mapDbSession(s, (Array.isArray(s.probes) ? s.probes : []).map(mapDbProbe)),
    );
}

async function readSessionProbeRows(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
): Promise<any[]> {
  const { data } = await supabase.from("sessions").select("probes").eq("id", sessionId).maybeSingle();
  return Array.isArray(data?.probes) ? data.probes : [];
}

async function writeSessionProbeRows(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  probes: unknown[],
): Promise<void> {
  await supabase.from("sessions").update({ probes }).eq("id", sessionId);
}

export async function saveSession(session: Session): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("sessions")
    .update({
      problem: session.problem,
      status: session.status,
      duration_ms: session.durationMs,
      ended_at: session.endedAt || null,
      metadata: session.metadata,
    })
    .eq("id", session.id);

  if (error) {
    console.error("[saveSession] Failed to persist session:", error);
    throw new Error(error.message || "Failed to save session");
  }
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Archive only. Proof of work and xAI files stay.
  await supabase.from("sessions").update({ status: "archived" }).eq("id", id);
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
  const existing = await readSessionProbeRows(supabase, sessionId);
  const data = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    timestamp_ms: probe.timestamp,
    gap_score: probe.gapScore,
    signals: probe.signals,
    text: probeText,
    expanded_text: probe.expandedText || null,
    request_type: probe.requestType || "question",
    plan_step_id: probe.planStepId || null,
    starred: false,
    is_revealed: false,
    archived: false,
    focused: false,
  };
  await writeSessionProbeRows(supabase, sessionId, [...existing, data]);
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

async function patchProbeById(
  probeId: string,
  patch: Record<string, unknown>,
): Promise<any | null> {
  const supabase = createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, probes")
    .contains("probes", [{ id: probeId }]);
  const row = (sessions || []).find((session) =>
    Array.isArray(session.probes) && session.probes.some((p: { id?: string }) => p.id === probeId),
  );
  if (!row) return null;
  const probes = (Array.isArray(row.probes) ? row.probes : []).map((p: Record<string, unknown>) =>
    p.id === probeId ? { ...p, ...patch } : p,
  );
  await writeSessionProbeRows(supabase, row.id, probes);
  return probes.find((p: { id?: string }) => p.id === probeId) || null;
}

export async function updateProbeExpanded(probeId: string, expandedText: string): Promise<void> {
  await patchProbeById(probeId, { expanded_text: expandedText });
}

export async function toggleProbeStarred(probeId: string, starred: boolean): Promise<void> {
  await patchProbeById(probeId, { starred });
}

export async function updateProbeRevealed(probeId: string, isRevealed: boolean): Promise<void> {
  await patchProbeById(probeId, { is_revealed: isRevealed });
}

export async function archiveProbe(probeId: string): Promise<void> {
  // Guard against non-UUID ids (e.g. "1", "probe_1") that can sneak in
  // from LLM output when a probe list was rendered without real UUIDs.
  if (!isUuid(probeId)) {
    console.warn(`[archiveProbe] skipping non-UUID probeId: ${JSON.stringify(probeId)}`);
    return;
  }

  const probe = await patchProbeById(probeId, { archived: true });
  if (!probe) return;
  const archivedAt = Date.now();
    
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
  await patchProbeById(probeId, { archived: false });
}

export async function toggleProbeFocused(probeId: string, focused: boolean): Promise<void> {
  await patchProbeById(probeId, { focused });
}

export async function resetSessionProbes(sessionId: string): Promise<void> {
  const supabase = createClient();
  await writeSessionProbeRows(supabase, sessionId, []);
}

/**
 * Restart a session: clears probes and the chapter map, resets status.
 * Proof of work and xAI files stay.
 */
export async function restartSession(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("sessions")
    .update({
      probes: [],
      chapter_map: null,
      status: "active",
      duration_ms: 0,
      ended_at: null,
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

