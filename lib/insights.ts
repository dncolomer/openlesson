import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { isUuid } from "@/lib/domain/types";

/** Nested `{ error: { message } }` envelopes must not render as `[object Object]`. */
export function insightApiErrorMessage(body: unknown, fallback: string): string {
  return errorMessageFromBody(body, fallback);
}

export type InsightSummary = {
  id: string;
  title: string;
  summary: string;
  workspace_id?: string | null;
  block_id?: string | null;
  chapter_id?: string | null;
  session_id?: string | null;
  aesthetic_image?: string | null;
  share_token?: string | null;
  created_at: string;
  archived_at?: string | null;
  thought_ids?: unknown;
  workspace_title?: string | null;
  /** Milliseconds from session start to crafting. Null when the start is unknown. */
  session_elapsed_ms?: number | null;
};

function uuidOrNull(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return isUuid(id) ? id : null;
}

/**
 * insights.block_id is uuid (workspace block). TAP Learning docked chapters use
 * string step ids like `step_1_seed`, which must not be written there.
 */
export function resolveInsightBlockAndChapterIds(input: {
  blockId?: unknown;
  chapterId?: unknown;
}): { blockId: string | null; chapterId: string | null } {
  const chapterId =
    String(input.chapterId ?? "").trim() ||
    String(input.blockId ?? "").trim() ||
    null;
  const blockId = uuidOrNull(input.blockId) || uuidOrNull(input.chapterId);
  return { blockId, chapterId };
}

export type InsightCreateInsertRow = {
  user_id: string;
  workspace_id: string | null;
  session_id: string | null;
  block_id: string | null;
  chapter_id: string | null;
  title: string;
  summary: string;
  thought_ids: unknown;
  source_thoughts: unknown;
  aesthetic_image: string;
  is_public: true;
  /** Present only when session start was known at craft time. */
  session_elapsed_ms?: number;
};

const INSIGHT_SESSION_ELAPSED_MS_MAX = 2_147_483_647;

function parseInsightTimestamp(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const time = Date.parse(trimmed);
  return Number.isFinite(time) ? time : null;
}

/** Non-negative integer milliseconds, or null. Caps at a signed 32-bit integer. */
export function normalizeInsightSessionElapsedMs(value: unknown): number | null {
  const ms = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.min(INSIGHT_SESSION_ELAPSED_MS_MAX, Math.round(ms));
}

/**
 * Milliseconds from session start to `atMs`.
 * Start is `sessionStartedAt` when that parses, otherwise `sessionCreatedAt`.
 */
export function insightSessionElapsedMs(input: {
  sessionStartedAt?: unknown;
  sessionCreatedAt?: unknown;
  atMs: unknown;
}): number | null {
  const at = parseInsightTimestamp(input.atMs);
  if (at == null) return null;
  const start =
    parseInsightTimestamp(input.sessionStartedAt) ??
    parseInsightTimestamp(input.sessionCreatedAt);
  if (start == null) return null;
  return normalizeInsightSessionElapsedMs(at - start);
}

type InsightSessionElapsedClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, id: string) => {
        maybeSingle: () => Promise<{
          data?: {
            user_id?: string | null;
            created_at?: string | null;
            session_started_at?: string | null;
          } | null;
          error?: { message?: string } | null;
        }>;
      };
    };
  };
};

/**
 * Read the owner's session and return elapsed milliseconds at `atMs`.
 * A missing session, another user's session, or a query error returns null
 * so crafting still saves.
 */
export async function loadInsightSessionElapsedMs(
  client: unknown,
  input: { sessionId: unknown; userId: unknown; atMs: number },
): Promise<number | null> {
  const sessionId = uuidOrNull(input.sessionId);
  const userId = String(input.userId ?? "").trim();
  if (!sessionId || !userId) return null;
  try {
    const { data, error } = await (client as InsightSessionElapsedClient)
      .from("sessions")
      .select("user_id, created_at, session_started_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !data || String(data.user_id || "") !== userId) return null;
    return insightSessionElapsedMs({
      sessionStartedAt: data.session_started_at,
      sessionCreatedAt: data.created_at,
      atMs: input.atMs,
    });
  } catch {
    return null;
  }
}

/** Insert row for POST /api/insights/create — UUID-guards uuid columns. */
export function buildInsightCreateInsert(input: {
  userId: string;
  workspaceId?: unknown;
  sessionId?: unknown;
  blockId?: unknown;
  chapterId?: unknown;
  title: string;
  summary: string;
  thoughtIds?: unknown;
  sourceThoughts?: unknown;
  aestheticImage: string;
  sessionElapsedMs?: unknown;
}): InsightCreateInsertRow {
  const link = resolveInsightBlockAndChapterIds({
    blockId: input.blockId,
    chapterId: input.chapterId,
  });
  const sessionElapsedMs = normalizeInsightSessionElapsedMs(input.sessionElapsedMs);
  return {
    user_id: input.userId,
    workspace_id: uuidOrNull(input.workspaceId),
    session_id: uuidOrNull(input.sessionId),
    block_id: link.blockId,
    chapter_id: link.chapterId,
    title: input.title,
    summary: input.summary,
    thought_ids: Array.isArray(input.thoughtIds) ? input.thoughtIds : [],
    source_thoughts: Array.isArray(input.sourceThoughts) ? input.sourceThoughts : [],
    aesthetic_image: input.aestheticImage,
    is_public: true,
    ...(sessionElapsedMs == null ? {} : { session_elapsed_ms: sessionElapsedMs }),
  };
}

/**
 * Product surfaces that host Thought Memory and/or Insights.
 * Generation (suggest/create) is allowed in TAP Learning and Knowledge only — never TAP.
 */
export type InsightSurface = "tap" | "ile" | "knowledge";

export type InsightSurfaceCapabilities = {
  /** Suggest + create insights from thought traces. */
  allowInsightGeneration: boolean;
  /** Browse/list insights for a workspace (or session context). */
  allowInsightList: boolean;
};

/**
 * Pure capability map for insight generation/list UI.
 * Call sites pass the result into ThoughtMemoryPanel / Knowledge hosts — do not re-implement in tests.
 */
export function resolveInsightSurfaceCapabilities(
  surface: InsightSurface,
): InsightSurfaceCapabilities {
  switch (surface) {
    case "tap":
      return { allowInsightGeneration: false, allowInsightList: false };
    case "ile":
      return { allowInsightGeneration: true, allowInsightList: true };
    case "knowledge":
      return { allowInsightGeneration: true, allowInsightList: true };
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}

/** Build insights list URL; always scopes when workspaceId is provided. */
export function insightsListUrl(workspaceId?: string | null): string {
  if (workspaceId) {
    return `/api/insights?workspaceId=${encodeURIComponent(workspaceId)}`;
  }
  return "/api/insights";
}

/** Session-scoped list for the TAP Learning session insights counter. */
export function insightsSessionListUrl(sessionId: string): string {
  return `/api/insights?sessionId=${encodeURIComponent(sessionId)}`;
}

/** Path back to a workspace's Knowledge Insights surface after archive/detail actions. */
export function workspaceKnowledgeInsightsPath(workspaceId: string): string {
  return `/workspace/${workspaceId}?section=knowledge&subview=insights`;
}

/** Play-mode top-level Insights tab. */
export function workspacePlayInsightsPath(workspaceId: string): string {
  return `/workspace/${workspaceId}?section=insights`;
}

export const GENERATE_INSIGHTS_ACTION_LABEL = "Generate Insights";
export const LEARNER_WORK_DRAWER_TITLE = "Work";
export const GENERATE_INSIGHTS_DRAWER_ID = "generate_insights";

export function insightsTracesUrl(
  workspaceId: string,
  blockId?: string | null,
): string {
  const base = `/api/insights/traces?workspaceId=${encodeURIComponent(workspaceId)}`;
  const block = typeof blockId === "string" ? blockId.trim() : "";
  if (!block) return base;
  return `${base}&blockId=${encodeURIComponent(block)}`;
}

export function buildGenerateInsightsSuggestBody(input: {
  thoughts: Array<{ id: string; text: string }>;
  modifyingPrompt?: string | null;
}): { thoughts: Array<{ id: string; text: string }>; modifyingPrompt?: string } {
  const thoughts = input.thoughts
    .filter((thought) => thought?.id && thought?.text?.trim())
    .map((thought) => ({ id: thought.id, text: thought.text.trim() }));
  const modifyingPrompt = String(input.modifyingPrompt || "").trim();
  return modifyingPrompt ? { thoughts, modifyingPrompt } : { thoughts };
}

export function buildGenerateInsightsCreateBody(input: {
  thoughts: Array<{ id: string; text: string }>;
  thoughtIds?: string[];
  workspaceId: string;
  blockId?: string | null;
  sessionId?: string | null;
  modifyingPrompt?: string | null;
}): Record<string, unknown> {
  const thoughts = input.thoughts
    .filter((thought) => thought?.text?.trim())
    .map((thought) => ({
      id: thought.id,
      text: thought.text.trim(),
    }));
  const modifyingPrompt = String(input.modifyingPrompt || "").trim();
  return {
    thoughts,
    thoughtIds: input.thoughtIds ?? thoughts.map((thought) => thought.id),
    workspaceId: input.workspaceId,
    blockId: input.blockId ?? null,
    sessionId: input.sessionId ?? null,
    ...(modifyingPrompt ? { modifyingPrompt } : {}),
  };
}

export function formatInsightDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function insightPublicPath(insight: Pick<InsightSummary, "id" | "share_token">) {
  return `/insights/${insight.share_token || insight.id}`;
}

export function insightShareUrl(
  insight: Pick<InsightSummary, "id" | "share_token">,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  return `${origin}${insightPublicPath(insight)}`;
}

export async function archiveInsight(insightId: string): Promise<void> {
  const response = await fetch(`/api/insights/${insightId}/archive`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(insightApiErrorMessage(data, "Failed to archive insight"));
  }
}