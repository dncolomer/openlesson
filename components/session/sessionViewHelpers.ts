import type { TransferHealth } from "@/components/LogsTool";
import type { ChatMessage, PendingChatMessage } from "@/components/HeliosChat";

export type ChapterWorkspace = {
  chatMessages: ChatMessage[];
  pendingChatMessage: string | PendingChatMessage | null;
  whiteboardData: string | null;
  whiteboardSceneData: { elements: any[]; appState: any; files: any } | null;
  notebookContent: string;
  canvasDirtyForHelios: boolean;
  notebookDirtyForHelios: boolean;
};

export const createChapterWorkspace = (): ChapterWorkspace => ({
  chatMessages: [],
  pendingChatMessage: null,
  whiteboardData: null,
  whiteboardSceneData: null,
  notebookContent: "",
  canvasDirtyForHelios: true,
  notebookDirtyForHelios: true,
});

/** Check if a new probe is a duplicate of any existing probe (normalized comparison) */
export function isDuplicateProbe(
  newText: string,
  existingProbes: { text: string; archived?: boolean }[]
): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const newNorm = normalize(newText);
  return existingProbes.some((p) => {
    const existingNorm = normalize(p.text);
    if (newNorm === existingNorm) return true;
    if (newNorm.length > 20 && existingNorm.length > 20) {
      if (newNorm.includes(existingNorm) || existingNorm.includes(newNorm)) return true;
    }
    return false;
  });
}

export async function readErrorResponse(response: Response, fallback: string) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return `${fallback} (HTTP ${response.status})`;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message = parsed.error || parsed.message;
    if (typeof message === "string" && message.trim()) {
      return `${message} (HTTP ${response.status})`;
    }
  } catch {
    // Non-JSON error body; include a short preview for debugging.
  }
  return `${fallback} (HTTP ${response.status}): ${text.slice(0, 300)}`;
}

/** Brief chapter switch fade. 0 = no artificial stall. Must stay ≤ 200ms. */
export const CHAPTER_LOAD_DURATION_MS = 0;
export const EEG_SAMPLE_RATE_HZ = 256;
export const EEG_DISPLAY_MAX_SAMPLES = 512;
export const EEG_PERSIST_MAX_SAMPLES = EEG_SAMPLE_RATE_HZ * 30;

/** In-memory ILE session log ring — keeps the last N so the Logs tool stays responsive. */
export const SESSION_LOG_MAX_ENTRIES = 500;

/** Return the newest `max` entries. Does not mutate the input. */
export function capSessionLogs<T>(logs: readonly T[], max = SESSION_LOG_MAX_ENTRIES): T[] {
  const limit = Math.max(1, Math.floor(max));
  if (logs.length <= limit) return logs.slice();
  return logs.slice(-limit);
}

export function createEmptyTransferHealth(): TransferHealth {
  return {
    audio: { sent: 0, saved: 0, failed: 0 },
    eeg: { sent: 0, saved: 0, failed: 0 },
    facial: { sent: 0, saved: 0, failed: 0 },
    screenshots: { sent: 0, saved: 0, failed: 0 },
    tools: { sent: 0, saved: 0, failed: 0 },
  };
}

export { computeBandPowers } from "@/lib/muse-eeg-quality";
