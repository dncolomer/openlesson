/**
 * Practice library: catalog grouping, virtual Solve-flow tagging,
 * session history, and dashboard copy.
 */

import { PRACTICE_QUANTUM_PROBLEMS } from "@/lib/practice-quantum-catalog";

export const PRACTICE_PROBLEMS_TABLE = "practice_problems" as const;

export const PRACTICE_SESSION_META_KEY = "practice";
export const PRACTICE_PROBLEM_META_KEY = "practice_problem_id";
export const PRACTICE_START_PATH = "/api/dashboard/practice/start";
export const PRACTICE_CATALOG_PATH = "/api/dashboard/practice/catalog";
export const PRACTICE_HISTORY_PATH = "/api/dashboard/practice/history";
export const PRACTICE_HOME_PATH = "/api/dashboard/practice/home";

export type PracticeProblem = {
  id: string;
  slug: string;
  category: string;
  subcategory: string;
  title: string;
  prompt: string;
  sortOrder: number;
  durationMinutes: number;
};

export type PracticeSubcategoryGroup = {
  subcategory: string;
  problems: PracticeProblem[];
};

export type PracticeCategoryGroup = {
  category: string;
  subcategories: PracticeSubcategoryGroup[];
};

export type PracticeHistoryRow = {
  sessionId: string;
  flowId: string;
  problemId: string;
  title: string;
  category: string;
  subcategory: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  insightCount: number;
  status: string;
};

export type PracticeInsight = {
  id: string;
  sessionId: string;
  problemId: string;
  problemTitle: string;
  title: string;
  summary: string;
  createdAt: string;
  sessionElapsedMs: number | null;
  aestheticImage: string | null;
};

export type PracticeHistorySummary = {
  sessionCount: number;
  insightCount: number;
  durationMs: number;
  problemCount: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isPracticeSolveFlow(flow: {
  practiceProblemId?: string | null;
  practice_problem_id?: unknown;
} | null | undefined): boolean {
  if (!flow) return false;
  return Boolean(
    text(flow.practiceProblemId) || text(flow.practice_problem_id),
  );
}

export function listedAuthorSolveFlows<T extends {
  archivedAt?: string | null;
  practiceProblemId?: string | null;
  practice_problem_id?: unknown;
}>(
  flows: readonly T[],
  isArchived: (flow: T) => boolean,
): T[] {
  return flows.filter((flow) => !isArchived(flow) && !isPracticeSolveFlow(flow));
}

export function presentPracticeProblem(row: {
  id?: unknown;
  slug?: unknown;
  category?: unknown;
  subcategory?: unknown;
  title?: unknown;
  prompt?: unknown;
  sort_order?: unknown;
  sortOrder?: unknown;
  duration_minutes?: unknown;
  durationMinutes?: unknown;
}): PracticeProblem | null {
  const id = text(row.id);
  const title = text(row.title);
  const prompt = text(row.prompt);
  const category = text(row.category);
  const subcategory = text(row.subcategory);
  if (!id || !title || !prompt || !category || !subcategory) return null;
  const sortRaw = row.sortOrder ?? row.sort_order;
  const durationRaw = row.durationMinutes ?? row.duration_minutes;
  const sortOrder = Number.isFinite(Number(sortRaw)) ? Number(sortRaw) : 0;
  const durationMinutes = Number.isFinite(Number(durationRaw))
    ? Math.max(1, Math.round(Number(durationRaw)))
    : 15;
  return {
    id,
    slug: text(row.slug) || id,
    category,
    subcategory,
    title,
    prompt,
    sortOrder,
    durationMinutes,
  };
}

export function groupPracticeProblems(
  problems: readonly PracticeProblem[],
): PracticeCategoryGroup[] {
  const categories: PracticeCategoryGroup[] = [];
  const categoryIndex = new Map<string, PracticeCategoryGroup>();
  const ordered = [...problems].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
  for (const problem of ordered) {
    let category = categoryIndex.get(problem.category);
    if (!category) {
      category = { category: problem.category, subcategories: [] };
      categoryIndex.set(problem.category, category);
      categories.push(category);
    }
    let sub = category.subcategories.find(
      (item) => item.subcategory === problem.subcategory,
    );
    if (!sub) {
      sub = { subcategory: problem.subcategory, problems: [] };
      category.subcategories.push(sub);
    }
    sub.problems.push(problem);
  }
  return categories;
}

export function countPracticeProblems(
  group: Pick<PracticeCategoryGroup, "subcategories">,
): number {
  return group.subcategories.reduce((n, sub) => n + sub.problems.length, 0);
}

function practiceProblemMatchesQuery(
  problem: PracticeProblem,
  query: string,
): boolean {
  if (!query) return true;
  const hay = `${problem.title} ${problem.prompt} ${problem.category} ${problem.subcategory}`.toLowerCase();
  return hay.includes(query);
}

export function filterPracticeCatalog(
  groups: readonly PracticeCategoryGroup[],
  input: {
    query?: string;
    category?: string | null;
    subcategory?: string | null;
  } = {},
): PracticeCategoryGroup[] {
  const q = (input.query || "").trim().toLowerCase();
  const category = (input.category || "").trim();
  const subcategory = (input.subcategory || "").trim();
  return groups
    .filter((group) => !category || group.category === category)
    .map((group) => ({
      ...group,
      subcategories: group.subcategories
        .filter((sub) => !subcategory || sub.subcategory === subcategory)
        .map((sub) => ({
          ...sub,
          problems: sub.problems.filter((problem) =>
            practiceProblemMatchesQuery(problem, q),
          ),
        }))
        .filter((sub) => sub.problems.length > 0),
    }))
    .filter((group) => group.subcategories.length > 0);
}

export type PracticeBrowseLevel = "categories" | "subcategories" | "problems";

export function practiceBrowseLevel(input: {
  category?: string | null;
  subcategory?: string | null;
}): PracticeBrowseLevel {
  if ((input.subcategory || "").trim()) return "problems";
  if ((input.category || "").trim()) return "subcategories";
  return "categories";
}

export function practiceSessionHref(sessionId: string): string {
  return `/session?id=${encodeURIComponent(text(sessionId))}`;
}

export function practiceIdentityForUser(userId: string): string {
  const id = text(userId);
  return id ? `practice:${id}` : "practice";
}

export function practiceSessionMetadata(input: {
  problemId: string;
  flowId: string;
  title: string;
  userId: string;
}): Record<string, unknown> {
  const identity = practiceIdentityForUser(input.userId);
  return {
    title: input.title,
    [PRACTICE_SESSION_META_KEY]: true,
    [PRACTICE_PROBLEM_META_KEY]: input.problemId,
    solve_flow_id: input.flowId,
    identity,
  };
}

export function isPracticeSessionMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const rec = metadata as Record<string, unknown>;
  return rec[PRACTICE_SESSION_META_KEY] === true && Boolean(text(rec[PRACTICE_PROBLEM_META_KEY]));
}

export function practiceDurationMs(row: {
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

export function presentPracticeHistoryRow(input: {
  sessionId?: unknown;
  flowId?: unknown;
  problemId?: unknown;
  title?: unknown;
  category?: unknown;
  subcategory?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  durationMs?: unknown;
  insightCount?: unknown;
  status?: unknown;
}): PracticeHistoryRow | null {
  const sessionId = text(input.sessionId);
  const problemId = text(input.problemId);
  const title = text(input.title);
  if (!sessionId || !problemId || !title) return null;
  const insightCount = Math.max(0, Math.round(Number(input.insightCount) || 0));
  const durationMs = Math.max(0, Math.round(Number(input.durationMs) || 0));
  return {
    sessionId,
    flowId: text(input.flowId),
    problemId,
    title,
    category: text(input.category),
    subcategory: text(input.subcategory),
    startedAt: text(input.startedAt),
    endedAt: text(input.endedAt) || null,
    durationMs,
    insightCount,
    status: text(input.status) || "active",
  };
}

export function presentPracticeInsight(input: {
  id?: unknown;
  sessionId?: unknown;
  problemId?: unknown;
  problemTitle?: unknown;
  title?: unknown;
  summary?: unknown;
  createdAt?: unknown;
  sessionElapsedMs?: unknown;
  aestheticImage?: unknown;
}): PracticeInsight | null {
  const id = text(input.id);
  const sessionId = text(input.sessionId);
  const problemId = text(input.problemId);
  if (!id || !sessionId || !problemId) return null;
  const elapsedRaw = input.sessionElapsedMs;
  const elapsed =
    elapsedRaw == null || elapsedRaw === ""
      ? null
      : Math.max(0, Math.round(Number(elapsedRaw)));
  return {
    id,
    sessionId,
    problemId,
    problemTitle: text(input.problemTitle) || "Untitled problem",
    title: text(input.title) || "Untitled insight",
    summary: text(input.summary),
    createdAt: text(input.createdAt),
    sessionElapsedMs: Number.isFinite(elapsed) ? elapsed : null,
    aestheticImage: text(input.aestheticImage) || null,
  };
}

export function practiceInsightsForSession(
  insights: readonly PracticeInsight[],
  sessionId?: string | null,
): PracticeInsight[] {
  const id = text(sessionId);
  const rows = id ? insights.filter((row) => row.sessionId === id) : [...insights];
  return rows.sort((a, b) => {
    const tb = Date.parse(b.createdAt) || 0;
    const ta = Date.parse(a.createdAt) || 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}

export function summarizePracticeHistory(
  rows: readonly PracticeHistoryRow[],
): PracticeHistorySummary {
  const problems = new Set<string>();
  let insightCount = 0;
  let durationMs = 0;
  for (const row of rows) {
    problems.add(row.problemId);
    insightCount += row.insightCount;
    durationMs += row.durationMs;
  }
  return {
    sessionCount: rows.length,
    insightCount,
    durationMs,
    problemCount: problems.size,
  };
}

export function formatPracticeDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function practiceCatalogSeedCount(): number {
  return PRACTICE_QUANTUM_PROBLEMS.length;
}
