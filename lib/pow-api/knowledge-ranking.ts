/**
 * Pure Knowledge Ranking helpers: latest-per-subject LWM Snapshot + GHC,
 * ordered as a leaderboard. Used by the Knowledge Ranking tab UI.
 */

export type KnowledgeRankingSubjectKey = string;

export interface KnowledgeRankingSubjectRef {
  user_id?: string | null;
  guest_user_id?: string | null;
  /** Optional display label (email, guest name, "You"). */
  label?: string | null;
}

/** One history row (eval_run_history / snapshot-history wire shape). */
export interface KnowledgeRankingRunLike {
  id?: string | null;
  ran_at?: string | null;
  score?: number | null;
  ghc_score?: number | null;
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
  /** Optional vertical; ranking prefers verification when mixed. */
  vertical?: string | null;
  /** Full LWM Snapshot report (markers / strengths / gaps) when present. */
  report?: unknown | null;
}

export interface KnowledgeRankingCard {
  rank: number;
  subjectKey: KnowledgeRankingSubjectKey;
  userId: string | null;
  guestUserId: string | null;
  label: string;
  /** Latest primary LWM Snapshot score 0–100, or null if no snapshot. */
  snapshotScore: number | null;
  /** Latest secondary GHC score 0–100, or null if missing. */
  ghcScore: number | null;
  ranAt: string | null;
  runId: string | null;
  hasSnapshot: boolean;
  /** Latest snapshot report payload (for detail pane spider / strengths / gaps). */
  report: unknown | null;
}

function cleanId(value?: string | null): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  return t ? t : null;
}

/** Stable subject key `u:<id>` / `g:<id>` (guest wins when both present). */
export function knowledgeRankingSubjectKey(
  ref: KnowledgeRankingSubjectRef | KnowledgeRankingRunLike,
): KnowledgeRankingSubjectKey {
  const guest =
    cleanId("guest_user_id" in ref ? ref.guest_user_id : null) ||
    cleanId("subject_guest_user_id" in ref ? ref.subject_guest_user_id : null);
  const user =
    cleanId("user_id" in ref ? ref.user_id : null) ||
    cleanId("subject_user_id" in ref ? ref.subject_user_id : null);
  if (guest) return `g:${guest}`;
  if (user) return `u:${user}`;
  return "";
}

function clampScoreOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ranAtMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function defaultLabel(key: KnowledgeRankingSubjectKey, currentUserId?: string | null): string {
  if (key.startsWith("u:")) {
    const id = key.slice(2);
    if (currentUserId && id === currentUserId) return "You";
    return `User ${id.slice(0, 8)}…`;
  }
  if (key.startsWith("g:")) {
    const id = key.slice(2);
    return `Guest ${id.slice(0, 8)}…`;
  }
  return "Unknown";
}

/**
 * Reduce multi-subject history rows to the latest run per subject.
 * Prefer `verification` vertical when a subject has mixed verticals at the same time;
 * otherwise newest ran_at wins (rows should already be newest-first from API).
 */
export function latestSnapshotRunBySubject(
  runs: KnowledgeRankingRunLike[],
): Map<KnowledgeRankingSubjectKey, KnowledgeRankingRunLike> {
  const best = new Map<
    KnowledgeRankingSubjectKey,
    { run: KnowledgeRankingRunLike; ms: number; verification: boolean }
  >();

  for (const run of runs || []) {
    const key = knowledgeRankingSubjectKey(run);
    if (!key) continue;
    const ms = ranAtMs(run.ran_at);
    const verification = (run.vertical || "verification") === "verification";
    const prev = best.get(key);
    if (!prev) {
      best.set(key, { run, ms, verification });
      continue;
    }
    if (ms > prev.ms) {
      best.set(key, { run, ms, verification });
      continue;
    }
    if (ms === prev.ms && verification && !prev.verification) {
      best.set(key, { run, ms, verification });
    }
  }

  const out = new Map<KnowledgeRankingSubjectKey, KnowledgeRankingRunLike>();
  for (const [k, v] of best) out.set(k, v.run);
  return out;
}

/**
 * Build ordered ranking cards from subject roster + history runs.
 * Sort: snapshot score desc (nulls last), then ran_at desc, then label.
 */
export function buildKnowledgeRanking(options: {
  subjects?: KnowledgeRankingSubjectRef[] | null;
  runs?: KnowledgeRankingRunLike[] | null;
  currentUserId?: string | null;
}): KnowledgeRankingCard[] {
  const latest = latestSnapshotRunBySubject(options.runs || []);
  const keys = new Set<KnowledgeRankingSubjectKey>();
  const labels = new Map<KnowledgeRankingSubjectKey, string>();

  for (const s of options.subjects || []) {
    const key = knowledgeRankingSubjectKey(s);
    if (!key) continue;
    keys.add(key);
    if (s.label && String(s.label).trim()) {
      labels.set(key, String(s.label).trim());
    }
  }
  for (const key of latest.keys()) {
    keys.add(key);
  }

  // Ensure current user appears even with empty subjects/history
  if (options.currentUserId) {
    const selfKey = `u:${options.currentUserId}`;
    keys.add(selfKey);
  }

  const cards: Omit<KnowledgeRankingCard, "rank">[] = [];
  for (const key of keys) {
    const run = latest.get(key) || null;
    const guest = key.startsWith("g:") ? key.slice(2) : null;
    const user = key.startsWith("u:") ? key.slice(2) : null;
    const snapshotScore = run ? clampScoreOrNull(run.score) : null;
    // Treat explicit missing ghc as null; 0 is a valid score.
    const ghcScore = run ? clampScoreOrNull(run.ghc_score) : null;
    const hasSnapshot = Boolean(run && run.id);
    cards.push({
      subjectKey: key,
      userId: user,
      guestUserId: guest,
      label: labels.get(key) || defaultLabel(key, options.currentUserId),
      snapshotScore: hasSnapshot ? snapshotScore : null,
      ghcScore: hasSnapshot ? ghcScore : null,
      ranAt: run?.ran_at ? String(run.ran_at) : null,
      runId: run?.id ? String(run.id) : null,
      hasSnapshot,
      report: hasSnapshot && run?.report != null ? run.report : null,
    });
  }

  cards.sort((a, b) => {
    const aScore = a.snapshotScore;
    const bScore = b.snapshotScore;
    if (aScore != null && bScore != null && aScore !== bScore) return bScore - aScore;
    if (aScore != null && bScore == null) return -1;
    if (aScore == null && bScore != null) return 1;
    const aMs = ranAtMs(a.ranAt);
    const bMs = ranAtMs(b.ranAt);
    if (aMs !== bMs) return bMs - aMs;
    return a.label.localeCompare(b.label);
  });

  return cards.map((c, i) => ({ ...c, rank: i + 1 }));
}

/** Format score for UI: integer string or em dash when missing. */
export function formatRankingScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return String(Math.round(score));
}
