/**
 * Infer the discrete policy from canvas proof of work.
 * The gate, the reply parser, and the winner are pure. Tests pass a reply string.
 * The xAI call lives in lib/session-policy-infer-xai.ts and is not imported here.
 */

import {
  advanceSessionBranchModel,
  recommendSessionBranchAction,
  sessionBranchById,
  sessionBranchEdgeBetween,
  sessionBranchInferCandidates,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

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

export type SessionPolicyInference = {
  hiddenStateId: string;
  fromId: string;
  confidence: number;
  label: string;
};

const RAW_LABEL = /^(close|keep|discard|insight|forage|exploit|avoid|infer|sample|predict)[.!?]*$/i;

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

export function sessionPolicyCandidateLines(model: SessionBranchModel): string {
  const cheapest = recommendSessionBranchAction(model, model.focusId);
  return sessionBranchInferCandidates(model)
    .map((branch) => {
      const question = branch.question.trim();
      const observation = branch.observation.trim();
      const fromParent = sessionBranchEdgeBetween(model, branch.parentId, branch.id);
      const fromFocus = sessionBranchEdgeBetween(model, model.focusId, branch.id);
      const price = fromFocus?.price ?? fromParent?.price;
      return [
        `- id: ${branch.id}`,
        `  title: ${branch.title}`,
        question ? `  question: ${question}` : "",
        observation ? `  observation: ${observation}` : "",
        price != null ? `  price: ${price}` : "",
        cheapest?.toId === branch.id ? "  cheapest: true" : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

/**
 * A learner-facing next-step line from the cheapest outgoing hidden state.
 * Prefer the node's own question, then its observation. Never a raw action name.
 */
export function sessionPolicyLocalSuggestion(input: {
  nodeTitle?: string | null;
  observation?: string | null;
  intent?: string | null;
}): string | null {
  const questionOrObservation = [input.intent, input.observation]
    .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
    .find(Boolean);
  if (questionOrObservation && !policySuggestionIsRawLabel(questionOrObservation)) {
    return questionOrObservation;
  }
  const title = String(input.nodeTitle ?? "").replace(/\s+/g, " ").trim();
  if (title && !policySuggestionIsRawLabel(title)) return title;
  return null;
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

export function policySuggestionIsRawLabel(text: string): boolean {
  return RAW_LABEL.test(text.trim());
}

export type SessionPolicyHiddenStateReply = {
  hiddenStateId: string;
  confidence: number;
  label: string;
};

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const scaled = value > 1 ? value / 100 : value;
  if (scaled < 0 || scaled > 1) return null;
  return scaled;
}

/** Hidden-state id plus confidence. A bad reply is null. */
export function parsePolicyHiddenStateReply(raw: string): SessionPolicyHiddenStateReply | null {
  const packed = extractJsonObject(raw.trim());
  if (!packed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(packed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const rec = parsed as Record<string, unknown>;
  const hiddenStateId = String(
    rec.hiddenStateId ?? rec.candidateId ?? rec.id ?? "",
  ).trim();
  if (!hiddenStateId) return null;
  const confidence = clampConfidence(rec.confidence);
  if (confidence == null) return null;
  const line = typeof rec.line === "string" ? rec.line.replace(/\s+/g, " ").trim() : "";
  return {
    hiddenStateId,
    confidence,
    label: line && line.length <= 400 && !policySuggestionIsRawLabel(line) ? line : "",
  };
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
 * Parse a reply, take the inferred hidden state, and travel that edge.
 * A bad reply, or an id that is not on the field, appends nothing.
 */
export function applyPolicyInference(
  model: SessionBranchModel,
  reply: string,
): { model: SessionBranchModel; entry: SessionPolicyInference } | null {
  const parsed = parsePolicyHiddenStateReply(reply);
  if (!parsed) return null;
  const allowed = new Set(sessionBranchInferCandidates(model).map((branch) => branch.id));
  if (!allowed.has(parsed.hiddenStateId) && !sessionBranchById(model, parsed.hiddenStateId)) {
    return null;
  }
  const target = sessionBranchById(model, parsed.hiddenStateId);
  if (!target) return null;
  const next = advanceSessionBranchModel(model, { toId: target.id, fromId: model.focusId });
  return {
    model: next,
    entry: {
      hiddenStateId: target.id,
      fromId: model.focusId,
      confidence: parsed.confidence,
      label: parsed.label,
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
