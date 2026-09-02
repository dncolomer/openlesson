/**
 * ILE TIM × chapter map — chapter-complete path.
 *
 * Completing a chapter is Proof of Work (`session_plan` / `chapter_done`).
 * TIM reads that event plus LWM evidence appetite and schedules a
 * `chapter_map_expand` interruption. ILE applies it on a dedicated map
 * timer (not the Helios dialogue scheduler, so idle/speech PoW cannot
 * supersede it). The new tile uses a TIM-explore icon until the learner
 * accepts it (3×3 blocky glyph) or rejects it (tile cleared).
 *
 * Idle TIM map effects are intentionally not implemented here — see
 * ILE_TIM_MAP_INTERACTIONS for follow-on ideas.
 */
import { findClosestEmptyChapterSlot } from "@/lib/ile-chapter-follow-ups";
import { ILE_SESSION_MODE_DEFAULT, type IleSessionMode } from "@/lib/ile-mode";
import type { IleHeliosPowOrigin } from "@/lib/ile-helios-trigger";
import {
  TIM_EXPLORE_MAP_ICON,
  blockMapGlyphDbFields,
  blockMapGlyphForLabel,
  isTimExploreMapIcon,
  randFromSeed,
} from "@/lib/block-map-glyph";
import type {
  PredictiveInterruption,
  ProofOfWorkApiInterruption,
} from "@/lib/pow-api/predictive-interruption-types";
import type { TimFeatureEnvelopeV1 } from "@/lib/pow-api/tim-feature-envelope";
import { normalizePredictedInterruption } from "@/lib/pow-api/tim-normalize";
import type { TimLlmRawPrediction } from "@/lib/pow-api/tim-llm-predictor";
import type { SessionPlan, SessionPlanStep } from "@/lib/domain/types";

export const ILE_CHAPTER_DONE_TOOL_NAME = "session_plan" as const;
export const ILE_CHAPTER_DONE_TOOL_ACTION = "chapter_done" as const;
export const ILE_CHAPTER_DONE_POW_EVENT = "chapter_done" as const;

export const CHAPTER_MAP_EXPAND_INTERVENTION = "chapter_map_expand" as const;
export const EXPAND_CHAPTER_MAP_ACTION = "expand_chapter_map" as const;

export const ILE_CHAPTER_COMPLETE_TIM_DELAY_MS = 8_000;
export const ILE_CHAPTER_COMPLETE_TIM_MIN_DELAY_MS = 2_000;
/** One chapter-complete TIM may place this many adjacent tiles at once. */
export const ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS = 3;
/** When appetite is thin, still fan out at least this many adjacent tiles. */
export const ILE_CHAPTER_COMPLETE_DEFAULT_EXPANSIONS = 2;

export const ILE_CHAPTER_SOURCE_TIM = "tim_chapter_complete" as const;
export const ILE_CHAPTER_SOURCE_LEARNER = "learner" as const;
export const ILE_CHAPTER_SOURCE_PLAN = "plan" as const;

export type IleChapterSource =
  | typeof ILE_CHAPTER_SOURCE_TIM
  | typeof ILE_CHAPTER_SOURCE_LEARNER
  | typeof ILE_CHAPTER_SOURCE_PLAN;

export type IleChapterSuggestionPayload = {
  topic: string;
  title: string;
  description: string;
  keyword?: string;
  source_step_id?: string | null;
};

/** Follow-on ILE map interactions. Only `chapter_complete_expand` is shipped. */
export type IleTimMapInteractionStatus = "shipped" | "planned";

export type IleTimMapInteraction = {
  id: string;
  title: string;
  status: IleTimMapInteractionStatus;
  tim_source: string;
  effect: "positive" | "negative" | "neutral";
  summary: string;
};

export const ILE_TIM_MAP_INTERACTIONS: readonly IleTimMapInteraction[] = [
  {
    id: "chapter_complete_expand",
    title: "Chapter-complete expansion",
    status: "shipped",
    tim_source: "upload_ile_chapter_done",
    effect: "positive",
    summary:
      "Mark as Done is PoW; TIM + evidence appetite place 1–3 adjacent TIM-sourced chapters (explore icon until accepted or rejected).",
  },
  {
    id: "idle_fog_creep",
    title: "Idle fog creep",
    status: "planned",
    tim_source: "upload_ile_idle",
    effect: "negative",
    summary: "Long idle grows fog over unvisited empty cells so the map cools.",
  },
  {
    id: "idle_wilt_unopened",
    title: "Wilt ignored TIM tiles",
    status: "planned",
    tim_source: "upload_ile_idle",
    effect: "negative",
    summary: "Unopened TIM-explore chapters dim if idle TIM fires before the learner opens them.",
  },
  {
    id: "idle_current_pulse",
    title: "Keep-alive pulse",
    status: "planned",
    tim_source: "upload_ile_idle",
    effect: "positive",
    summary: "Short idle TIM pulses the active chapter so the map still feels inhabited.",
  },
  {
    id: "speech_keyword_highlight",
    title: "Speech keyword highlight",
    status: "planned",
    tim_source: "upload_ile_speech",
    effect: "positive",
    summary: "Speech TIM highlights chapters whose keywords match the transcript.",
  },
  {
    id: "appetite_settle",
    title: "Appetite settle",
    status: "planned",
    tim_source: "upload_ile_chapter_done",
    effect: "neutral",
    summary: "Saturated chapter expansion + empty want_more stops TIM from growing the map.",
  },
  {
    id: "skip_withdraw",
    title: "Skip withdraws suggestions",
    status: "planned",
    tim_source: "session_plan/skip",
    effect: "negative",
    summary: "Skipping a chapter withdraws nearby unopened TIM tiles.",
  },
] as const;

export function isIleChapterDonePow(
  toolName: string | null | undefined,
  toolAction: string | null | undefined,
): boolean {
  return (
    toolName === ILE_CHAPTER_DONE_TOOL_NAME &&
    toolAction === ILE_CHAPTER_DONE_TOOL_ACTION
  );
}

export function ilePowInterruptionOriginFromTool(
  toolName: string | null | undefined,
  toolAction: string | null | undefined,
): IleHeliosPowOrigin {
  if (isIleChapterDonePow(toolName, toolAction)) return "chapter_done";
  return "other";
}

export function isChapterMapExpandInterruption(
  interruption: ProofOfWorkApiInterruption | undefined,
): interruption is PredictiveInterruption {
  if (!interruption) return false;
  const type = interruption.intervention?.type;
  const action = interruption.intervention?.consumer_action;
  return type === CHAPTER_MAP_EXPAND_INTERVENTION || action === EXPAND_CHAPTER_MAP_ACTION;
}

export function isTimUnopenedChapter(
  step: Pick<SessionPlanStep, "source" | "tim_unopened" | "map_icon"> | null | undefined,
): boolean {
  if (!step) return false;
  if (step.tim_unopened === false) return false;
  if (step.source === ILE_CHAPTER_SOURCE_TIM) return true;
  return isTimExploreMapIcon(step.map_icon);
}

export function displayChapterMapIcon(
  step: Pick<SessionPlanStep, "source" | "tim_unopened" | "map_icon" | "description" | "id">,
): string {
  if (isTimUnopenedChapter(step)) return TIM_EXPLORE_MAP_ICON;
  if (step.map_icon && !isTimExploreMapIcon(step.map_icon)) return step.map_icon;
  return blockMapGlyphForLabel(step.description || "", step.id).map_icon;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown, max = 400): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function payloadFromChapterSuggestion(raw: unknown): IleChapterSuggestionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const topic = str(rec.topic, 200) || str(rec.title, 200) || str(rec.description, 200);
  if (topic.length < 3) return null;
  const title = str(rec.title, 120) || topic.slice(0, 120);
  const description = str(rec.description, 400) || title;
  const keyword = str(rec.keyword ?? rec.map_keyword, 28) || undefined;
  const source_step_id = str(rec.source_step_id, 80) || null;
  return { topic, title, description, ...(keyword ? { keyword } : {}), source_step_id };
}

export function chapterSuggestionFromInterruption(
  interruption: PredictiveInterruption | null | undefined,
): IleChapterSuggestionPayload | null {
  const many = chapterSuggestionsFromInterruption(interruption);
  return many[0] ?? null;
}

export function chapterSuggestionsFromInterruption(
  interruption: PredictiveInterruption | null | undefined,
): IleChapterSuggestionPayload[] {
  if (!interruption) return [];
  const rec = interruption.intervention;
  const rawList = Array.isArray(rec.chapter_suggestions)
    ? rec.chapter_suggestions
    : rec.chapter_suggestion
      ? [rec.chapter_suggestion]
      : [];
  const out: IleChapterSuggestionPayload[] = [];
  const seen = new Set<string>();
  for (const item of rawList) {
    const payload = payloadFromChapterSuggestion(item);
    if (!payload) continue;
    const key = payload.description.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(payload);
    if (out.length >= ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS) break;
  }
  return out;
}

function humanizeAppetiteToken(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const APPETITE_SKIP = new Set([
  "tool_crud_events",
  "idle_heartbeat",
  "screenshot",
  "screen",
  "eeg",
]);

export function appetiteExpansionHints(
  appetite: { want_more?: string[]; saturated?: string[] } | null | undefined,
): string[] {
  const want = (appetite?.want_more ?? []).map((item) => String(item || "").trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of want) {
    if (APPETITE_SKIP.has(token.toLowerCase())) continue;
    const hint = humanizeAppetiteToken(token);
    if (!hint) continue;
    const key = hint.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hint);
    if (out.length >= ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS) break;
  }
  return out;
}

export function appetiteExpansionHint(
  appetite: { want_more?: string[]; saturated?: string[] } | null | undefined,
): string | null {
  return appetiteExpansionHints(appetite)[0] ?? null;
}

function fallbackExpansionBodies(completed: string): IleChapterSuggestionPayload[] {
  const short = completed.slice(0, 80);
  return [
    {
      topic: completed.slice(0, 200),
      title: `Go deeper from ${short}`.slice(0, 120),
      description: `Go deeper from ${completed}`.slice(0, 400),
      keyword: "Go Deeper",
    },
    {
      topic: completed.slice(0, 200),
      title: `Apply ${short}`.slice(0, 120),
      description: `Apply ${completed} to a new case`.slice(0, 400),
      keyword: "Apply Case",
    },
    {
      topic: completed.slice(0, 200),
      title: `Contrast ${short}`.slice(0, 120),
      description: `Contrast ${completed} with a nearby idea`.slice(0, 400),
      keyword: "Contrast",
    },
  ];
}

export function buildChapterCompleteExpansionSuggestions(input: {
  completedDescription?: string | null;
  completedStepId?: string | null;
  appetite?: { want_more?: string[]; saturated?: string[] } | null;
  llmMessage?: string | null;
}): IleChapterSuggestionPayload[] {
  const completed = str(input.completedDescription, 160) || "the chapter you just finished";
  const source_step_id = input.completedStepId ?? null;
  const hints = appetiteExpansionHints(input.appetite);
  const llm = str(input.llmMessage, 280);
  const out: IleChapterSuggestionPayload[] = [];
  const seen = new Set<string>();

  const push = (payload: IleChapterSuggestionPayload) => {
    const key = payload.description.toLowerCase();
    if (seen.has(key) || payload.description.trim().length < 3) return;
    seen.add(key);
    out.push({ ...payload, source_step_id });
  };

  if (llm.length >= 3) {
    push({
      topic: (hints[0] || completed).slice(0, 200),
      title: llm.slice(0, 120),
      description: llm.slice(0, 400),
      source_step_id,
    });
  }
  for (const hint of hints) {
    push({
      topic: hint.slice(0, 200),
      title: `Explore ${hint}`.slice(0, 120),
      description: `Explore ${hint} next to ${completed}`.slice(0, 400),
      source_step_id,
    });
  }
  const target = Math.min(
    ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS,
    Math.max(ILE_CHAPTER_COMPLETE_DEFAULT_EXPANSIONS, hints.length),
  );
  for (const fallback of fallbackExpansionBodies(completed)) {
    if (out.length >= target) break;
    push({ ...fallback, source_step_id });
  }
  if (out.length === 0) {
    push({ ...fallbackExpansionBodies(completed)[0], source_step_id });
  }
  return out.slice(0, ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS);
}

export function buildChapterCompleteExpansionSuggestion(input: {
  completedDescription?: string | null;
  completedStepId?: string | null;
  appetite?: { want_more?: string[]; saturated?: string[] } | null;
  llmMessage?: string | null;
}): IleChapterSuggestionPayload {
  return (
    buildChapterCompleteExpansionSuggestions(input)[0] ?? {
      topic: "Explore",
      title: "Explore",
      description: "Go deeper from the chapter you just finished",
      source_step_id: input.completedStepId ?? null,
    }
  );
}

/**
 * Shipped TIM decision for ILE chapter-complete PoW.
 * Always recommends a map expansion; appetite biases the suggested chapter.
 */
export function predictChapterCompleteMapExpansion(
  features: TimFeatureEnvelopeV1,
): PredictiveInterruption {
  const metadata = asRecord(features.proof_of_work.artifact_metadata);
  const completedStepId =
    str(metadata?.stepId, 80) ||
    str(metadata?.step_id, 80) ||
    str(metadata?.current_chapter_id, 80) ||
    null;
  const completedDescription =
    str(metadata?.stepDescription, 160) ||
    str(metadata?.step_description, 160) ||
    str(features.proof_of_work.artifact_summary, 160);

  const suggestions = buildChapterCompleteExpansionSuggestions({
    completedDescription,
    completedStepId,
    appetite: features.learning_world_model?.evidence_appetite ?? null,
  });
  const suggestion = suggestions[0];
  if (!suggestion) {
    throw new Error("chapter-complete TIM expansion produced no suggestions");
  }

  const appetiteHint = appetiteExpansionHint(
    features.learning_world_model?.evidence_appetite ?? null,
  );
  const confidence = appetiteHint ? "high" : "medium";
  const delay_ms = ILE_CHAPTER_COMPLETE_TIM_DELAY_MS;
  const message =
    suggestions.length > 1
      ? suggestions.map((item) => item.title).join(" · ")
      : suggestion.description;

  const normalized = normalizePredictedInterruption(
    {
      delay_ms,
      confidence,
      intervention: {
        type: CHAPTER_MAP_EXPAND_INTERVENTION,
        message,
        rationale: appetiteHint
          ? `Chapter complete PoW plus evidence appetite want_more (${appetiteHint}) — grow the ILE chapter map with ${suggestions.length} adjacent chapters.`
          : `Chapter complete is Proof of Work; TIM grows the chapter map with ${suggestions.length} adjacent chapters so the session stays spatially alive.`,
        consumer_action: EXPAND_CHAPTER_MAP_ACTION,
        block_id: features.event.block_id ?? null,
        chapter_suggestion: suggestion,
        chapter_suggestions: suggestions,
      },
    },
    features.event.endpoint,
    features.event.workspace_id,
  );

  if (!normalized) {
    throw new Error("chapter-complete TIM expansion failed to normalize");
  }
  return normalized;
}

export function enrichChapterCompleteTimWithLlm(
  base: PredictiveInterruption,
  raw: TimLlmRawPrediction | null | undefined,
): PredictiveInterruption {
  if (!raw?.should_interrupt) return base;
  const llmMessage = str(raw.message, 280);
  const suggestions = chapterSuggestionsFromInterruption(base);
  if (llmMessage.length >= 3 && suggestions[0]) {
    suggestions[0] = {
      ...suggestions[0],
      title: llmMessage.slice(0, 120),
      description: llmMessage.slice(0, 400),
    };
  }
  const suggestion = suggestions[0] ?? {
    topic: base.intervention.message,
    title: base.intervention.message.slice(0, 120),
    description: base.intervention.message,
  };
  const delayRaw = Number(raw.delay_ms);
  const delay_ms = Number.isFinite(delayRaw)
    ? Math.min(
        Math.max(Math.trunc(delayRaw), ILE_CHAPTER_COMPLETE_TIM_MIN_DELAY_MS),
        600_000,
      )
    : base.delay_ms;
  const confidence =
    raw.confidence === "low" || raw.confidence === "medium" || raw.confidence === "high"
      ? raw.confidence
      : base.confidence;
  const message =
    suggestions.length > 1
      ? suggestions.map((item) => item.title).join(" · ")
      : suggestion.description;
  const normalized = normalizePredictedInterruption(
    {
      interruption_id: base.interruption_id,
      delay_ms,
      confidence,
      intervention: {
        type: CHAPTER_MAP_EXPAND_INTERVENTION,
        message,
        rationale: str(raw.rationale, 2000) || base.intervention.rationale,
        consumer_action: EXPAND_CHAPTER_MAP_ACTION,
        block_id: base.intervention.block_id ?? null,
        chapter_suggestion: suggestion,
        chapter_suggestions: suggestions.length ? suggestions : [suggestion],
      },
    },
    "upload_ile_chapter_done",
    undefined,
  );
  return normalized ?? base;
}

export async function predictIleChapterCompleteInterruption(
  features: TimFeatureEnvelopeV1,
  llm?: (features: TimFeatureEnvelopeV1) => Promise<TimLlmRawPrediction | null>,
): Promise<ProofOfWorkApiInterruption> {
  const base = predictChapterCompleteMapExpansion(features);
  if (!llm) return base;
  try {
    const raw = await llm(features);
    return enrichChapterCompleteTimWithLlm(base, raw);
  } catch {
    return base;
  }
}

export function resolveChapterCompleteExpansionAnchor(
  plan: SessionPlan,
  interruption: PredictiveInterruption,
): SessionPlanStep | null {
  const suggestion = chapterSuggestionFromInterruption(interruption);
  const sourceId = suggestion?.source_step_id;
  if (sourceId) {
    const match = plan.steps.find((step) => step.id === sourceId);
    if (match) return match;
  }
  const completed = [...plan.steps].reverse().find((step) => step.status === "completed");
  return completed ?? plan.steps[plan.currentStepIndex] ?? plan.steps[0] ?? null;
}

export function countTimExpansionsFrom(
  plan: SessionPlan,
  sourceStepId: string | null | undefined,
): number {
  if (!sourceStepId) return 0;
  return plan.steps.filter(
    (step) =>
      step.source === ILE_CHAPTER_SOURCE_TIM && step.source_step_id === sourceStepId,
  ).length;
}

export function alreadyHasTimExpansionFrom(
  plan: SessionPlan,
  sourceStepId: string | null | undefined,
): boolean {
  return countTimExpansionsFrom(plan, sourceStepId) > 0;
}

function existingTimDescriptionsFrom(
  plan: SessionPlan,
  sourceStepId: string | null | undefined,
): Set<string> {
  const seen = new Set<string>();
  if (!sourceStepId) return seen;
  for (const step of plan.steps) {
    if (step.source !== ILE_CHAPTER_SOURCE_TIM || step.source_step_id !== sourceStepId) continue;
    const key = String(step.description || "").trim().toLowerCase();
    if (key) seen.add(key);
  }
  return seen;
}

export function buildTimChapterCompleteStep(input: {
  id: string;
  suggestion: IleChapterSuggestionPayload;
  position: { row: number; col: number };
  order: number;
  sessionMode?: IleSessionMode;
}): SessionPlanStep {
  void input.sessionMode;
  const description = String(input.suggestion.description || input.suggestion.title || "").trim();
  const glyph = blockMapGlyphDbFields(
    {
      keyword: input.suggestion.keyword,
      title: input.suggestion.title || description,
    },
    description,
    randFromSeed(input.id),
  );
  return {
    id: input.id,
    description,
    status: "pending",
    type: "task",
    order: input.order,
    position_x: input.position.col,
    position_y: input.position.row,
    map_keyword: glyph.map_keyword,
    map_icon: TIM_EXPLORE_MAP_ICON,
    source: ILE_CHAPTER_SOURCE_TIM,
    source_step_id: input.suggestion.source_step_id ?? null,
    tim_unopened: true,
  };
}

export function applyChapterCompleteTimExpansionToPlan(input: {
  plan: SessionPlan;
  interruption: PredictiveInterruption;
  newStepId?: string;
  newStepIds?: string[];
  sessionMode?: IleSessionMode;
}): { plan: SessionPlan; added: SessionPlanStep[] } | null {
  const anchor = resolveChapterCompleteExpansionAnchor(input.plan, input.interruption);
  if (!anchor) return null;

  const ids: string[] = [];
  for (const id of input.newStepIds ?? []) {
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (input.newStepId && !ids.includes(input.newStepId)) ids.unshift(input.newStepId);
  if (ids.length === 0) return null;

  const existingCount = countTimExpansionsFrom(input.plan, anchor.id);
  const remainingSlots = Math.max(0, ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS - existingCount);
  if (remainingSlots === 0) return null;

  let suggestions = chapterSuggestionsFromInterruption(input.interruption);
  if (suggestions.length === 0) {
    suggestions = buildChapterCompleteExpansionSuggestions({
      completedDescription: anchor.description,
      completedStepId: anchor.id,
    });
  }
  const already = existingTimDescriptionsFrom(input.plan, anchor.id);
  const toPlace: IleChapterSuggestionPayload[] = [];
  for (const suggestion of suggestions) {
    const next = {
      ...suggestion,
      source_step_id: suggestion.source_step_id || anchor.id,
    };
    const key = next.description.toLowerCase();
    if (already.has(key)) continue;
    already.add(key);
    toPlace.push(next);
    if (toPlace.length >= remainingSlots) break;
    if (toPlace.length >= ids.length) break;
  }
  if (toPlace.length === 0) return null;

  let plan = input.plan;
  const added: SessionPlanStep[] = [];
  for (let i = 0; i < toPlace.length; i += 1) {
    const slot = findClosestEmptyChapterSlot(plan, anchor);
    const step = buildTimChapterCompleteStep({
      id: ids[i],
      suggestion: toPlace[i],
      position: slot,
      order: plan.steps.length,
      sessionMode: input.sessionMode ?? ILE_SESSION_MODE_DEFAULT,
    });
    if (!step.description.trim()) continue;
    plan = { ...plan, steps: [...plan.steps, step] };
    added.push(step);
  }
  if (added.length === 0) return null;
  return { plan, added };
}

export function revealTimChapterIcon(step: SessionPlanStep): SessionPlanStep {
  if (!isTimUnopenedChapter(step)) {
    return { ...step, tim_unopened: false };
  }
  const glyph = blockMapGlyphForLabel(step.description || "", step.id);
  return {
    ...step,
    map_keyword: step.map_keyword || glyph.map_keyword,
    map_icon: glyph.map_icon,
    tim_unopened: false,
  };
}

export function revealTimChapterIconOnPlan(
  plan: SessionPlan,
  stepId: string,
): { plan: SessionPlan; changed: boolean } {
  let changed = false;
  const steps = plan.steps.map((step) => {
    if (step.id !== stepId) return step;
    if (!isTimUnopenedChapter(step)) return step;
    changed = true;
    return revealTimChapterIcon(step);
  });
  return { plan: changed ? { ...plan, steps } : plan, changed };
}

/** Reject an unopened TIM chapter: drop the step so the cell is empty again. */
export function rejectTimChapterFromPlan(
  plan: SessionPlan,
  stepId: string,
): { plan: SessionPlan; changed: boolean } {
  const id = typeof stepId === "string" ? stepId.trim() : "";
  if (!id) return { plan, changed: false };
  const removedIndex = plan.steps.findIndex((step) => step.id === id);
  if (removedIndex < 0) return { plan, changed: false };
  const step = plan.steps[removedIndex];
  if (!isTimUnopenedChapter(step)) return { plan, changed: false };
  const steps = plan.steps
    .filter((row) => row.id !== id)
    .map((row, index) => ({ ...row, order: index }));
  let currentStepIndex = plan.currentStepIndex;
  if (removedIndex <= currentStepIndex) {
    currentStepIndex = Math.max(0, currentStepIndex - 1);
  }
  if (steps.length === 0) currentStepIndex = 0;
  else if (currentStepIndex > steps.length - 1) currentStepIndex = steps.length - 1;
  return { plan: { ...plan, steps, currentStepIndex }, changed: true };
}

export type IleMapSchedulerPending = {
  interruptionId: string;
  delayMs: number;
  startedAt: number;
  stepId: string | null;
};

export const ILE_MARK_DONE_AWAITING_ID = "ile-mark-done-awaiting" as const;

/** Optimistic bar from the Mark as Done click, before TIM responds. */
export function beginIleMarkDoneProgress(
  stepId: string | null | undefined,
  now = Date.now(),
): IleMapSchedulerPending | null {
  const id = typeof stepId === "string" ? stepId.trim() : "";
  if (!id) return null;
  return {
    interruptionId: ILE_MARK_DONE_AWAITING_ID,
    delayMs: ILE_CHAPTER_COMPLETE_TIM_DELAY_MS,
    startedAt: now,
    stepId: id,
  };
}

export function remainingIleMapDelayMs(
  pending: Pick<IleMapSchedulerPending, "startedAt" | "delayMs"> | null | undefined,
  now = Date.now(),
): number {
  if (!pending) return 0;
  const delay = Number(pending.delayMs);
  if (!Number.isFinite(delay) || delay <= 0) return 0;
  const started = Number(pending.startedAt);
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, delay - (now - started));
}

/**
 * Keep the click-time startedAt when TIM arrives for the same chapter so the
 * bar does not reset after the network wait.
 */
export function mergeIleMapDelayWithTim(
  current: IleMapSchedulerPending | null | undefined,
  interruption: PredictiveInterruption,
  now = Date.now(),
): { pending: IleMapSchedulerPending; remainingMs: number } {
  const suggestion = chapterSuggestionFromInterruption(interruption);
  const stepId = suggestion?.source_step_id ?? current?.stepId ?? null;
  const delayMs = Math.max(interruption.delay_ms, 0);
  const sameChapter =
    Boolean(current?.stepId) && Boolean(stepId) && current?.stepId === stepId;
  const startedAt = sameChapter && current ? current.startedAt : now;
  const pending: IleMapSchedulerPending = {
    interruptionId: interruption.interruption_id,
    delayMs,
    startedAt,
    stepId,
  };
  return { pending, remainingMs: remainingIleMapDelayMs(pending, now) };
}

/**
 * Filling bar while a TIM map-expansion delay is pending.
 * (0, 1] during the wait; 0 when idle or after the delay finishes.
 */
export function ileTimDelayProgressFraction(
  pending: Pick<IleMapSchedulerPending, "startedAt" | "delayMs"> | null | undefined,
  now = Date.now(),
): number {
  if (!pending) return 0;
  const delay = Number(pending.delayMs);
  if (!Number.isFinite(delay) || delay <= 0) return 0;
  const started = Number(pending.startedAt);
  if (!Number.isFinite(started)) return 0;
  const elapsed = now - started;
  if (elapsed >= delay) return 0;
  if (elapsed <= 0) return 0.08;
  return Math.min(1, elapsed / delay);
}

export type IleMapInterruptionScheduler = {
  apply: (interruption: ProofOfWorkApiInterruption) => void;
  begin: (stepId: string | null | undefined) => void;
  clear: () => void;
  getPending: () => IleMapSchedulerPending | null;
};

/**
 * Dedicated ILE map-expansion timer. Idle/speech TIM (Helios path) must not
 * supersede a pending chapter-complete map expansion.
 */
export function createIleMapInterruptionScheduler(
  onExpand: (interruption: PredictiveInterruption) => void,
  onPendingChange?: (pending: IleMapSchedulerPending | null) => void,
): IleMapInterruptionScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingId: string | null = null;
  let pending: IleMapSchedulerPending | null = null;

  const setPending = (next: IleMapSchedulerPending | null) => {
    pending = next;
    onPendingChange?.(next);
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingId = null;
  };

  const clear = () => {
    clearTimer();
    setPending(null);
  };

  const apply = (interruption: ProofOfWorkApiInterruption) => {
    if (!isChapterMapExpandInterruption(interruption)) return;
    const merged = mergeIleMapDelayWithTim(pending, interruption);
    clearTimer();
    const interruptionId = interruption.interruption_id;
    pendingId = interruptionId;
    setPending(merged.pending);
    timer = setTimeout(() => {
      if (pendingId !== interruptionId) return;
      setPending(null);
      onExpand(interruption);
      pendingId = null;
      timer = null;
    }, merged.remainingMs);
  };

  const begin = (stepId: string | null | undefined) => {
    const next = beginIleMarkDoneProgress(stepId);
    if (!next?.stepId) return;
    if (
      pending?.stepId === next.stepId &&
      pending.interruptionId !== ILE_MARK_DONE_AWAITING_ID
    ) {
      return;
    }
    if (
      pending?.stepId === next.stepId &&
      pending.interruptionId === ILE_MARK_DONE_AWAITING_ID
    ) {
      return;
    }
    clearTimer();
    pendingId = next.interruptionId;
    setPending(next);
    timer = setTimeout(() => {
      if (pendingId !== ILE_MARK_DONE_AWAITING_ID) return;
      setPending(null);
      pendingId = null;
      timer = null;
    }, next.delayMs);
  };

  return { apply, begin, clear, getPending: () => pending };
}
