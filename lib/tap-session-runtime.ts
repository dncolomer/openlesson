/**
 * Shared TAP session runtime decisions for conversational + exercise shells.
 */

import { TAP_POW_API_PATHS } from "@/lib/session-pow-api-paths";

export type TapRuntimePhase = "briefing" | "live" | "complete";

/** TAP shells arm the live thought/speech hook only while the session is live. */
export function isTapLiveThoughtSpeechEnabled(phase: string): boolean {
  return phase === "live";
}

/** Local SpeechRecognition bindings stay off while the hook owns the mic. */
export function shouldRestartLocalTapSpeechBindings(phase: string): boolean {
  return !isTapLiveThoughtSpeechEnabled(phase);
}

/** Live TAP speech source — hook forming text only. */
export function tapHookFormingText(hook: { getFormingText?: () => string }): string {
  const text = hook.getFormingText?.();
  return typeof text === "string" ? text.trim() : "";
}

/** End-session / stash flush: hook forming text first, not a dead local buffer. */
export function tapLiveSpeechFlushText(input: {
  hookFormingText?: string | null;
  crystallizableText?: string | null;
  localFinalBuffer?: readonly string[] | null;
}): string {
  const hook = typeof input.hookFormingText === "string" ? input.hookFormingText.trim() : "";
  if (hook) return hook;
  const live =
    typeof input.crystallizableText === "string" ? input.crystallizableText.trim() : "";
  if (live) return live;
  const buf = (input.localFinalBuffer || [])
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return buf;
}

/** Start / complete / speech / idle — both TAP shells POST these paths. */
export const TAP_SESSION_RUNTIME_PATHS = {
  start: "/api/workspace-tap-score/start",
  complete: "/api/workspace-tap-score/complete",
  speech: TAP_POW_API_PATHS.speech,
  idle: TAP_POW_API_PATHS.idle,
} as const;

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
