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

export async function getSolveLinkSession(
  token: string,
  sessionId: string,
): Promise<Session | null> {
  const flowToken = String(token || "").trim();
  const id = String(sessionId || "").trim();
  if (!flowToken || !id) return null;
  const response = await fetch(`/api/solve-flow/public/${encodeURIComponent(flowToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: id }),
  });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => ({}))) as { session?: unknown };
  if (!payload.session || typeof payload.session !== "object") return null;
  return mapSession(payload.session as Record<string, unknown>);
}
