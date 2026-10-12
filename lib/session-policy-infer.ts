/**
 * Infer the discrete policy from canvas proof of work.
 * The gate, the reply parser, and the winner are pure. Tests pass a reply string.
 * The xAI call lives in lib/session-policy-infer-xai.ts and is not imported here.
 */

import { advanceSessionBranchModel, SESSION_BRANCH_ACTION_ORDER, type SessionBranchModel } from "@/lib/session-branch-model";
import type { SessionMarkButtonId } from "@/lib/session-marks";

/** Live sessions wait for more than one new proof event, or for this much time. */
export const SESSION_POLICY_INFER_EVENT_THRESHOLD = 3;
export const SESSION_POLICY_INFER_INTERVAL_MS = 20_000;

export type SessionPolicyInferThresholds = {
  eventCount: number;
  elapsedMs: number;
};

export type SessionPolicyProofEvent = {
  action: string;
  prompt?: string;
};

export type SessionPolicyConfidence = Record<SessionMarkButtonId, number>;

export type SessionPolicyInference = {
  action: SessionMarkButtonId;
  confidence: number;
  label: string;
};

const ALIASES: Record<string, SessionMarkButtonId> = {
  close: "try",
  try: "try",
  keep: "hold",
  hold: "hold",
  discard: "drop",
  drop: "drop",
  insight: "insight",
};

const RAW_LABEL = /^(close|keep|discard|insight)[.!?]*$/i;

const ACTION_LINE_KEY: Record<SessionMarkButtonId, string> = {
  try: "closeLine",
  hold: "keepLine",
  drop: "discardLine",
  insight: "insightLine",
};

/**
 * An empty batch never calls. Crossing the event count or the elapsed time does,
 * as long as at least one event is waiting.
 */
export function sessionPolicyInferDue(input: {
  pendingEvents: number;
  elapsedMs: number;
  thresholds: SessionPolicyInferThresholds;
}): boolean {
  if (input.pendingEvents <= 0) return false;
  if (input.pendingEvents >= input.thresholds.eventCount) return true;
  return input.elapsedMs >= input.thresholds.elapsedMs;
}

export function sessionPolicyProofFromCanvas(
  events: readonly { toolAction?: unknown; metadata?: unknown }[],
): SessionPolicyProofEvent[] {
  const out: SessionPolicyProofEvent[] = [];
  for (const event of events) {
    const action = typeof event.toolAction === "string" ? event.toolAction.trim() : "";
    if (!action) continue;
    const metadata = event.metadata;
    const promptValue =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as { prompt?: unknown }).prompt
        : undefined;
    const prompt = typeof promptValue === "string" ? promptValue.trim() : "";
    out.push(prompt ? { action, prompt } : { action });
  }
  return out;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

/** Four confidences. 0–1, or 0–100 when any value is above 1. A bad reply is null. */
export function parsePolicyConfidenceReply(raw: string): SessionPolicyConfidence | null {
  const packed = extractJsonObject(raw.trim());
  if (!packed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(packed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const found = new Map<SessionMarkButtonId, number>();
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const action = ALIASES[key.trim().toLowerCase()];
    if (!action) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    if (found.has(action)) return null;
    found.set(action, value);
  }
  if (found.size !== SESSION_BRANCH_ACTION_ORDER.length) return null;
  const numbers = SESSION_BRANCH_ACTION_ORDER.map((id) => found.get(id) ?? Number.NaN);
  if (numbers.some((value) => value < 0)) return null;
  const scale = numbers.some((value) => value > 1) ? 100 : 1;
  const confidence = {} as SessionPolicyConfidence;
  for (const id of SESSION_BRANCH_ACTION_ORDER) {
    const value = (found.get(id) ?? Number.NaN) / scale;
    if (value < 0 || value > 1) return null;
    confidence[id] = value;
  }
  return confidence;
}

/** Highest confidence. A tie keeps the earlier action: Close, Keep, Discard, Insight. */
export function chooseHighestPolicyConfidence(
  confidence: SessionPolicyConfidence,
): { action: SessionMarkButtonId; confidence: number } {
  let action: SessionMarkButtonId = SESSION_BRANCH_ACTION_ORDER[0];
  let best = Number.NEGATIVE_INFINITY;
  for (const id of SESSION_BRANCH_ACTION_ORDER) {
    const value = confidence[id];
    if (value > best) {
      best = value;
      action = id;
    }
  }
  return { action, confidence: best };
}

export function policySuggestionIsRawLabel(text: string): boolean {
  return RAW_LABEL.test(text.trim());
}

/**
 * The learner-facing line for one internal action.
 * A missing line, or a line that is only the raw name, is null.
 */
export function parsePolicyActionLine(raw: string, action: SessionMarkButtonId): string | null {
  const packed = extractJsonObject(raw.trim());
  if (!packed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(packed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = (parsed as Record<string, unknown>)[ACTION_LINE_KEY[action]];
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > 400 || policySuggestionIsRawLabel(text)) return null;
  return text;
}

/** A rephrased next step. An empty reply or a raw action label is null. */
export function parsePolicySuggestionReply(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let text = trimmed;
  const packed = extractJsonObject(trimmed);
  if (packed && trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(packed) as { text?: unknown; suggestion?: unknown };
      const value = typeof parsed.text === "string" ? parsed.text : parsed.suggestion;
      if (typeof value !== "string") return null;
      text = value.trim();
    } catch {
      return null;
    }
  }
  if (!text || policySuggestionIsRawLabel(text)) return null;
  return text;
}

/**
 * Parse a reply, take the winner, and advance the field the way a press did.
 * A bad reply, or an action that cannot move a closed focus, appends nothing.
 */
export function applyPolicyInference(
  model: SessionBranchModel,
  reply: string,
): { model: SessionBranchModel; entry: SessionPolicyInference } | null {
  const confidence = parsePolicyConfidenceReply(reply);
  if (!confidence) return null;
  const winner = chooseHighestPolicyConfidence(confidence);
  const next = advanceSessionBranchModel(model, { action: winner.action });
  if (next === model) return null;
  return {
    model: next,
    entry: {
      action: winner.action,
      confidence: winner.confidence,
      label: parsePolicyActionLine(reply, winner.action) ?? "",
    },
  };
}

/** Same log and same model when the reply is refused or the field does not move. */
export function recordPolicyInference(
  model: SessionBranchModel,
  log: readonly SessionPolicyInference[],
  reply: string,
): { model: SessionBranchModel; log: readonly SessionPolicyInference[] } {
  const applied = applyPolicyInference(model, reply);
  if (!applied) return { model, log };
  return { model: applied.model, log: [...log, applied.entry] };
}
