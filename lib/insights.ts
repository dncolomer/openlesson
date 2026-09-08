export type InsightSummary = {
  id: string;
  title: string;
  summary: string;
  workspace_id?: string | null;
  block_id?: string | null;
  session_id?: string | null;
  aesthetic_image?: string | null;
  share_token?: string | null;
  created_at: string;
  archived_at?: string | null;
};

/**
 * Product surfaces that host Thought Memory and/or Insights.
 * Generation (suggest/create) is allowed in ILE and Knowledge only — never TAP.
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
    throw new Error(data.error || "Failed to archive insight");
  }
}