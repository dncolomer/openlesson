// Pure helpers for TAP score client UI
import { TAP_LINK_MAX_MINUTES, TAP_LINK_MIN_MINUTES } from "@/lib/pow-api/tap-link-config";
import { cn } from "@/lib/utils";

export type Phase = "briefing" | "live" | "saving" | "results" | "error";

export interface Thought {
  id: string;
  text: string;
  timestamp: number;
  chainId: string;
}

export type TapTraceType = "system1" | "system2";
export type TapSystem1Action = "crystallize" | "pause_finalize";
export type TapSystem2Action = "send" | "skip" | "select" | "deselect" | "resend" | "edit";

export interface TapChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
}

export const OPENING_MESSAGE_ID = "opening";
export const THINK_ALOUD_PROTOCOL_LABEL = "Think Aloud Protocol";
export const CHAIN_GAP_MS = 2600;
export const DURATIONS = [15, 30];

export const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

export function getDialogueStorageKey({
  workspaceId,
  sessionId,
  blockId,
  privateToken,
}: {
  workspaceId?: string;
  sessionId?: string;
  blockId?: string;
  privateToken?: string;
}) {
  return [
    "uncertain-systems",
    "tap-dialogue",
    workspaceId || "workspace",
    privateToken || sessionId || blockId || "session",
  ].join(":");
}

export function clearDialogueMessages(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export function resolveInitialMinutes(requestedDurationSeconds: unknown): number {
  const minutes = Number(requestedDurationSeconds || 900) / 60;
  if (!Number.isFinite(minutes)) return 15;
  if (minutes >= TAP_LINK_MIN_MINUTES && minutes <= TAP_LINK_MAX_MINUTES) {
    return Math.trunc(minutes);
  }
  return DURATIONS.includes(minutes) ? minutes : 15;
}

export function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function formatCountdown(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export type ThoughtButtonSize = "sm" | "md" | "lg";
export type ThoughtButtonVariant = "ghost" | "primary" | "toggleOn" | "toggleOff";

export function thoughtButtonClasses({
  size = "md",
  variant = "ghost",
  className = "",
}: {
  size?: ThoughtButtonSize;
  variant?: ThoughtButtonVariant;
  className?: string;
}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
    size === "sm" && "h-8 px-2.5 text-xs",
    size === "md" && "h-9 px-3.5 text-xs",
    size === "lg" && "h-11 px-4 text-sm",
    variant === "ghost" && "border border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600 hover:text-white",
    variant === "primary" && "border border-transparent bg-white text-black hover:bg-neutral-200",
    variant === "toggleOn" && "border border-white bg-white text-black",
    variant === "toggleOff" && "border border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300",
    className,
  );
}
