import type { Probe, Session } from "@/lib/storage";
import { mapDbProbe, mapDbSession as mapDbSessionBase } from "@/lib/storage/session-mappers";

async function ayclPost<T>(token: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/aycl/session-mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AYCL session request failed");
  return data as T;
}

function mapDbSession(row: Record<string, unknown>, probes: Probe[] = []): Session {
  return mapDbSessionBase(row, probes, "active");
}

export async function getAyclSession(token: string, sessionId: string): Promise<Session | null> {
  const data = await ayclPost<{ session: Record<string, unknown>; probes: Record<string, unknown>[] }>(
    token,
    "get",
    { sessionId }
  );
  if (!data.session) return null;
  return mapDbSession(data.session, (data.probes || []).map(mapDbProbe));
}

export async function saveAyclSession(token: string, session: Session): Promise<void> {
  const metadata: Session["metadata"] & { objectives?: string[] } = {
    ...(session.metadata || {}),
  };
  if (session.objectives.length > 0) {
    metadata.objectives = session.objectives;
  }

  await ayclPost(token, "save", {
    sessionId: session.id,
    session: {
      status: session.status,
      duration_ms: session.durationMs,
      ended_at: session.endedAt ?? null,
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

export async function addAyclProbe(
  token: string,
  sessionId: string,
  probe: Omit<Probe, "id"> & { id?: string }
): Promise<Probe> {
  const data = await ayclPost<{ probe: Record<string, unknown> }>(token, "add_probe", {
    sessionId,
    probe: {
      id: probe.id,
      text: probe.text,
      timestamp_ms: probe.timestamp,
      gap_score: probe.gapScore,
      signals: probe.signals,
      expanded_text: probe.expandedText,
      starred: probe.starred,
      is_revealed: probe.isRevealed,
      request_type: probe.requestType,
      plan_step_id: probe.planStepId,
      archived: probe.archived,
      focused: probe.focused,
    },
  });
  return mapDbProbe(data.probe);
}