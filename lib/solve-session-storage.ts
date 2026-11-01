/**
 * Public Solve session load. Guests read the claimed session via the flow token.
 */

import type { Session } from "@/lib/domain/types";

function mapSession(row: Record<string, unknown>): Session {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id || ""),
    problem: String(row.problem || "Solve"),
    startedAt: String(row.created_at || new Date().toISOString()),
    endedAt: row.ended_at ? String(row.ended_at) : undefined,
    durationMs: Number(row.duration_ms) || 0,
    status: (row.status as Session["status"]) || "pending",
    probes: Array.isArray(row.probes) ? (row.probes as Session["probes"]) : [],
    objectives: Array.isArray(metadata.objectives)
      ? (metadata.objectives as string[])
      : [],
    hasAudio: false,
    workspaceTitle: typeof metadata.title === "string" ? metadata.title : undefined,
    planningPrompt:
      typeof row.planning_prompt === "string" ? row.planning_prompt : undefined,
    metadata: metadata as Session["metadata"],
  };
}

async function solvePublicPost<T>(
  token: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/solve-flow/public/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Solve session request failed",
    );
  }
  return data;
}

export async function getSolveLinkSession(
  token: string,
  sessionId: string,
): Promise<Session | null> {
  const flowToken = String(token || "").trim();
  const id = String(sessionId || "").trim();
  if (!flowToken || !id) return null;
  try {
    const payload = await solvePublicPost<{ session?: unknown }>(flowToken, { sessionId: id });
    if (!payload.session || typeof payload.session !== "object") return null;
    return mapSession(payload.session as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function saveSolveLinkSession(token: string, session: Session): Promise<void> {
  const flowToken = String(token || "").trim();
  if (!flowToken || !session.id) return;
  const metadata: Session["metadata"] & { objectives?: string[] } = {
    ...(session.metadata || {}),
  };
  if (session.objectives.length > 0) {
    metadata.objectives = session.objectives;
  }
  await solvePublicPost(flowToken, {
    sessionId: session.id,
    session: {
      status: session.status,
      duration_ms: session.durationMs,
      ended_at: session.endedAt ?? null,
      metadata,
      planning_prompt: session.planningPrompt ?? null,
      probes: session.probes,
      problem: session.problem,
    },
  });
}
