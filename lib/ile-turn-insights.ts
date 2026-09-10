/**
 * ILE turn-close insight craft: unused-PoW slot math, typed XAI verdict
 * allow/refuse, thoughts-pool candidate requests, and persist payloads
 * that plug into existing insight records.
 *
 * Pure — no React. End turn still runs closeIleOpenWorkTurn first; these
 * helpers only govern the crafting phase that follows.
 */
import {
  emptyIlePowTypeCounts,
  type IlePowCounterArtifact,
  type IlePowTypeCounts,
} from "@/lib/ile-pow-counters";
import { ilePowUnifiedPool } from "@/lib/ile-pow-spend";
import {
  buildGenerateInsightsSuggestBody,
  insightsSessionListUrl,
  resolveInsightBlockAndChapterIds,
} from "@/lib/insights";

export { insightsSessionListUrl };

export const ILE_TURN_INSIGHT_SLOT_MAX = 3;
export const ILE_TURN_INSIGHT_EVALUATE_PATH = "/api/insights/evaluate";
export const ILE_TURN_INSIGHT_CREATE_PATH = "/api/insights/create";
export const ILE_TURN_INSIGHT_SUGGEST_PATH = "/api/insights/suggest";

/** Typed tool PoW for an accepted insight craft — not a thought-trace. */
export const ILE_INSIGHT_CRAFT_TOOL_NAME = "insight-crafting" as const;
export const ILE_INSIGHT_CRAFT_TOOL_ACTION = "accepted-craft" as const;
export const ILE_INSIGHT_CRAFT_POW_FILE = "ile-insight-crafting.json" as const;
export const ILE_INSIGHT_CRAFT_META_TYPE =
  "uncertain_systems_ile_insight_craft" as const;

export type IleTypedInsightVerdict = {
  accepted: boolean;
  correct: boolean;
  goodEnough: boolean;
  title: string;
  summary: string;
  reason: string;
};

export type IleTurnInsightThought = {
  id: string;
  text: string;
};

export type IleTurnInsightPersistPayload = {
  title: string;
  summary: string;
  sessionId: string;
  workspaceId: string | null;
  blockId: string | null;
  chapterId: string | null;
  thoughts: IleTurnInsightThought[];
  thoughtIds: string[];
  evaluated: true;
};

/** Leftover unified PoW (typed leftover + thoughts − extra spent units). */
export function unusedIlePowForInsights(input: {
  available: IlePowTypeCounts;
  thoughts?: number | null;
  spentUnits?: number | null;
  spentTyped?: IlePowTypeCounts | null;
}): number {
  return ilePowUnifiedPool({
    available: input.available ?? emptyIlePowTypeCounts(),
    thoughts: input.thoughts,
    spentUnits: input.spentUnits,
    spentTyped: input.spentTyped,
  });
}

/**
 * Available insight slots this turn: unused PoW, capped at 3, never below 0.
 * Monotonic in unused PoW (1 leftover → 1 slot, 2 → 2, 3+ → 3).
 */
export function ileTurnInsightSlotCount(unusedPow: unknown): number {
  const n = Math.floor(Number(unusedPow));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(ILE_TURN_INSIGHT_SLOT_MAX, n);
}

/**
 * Capture leftover unused PoW at End turn. The open craft must keep using
 * this number — newly recorded insight-craft PoW must not reopen slots.
 */
export function freezeIleTurnInsightUnusedPow(unusedPow: unknown): number {
  const n = Math.floor(Number(unusedPow));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export function ileTurnInsightSlotsFromUnusedPow(input: {
  available: IlePowTypeCounts;
  thoughts?: number | null;
  spentUnits?: number | null;
  spentTyped?: IlePowTypeCounts | null;
}): number {
  return ileTurnInsightSlotCount(unusedIlePowForInsights(input));
}

export function remainingIleTurnInsightSlots(input: {
  unusedPow?: unknown;
  slotCount?: unknown;
  craftedCount: unknown;
}): number {
  const max =
    input.slotCount !== undefined
      ? ileTurnInsightSlotCount(input.slotCount)
      : ileTurnInsightSlotCount(input.unusedPow);
  const crafted = Math.max(0, Math.floor(Number(input.craftedCount) || 0));
  return Math.max(0, max - crafted);
}

/**
 * Completing the crafting step is always allowed, including zero crafts.
 * Over-cap crafts are not a valid complete.
 */
export function canCompleteIleTurnInsightCraft(input: {
  craftedCount: unknown;
  unusedPow?: unknown;
  slotCount?: unknown;
}): boolean {
  const crafted = Math.floor(Number(input.craftedCount));
  if (!Number.isFinite(crafted) || crafted < 0) return false;
  const max =
    input.slotCount !== undefined
      ? ileTurnInsightSlotCount(input.slotCount)
      : ileTurnInsightSlotCount(input.unusedPow);
  return crafted <= max;
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function asBool(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    if (n === "true" || n === "yes" || n === "ok") return true;
    if (n === "false" || n === "no") return false;
  }
  return null;
}

/** Normalize an XAI evaluate payload into a verdict the allow helper can read. */
export function parseIleTypedInsightVerdict(raw: unknown): IleTypedInsightVerdict {
  const rec = asRecord(raw);
  const nested = asRecord(rec.verdict);
  const src = Object.keys(nested).length > 0 ? { ...rec, ...nested } : rec;
  const correct = asBool(src.correct) === true;
  const goodEnough =
    asBool(src.goodEnough) === true || asBool(src.good_enough) === true;
  const acceptedFlag =
    asBool(src.accepted) === true ||
    asBool(src.ok) === true ||
    asBool(src.allow) === true;
  const refused =
    asBool(src.accepted) === false ||
    asBool(src.ok) === false ||
    asBool(src.allow) === false;
  const hasQuality =
    src.correct !== undefined ||
    src.goodEnough !== undefined ||
    src.good_enough !== undefined;
  const qualityFromAccepted = !hasQuality && acceptedFlag && !refused;
  return {
    accepted: !refused && (acceptedFlag || correct || goodEnough || qualityFromAccepted),
    correct,
    goodEnough: goodEnough || qualityFromAccepted,
    title: String(src.title ?? "").trim(),
    summary: String(src.summary ?? "").trim(),
    reason: String(src.reason ?? src.message ?? "").trim(),
  };
}

/**
 * Typed path: refuse unless the verdict is correct or good enough.
 * Explicit accepted:false always refuses.
 */
export function allowIleTypedInsightCreate(
  verdict: IleTypedInsightVerdict | null | undefined,
): boolean {
  if (!verdict) return false;
  if (verdict.accepted === false) return false;
  return Boolean(verdict.correct) || Boolean(verdict.goodEnough);
}

export function buildIleTypedInsightEvaluateRequest(input: {
  text: unknown;
  chapterLabel?: string | null;
}): { text: string; chapterLabel?: string } {
  const text = String(input.text ?? "").trim();
  const chapterLabel = String(input.chapterLabel ?? "").trim();
  return chapterLabel ? { text, chapterLabel } : { text };
}

export function typedInsightRecordFromVerdict(input: {
  draft: string;
  verdict: IleTypedInsightVerdict;
}): { title: string; summary: string } | null {
  if (!allowIleTypedInsightCreate(input.verdict)) return null;
  const draft = String(input.draft || "").trim();
  const title =
    input.verdict.title ||
    draft.split(/\n/)[0]?.split(/\s+/).slice(0, 12).join(" ") ||
    "Insight";
  const summary = input.verdict.summary || draft;
  if (!title.trim() || !summary.trim()) return null;
  return { title: title.trim(), summary: summary.trim() };
}

/** Thoughts-pool path: selected traces → existing /api/insights/suggest body. */
export function buildIleThoughtsPoolCandidateRequest(input: {
  thoughts: readonly IleTurnInsightThought[] | null | undefined;
  selectedIds: readonly string[] | null | undefined;
  modifyingPrompt?: string | null;
}): { thoughts: Array<{ id: string; text: string }>; modifyingPrompt?: string } {
  const wanted = new Set(
    (input.selectedIds ?? []).map((id) => String(id || "").trim()).filter(Boolean),
  );
  const thoughts = (input.thoughts ?? []).filter((thought) => {
    if (!thought?.id || !String(thought.text || "").trim()) return false;
    return wanted.size === 0 ? false : wanted.has(thought.id);
  });
  return buildGenerateInsightsSuggestBody({
    thoughts: thoughts.map((thought) => ({
      id: thought.id,
      text: thought.text,
    })),
    modifyingPrompt: input.modifyingPrompt,
  });
}

/** Persist an accepted craft as the existing insight row (session + optional chapter). */
export function buildIleTurnInsightPersistPayload(input: {
  title: unknown;
  summary: unknown;
  sessionId: unknown;
  workspaceId?: string | null;
  blockId?: string | null;
  chapterId?: string | null;
  thoughts?: readonly IleTurnInsightThought[] | null;
  thoughtIds?: readonly string[] | null;
}): IleTurnInsightPersistPayload {
  const thoughts = (input.thoughts ?? [])
    .filter((thought) => thought?.id && String(thought.text || "").trim())
    .map((thought) => ({
      id: String(thought.id),
      text: String(thought.text).trim(),
    }));
  const thoughtIds = (input.thoughtIds ?? thoughts.map((thought) => thought.id))
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const workspaceId = String(input.workspaceId ?? "").trim() || null;
  const link = resolveInsightBlockAndChapterIds({
    blockId: input.blockId,
    chapterId: input.chapterId,
  });
  return {
    title: String(input.title ?? "").trim(),
    summary: String(input.summary ?? "").trim(),
    sessionId: String(input.sessionId ?? "").trim(),
    workspaceId,
    blockId: link.blockId,
    chapterId: link.chapterId,
    thoughts,
    thoughtIds,
    evaluated: true,
  };
}

/**
 * Snapshot-eligible tool PoW for one accepted persist. Missing insight or
 * session id → no event (refused / failed / zero crafts never call this
 * with a saved row).
 */
export function buildIleInsightCraftPowArtifact(input: {
  insightId: unknown;
  sessionId: unknown;
  workspaceId?: string | null;
  blockId?: string | null;
  chapterId?: string | null;
  title?: string | null;
}): IlePowCounterArtifact | null {
  const insightId = String(input.insightId ?? "").trim();
  const sessionId = String(input.sessionId ?? "").trim();
  if (!insightId || !sessionId) return null;
  const workspaceId = String(input.workspaceId ?? "").trim() || null;
  const blockId = String(input.blockId ?? "").trim() || null;
  const chapterId = String(input.chapterId ?? "").trim() || null;
  const title = String(input.title ?? "").trim() || null;
  return {
    type: "tool",
    tool_name: ILE_INSIGHT_CRAFT_TOOL_NAME,
    tool_action: ILE_INSIGHT_CRAFT_TOOL_ACTION,
    block_id: blockId,
    chapter_id: chapterId,
    metadata: {
      type: ILE_INSIGHT_CRAFT_META_TYPE,
      insight_id: insightId,
      session_id: sessionId,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      ...(title ? { title } : {}),
    },
  };
}

/** Only a successful insight create emits craft PoW. */
export function ileInsightCraftPowFromAcceptedPersist(input: {
  persistOk: boolean;
  insight?: {
    id?: string | null;
    title?: string | null;
    block_id?: string | null;
    chapter_id?: string | null;
    session_id?: string | null;
    workspace_id?: string | null;
  } | null;
  sessionId: unknown;
  workspaceId?: string | null;
  blockId?: string | null;
  chapterId?: string | null;
}): IlePowCounterArtifact | null {
  if (!input.persistOk) return null;
  const insight = input.insight;
  if (!insight?.id) return null;
  return buildIleInsightCraftPowArtifact({
    insightId: insight.id,
    sessionId: insight.session_id || input.sessionId,
    workspaceId: insight.workspace_id ?? input.workspaceId,
    blockId: insight.block_id ?? input.blockId,
    chapterId: insight.chapter_id ?? input.chapterId,
    title: insight.title,
  });
}


