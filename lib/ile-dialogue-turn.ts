/**
 * ILE dialogue: Helios-only surface (no learner speaker).
 * TAP keeps both comic avatars.
 */

export type HeliosTurnModeLike = "idle" | "responding" | "interruption" | string;

export type IleDialogueSpeaker = "helios";

export type IleDialogueSurfaceKind = "helios" | "waiting";

export type IleDialogueTurnVisibility = {
  speaker: IleDialogueSpeaker;
  kind: IleDialogueSurfaceKind;
  showHeliosAvatar: boolean;
  showLearnerAvatar: false;
};

/** TAP comic circles (Tailwind). ILE Helios mark is smaller and top-centered. */
export const TAP_DIALOGUE_AVATAR_SIZE_CLASS = "h-28 w-28";
export const ILE_DIALOGUE_AVATAR_SIZE_CLASS = "h-10 w-10";

export const ILE_HELIOS_THINKING_LINES = [
  "Helios is thinking",
  "Helios is thinking this through",
  "Helios is thinking with you",
] as const;

export const ILE_HELIOS_THINKING_ROTATE_MS = 2200;

export function isIleHeliosWaitingTurn(input: {
  isSending?: boolean;
  heliosTurnMode?: HeliosTurnModeLike | null;
}): boolean {
  return Boolean(input.isSending) || input.heliosTurnMode === "interruption";
}

/** @deprecated Use isIleHeliosWaitingTurn — ILE no longer treats Helios as a second speaker. */
export function isIleHeliosActiveTurn(input: {
  isSending?: boolean;
  heliosTurnMode?: HeliosTurnModeLike | null;
}): boolean {
  return isIleHeliosWaitingTurn(input);
}

/** ILE surface is always Helios-only. Waiting = after submit, before reply. */
export function resolveIleDialogueTurn(input: {
  isSending?: boolean;
  heliosTurnMode?: HeliosTurnModeLike | null;
}): IleDialogueTurnVisibility {
  const waiting = isIleHeliosWaitingTurn(input);
  return {
    speaker: "helios",
    kind: waiting ? "waiting" : "helios",
    showHeliosAvatar: true,
    showLearnerAvatar: false,
  };
}

export function ileHeliosThinkingLine(index: number): string {
  const lines = ILE_HELIOS_THINKING_LINES;
  const i = ((Math.floor(Number(index) || 0) % lines.length) + lines.length) % lines.length;
  return lines[i];
}
