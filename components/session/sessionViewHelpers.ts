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

export function computeBandPowers(af7: number[], af8: number[]) {
  const n = 256;
  const sampleRate = 256;
  const bandRanges: Record<string, [number, number]> = {
    delta: [1, 4],
    theta: [4, 8],
    alpha: [8, 13],
    beta: [13, 30],
    gamma: [30, 44],
  };

  function channelBands(samples: number[]) {
    const windowed = samples.map(
      (s, i) => s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)))
    );
    const powers: Record<string, number> = {};
    for (const [band, [fLow, fHigh]] of Object.entries(bandRanges)) {
      let power = 0;
      const binLow = Math.floor((fLow * n) / sampleRate);
      const binHigh = Math.min(Math.ceil((fHigh * n) / sampleRate), n / 2);
      for (let k = binLow; k <= binHigh; k++) {
        let re = 0,
          im = 0;
        for (let j = 0; j < n; j++) {
          const angle = (2 * Math.PI * k * j) / n;
          re += windowed[j] * Math.cos(angle);
          im -= windowed[j] * Math.sin(angle);
        }
        power += (re * re + im * im) / (n * n);
      }
      powers[band] = power;
    }
    return powers;
  }

  const p1 = channelBands(af7.slice(-n));
  const p2 = channelBands(af8.slice(-n));
  const avg: Record<string, number> = {};
  for (const band of Object.keys(bandRanges)) {
    avg[band] = ((p1[band] || 0) + (p2[band] || 0)) / 2;
  }

  const total = Object.values(avg).reduce((s, v) => s + v, 0);
  if (total > 0) for (const band of Object.keys(avg)) avg[band] /= total;

  return {
    delta: avg.delta || 0,
    theta: avg.theta || 0,
    alpha: avg.alpha || 0,
    beta: avg.beta || 0,
    gamma: avg.gamma || 0,
  };
}
