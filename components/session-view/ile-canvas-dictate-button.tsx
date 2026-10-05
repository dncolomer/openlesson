"use client";

import { useEffect, useRef, useState } from "react";
import {
  ILE_CANVAS_DICTATE_LABEL,
  ILE_CANVAS_DICTATE_STOP_LABEL,
  advanceIleDictateCapture,
  ileDictateCaptureText,
  noteIleDictateTranscript,
  startIleDictateCapture,
  type IleDictateCapture,
} from "@/lib/ile-canvas-dictate";

export function IleCanvasDictateButton({
  transcript,
  onLiveText,
  onCommit,
  onActiveChange,
}: {
  transcript: string;
  /** Writes the transcript onto the canvas as recognition updates. */
  onLiveText: (text: string) => void;
  /** Stop. The canvas records the finished transcript as proof of work. */
  onCommit: (text: string) => void;
  /** Optional. Calibration starts speech only while this button is active. */
  onActiveChange?: (active: boolean) => void;
}) {
  const [dictating, setDictating] = useState(false);
  const captureRef = useRef<IleDictateCapture | null>(null);
  const onLiveTextRef = useRef(onLiveText);
  onLiveTextRef.current = onLiveText;

  useEffect(() => {
    if (!captureRef.current) return;
    const advanced = advanceIleDictateCapture(captureRef.current, transcript);
    captureRef.current = advanced.capture;
    onLiveTextRef.current(advanced.text);
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
          onActiveChange?.(true);
          return;
        }
        const text = ileDictateCaptureText(
          noteIleDictateTranscript(captureRef.current, transcript),
        );
        captureRef.current = null;
        setDictating(false);
        onActiveChange?.(false);
        if (text) onCommit(text);
        else onLiveText(text);
      }}
      className="pointer-events-auto shrink-0 rounded-none border border-white bg-neutral-950 px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] hover:bg-neutral-800 aria-pressed:bg-white aria-pressed:text-neutral-950"
    >
      {dictating ? ILE_CANVAS_DICTATE_STOP_LABEL : ILE_CANVAS_DICTATE_LABEL}
    </button>
  );
}
