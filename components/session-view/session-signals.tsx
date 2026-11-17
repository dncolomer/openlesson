"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { SessionDataCard } from "@/components/session-view/session-data-card";
import { type FlowEnforcedChannels } from "@/lib/flow-channels";
import {
  mediaStreamLive,
  museSamplesLive,
  type FlowChannelLive,
} from "@/lib/flow-channel-purity";
import type { DeviceStatus } from "@/lib/muse-athena";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
}

async function openMic(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
      video: false,
    });
  } catch {
    return null;
  }
}

async function openCamera(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 360 },
      audio: false,
    });
  } catch {
    return null;
  }
}

async function openScreen(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return null;
  }
}

/**
 * Data card for Prepare, Drill, conversational TAP, Verify, and Calibration.
 * Enforced channels auto-start. Muse connects when the flow requires EEG.
 */
export function TapSessionSignals({
  captureAudio = false,
  enforcedChannels,
  onLiveChange,
}: {
  captureAudio?: boolean;
  enforcedChannels?: FlowEnforcedChannels;
  onLiveChange?: (live: FlowChannelLive) => void;
}) {
  const channels = enforcedChannels ?? {
    audio: captureAudio,
    muse: false,
    video: false,
    screenshots: false,
  };
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [videoNote, setVideoNote] = useState<string | null>(null);
  const [screenNote, setScreenNote] = useState<string | null>(null);
  const [museNote, setMuseNote] = useState<string | null>(null);
  const [museStatus, setMuseStatus] = useState<
    "disconnected" | "connecting" | "connected" | "streaming"
  >("disconnected");
  const [museDeviceStatus, setMuseDeviceStatus] = useState<DeviceStatus | null>(null);
  const [museChannelData, setMuseChannelData] = useState<Map<string, number[]>>(new Map());
  const audioRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const museClientRef = useRef<{ disconnect: () => void } | null>(null);
  const museLastSampleAtRef = useRef<number | null>(null);
  const eegBufferRef = useRef<Map<string, number[]>>(new Map());
  const eegIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onLiveChangeRef = useRef(onLiveChange);
  onLiveChangeRef.current = onLiveChange;
  const wantAudio = captureAudio || channels.audio;

  useEffect(() => {
    return () => {
      stopStream(audioRef.current);
      stopStream(videoRef.current);
      stopStream(screenRef.current);
      museClientRef.current?.disconnect();
      if (eegIntervalRef.current) window.clearInterval(eegIntervalRef.current);
    };
  }, []);

  const replace = (
    ref: MutableRefObject<MediaStream | null>,
    setStream: (stream: MediaStream | null) => void,
    next: MediaStream | null,
  ) => {
    stopStream(ref.current);
    ref.current = next;
    setStream(next);
  };

  const publishLive = () => {
    const live: FlowChannelLive = {
      muse: museSamplesLive({ lastSampleAtMs: museLastSampleAtRef.current }),
      video: mediaStreamLive(videoRef.current),
      screenshots: mediaStreamLive(screenRef.current),
    };
    onLiveChangeRef.current?.(live);
  };

  useEffect(() => {
    const tick = window.setInterval(publishLive, 250);
    publishLive();
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!wantAudio) return;
    let cancelled = false;
    void openMic().then((next) => {
      if (cancelled || !next || audioRef.current) {
        stopStream(next);
        return;
      }
      setAudioNote(null);
      audioRef.current = next;
      setAudioStream(next);
    });
    return () => {
      cancelled = true;
    };
  }, [wantAudio]);

  const enableVideo = () => {
    void openCamera().then((next) => {
      if (!next) {
        setVideoNote("Camera unavailable.");
        return;
      }
      setVideoNote(null);
      replace(videoRef, setVideoStream, next);
      publishLive();
    });
  };

  const enableScreen = () => {
    void openScreen().then((next) => {
      if (!next) {
        setScreenNote("Screen capture unavailable.");
        return;
      }
      setScreenNote(null);
      const owned = next;
      owned.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (screenRef.current !== owned) return;
          setScreenNote(null);
          replace(screenRef, setScreenStream, null);
          publishLive();
        };
      });
      replace(screenRef, setScreenStream, owned);
      publishLive();
    });
  };

  const disconnectMuse = () => {
    if (eegIntervalRef.current) {
      window.clearInterval(eegIntervalRef.current);
      eegIntervalRef.current = null;
    }
    museClientRef.current?.disconnect();
    museClientRef.current = null;
    museLastSampleAtRef.current = null;
    setMuseStatus("disconnected");
    setMuseDeviceStatus(null);
    setMuseChannelData(new Map());
    publishLive();
  };

  const connectMuse = async () => {
    disconnectMuse();
    setMuseStatus("connecting");
    setMuseNote(null);
    try {
      const { MuseAthenaClient } = await import("@/lib/muse-athena");
      const muse = new MuseAthenaClient();
      muse.onStatusChange((status: "disconnected" | "connecting" | "connected" | "streaming") => {
        setMuseStatus(status);
      });
      muse.onDeviceStatus((status: DeviceStatus) => {
        setMuseDeviceStatus(status);
      });
      muse.onDisconnected(() => {
        museClientRef.current = null;
        museLastSampleAtRef.current = null;
        setMuseStatus("disconnected");
        setMuseNote("Muse disconnected. Reconnect it from the Muse tab.");
        publishLive();
      });
      muse.onEEG((sample: { channels: Record<string, number[]> }) => {
        museLastSampleAtRef.current = Date.now();
        for (const [channelName, samples] of Object.entries(sample.channels)) {
          const existing = eegBufferRef.current.get(channelName) || [];
          existing.push(...samples);
          eegBufferRef.current.set(channelName, existing.slice(-256));
        }
      });
      await muse.connect();
      museClientRef.current = muse;
      setMuseStatus("connected");
      await muse.startStreaming();
      setMuseStatus("streaming");
      eegIntervalRef.current = setInterval(() => {
        setMuseChannelData(new Map(eegBufferRef.current));
        publishLive();
      }, 200);
    } catch {
      setMuseStatus("disconnected");
      setMuseNote("Muse unavailable.");
      publishLive();
    }
  };

  useEffect(() => {
    if (channels.video && !videoRef.current) enableVideo();
    if (channels.screenshots && !screenRef.current) enableScreen();
    if (channels.muse && museStatus === "disconnected" && !museClientRef.current) {
      void connectMuse();
    }
    // Auto-start once per mount when the flow requires the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.muse, channels.video, channels.screenshots]);

  return (
    <div data-ile-tools-widget data-session-sidebar-signals className="h-full w-full min-w-0">
      <SessionDataCard
        audioEnabled={audioStream != null}
        audioNote={audioNote}
        audioStream={audioStream}
        onEnableAudio={() => {
          void openMic().then((next) => {
            if (!next) {
              setAudioNote("Microphone unavailable.");
              return;
            }
            setAudioNote(null);
            replace(audioRef, setAudioStream, next);
          });
        }}
        onDisableAudio={
          channels.audio
            ? undefined
            : () => {
                setAudioNote(null);
                replace(audioRef, setAudioStream, null);
              }
        }
        museEnabled={
          museStatus === "connecting" || museStatus === "connected" || museStatus === "streaming"
        }
        museNote={museNote}
        museStatus={museStatus}
        museDeviceStatus={museDeviceStatus}
        museChannelData={museChannelData}
        onEnableMuse={() => {
          void connectMuse();
        }}
        onDisableMuse={channels.muse ? undefined : disconnectMuse}
        videoEnabled={videoStream != null}
        videoNote={videoNote}
        videoStream={videoStream}
        onEnableVideo={enableVideo}
        onDisableVideo={
          channels.video
            ? undefined
            : () => {
                setVideoNote(null);
                replace(videoRef, setVideoStream, null);
                publishLive();
              }
        }
        screenEnabled={screenStream != null}
        screenNote={screenNote}
        screenStream={screenStream}
        onEnableScreen={enableScreen}
        onDisableScreen={
          channels.screenshots
            ? undefined
            : () => {
                setScreenNote(null);
                replace(screenRef, setScreenStream, null);
                publishLive();
              }
        }
      />
    </div>
  );
}
