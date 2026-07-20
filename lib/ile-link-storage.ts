import type { Probe, Session } from "@/lib/storage";

async function ilePost<T>(token: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/ile/session-mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "ILE session request failed");
  return data as T;
}

function mapDbProbe(row: Record<string, unknown>): Probe {
  return {
    id: String(row.id),
    timestamp: Number(row.timestamp_ms || 0),
    gapScore: Number(row.gap_score || 0),
    signals: Array.isArray(row.signals) ? (row.signals as string[]) : [],
    text: String(row.text || ""),
    expandedText: row.expanded_text ? String(row.expanded_text) : undefined,
    starred: Boolean(row.starred),
    isRevealed: Boolean(row.is_revealed),
    requestType: (row.request_type as Probe["requestType"]) || "question",
    planStepId: row.plan_step_id ? String(row.plan_step_id) : undefined,
    archived: Boolean(row.archived),
    focused: Boolean(row.focused),
  };
}

function mapDbSession(row: Record<string, unknown>, probes: Probe[] = []): Session {
  const metadata = (row.metadata as Session["metadata"]) || {};
  const storedObjectives = (metadata as Record<string, unknown>).objectives;
  return {
    id: String(row.id),
    problem: String(row.problem || ""),
    startedAt: String(row.created_at || new Date().toISOString()),
    endedAt: row.ended_at ? String(row.ended_at) : undefined,
    durationMs: Number(row.duration_ms || 0),
    status: (row.status as Session["status"]) || "active",
    probes,
    objectives: Array.isArray(storedObjectives) ? (storedObjectives as string[]) : [],
    hasAudio: Boolean(row.audio_path),
    audioPath: row.audio_path ? String(row.audio_path) : undefined,
    report: row.report ? String(row.report) : undefined,
    reportGeneratedAt: row.report_generated_at ? String(row.report_generated_at) : undefined,
    transcript: row.transcript ? String(row.transcript) : undefined,
    planningPrompt: row.planning_prompt ? String(row.planning_prompt) : undefined,
    metadata,
  };
}

export async function getIleLinkSession(token: string, sessionId: string): Promise<Session | null> {
  const data = await ilePost<{ session: Record<string, unknown>; probes: Record<string, unknown>[] }>(
    token,
    "get",
    { sessionId }
  );
  if (!data.session) return null;
  return mapDbSession(data.session, (data.probes || []).map(mapDbProbe));
}

export async function saveIleLinkSession(token: string, session: Session): Promise<void> {
  const metadata: Session["metadata"] & { objectives?: string[] } = {
    ...(session.metadata || {}),
  };
  if (session.objectives.length > 0) {
    metadata.objectives = session.objectives;
  }

  await ilePost(token, "save", {
    sessionId: session.id,
    session: {
      status: session.status,
      duration_ms: session.durationMs,
      ended_at: session.endedAt ?? null,
      report: session.report ?? null,
      metadata,
      planning_prompt: session.planningPrompt ?? null,
      objectives: session.objectives,
    },
    probes: session.probes.map((probe) => ({
      id: probe.id,
      text: probe.text,
      timestamp_ms: probe.timestamp,
      gap_score: probe.gapScore,
      signals: probe.signals,
      expanded_text: probe.expandedText ?? null,
      starred: probe.starred ?? false,
      is_revealed: probe.isRevealed ?? false,
      request_type: probe.requestType ?? "question",
      plan_step_id: probe.planStepId ?? null,
      archived: probe.archived ?? false,
      focused: probe.focused ?? false,
    })),
  });
}
