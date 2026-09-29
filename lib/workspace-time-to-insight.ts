/**
 * Time-to-insight for one workspace: mean elapsed time from each qualifying
 * session's start to that session's first qualifying insight.
 *
 * Session start is `session_started_at` when that value parses as a timestamp,
 * otherwise `created_at`. There is no `sessions.workspace_id` column — workspace
 * membership is `metadata.workspace_id` only.
 */

export type TimeToInsightSessionRecord = {
  id: string;
  user_id?: string | null;
  created_at?: string | null;
  session_started_at?: string | null;
  metadata?: unknown;
};

export type TimeToInsightInsightRecord = {
  user_id?: string | null;
  session_id?: string | null;
  workspace_id?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
};

export type TimeToInsightAverageInput = {
  sessions: readonly TimeToInsightSessionRecord[];
  insights: readonly TimeToInsightInsightRecord[];
  viewerId: string;
  workspaceId: string;
};

/** Visible metric name on the KPIs tab. */
export const WORKSPACE_KPI_TIME_TO_INSIGHT_LABEL = "Time-to-insight";

/** Shown when no session qualifies. Not a numeric zero. */
export const WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY = "No qualifying sessions";

export type WorkspaceKpiTimeToInsightReadout = {
  metricLabel: string;
  /** Human duration, or the empty phrase when the mean is absent. */
  valueText: string;
  averageMs: number | null;
};

function parseTimestamp(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const time = Date.parse(trimmed);
  return Number.isFinite(time) ? time : null;
}

function sameId(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = left.trim();
  const b = right.trim();
  return a.length > 0 && a === b;
}

function isArchivedInsight(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

/** Blank workspace tags count as unset and still qualify. */
function insightMatchesWorkspace(value: unknown, workspaceId: string): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed === workspaceId;
}

function metadataWorkspaceId(metadata: unknown): string | null {
  let record: unknown = metadata;
  if (typeof record === "string") {
    const trimmed = record.trim();
    if (!trimmed) return null;
    try {
      record = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const id = (record as { workspace_id?: unknown }).workspace_id;
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  return trimmed || null;
}

function sessionStartMs(session: TimeToInsightSessionRecord): number | null {
  const started = parseTimestamp(session.session_started_at);
  if (started != null) return started;
  return parseTimestamp(session.created_at);
}

/**
 * Arithmetic mean, in milliseconds, of time-to-first-insight for qualifying
 * sessions. `null` when nothing qualifies — never a stand-in zero.
 */
export function averageTimeToInsightMs(
  input: TimeToInsightAverageInput,
): number | null {
  const viewerId = input.viewerId;
  const workspaceId = input.workspaceId;
  if (typeof viewerId !== "string" || !viewerId.trim()) return null;
  if (typeof workspaceId !== "string" || !workspaceId.trim()) return null;
  const openWorkspaceId = workspaceId.trim();

  const durations: number[] = [];
  for (const session of input.sessions) {
    if (!sameId(session.user_id, viewerId)) continue;
    if (metadataWorkspaceId(session.metadata) !== openWorkspaceId) continue;
    const start = sessionStartMs(session);
    if (start == null) continue;

    let earliest: number | null = null;
    for (const insight of input.insights) {
      if (!sameId(insight.session_id, session.id)) continue;
      if (!sameId(insight.user_id, viewerId)) continue;
      if (isArchivedInsight(insight.archived_at)) continue;
      if (!insightMatchesWorkspace(insight.workspace_id, openWorkspaceId)) continue;
      const created = parseTimestamp(insight.created_at);
      if (created == null) continue;
      if (earliest == null || created < earliest) earliest = created;
    }
    if (earliest == null) continue;
    const elapsed = earliest - start;
    if (!Number.isFinite(elapsed) || elapsed < 0) continue;
    durations.push(elapsed);
  }

  if (durations.length === 0) return null;
  const sum = durations.reduce((total, value) => total + value, 0);
  const mean = sum / durations.length;
  return Number.isFinite(mean) ? mean : null;
}

/** Human duration. 120000 ms → "2m 0s". */
export function formatTimeToInsightDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * What the KPIs tab shows. The duration is `formatTimeToInsightDuration` of
 * `averageTimeToInsightMs`. An absent mean uses the empty phrase, not "0s".
 */
export function workspaceKpiTimeToInsightReadout(
  input: TimeToInsightAverageInput,
): WorkspaceKpiTimeToInsightReadout {
  const averageMs = averageTimeToInsightMs(input);
  if (averageMs == null) {
    return {
      metricLabel: WORKSPACE_KPI_TIME_TO_INSIGHT_LABEL,
      valueText: WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY,
      averageMs: null,
    };
  }
  return {
    metricLabel: WORKSPACE_KPI_TIME_TO_INSIGHT_LABEL,
    valueText: formatTimeToInsightDuration(averageMs),
    averageMs,
  };
}
