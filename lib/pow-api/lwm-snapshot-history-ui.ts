/**
 * Pure helpers for LWM snapshot timeline UI: date windowing, selection, dual score series.
 * Driven by eval_run_history / snapshot-history rows (client-side window + chart).
 */

export interface LwmHistoryRunLike {
  id: string;
  ran_at: string;
  score: number | null | undefined;
  ghc_score?: number | null;
  report?: unknown;
}

export interface LwmDateWindow {
  /** Inclusive lower bound (ISO date or datetime). Empty = no lower bound. */
  from?: string | null;
  /** Inclusive upper bound (ISO date or datetime). Empty = no upper bound. */
  to?: string | null;
}

export interface LwmScorePoint {
  id: string;
  ran_at: string;
  atMs: number;
  /** Snapshot / verification score 0–100 */
  snapshotScore: number | null;
  /** GHC score 0–100 */
  ghcScore: number | null;
}

export interface LwmTimelineMarker {
  id: string;
  ran_at: string;
  atMs: number;
  /** 0..1 position along the timeline axis for the windowed set */
  t: number;
  snapshotScore: number | null;
  ghcScore: number | null;
}

function parseBoundMs(value: string | null | undefined, endOfDay: boolean): number | null {
  if (!value || !String(value).trim()) return null;
  const raw = String(value).trim();
  // date-only yyyy-mm-dd → local-ish UTC day bounds for filtering
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const ms = Date.parse(endOfDay ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function runAtMs(run: LwmHistoryRunLike): number {
  const ms = Date.parse(run.ran_at);
  return Number.isFinite(ms) ? ms : 0;
}

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Keep runs whose ran_at falls within [from, to] (inclusive).
 * Order preserved (API is typically newest-first).
 */
export function filterLwmHistoryByDateWindow<T extends LwmHistoryRunLike>(
  runs: T[],
  window: LwmDateWindow = {},
): T[] {
  const fromMs = parseBoundMs(window.from, false);
  const toMs = parseBoundMs(window.to, true);
  return (runs || []).filter((run) => {
    const t = runAtMs(run);
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}

/**
 * Pick the selected run; if missing/invalid, fall back to newest in the list.
 */
export function selectLwmHistoryRun<T extends LwmHistoryRunLike>(
  runs: T[],
  selectedId: string | null | undefined,
): T | null {
  if (!runs?.length) return null;
  if (selectedId) {
    const hit = runs.find((r) => r.id === selectedId);
    if (hit) return hit;
  }
  // Prefer newest by ran_at
  let best = runs[0];
  let bestMs = runAtMs(best);
  for (const r of runs) {
    const ms = runAtMs(r);
    if (ms > bestMs) {
      best = r;
      bestMs = ms;
    }
  }
  return best;
}

/** Chronological (oldest → newest) dual score series for trend charts. */
export function dualScoreSeriesFromRuns(runs: LwmHistoryRunLike[]): LwmScorePoint[] {
  const points: LwmScorePoint[] = (runs || []).map((r) => ({
    id: r.id,
    ran_at: r.ran_at,
    atMs: runAtMs(r),
    snapshotScore: clampScore(r.score),
    ghcScore: clampScore(r.ghc_score),
  }));
  points.sort((a, b) => a.atMs - b.atMs);
  return points;
}

/**
 * Timeline markers with normalized position t in [0,1] across the windowed span.
 * Single point → t=0.5; empty → [].
 */
export function timelineMarkersFromRuns(runs: LwmHistoryRunLike[]): LwmTimelineMarker[] {
  const series = dualScoreSeriesFromRuns(runs);
  if (!series.length) return [];
  if (series.length === 1) {
    const p = series[0];
    return [
      {
        id: p.id,
        ran_at: p.ran_at,
        atMs: p.atMs,
        t: 0.5,
        snapshotScore: p.snapshotScore,
        ghcScore: p.ghcScore,
      },
    ];
  }
  const min = series[0].atMs;
  const max = series[series.length - 1].atMs;
  const span = Math.max(1, max - min);
  return series.map((p) => ({
    id: p.id,
    ran_at: p.ran_at,
    atMs: p.atMs,
    t: (p.atMs - min) / span,
    snapshotScore: p.snapshotScore,
    ghcScore: p.ghcScore,
  }));
}

/** SVG polyline points string for a score series (nulls skipped). */
export function scoreSeriesPolyline(
  points: LwmScorePoint[],
  key: "snapshotScore" | "ghcScore",
  width: number,
  height: number,
  pad = 8,
): string {
  const usable = points.filter((p) => p[key] != null);
  if (usable.length === 0) return "";
  const minT = points[0]?.atMs ?? 0;
  const maxT = points[points.length - 1]?.atMs ?? minT;
  const spanT = Math.max(1, maxT - minT);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  return usable
    .map((p) => {
      const x = pad + ((p.atMs - minT) / spanT) * innerW;
      const score = p[key] as number;
      const y = pad + (1 - score / 100) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Date input value (yyyy-mm-dd) from an ISO timestamp. */
export function isoToDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

/** Local calendar yyyy-mm-dd for `<input type="date">` values. */
export function formatDateInputLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Default LWM timeline filters: last N calendar days inclusive of today
 * (e.g. days=7 → from today−6 through today).
 */
export function defaultLwmTimelineDateWindow(options?: {
  /** Inclusive day count ending today. Default 7. */
  days?: number;
  now?: Date;
}): { from: string; to: string } {
  const days = Math.max(1, Math.floor(options?.days ?? 7));
  const now = options?.now ?? new Date();
  const toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  return {
    from: formatDateInputLocal(fromDate),
    to: formatDateInputLocal(toDate),
  };
}
