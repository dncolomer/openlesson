/**
 * Harness tab copy: one next-step sentence. No graph.
 * The sentence uses the learner's work. It never names an action.
 */
import { policySuggestionIsRawLabel, sessionPolicyLocalSuggestion } from "@/lib/session-policy-infer";
import {
  sessionBranchById,
  sessionBranchCheapestTransition,
  sessionBranchNextPolicyStep,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import type { SessionGuideId } from "@/lib/session-instructions";

export const LEARN_HIDDEN_STATES_BUTTON_LABEL = "Hidden states";
export const LEARN_HIDDEN_STATES_MODAL_TITLE = "Hidden states";
export const LEARN_HIDDEN_STATES_SUGGESTION_LABEL = "Suggested";

export const SESSION_HARNESS_FALLBACK: Record<SessionGuideId, string> = {
  learn:
    "Stay with the work on the board. The next step will show here once there is enough of your work to read.",
  calibrate: "Tap every question you would not trust yourself to answer.",
  verification:
    "Work the question on the board. The next step will show here once there is enough of your work to read.",
};

function cleanLine(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Prefer the live suggestion, then the latest inference line.
 * A raw action name is skipped. The fallback is the last resort.
 */
export function sessionHarnessNextLine(input: {
  suggestion?: string | null;
  inferenceLabel?: string | null;
  fallback: string;
}): string {
  const suggestion = cleanLine(input.suggestion);
  if (suggestion && !policySuggestionIsRawLabel(suggestion)) return suggestion;
  const label = cleanLine(input.inferenceLabel);
  if (label && !policySuggestionIsRawLabel(label)) return label;
  return cleanLine(input.fallback) || SESSION_HARNESS_FALLBACK.learn;
}

/**
 * Learn and Verify show the live recommendation. Calibrate keeps the tap line.
 */
export function sessionHarnessFocusLine(input: {
  guide: SessionGuideId;
  suggestion?: string | null;
  inferenceLabel?: string | null;
}): string {
  if (input.guide === "calibrate") {
    return sessionHarnessNextLine({
      fallback: SESSION_HARNESS_FALLBACK.calibrate,
    });
  }
  return sessionHarnessNextLine({
    suggestion: input.suggestion,
    inferenceLabel: input.inferenceLabel,
    fallback:
      input.guide === "verification"
        ? SESSION_HARNESS_FALLBACK.verification
        : SESSION_HARNESS_FALLBACK.learn,
  });
}

/**
 * Occupied hidden state: its own question, then observation, then title.
 * This is the Focus command. It is not the cheapest child.
 */
export function sessionHarnessHereLine(
  model: SessionBranchModel | null | undefined,
): string {
  if (!model) return "";
  return sessionHarnessNodeLine(model, model.focusId);
}

function sessionHarnessNodeLine(
  model: SessionBranchModel,
  branchId: string | null | undefined,
): string {
  const node = sessionBranchById(model, branchId);
  if (!node) return "";
  return (
    sessionPolicyLocalSuggestion({
      nodeTitle: node.title,
      observation: node.observation,
      intent: node.question,
    }) ?? ""
  );
}

/**
 * Next unused priced action on the Unsys simulated policy.
 * Each call skips nodes already placed as Next notes and walks cheapest
 * unused outgoing, then siblings, then deeper.
 */
export function sessionHarnessExploreLine(input: {
  model: SessionBranchModel | null | undefined;
  placedIds?: readonly string[] | null;
  placedTexts?: readonly string[] | null;
}): { text: string; sameAsHere: boolean; toId: string | null } {
  const model = input.model;
  if (!model) return { text: "", sameAsHere: false, toId: null };
  const hereId = model.focusId;
  const here = sessionHarnessHereLine(model);
  const placed = new Set(
    (input.placedIds ?? []).map((id) => String(id || "").trim()).filter(Boolean),
  );
  const placedTexts = new Set(
    (input.placedTexts ?? []).map((text) => cleanLine(text)).filter(Boolean),
  );
  if (here) placedTexts.add(here);
  for (const branch of model.branches) {
    const line = sessionHarnessNodeLine(model, branch.id);
    if (line && (placedTexts.has(line) || (here && line === here))) placed.add(branch.id);
  }
  const step = sessionBranchNextPolicyStep(model, [...placed]);
  if (!step) {
    const cheapest = sessionBranchCheapestTransition(model, hereId);
    return { text: "", sameAsHere: Boolean(cheapest && cheapest.toId === hereId), toId: null };
  }
  const text = sessionHarnessNodeLine(model, step.toId);
  if (!text) return { text: "", sameAsHere: false, toId: null };
  return { text, sameAsHere: false, toId: step.toId };
}
