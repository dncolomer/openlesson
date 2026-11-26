/**
 * Shared TAP session runtime decisions for conversational + exercise shells.
 */

import { VERIFY_POW_API_PATHS } from "@/lib/session-pow-api-paths";

export type TapRuntimePhase = "briefing" | "live" | "complete";

/** Product at the TAP client boundary. Stored sidebar id stays verification-tap. */
export type TapProductKind = "verify" | "scored";

/** TAP shells arm the live thought/speech hook only while the session is live. */
export function isTapLiveThoughtSpeechEnabled(phase: string): boolean {
  return phase === "live";
}

/** Live TAP speech source — hook forming text only. */
export function tapHookFormingText(hook: { getFormingText?: () => string }): string {
  const text = hook.getFormingText?.();
  return typeof text === "string" ? text.trim() : "";
}

/** Start / complete / speech / idle — verification TAP kernel. */
export function tapSessionRuntimePaths(_kind: TapProductKind = "scored") {
  return VERIFY_POW_API_PATHS;
}

/** Default TAP runtime paths. */
export const TAP_SESSION_RUNTIME_PATHS = tapSessionRuntimePaths("verify");

export function shouldIncludePracticeOnTapTrace(input: {
  practice: boolean;
}): boolean {
  return input.practice === true;
}

export function tapTracePayload(
  input: Record<string, unknown> & { practice?: boolean },
): Record<string, unknown> {
  const { practice, ...rest } = input;
  if (shouldIncludePracticeOnTapTrace({ practice: practice === true })) {
    return { ...rest, practice: true };
  }
  return rest;
}
