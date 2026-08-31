/**
 * Gate silence/idle-originated TIM interruptions while the learner is still
 * forming a thought (pending live bar text and/or active transcription).
 */

export type TapInterruptionOrigin = "idle" | "speech" | "other" | "chapter_done";

export type FormingThoughtState = {
  /** Non-empty live transcription bar (not yet sent/stashed). */
  hasPendingTranscription: boolean;
  /** Live speech segment currently open (speech results flowing). */
  isTranscriptionActive: boolean;
};

/** Silence-period pathways: idle heartbeats and speech segment start/stop. */
export function isSilenceOriginatedInterruption(origin: TapInterruptionOrigin): boolean {
  return origin === "idle" || origin === "speech";
}

export function isFormingThought(state: FormingThoughtState): boolean {
  return Boolean(state.hasPendingTranscription) || Boolean(state.isTranscriptionActive);
}

/**
 * Skip scheduling/firing silence-origin interruptions while a thought is forming.
 * Non-silence origins (chat, deliberate traces) are never skipped by this rule.
 */
export function shouldSkipSilenceInterruptionWhileFormingThought(input: {
  origin: TapInterruptionOrigin;
} & FormingThoughtState): boolean {
  if (!isSilenceOriginatedInterruption(input.origin)) return false;
  return isFormingThought({
    hasPendingTranscription: input.hasPendingTranscription,
    isTranscriptionActive: input.isTranscriptionActive,
  });
}

/** Whether the idle PoW client should send an idle heartbeat at all. */
export function shouldSendIdleProofOfWork(state: FormingThoughtState): boolean {
  return !isFormingThought(state);
}
