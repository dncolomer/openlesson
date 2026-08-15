/**
 * Mini-mode TAP chrome helpers. Presentational only — PiP I/O stays at the hook.
 */

import {
  ileHeliosThinkingLine,
  isIleHeliosWaitingTurn,
  type HeliosTurnModeLike,
} from "@/lib/ile-dialogue-turn";

export function ileMiniModeShareCtaLabel(): string {
  return "Share your screen";
}

export function shouldShowIleMiniShareCta(isScreenSharing: boolean): boolean {
  return !Boolean(isScreenSharing);
}

/** Chapter title for mini chrome. Never falls back to the product name "ILE". */
export function ileCompactChapterTitle(chapterLabel?: string | null): string | null {
  const title = String(chapterLabel || "").trim();
  if (!title) return null;
  if (title.toUpperCase() === "ILE") return null;
  return title;
}

export function resolveIleCompactTranscript(input: {
  lastHeliosText?: string | null;
  isSending?: boolean;
  heliosTurnMode?: HeliosTurnModeLike | null;
  thinkingIndex?: number;
}): { kind: "helios" | "waiting"; text: string } {
  if (isIleHeliosWaitingTurn(input)) {
    return { kind: "waiting", text: ileHeliosThinkingLine(input.thinkingIndex ?? 0) };
  }
  return { kind: "helios", text: String(input.lastHeliosText || "").trim() };
}

/** CTA click path — same startScreenshare the leave-focus hook holds. */
export async function runIleMiniShareCta(input: {
  isScreenSharing: boolean;
  startScreenshare: () => Promise<boolean | void>;
}): Promise<boolean> {
  if (!shouldShowIleMiniShareCta(input.isScreenSharing)) return false;
  await input.startScreenshare();
  return true;
}
