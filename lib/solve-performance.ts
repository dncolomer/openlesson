/**
 * Solve / Practice Performance: owner Solve session history and insights.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { INSIGHTS_TABLE, SESSIONS_TABLE, SOLVE_FLOWS_TABLE } from "@/lib/core-tables";

export const SOLVE_PERFORMANCE_PATH = "/api/dashboard/solve/performance";

export type SolvePerformanceRow = {
  sessionId: string;
  flowId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  insightCount: number;
  status: string;
};

export type SolvePerformanceInsight = {
  id: string;
  sessionId: string;
  flowId: string;
  flowTitle: string;
  title: string;
  summary: string;
  createdAt: string;
  sessionElapsedMs: number | null;
  aestheticImage: string | null;
};

export type SolvePerformanceSummary = {
  sessionCount: number;
  insightCount: number;
  durationMs: number;
  flowCount: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function solveSessionHref(sessionId: string): string {
  return `/session?id=${encodeURIComponent(text(sessionId))}`;
}

export function solvePerformanceDurationMs(row: {
  duration_ms?: unknown;
  durationMs?: unknown;
  created_at?: unknown;
  ended_at?: unknown;
}): number {
  const stored = Number(row.durationMs ?? row.duration_ms);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  const started = Date.parse(String(row.created_at || ""));
  const ended = Date.parse(String(row.ended_at || ""));
  if (Number.isFinite(started) && Number.isFinite(ended) && ended >= started) {
    return Math.round(ended - started);
  }
  return 0;
}

export function presentSolvePerformanceRow(input: {
  sessionId?: unknown;
  flowId?: unknown;
  title?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  durationMs?: unknown;
  insightCount?: unknown;
  status?: unknown;
}): SolvePerformanceRow | null {
  const sessionId = text(input.sessionId);
  const title = text(input.title);
  if (!sessionId || !title) return null;
  return {
    sessionId,
    flowId: text(input.flowId),
    title,
    startedAt: text(input.startedAt),
    endedAt: text(input.endedAt) || null,
    durationMs: Math.max(0, Math.round(Number(input.durationMs) || 0)),
    insightCount: Math.max(0, Math.round(Number(input.insightCount) || 0)),
    status: text(input.status) || "active",
  };
}

export function presentSolvePerformanceInsight(input: {
  id?: unknown;
  sessionId?: unknown;
  flowId?: unknown;
  flowTitle?: unknown;
  title?: unknown;
  summary?: unknown;
  createdAt?: unknown;
  sessionElapsedMs?: unknown;
  aestheticImage?: unknown;
}): SolvePerformanceInsight | null {
  const id = text(input.id);
  const sessionId = text(input.sessionId);
  if (!id || !sessionId) return null;
  const elapsedRaw = input.sessionElapsedMs;
  const elapsed =
    elapsedRaw == null || elapsedRaw === ""
      ? null
      : Math.max(0, Math.round(Number(elapsedRaw)));
  return {
    id,
    sessionId,
    flowId: text(input.flowId),
    flowTitle: text(input.flowTitle) || "Untitled",
    title: text(input.title) || "Untitled insight",
    summary: text(input.summary),
    createdAt: text(input.createdAt),
    sessionElapsedMs: Number.isFinite(elapsed) ? elapsed : null,
    aestheticImage: text(input.aestheticImage) || null,
  };
}

export function solvePerformanceInsightsForSession(
  insights: readonly SolvePerformanceInsight[],
  sessionId?: string | null,
): SolvePerformanceInsight[] {
  const id = text(sessionId);
  const rows = id ? insights.filter((row) => row.sessionId === id) : [...insights];
  return rows.sort((a, b) => {
    const tb = Date.parse(b.createdAt) || 0;
    const ta = Date.parse(a.createdAt) || 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}

export function summarizeSolvePerformance(
  rows: readonly SolvePerformanceRow[],
): SolvePerformanceSummary {
  const flows = new Set<string>();
  let insightCount = 0;
  let durationMs = 0;
  for (const row of rows) {
    if (row.flowId) flows.add(row.flowId);
    insightCount += row.insightCount;
    durationMs += row.durationMs;
  }
  return {
    sessionCount: rows.length,
    insightCount,
    durationMs,
    flowCount: flows.size,
  };
}

export function formatSolvePerformanceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export async function loadSolvePerformance(ownerUserId: string): Promise<{
  rows: SolvePerformanceRow[];
  summary: SolvePerformanceSummary;
  insights: SolvePerformanceInsight[];
}> {
  const userId = String(ownerUserId || "").trim();
  if (!userId) {
    return { rows: [], summary: summarizeSolvePerformance([]), insights: [] };
  }
  const supabase = createAdminClient();
  const { data: sessionRows, error } = await supabase
    .from(SESSIONS_TABLE)
    .select("id, status, created_at, ended_at, duration_ms, solve_flow_id, problem")
    .eq("user_id", userId)
    .eq("kind", "solve")
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(sessionRows) || sessionRows.length === 0) {
    return { rows: [], summary: summarizeSolvePerformance([]), insights: [] };
  }

  const flowIds = [
    ...new Set(
      sessionRows
        .map((row) => String((row as { solve_flow_id?: unknown }).solve_flow_id || "").trim())
        .filter(Boolean),
    ),
  ];
  const { data: flowRows } =
    flowIds.length > 0
      ? await supabase.from(SOLVE_FLOWS_TABLE).select("id, name, topic").in("id", flowIds)
      : { data: [] as Record<string, unknown>[] };
  const flowById = new Map<string, { name: string; topic: string }>();
  for (const row of flowRows || []) {
    const rec = row as Record<string, unknown>;
    const id = text(rec.id);
    if (!id) continue;
    flowById.set(id, { name: text(rec.name), topic: text(rec.topic) });
  }

  const parsed = sessionRows
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const flowId = text(rec.solve_flow_id);
      const flow = flowById.get(flowId);
      const title = flow?.name || text(rec.problem) || "Untitled";
      return presentSolvePerformanceRow({
        sessionId: rec.id,
        flowId,
        title,
        startedAt: rec.created_at,
        endedAt: rec.ended_at,
        durationMs: solvePerformanceDurationMs(rec),
        status: rec.status,
      });
    })
    .filter((row): row is SolvePerformanceRow => Boolean(row));

  const sessionIds = parsed.map((row) => row.sessionId);
  const sessionById = new Map(parsed.map((row) => [row.sessionId, row]));
  const insightCounts = new Map<string, number>();
  const insights: SolvePerformanceInsight[] = [];
  if (sessionIds.length > 0) {
    const { data: insightRows } = await supabase
      .from(INSIGHTS_TABLE)
      .select("id, session_id, title, summary, created_at, session_elapsed_ms, aesthetic_image")
      .eq("user_id", userId)
      .in("session_id", sessionIds)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    for (const row of insightRows || []) {
      const rec = row as Record<string, unknown>;
      const sessionId = text(rec.session_id);
      const session = sessionById.get(sessionId);
      if (!session) continue;
      insightCounts.set(sessionId, (insightCounts.get(sessionId) || 0) + 1);
      const insight = presentSolvePerformanceInsight({
        id: rec.id,
        sessionId,
        flowId: session.flowId,
        flowTitle: session.title,
        title: rec.title,
        summary: rec.summary,
        createdAt: rec.created_at,
        sessionElapsedMs: rec.session_elapsed_ms,
        aestheticImage: rec.aesthetic_image,
      });
      if (insight) insights.push(insight);
    }
  }

  const rows = parsed.map((row) => ({
    ...row,
    insightCount: insightCounts.get(row.sessionId) || 0,
  }));
  return { rows, summary: summarizeSolvePerformance(rows), insights };
}
