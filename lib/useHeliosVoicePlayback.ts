"use client";

import { useEffect, useState } from "react";

const HELIOS_VOICE_PLAYBACK_EVENT = "helios-voice-playback";

type HeliosVoicePlaybackDetail = {
  sourceId: string;
  playing: boolean;
};

export function emitHeliosVoicePlayback(sourceId: string, playing: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<HeliosVoicePlaybackDetail>(HELIOS_VOICE_PLAYBACK_EVENT, {
    detail: { sourceId, playing },
  }));
}

export function useHeliosVoicePlaybackActive() {
  const [activeSourceIds, setActiveSourceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handlePlayback = (event: Event) => {
      const { sourceId, playing } = (event as CustomEvent<HeliosVoicePlaybackDetail>).detail || {};
      if (!sourceId) return;

      setActiveSourceIds((current) => {
        const next = new Set(current);
        if (playing) {
          next.add(sourceId);
        } else {
          next.delete(sourceId);
        }
        return next;
      });
    };

    window.addEventListener(HELIOS_VOICE_PLAYBACK_EVENT, handlePlayback);
    return () => window.removeEventListener(HELIOS_VOICE_PLAYBACK_EVENT, handlePlayback);
  }, []);

  return activeSourceIds.size > 0;
}
