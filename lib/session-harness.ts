/**
 * Harness tab copy: one next-step sentence. No graph.
 * The sentence uses the learner's work. It never names an action.
 */
import { policySuggestionIsRawLabel, sessionPolicyLocalSuggestion } from "@/lib/session-policy-infer";
import {
  sessionBranchById,
  sessionBranchCheapestTransition,
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
  const here = sessionBranchById(model, model.focusId);
  if (!here) return "";
  return (
    sessionPolicyLocalSuggestion({
      nodeTitle: here.title,
      observation: here.observation,
      intent: here.question,
    }) ?? ""
  );
}

/**
 * Cheapest outgoing hidden state that is not the occupied node.
 * Prefers the live harness suggestion when it is not the here line.
 */
export function sessionHarnessExploreLine(input: {
  model: SessionBranchModel | null | undefined;
  suggestion?: string | null;
}): { text: string; sameAsHere: boolean } {
  const model = input.model;
  if (!model) return { text: "", sameAsHere: false };
  const hereId = model.focusId;
  const cheapest = sessionBranchCheapestTransition(model, hereId);
  if (!cheapest) return { text: "", sameAsHere: false };
  if (cheapest.toId === hereId) return { text: "", sameAsHere: true };
  const here = sessionHarnessHereLine(model);
  const suggestion = cleanLine(input.suggestion);
  if (suggestion && !policySuggestionIsRawLabel(suggestion)) {
    if (here && suggestion === here) return { text: "", sameAsHere: true };
    return { text: suggestion, sameAsHere: false };
  }
  const to = sessionBranchById(model, cheapest.toId);
  const text =
    sessionPolicyLocalSuggestion({
      nodeTitle: cheapest.toTitle,
      observation: to?.observation ?? "",
      intent: to?.question ?? "",
    }) ?? "";
  if (here && text && text === here) return { text: "", sameAsHere: true };
  return { text, sameAsHere: false };
}
