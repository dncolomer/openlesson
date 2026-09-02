import {
  TIM_INTERVENTION_TYPE_CATALOG,
  type InterruptionChapterSuggestion,
  type InterruptionInterventionType,
  type ProofOfWorkApiEndpoint,
  type ProofOfWorkApiInterruption,
} from "./predictive-interruption-types";

export type {
  InterruptionInterventionType,
  ProofOfWorkApiEndpoint,
  ProofOfWorkApiInterruption,
} from "./predictive-interruption-types";

function createInterruptionId(endpoint: ProofOfWorkApiEndpoint, workspaceId?: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  const scope = workspaceId ? workspaceId.slice(0, 8) : "global";
  return `int_${endpoint}_${scope}_${suffix}`;
}

function clampDelayMs(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function normalizePredictedInterruption(
  raw: unknown,
  fallbackEndpoint: ProofOfWorkApiEndpoint,
  workspaceId?: string,
): ProofOfWorkApiInterruption {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const interventionRaw = record.intervention;
  if (!interventionRaw || typeof interventionRaw !== "object" || Array.isArray(interventionRaw)) {
    return null;
  }

  const intervention = interventionRaw as Record<string, unknown>;
  const type = intervention.type;
  const message = typeof intervention.message === "string" ? intervention.message.trim() : "";
  if (!message) return null;

  const allowedTypes: InterruptionInterventionType[] = [...TIM_INTERVENTION_TYPE_CATALOG];
  const interventionType = allowedTypes.includes(type as InterruptionInterventionType)
    ? (type as InterruptionInterventionType)
    : "reflection_prompt";

  const confidenceRaw = record.confidence;
  const confidence =
    confidenceRaw === "low" || confidenceRaw === "medium" || confidenceRaw === "high"
      ? confidenceRaw
      : "medium";

  const minDelay = interventionType === "chapter_map_expand" ? 2_000 : 15_000;

  return {
    interruption_id:
      typeof record.interruption_id === "string" && record.interruption_id.trim()
        ? record.interruption_id.trim()
        : createInterruptionId(fallbackEndpoint, workspaceId),
    delay_ms: clampDelayMs(Number(record.delay_ms), minDelay, 600_000),
    intervention: {
      type: interventionType,
      message: message.slice(0, 2000),
      rationale:
        typeof intervention.rationale === "string" ? intervention.rationale.trim().slice(0, 2000) : undefined,
      consumer_action:
        typeof intervention.consumer_action === "string"
          ? intervention.consumer_action.trim().slice(0, 500)
          : undefined,
      block_id:
        typeof intervention.block_id === "string"
          ? intervention.block_id
          : intervention.block_id === null
            ? null
            : undefined,
      ...chapterSuggestionFields(intervention),
    },
    confidence,
    predicted_at: new Date().toISOString(),
  };
}

function normalizeChapterSuggestion(raw: unknown): InterruptionChapterSuggestion | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const topic =
    typeof rec.topic === "string"
      ? rec.topic.trim()
      : typeof rec.title === "string"
        ? rec.title.trim()
        : typeof rec.description === "string"
          ? rec.description.trim()
          : "";
  if (topic.length < 3) return undefined;
  const title =
    typeof rec.title === "string" && rec.title.trim() ? rec.title.trim() : topic;
  const description =
    typeof rec.description === "string" && rec.description.trim()
      ? rec.description.trim()
      : title;
  const keywordRaw =
    typeof rec.keyword === "string"
      ? rec.keyword.trim()
      : typeof rec.map_keyword === "string"
        ? rec.map_keyword.trim()
        : "";
  const source =
    typeof rec.source_step_id === "string" && rec.source_step_id.trim()
      ? rec.source_step_id.trim()
      : rec.source_step_id === null
        ? null
        : undefined;
  return {
    topic: topic.slice(0, 200),
    title: title.slice(0, 120),
    description: description.slice(0, 400),
    ...(keywordRaw ? { keyword: keywordRaw.slice(0, 28) } : {}),
    source_step_id: source,
  };
}

function normalizeChapterSuggestionList(raw: unknown): InterruptionChapterSuggestion[] {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? [raw]
      : [];
  const out: InterruptionChapterSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const suggestion = normalizeChapterSuggestion(item);
    if (!suggestion) continue;
    const key = suggestion.description.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
    if (out.length >= 3) break;
  }
  return out;
}

function chapterSuggestionFields(intervention: Record<string, unknown>): {
  chapter_suggestion?: InterruptionChapterSuggestion;
  chapter_suggestions?: InterruptionChapterSuggestion[];
} {
  const fromList = normalizeChapterSuggestionList(intervention.chapter_suggestions);
  const fromSingle = normalizeChapterSuggestion(intervention.chapter_suggestion);
  const merged: InterruptionChapterSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of [...fromList, ...(fromSingle ? [fromSingle] : [])]) {
    const key = item.description.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= 3) break;
  }
  if (merged.length === 0) return {};
  return {
    chapter_suggestion: merged[0],
    chapter_suggestions: merged,
  };
}
