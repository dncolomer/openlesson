"use client";

/**
 * useSessionHeartbeat — Custom hook that manages the dual heartbeat lifecycle.
 *
 * Encapsulates:
 *   - 1-second master tick driving storage (5s) and analysis (10s) cycles
 *   - Reentrancy guards for both heartbeats
 *   - Health tracking (last success timestamps, consecutive failures)
 *   - Adaptive throttling on repeated failures
 *   - Structured event logging
 *   - Clean start / stop / pause / resume semantics
 *   - Counter reset on resume for immediate data flush
 *   - Safe final flush on stop (waits for in-flight analysis)
 *
 * The hook does NOT contain business logic for what to save or analyze —
 * those are provided as callbacks via the options. This keeps the hook
 * reusable across Desktop and Mobile session views.
 */

import { useRef, useState, useCallback } from "react";
import type { LogEntry } from "@/components/LogsTool";

// ──────────────────────────────────────────────
// Heartbeat health / pipeline error types
// (Previously exported from the now-removed HeartbeatIndicator component.)
// ──────────────────────────────────────────────

export interface HeartbeatHealth {
  lastStorageSuccess: number | null;
  lastAnalysisSuccess: number | null;
  consecutiveStorageFailures: number;
  consecutiveAnalysisFailures: number;
}

export interface PipelineErrors {
  storage?: string;
  analysis?: string;
  transcription?: string;
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** A single data channel the heartbeat tracks for transfer-health reporting. */
export type TransferChannel = "audio" | "eeg" | "facial" | "screenshots" | "tools";

export interface TransferHealthCounters {
  audio: { sent: number; saved: number; failed: number };
  eeg: { sent: number; saved: number; failed: number };
  facial: { sent: number; saved: number; failed: number };
  /** Screenshots are captured on their own interval (not inside the storage
   *  heartbeat), and are reported via `recordTransferEvent()`. */
  screenshots: { sent: number; saved: number; failed: number };
  /** Tool events (user clicks in panels, whiteboard saves, tool open/close).
   *  Reported via `recordTransferEvent()` from the `logTool()` helper. */
  tools: { sent: number; saved: number; failed: number };
}

/** Per-channel outcome emitted by the storage heartbeat callback. */
export interface ChannelResult {
  attempted: boolean;
  saved: boolean;
  /** Optional underlying error, used to surface failures in the event log. */
  error?: string;
}

/** Result returned by the storage heartbeat callback */
export interface StorageHeartbeatResult {
  /** Per-channel outcome from this heartbeat cycle */
  audio?: ChannelResult;
  eeg?: ChannelResult;
  facial?: ChannelResult;
  /** Screenshots can be reported here if the storage heartbeat captures them,
   *  but typically screenshots use `recordTransferEvent()` because they run on
   *  their own interval. */
  screenshots?: ChannelResult;
  /** Error message if the entire heartbeat failed */
  error?: string;
}

/** Result returned by the analysis heartbeat callback */
export interface AnalysisHeartbeatResult {
  success: boolean;
  /** Duration of the analysis cycle in ms */
  durationMs?: number;
  /** Gap score from the analysis */
  gapScore?: number;
  /** Error message if analysis failed */
  error?: string;
}

export interface UseSessionHeartbeatOptions {
  /** Storage heartbeat interval in ms (default: 5000) */
  storageIntervalMs?: number;
  /** Analysis heartbeat interval in ms (default: 10000) */
  analysisIntervalMs?: number;
  /** Called every storage cycle. Must handle its own error catching. */
  onStorageHeartbeat: () => Promise<StorageHeartbeatResult>;
  /** Called every analysis cycle. Must handle its own error catching. */
  onAnalysisHeartbeat: () => Promise<AnalysisHeartbeatResult>;
  /** Callback to append structured log entries */
  onLog?: (entry: Omit<LogEntry, "id">) => void;
  /** Maximum consecutive failures before throttling kicks in (default: 3) */
  throttleAfterFailures?: number;
}

export interface UseSessionHeartbeatReturn {
  /** Start the heartbeat system */
  start: () => void;
  /** Stop the heartbeat system, performing a final flush. Returns when flush completes. */
  stop: () => Promise<void>;
  /** Pause the heartbeat system (no final flush) */
  pause: () => void;
  /** Resume the heartbeat system (resets counter for immediate flush) */
  resume: () => void;
  /** Current storage beat position (0-based, cycles 0..storageIntervalMs/1000-1) */
  storageBeat: number;
  /** Current analysis beat position (0-based, cycles 0..analysisIntervalMs/1000-1) */
  analysisBeat: number;
  /** Whether a storage heartbeat is currently in flight */
  isStorageRunning: boolean;
  /** Whether an analysis heartbeat is currently in flight */
  isAnalysisRunning: boolean;
  /** Health metrics for UI indicators */
  health: HeartbeatHealth;
  /** Pipeline error state */
  pipelineErrors: PipelineErrors;
  /** Transfer health counters */
  transferHealth: TransferHealthCounters;
  /** Mutable ref to transfer health counters (for use inside heartbeat callbacks) */
  transferHealthRef: React.MutableRefObject<TransferHealthCounters>;
  /** Whether the heartbeat system is currently active */
  isRunning: boolean;
  /** Clear pipeline errors (e.g., after user dismisses) */
  clearErrors: () => void;
  /**
   * Manually record a transfer event for a channel.
   *
   * Used by data sources that run on their own interval (e.g. screenshot
   * capture) and are therefore NOT part of the storage-heartbeat callback
   * result. Increments the matching sent/saved/failed counters, emits a
   * structured log entry on failure, and triggers a re-render so the UI
   * health table stays in sync.
   */
  recordTransferEvent: (channel: TransferChannel, saved: boolean, error?: string) => void;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const TICK_MS = 1000;
const DEFAULT_STORAGE_INTERVAL_MS = 5000;
const DEFAULT_ANALYSIS_INTERVAL_MS = 10000;
const DEFAULT_THROTTLE_AFTER_FAILURES = 3;

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

function createEmptyTransferHealth(): TransferHealthCounters {
  return {
    audio: { sent: 0, saved: 0, failed: 0 },
    eeg: { sent: 0, saved: 0, failed: 0 },
    facial: { sent: 0, saved: 0, failed: 0 },
    screenshots: { sent: 0, saved: 0, failed: 0 },
    tools: { sent: 0, saved: 0, failed: 0 },
  };
}

/**
 * Channels whose events are produced BY the storage heartbeat's
 * `onStorageHeartbeat` callback (so the tick handler reads them from the
 * result object). `screenshots` and `tools` are reported via
 * `recordTransferEvent()` instead — they run on their own cadence.
 *
 * Typed narrower than `TransferChannel` so `result[channel]` in the tick
 * handler is type-safe.
 */
type StorageHeartbeatChannel = "audio" | "eeg" | "facial";

const STORAGE_HEARTBEAT_CHANNELS: readonly StorageHeartbeatChannel[] = [
  "audio",
  "eeg",
  "facial",
] as const;

export function useSessionHeartbeat(
  options: UseSessionHeartbeatOptions,
): UseSessionHeartbeatReturn {
  const {
    storageIntervalMs = DEFAULT_STORAGE_INTERVAL_MS,
    analysisIntervalMs = DEFAULT_ANALYSIS_INTERVAL_MS,
    onStorageHeartbeat,
    onAnalysisHeartbeat,
    onLog,
    throttleAfterFailures = DEFAULT_THROTTLE_AFTER_FAILURES,
  } = options;

  // Stable refs for the callbacks so interval closures always see latest
  const onStorageRef = useRef(onStorageHeartbeat);
  onStorageRef.current = onStorageHeartbeat;
  const onAnalysisRef = useRef(onAnalysisHeartbeat);
  onAnalysisRef.current = onAnalysisHeartbeat;
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  // Derived tick counts
  const storageTicks = Math.round(storageIntervalMs / TICK_MS);
  const analysisTicks = Math.round(analysisIntervalMs / TICK_MS);
  const cycleTicks = lcm(storageTicks, analysisTicks);

  // ── Refs (mutable, no re-renders) ──
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const counterRef = useRef(0);
  const isStorageRunningRef = useRef(false);
  const isAnalysisRunningRef = useRef(false);
  const analysisPromiseRef = useRef<Promise<AnalysisHeartbeatResult> | null>(null);

  // Consecutive failure tracking for adaptive throttling
  const storageFailStreakRef = useRef(0);
  const analysisFailStreakRef = useRef(0);

  // ── State (triggers re-renders for UI) ──
  const [storageBeat, setStorageBeat] = useState(0);
  const [analysisBeat, setAnalysisBeat] = useState(0);
  const [isStorageRunning, setIsStorageRunning] = useState(false);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const [health, setHealth] = useState<HeartbeatHealth>({
    lastStorageSuccess: null,
    lastAnalysisSuccess: null,
    consecutiveStorageFailures: 0,
    consecutiveAnalysisFailures: 0,
  });

  const [pipelineErrors, setPipelineErrors] = useState<PipelineErrors>({});

  const [transferHealth, setTransferHealth] = useState<TransferHealthCounters>(
    createEmptyTransferHealth,
  );
  const transferHealthRef = useRef<TransferHealthCounters>(createEmptyTransferHealth());

  // ── Helpers ──

  const emitLog = useCallback(
    (level: "info" | "warning" | "error", message: string, source?: string) => {
      onLogRef.current?.({
        timestamp: Date.now(),
        level,
        message,
        source: source ?? "heartbeat",
      });
    },
    [],
  );

  const syncTransferHealth = useCallback(() => {
    setTransferHealth({ ...transferHealthRef.current });
  }, []);

  // ── Core tick handler ──

  const tick = useCallback(() => {
    const second = counterRef.current;

    // Update UI beat positions
    setStorageBeat(second % storageTicks);
    setAnalysisBeat(second % analysisTicks);

    // ── Storage heartbeat ──
    if (second % storageTicks === 0) {
      // Adaptive throttle: skip if too many consecutive failures
      const shouldThrottle =
        storageFailStreakRef.current >= throttleAfterFailures &&
        second % (storageTicks * 2) !== 0; // run at half rate when throttled

      if (!isStorageRunningRef.current && !shouldThrottle) {
        isStorageRunningRef.current = true;
        setIsStorageRunning(true);

        const startMs = Date.now();
        onStorageRef.current().then((result) => {
          const durationMs = Date.now() - startMs;

          // Update per-channel counters and surface per-channel failures as
          // log entries. Without this, a retry that exhausts its attempts
          // bumps `failed` in the health table but leaves the event log
          // silent, making it look like there's no error at all.
          // Note: `screenshots` and `tools` report via `recordTransferEvent`
          // on their own cadence, not through the storage heartbeat result.
          for (const channel of STORAGE_HEARTBEAT_CHANNELS) {
            const ch = result[channel];
            if (ch?.attempted) {
              transferHealthRef.current[channel].sent++;
              if (ch.saved) {
                transferHealthRef.current[channel].saved++;
              } else {
                transferHealthRef.current[channel].failed++;
                emitLog(
                  "error",
                  ch.error
                    ? `${channel} save failed: ${ch.error}`
                    : `${channel} save failed (no error detail reported)`,
                  channel,
                );
              }
            }
          }
          syncTransferHealth();

          if (result.error) {
            storageFailStreakRef.current++;
            setPipelineErrors((prev) => ({ ...prev, storage: result.error }));
            setHealth((prev) => ({
              ...prev,
              consecutiveStorageFailures: storageFailStreakRef.current,
            }));
            emitLog("error", `Storage heartbeat failed (${durationMs}ms): ${result.error}`, "storage");
          } else {
            storageFailStreakRef.current = 0;
            setPipelineErrors((prev) => ({ ...prev, storage: undefined }));
            setHealth((prev) => ({
              ...prev,
              lastStorageSuccess: Date.now(),
              consecutiveStorageFailures: 0,
            }));
            emitLog("info", `Storage heartbeat OK (${durationMs}ms)`, "storage");
          }

          isStorageRunningRef.current = false;
          setIsStorageRunning(false);
        });
      } else if (isStorageRunningRef.current) {
        emitLog("warning", "Storage heartbeat skipped (previous still running)", "storage");
      } else if (shouldThrottle) {
        emitLog("warning", `Storage heartbeat throttled (${storageFailStreakRef.current} consecutive failures)`, "storage");
      }
    }

    // ── Analysis heartbeat ──
    if (second % analysisTicks === 0) {
      const shouldThrottle =
        analysisFailStreakRef.current >= throttleAfterFailures &&
        second % (analysisTicks * 2) !== 0;

      if (!isAnalysisRunningRef.current && !shouldThrottle) {
        isAnalysisRunningRef.current = true;
        setIsAnalysisRunning(true);

        const startMs = Date.now();
        const promise = onAnalysisRef.current();
        analysisPromiseRef.current = promise;

        promise.then((result) => {
          const durationMs = result.durationMs ?? (Date.now() - startMs);

          if (result.success) {
            analysisFailStreakRef.current = 0;
            setPipelineErrors((prev) => ({
              ...prev,
              analysis: undefined,
              transcription: undefined,
            }));
            setHealth((prev) => ({
              ...prev,
              lastAnalysisSuccess: Date.now(),
              consecutiveAnalysisFailures: 0,
            }));
            emitLog(
              "info",
              `Analysis heartbeat OK (${durationMs}ms)${result.gapScore !== undefined ? ` gap=${result.gapScore.toFixed(2)}` : ""}`,
              "analysis",
            );
          } else {
            analysisFailStreakRef.current++;
            setPipelineErrors((prev) => ({
              ...prev,
              analysis: result.error || "Analysis failed",
            }));
            setHealth((prev) => ({
              ...prev,
              consecutiveAnalysisFailures: analysisFailStreakRef.current,
            }));
            emitLog("error", `Analysis heartbeat failed (${durationMs}ms): ${result.error}`, "analysis");
          }

          isAnalysisRunningRef.current = false;
          setIsAnalysisRunning(false);
          analysisPromiseRef.current = null;
        });
      } else if (isAnalysisRunningRef.current) {
        emitLog("warning", "Analysis heartbeat skipped (previous still running)", "analysis");
      }
    }

    // Advance counter
    counterRef.current = (second + 1) % cycleTicks;
  }, [storageTicks, analysisTicks, cycleTicks, throttleAfterFailures, emitLog, syncTransferHealth]);

  // ── Public API ──

  const start = useCallback(() => {
    if (intervalRef.current) return; // already running

    // Reset state
    counterRef.current = 0;
    storageFailStreakRef.current = 0;
    analysisFailStreakRef.current = 0;
    transferHealthRef.current = createEmptyTransferHealth();
    setTransferHealth(createEmptyTransferHealth());
    setHealth({
      lastStorageSuccess: null,
      lastAnalysisSuccess: null,
      consecutiveStorageFailures: 0,
      consecutiveAnalysisFailures: 0,
    });
    setPipelineErrors({});

    intervalRef.current = setInterval(tick, TICK_MS);
    setIsRunning(true);
    emitLog("info", "Heartbeat system started");
  }, [tick, emitLog]);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    emitLog("info", "Heartbeat system paused");
  }, [emitLog]);

  const resume = useCallback(() => {
    if (intervalRef.current) return; // already running

    // Reset counter so both heartbeats fire immediately on resume
    counterRef.current = 0;
    intervalRef.current = setInterval(tick, TICK_MS);
    setIsRunning(true);
    emitLog("info", "Heartbeat system resumed (counter reset)");
  }, [tick, emitLog]);

  const stop = useCallback(async () => {
    // Clear the interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);

    // Wait for any in-flight analysis to complete
    if (analysisPromiseRef.current) {
      emitLog("info", "Waiting for in-flight analysis to complete...");
      try {
        await analysisPromiseRef.current;
      } catch {
        // Swallow — we just need it to finish
      }
    }

    // Final flush: run one last storage and analysis heartbeat
    emitLog("info", "Running final heartbeat flush...");
    try {
      await onStorageRef.current();
    } catch (err) {
      emitLog("error", `Final storage flush failed: ${err}`);
    }

    // Only run final analysis if not already running
    if (!isAnalysisRunningRef.current) {
      try {
        await onAnalysisRef.current();
      } catch (err) {
        emitLog("error", `Final analysis flush failed: ${err}`);
      }
    }

    emitLog("info", "Heartbeat system stopped");
  }, [emitLog]);

  const clearErrors = useCallback(() => {
    setPipelineErrors({});
  }, []);

  const recordTransferEvent = useCallback(
    (channel: TransferChannel, saved: boolean, error?: string) => {
      const counter = transferHealthRef.current[channel];
      counter.sent++;
      if (saved) {
        counter.saved++;
      } else {
        counter.failed++;
        emitLog(
          "error",
          error
            ? `${channel} save failed: ${error}`
            : `${channel} save failed (no error detail reported)`,
          channel,
        );
      }
      syncTransferHealth();
    },
    [emitLog, syncTransferHealth],
  );

  return {
    start,
    stop,
    pause,
    resume,
    storageBeat,
    analysisBeat,
    isStorageRunning,
    isAnalysisRunning,
    health,
    pipelineErrors,
    transferHealth,
    transferHealthRef,
    isRunning,
    clearErrors,
    recordTransferEvent,
  };
}

// ── Math utility ──

function gcd(a: number, b: number): number {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}
