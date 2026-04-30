"use client";

import { useEffect, useState } from "react";

interface UseVoiceActivityOptions {
  /** Mic MediaStream. When null the hook is inert. */
  stream: MediaStream | null;
  /** True while the session is recording. Hook is inert otherwise. */
  isRecording: boolean;
  /** True while the session is paused. Also makes the hook inert. */
  isPaused: boolean;
  /**
   * RMS amplitude (0-1) above which a sample counts as voiced.
   * Default 0.04 — same threshold as useInactivityAutoPause.
   */
  rmsThreshold?: number;
  /**
   * Consecutive above-threshold samples required to flip `isSpeaking`
   * to true. Samples are taken every 150 ms, so default 2 = ~300 ms
   * of sustained sound.
   */
  onsetSamples?: number;
  /**
   * Consecutive below-threshold samples required to flip `isSpeaking`
   * back to false. Samples run every 150 ms, so default 8 = ~1.2 s of
   * silence before the background drift + actions-box glow fade out.
   * The generous tail prevents the UI from abruptly stopping during
   * natural pauses between sentences.
   */
  offsetSamples?: number;
}

/**
 * Lightweight real-time voice activity detector.
 *
 * Returns `isSpeaking: boolean` which is `true` while the mic picks up
 * speech-level audio and `false` after a brief silent period.
 *
 * Uses the same AudioContext + AnalyserNode approach as
 * useInactivityAutoPause but with a tighter sampling loop (150 ms)
 * and hysteresis (separate onset/offset thresholds) for smooth UI.
 */
export function useVoiceActivity({
  stream,
  isRecording,
  isPaused,
  rmsThreshold = 0.04,
  onsetSamples = 2,
  offsetSamples = 8,
}: UseVoiceActivityOptions): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Reset when session stops or pauses
  useEffect(() => {
    if (!isRecording || isPaused) {
      setIsSpeaking(false);
    }
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (!isRecording || isPaused || !stream) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let timeDomain: Float32Array<ArrayBuffer> | null = null;
    let consecutiveVoiced = 0;
    let consecutiveSilent = 0;
    let speaking = false;

    try {
      const Ctx: typeof AudioContext | undefined =
        (
          window as unknown as {
            AudioContext?: typeof AudioContext;
            webkitAudioContext?: typeof AudioContext;
          }
        ).AudioContext ||
        (
          window as unknown as {
            AudioContext?: typeof AudioContext;
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!Ctx) return;

      audioCtx = new Ctx();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      timeDomain = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    } catch {
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

      if (rms > rmsThreshold) {
        consecutiveVoiced++;
        consecutiveSilent = 0;
        if (!speaking && consecutiveVoiced >= onsetSamples) {
          speaking = true;
          setIsSpeaking(true);
        }
      } else {
        consecutiveSilent++;
        consecutiveVoiced = 0;
        if (speaking && consecutiveSilent >= offsetSamples) {
          speaking = false;
          setIsSpeaking(false);
        }
      }

      timerId = setTimeout(tick, 150);
    };
    tick();

    return () => {
      if (timerId !== null) clearTimeout(timerId);
      try {
        source?.disconnect();
      } catch {}
      try {
        analyser?.disconnect();
      } catch {}
      audioCtx?.close().catch(() => {});
    };
  }, [stream, isRecording, isPaused, rmsThreshold, onsetSamples, offsetSamples]);

  return isSpeaking;
}
