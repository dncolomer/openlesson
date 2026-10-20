/**
 * Harness tab copy: one next-step sentence. No graph.
 * The sentence uses the learner's work. It never names an action.
 */
import { policySuggestionIsRawLabel } from "@/lib/session-policy-infer";
import type { SessionGuideId } from "@/lib/session-instructions";

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
