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
import { AccelerandoMark } from "@/components/AccelerandoGlyphs";
import {
  CommandPlate,
  ILE_CANVAS_COMMAND_SIDEBAR_CLASS,
  ILE_CANVAS_COMMAND_SIDEBAR_MARK_CLASS,
} from "@/components/excalidraw-canvas/command-plate";

function dictateButtonClass(
  kind: "idle" | "stop",
  square: boolean,
  wide: boolean,
  plate: boolean,
) {
  const pressed = kind === "idle" ? " aria-pressed:bg-white aria-pressed:text-neutral-950" : "";
  if (plate) return `${ILE_CANVAS_COMMAND_SIDEBAR_CLASS}${pressed}`;
  if (square) {
    return `pointer-events-auto flex min-h-9 w-full min-w-0 items-center justify-start gap-1.5 whitespace-nowrap rounded-none border border-white bg-neutral-950 px-1.5 py-2 text-left font-mono text-[11px] font-semibold text-white hover:bg-neutral-800${pressed}`;
  }
  if (wide) {
    return `pointer-events-auto flex h-full min-h-0 min-w-0 w-full items-center justify-center gap-1 rounded-none border border-white bg-neutral-950 px-2 py-1.5 text-[11px] text-center font-semibold uppercase tracking-wider text-white hover:bg-neutral-800${pressed}`;
  }
  return `pointer-events-auto inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-none border border-white bg-neutral-950 px-4 py-2.5 text-sm text-center font-semibold uppercase tracking-wider text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] hover:bg-neutral-800${pressed}`;
}

export function IleCanvasDictateButton({
  transcript,
  onLiveText,
  onCommit,
  onActiveChange,
  square = false,
  wide = false,
  plate = false,
  index = "07",
}: {
  transcript: string;
  /** Writes the transcript onto the canvas as recognition updates. */
  onLiveText: (text: string) => void;
  /** Stop. The canvas records the finished transcript as proof of work. */
  onCommit: (text: string) => void;
  /** Optional. Calibration starts speech only while this button is active. */
  onActiveChange?: (active: boolean) => void;
  /** Left and right docks: a short row with the name beside a mark. */
  square?: boolean;
  /** Sidebar board row: full width, apart from the command grid. */
  wide?: boolean;
  /** Commands grid tile. */
  plate?: boolean;
  index?: string;
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

  const finish = () => {
    if (!captureRef.current) return;
    const text = ileDictateCaptureText(
      noteIleDictateTranscript(captureRef.current, transcript),
    );
    captureRef.current = null;
    setDictating(false);
    onActiveChange?.(false);
    if (text) onCommit(text);
    else onLiveText(text);
  };

  const markClass = plate ? ILE_CANVAS_COMMAND_SIDEBAR_MARK_CLASS : "h-3.5 w-3.5";
  return (
    <div
      data-ile-canvas-dictate
      data-session-command="dictate"
      className="flex h-full min-h-0 w-full min-w-0"
    >
      {dictating ? (
        <button
          type="button"
          data-ile-canvas-dictate-stop
          aria-pressed="true"
          aria-label={ILE_CANVAS_DICTATE_STOP_LABEL}
          onClick={finish}
          className={dictateButtonClass("stop", square, wide, plate)}
        >
          {plate ? <CommandPlate index={index} /> : null}
          <AccelerandoMark text={ILE_CANVAS_DICTATE_LABEL} className={markClass} />
          {plate ? (
            <span className="min-w-0 truncate">{ILE_CANVAS_DICTATE_STOP_LABEL}</span>
          ) : (
            ILE_CANVAS_DICTATE_STOP_LABEL
          )}
        </button>
      ) : (
        <button
          type="button"
          aria-pressed="false"
          aria-label={ILE_CANVAS_DICTATE_LABEL}
          onClick={() => {
            captureRef.current = startIleDictateCapture(transcript);
            setDictating(true);
            onActiveChange?.(true);
          }}
          className={dictateButtonClass("idle", square, wide, plate)}
        >
          {plate ? <CommandPlate index={index} /> : null}
          <AccelerandoMark text={ILE_CANVAS_DICTATE_LABEL} className={markClass} />
          {plate ? (
            <span className="min-w-0 truncate">{ILE_CANVAS_DICTATE_LABEL}</span>
          ) : (
            ILE_CANVAS_DICTATE_LABEL
          )}
        </button>
      )}
    </div>
  );
}
