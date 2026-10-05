"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { WorkCanvas } from "@/components/ExcalidrawCanvas";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionTopicChapter } from "@/components/session-view/ile-work-dock-bar";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import {
  CALIBRATE_COMFORTABLE_REQUIRED,
  CALIBRATE_DATA_DISABLED_LABEL,
  CALIBRATE_DONE_ANSWERING_LABEL,
  CALIBRATE_DONE_CLASSIFYING_LABEL,
  CALIBRATE_DONE_EXPLAINING_LABEL,
  CALIBRATE_UNCONFIDENT_REQUIRED,
  calibrateStepInstruction,
  type CalibratePhase,
} from "@/lib/calibrate-session";
import { tapWorkCanvasShouldAcceptSceneUpdate } from "@/lib/tap-work-canvas";
import type { IleWorkCanvasElement, IleWorkCanvasScene } from "@/lib/ile-work-canvas";
import type { IleWorkCanvasPowEvent } from "@/lib/ile-work-canvas-pow";
import { getSpeechRecognitionConstructor } from "@/lib/useSessionThoughtInterface";

function useOptionalDictateTranscript() {
  const [transcript, setTranscript] = useState("");
  const stopRef = useRef<(() => void) | null>(null);

  const onDictateActive = useCallback((active: boolean) => {
    stopRef.current?.();
    stopRef.current = null;
    if (!active) return;
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i]?.[0]?.transcript || "";
      }
      setTranscript(text);
    };
    try {
      recognition.start();
    } catch {
      return;
    }
    stopRef.current = () => {
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  useEffect(() => () => stopRef.current?.(), []);
  return { transcript, onDictateActive };
}

function CalibrateDataDisabled() {
  return (
    <div
      data-session-sidebar-signals
      data-calibrate-data="disabled"
      className="flex h-full min-h-0 items-center justify-center bg-black px-3 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-400"
    >
      {CALIBRATE_DATA_DISABLED_LABEL}
    </div>
  );
}

function advanceLabel(phase: CalibratePhase): string {
  if (phase === "answer") return CALIBRATE_DONE_ANSWERING_LABEL;
  if (phase === "explain") return CALIBRATE_DONE_EXPLAINING_LABEL;
  if (phase === "complete") return "Stored";
  return CALIBRATE_DONE_CLASSIFYING_LABEL;
}

export function CalibrateLiveSurface(props: {
  boardId?: string | null;
  phase: CalibratePhase;
  poolLoading: boolean;
  comfortableCount: number;
  unconfidentCount: number;
  canAdvance: boolean;
  readOnly: boolean;
  scene: IleWorkCanvasScene;
  sceneRef: MutableRefObject<IleWorkCanvasScene | null>;
  applyElements: IleWorkCanvasElement[];
  applyNonce: number;
  onSceneChange: (scene: IleWorkCanvasScene) => void;
  onCanvasPowActions: (events: IleWorkCanvasPowEvent[]) => void;
  onAdvance: () => void;
  error: string;
  clock: ReactNode;
  actions: ReactNode;
  topicId: string;
  topicText: string;
  focusLabel: string;
}) {
  const { transcript, onDictateActive } = useOptionalDictateTranscript();
  const label = advanceLabel(props.phase);
  const waiting = props.poolLoading && props.phase === "classifying";

  return (
    <SessionWorkSurface
      mode="tap"
      stage={
        <div
          data-scout-work-canvas-pane
          data-calibrate-work-canvas
          data-scout-canvas-readonly={props.readOnly ? "true" : "false"}
          className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <WorkCanvas
            key={`calibrate-work-canvas:${props.boardId || "board"}`}
            boardId={props.boardId}
            initialSceneData={props.scene}
            applyElements={props.applyElements}
            applyElementsNonce={props.applyNonce}
            viewModeEnabled={props.readOnly}
            heliosBusy={false}
            dictateTranscript={transcript}
            onDictateActive={onDictateActive}
            onSceneChange={(scene) => {
              if (props.readOnly) return;
              if (!tapWorkCanvasShouldAcceptSceneUpdate(props.sceneRef.current, scene)) return;
              props.onSceneChange(scene);
            }}
            onCanvasPowActions={props.onCanvasPowActions}
            onAskSelected={async () => ({ text: "" })}
          />
          {props.error ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 px-3 text-center text-xs text-red-300">
              {props.error}
            </p>
          ) : null}
        </div>
      }
      clock={props.clock}
      actions={props.actions}
      chapters={<SessionTopicChapter id={props.topicId} keyword={props.topicText} />}
      signals={<CalibrateDataDisabled />}
      focusLabel={props.focusLabel}
      focus={
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" data-calibrate-step>
          {waiting ? (
            <div
              className="flex min-h-0 flex-1 items-center justify-center px-4 py-8"
              data-calibrate-pool-loading
              data-scout-questions-loading
            >
              <LoadingStatusMessage message="Generating questions…" size="md" tone="light" className="text-center" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
              <p className="text-sm leading-relaxed text-neutral-200" data-calibrate-instruction>
                {calibrateStepInstruction(props.phase)}
              </p>
              {props.phase === "classifying" ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500" data-calibrate-counts>
                  Comfortable {props.comfortableCount}/{CALIBRATE_COMFORTABLE_REQUIRED}
                  {" · "}
                  Not confident {props.unconfidentCount}/{CALIBRATE_UNCONFIDENT_REQUIRED}
                </p>
              ) : null}
              <button
                type="button"
                data-calibrate-advance
                data-calibrate-done-classifying={props.phase === "classifying" ? "true" : "false"}
                disabled={props.readOnly || props.phase === "complete" || !props.canAdvance}
                onClick={() => props.onAdvance()}
                className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} w-full disabled:opacity-40`}
              >
                {label}
              </button>
            </div>
          )}
        </div>
      }
    />
  );
}
