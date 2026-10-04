"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { SessionDataCard } from "@/components/session-view/session-data-card";

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
 * Data card for Prepare, Drill, conversational TAP, and Verify.
 * Audio, video, and screen stay off until Enable. This surface has no Muse headset.
 */
export function TapSessionSignals() {
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [videoNote, setVideoNote] = useState<string | null>(null);
  const [screenNote, setScreenNote] = useState<string | null>(null);
  const [museNote, setMuseNote] = useState<string | null>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopStream(audioRef.current);
      stopStream(videoRef.current);
      stopStream(screenRef.current);
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
        onDisableAudio={() => {
          setAudioNote(null);
          replace(audioRef, setAudioStream, null);
        }}
        museEnabled={false}
        museNote={museNote}
        onEnableMuse={() => setMuseNote("No headset on this mode.")}
        videoEnabled={videoStream != null}
        videoNote={videoNote}
        videoStream={videoStream}
        onEnableVideo={() => {
          void openCamera().then((next) => {
            if (!next) {
              setVideoNote("Camera unavailable.");
              return;
            }
            setVideoNote(null);
            replace(videoRef, setVideoStream, next);
          });
        }}
        onDisableVideo={() => {
          setVideoNote(null);
          replace(videoRef, setVideoStream, null);
        }}
        screenEnabled={screenStream != null}
        screenNote={screenNote}
        screenStream={screenStream}
        onEnableScreen={() => {
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
              };
            });
            replace(screenRef, setScreenStream, owned);
          });
        }}
        onDisableScreen={() => {
          setScreenNote(null);
          replace(screenRef, setScreenStream, null);
        }}
      />
    </div>
  );
}
