/**
 * Mini-mode TAP chrome helpers. Presentational only — PiP I/O stays at the hook.
 * Compact learner chrome: Share your Screen, I'm Done Answering, live transcript, autostash bar.
 */

import { thoughtContextFillRatio } from "@/lib/thought-context-auto-stash";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";

export function ileMiniModeShareCtaLabel(): string {
  return "Share your Screen";
}

export function ileMiniModeDoneAnsweringLabel(): string {
  return "I'm Done Answering";
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

/**
 * Compact transcript is the live forming/speech line (same text as the ILE bar).
 * Helios last-turn text is never the body. PiP paints it wrapping, not a single sliding line.
 */
export function resolveIleCompactTranscript(input: {
  formingText?: string | null;
  speechDisplay?: string | null;
  speechError?: string | null;
  speechSupported?: boolean | null;
  isListening?: boolean;
  speechEnabled?: boolean;
  /** Ignored — compact never paints Helios last-turn as the transcript. */
  lastHeliosText?: string | null;
}): { kind: "live"; text: string } {
  if (typeof input.speechDisplay === "string" && input.speechDisplay.length > 0) {
    return { kind: "live", text: input.speechDisplay };
  }
  return {
    kind: "live",
    text: formatSpeechTranscriptDisplay({
      text: String(input.formingText || ""),
      speechError: input.speechError ?? null,
      speechSupported: input.speechSupported ?? true,
      isListening: Boolean(input.isListening),
      enabled: input.speechEnabled !== false,
    }),
  };
}

/** Autostash fill for compact = same ratio as the main ILE bar. */
export function ileCompactAutostashFillRatio(
  formingText?: string | null,
  maxChars?: number,
): number {
  return thoughtContextFillRatio(formingText, maxChars);
}

export function focusIleCompactOpenerTab(input: {
  opener?: { focus?: () => void } | null;
  tab?: { focus?: () => void } | null;
}): boolean {
  const target =
    input.opener && typeof input.opener.focus === "function"
      ? input.opener
      : input.tab && typeof input.tab.focus === "function"
        ? input.tab
        : null;
  if (!target?.focus) return false;
  target.focus();
  return true;
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

/** Existing I'm Done Answering close, then focus the ILE opener tab. */
export async function runIleMiniDoneAnswering(input: {
  closePath: () => void | Promise<void>;
  opener?: { focus?: () => void } | null;
  tab?: { focus?: () => void } | null;
}): Promise<boolean> {
  await input.closePath();
  return focusIleCompactOpenerTab({ opener: input.opener, tab: input.tab });
}
