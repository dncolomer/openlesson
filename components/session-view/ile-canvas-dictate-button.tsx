"use client";

import { useEffect, useRef, useState } from "react";
import {
  ILE_CANVAS_DICTATE_LABEL,
  ILE_CANVAS_DICTATE_STOP_LABEL,
  ileDictateCaptureText,
  noteIleDictateTranscript,
  startIleDictateCapture,
  type IleDictateCapture,
} from "@/lib/ile-canvas-dictate";

export function IleCanvasDictateButton({
  transcript,
  onCommit,
}: {
  transcript: string;
  onCommit: (text: string) => void;
}) {
  const [dictating, setDictating] = useState(false);
  const captureRef = useRef<IleDictateCapture | null>(null);

  useEffect(() => {
    if (!captureRef.current) return;
    captureRef.current = noteIleDictateTranscript(captureRef.current, transcript);
  }, [transcript]);

  return (
    <button
      type="button"
      data-ile-canvas-dictate
      aria-pressed={dictating}
      onClick={() => {
        if (!captureRef.current) {
          captureRef.current = startIleDictateCapture(transcript);
          setDictating(true);
          return;
        }
        const text = ileDictateCaptureText(
          noteIleDictateTranscript(captureRef.current, transcript),
        );
        captureRef.current = null;
        setDictating(false);
        if (text) onCommit(text);
      }}
      className="pointer-events-auto shrink-0 rounded-none border border-white bg-neutral-950 px-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] hover:bg-neutral-800 aria-pressed:bg-white aria-pressed:text-neutral-950"
    >
      {dictating ? ILE_CANVAS_DICTATE_STOP_LABEL : ILE_CANVAS_DICTATE_LABEL}
    </button>
  );
}
