"use client";

import { useEffect, useRef } from "react";

interface UseInactivityAutoPauseOptions {
  /** Mic MediaStream.  When null, only input-device activity is tracked. */
  stream: MediaStream | null;
  /** True while the session is recording (i.e. running).  Hook is inert otherwise. */
  isRecording: boolean;
  /** True while the session is paused — also makes the hook inert. */
  isPaused: boolean;
  /** Called once when the threshold is crossed.  Should pause the session. */
  onAutoPause: () => void;
  /**
   * Milliseconds of continuous inactivity (no voice AND no input) before
   * the callback fires.  Defaults to 5 minutes.
   */
  thresholdMs?: number;
  /**
   * RMS amplitude (0-1) that counts as "voice".  The analyser values are
   * time-domain floats in [-1, 1].  Typical speech sits around 0.05-0.15,
   * while a quiet room mic floor is around 0.005-0.02.  We pick 0.04 so
   * background noise / HVAC / keyboard-tick-through-mic doesn't keep the
   * session alive forever, while normal conversational speech triggers
   * comfortably.
   */
  audioRmsThreshold?: number;
  /**
   * Number of consecutive above-threshold samples required to count as
   * real voice.  Samples are taken every 250 ms, so the default of 3
   * means ~750 ms of sustained sound — enough to filter out one-off
   * clicks, knocks and transient spikes.
   */
  audioConsecutiveSamples?: number;
  /**
   * Sampling interval for the inactivity check timer.  Defaults to 1 s.
   */
  checkIntervalMs?: number;
  /**
   * If true, logs periodic RMS + idle-time diagnostics to the console.
   * Useful when tuning thresholds.  Defaults to false.
   */
  debug?: boolean;
}

/**
 * Auto-pauses an active session after `thresholdMs` of no microphone
 * voice activity AND no user input (mouse / keyboard / touch / wheel).
 *
 * Cost-savings hook: prevents a forgotten tab from continuing to upload
 * audio chunks, run analysis heartbeats and burn LLM tokens.
 *
 * The hook is completely passive — it only calls `onAutoPause` once per
 * idle stretch.  It never reaches into DOM state or session storage; the
 * caller is responsible for the actual pause side-effects.
 */
export function useInactivityAutoPause({
  stream,
  isRecording,
  isPaused,
  onAutoPause,
  thresholdMs = 5 * 60 * 1000,
  audioRmsThreshold = 0.04,
  audioConsecutiveSamples = 3,
  checkIntervalMs = 1000,
  debug = false,
}: UseInactivityAutoPauseOptions) {
  // Latch callback in a ref so the main effect doesn't re-subscribe on every
  // render (the caller typically passes a freshly-bound `handlePause`).
  const onAutoPauseRef = useRef(onAutoPause);
  useEffect(() => {
    onAutoPauseRef.current = onAutoPause;
  }, [onAutoPause]);

  const lastActivityAtRef = useRef<number>(Date.now());
  const firedRef = useRef<boolean>(false);
  // Latch the most recent RMS purely for debug logging.
  const lastRmsRef = useRef<number>(0);

  // ── Input event listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isRecording || isPaused) return;

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
      firedRef.current = false;
    };

    // Reset on (re)enable
    markActivity();

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "touchmove",
      "pointerdown",
      "pointermove",
      "wheel",
      "scroll",
    ];
    for (const ev of events) {
      window.addEventListener(ev, markActivity, { passive: true });
    }
    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, markActivity);
      }
    };
  }, [isRecording, isPaused]);

  // ── Audio RMS monitor ────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording || isPaused) return;
    if (!stream) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let rafId: number | null = null;
    let timeDomain: Float32Array<ArrayBuffer> | null = null;
    let consecutiveVoiced = 0;

    try {
      const Ctx: typeof AudioContext | undefined =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;

      audioCtx = new Ctx();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      timeDomain = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    } catch (err) {
      // If we can't build the audio graph just fall back to input-only tracking.
      console.warn("[inactivity] Unable to set up audio analyser:", err);
      audioCtx?.close().catch(() => {});
      return;
    }

    const tick = () => {
      if (!analyser || !timeDomain) return;
      analyser.getFloatTimeDomainData(timeDomain);
      let sum = 0;
      for (let i = 0; i < timeDomain.length; i++) {
        const v = timeDomain[i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeDomain.length);
      lastRmsRef.current = rms;

      if (rms > audioRmsThreshold) {
        consecutiveVoiced++;
        if (consecutiveVoiced >= audioConsecutiveSamples) {
          lastActivityAtRef.current = Date.now();
          firedRef.current = false;
        }
      } else {
        consecutiveVoiced = 0;
      }

      rafId = window.setTimeout(tick, 250) as unknown as number;
    };
    tick();

    return () => {
      if (rafId !== null) clearTimeout(rafId);
      try {
        source?.disconnect();
      } catch {}
      try {
        analyser?.disconnect();
      } catch {}
      audioCtx?.close().catch(() => {});
    };
  }, [stream, isRecording, isPaused, audioRmsThreshold, audioConsecutiveSamples]);

  // ── Inactivity check ticker ──────────────────────────────────────────
  useEffect(() => {
    if (!isRecording || isPaused) return;
    // Reset the clock whenever we (re)enable monitoring
    lastActivityAtRef.current = Date.now();
    firedRef.current = false;

    let debugTick = 0;

    const intervalId = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityAtRef.current;

      if (debug) {
        // Log every 15 s so we can verify the hook is alive without flooding
        debugTick++;
        if (debugTick % 15 === 0) {
          console.log(
            `[inactivity] idle=${Math.round(idleFor / 1000)}s` +
            ` threshold=${Math.round(thresholdMs / 1000)}s` +
            ` rms=${lastRmsRef.current.toFixed(4)}` +
            ` rmsThreshold=${audioRmsThreshold}`,
          );
        }
      }

      if (firedRef.current) return;
      if (idleFor >= thresholdMs) {
        firedRef.current = true;
        if (debug) console.log("[inactivity] firing onAutoPause");
        try {
          onAutoPauseRef.current();
        } catch (err) {
          console.error("[inactivity] onAutoPause threw:", err);
        }
      }
    }, checkIntervalMs);

    return () => clearInterval(intervalId);
  }, [isRecording, isPaused, thresholdMs, checkIntervalMs, audioRmsThreshold, debug]);
}

