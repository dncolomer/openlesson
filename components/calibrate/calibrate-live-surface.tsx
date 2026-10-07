"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { WorkCanvas } from "@/components/ExcalidrawCanvas";
import { SessionTopicChapter } from "@/components/session-view/ile-work-dock-bar";
import { SessionBranchFieldBoundary } from "@/components/session-view/session-branch-prepare";
import { calibrateFieldPrepareInput } from "@/lib/session-branch-prepare";
import { SessionPolicyBridge, type SessionPolicySnapshot } from "@/components/session-view/session-policy-context";
import { SessionActionsPanel } from "@/components/session-view/session-mark-controls";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import {
  CALIBRATE_DATA_DISABLED_LABEL,
  CALIBRATE_MOVE_RIGHT_LABEL,
  CALIBRATE_OPENING_INSTRUCTION,
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
  markQuestions?: readonly { id?: string | null; text?: string | null }[];
  sessionId?: string | null;
  tapSessionId?: string | null;
  workspaceId?: string | null;
  blockId?: string | null;
  privateToken?: string | null;
  calibrationToken?: string | null;
  entryQueryParams?: Record<string, string | string[]> | null;
  policyRef?: MutableRefObject<SessionPolicySnapshot>;
}) {
  const { transcript, onDictateActive } = useOptionalDictateTranscript();
  const [showOpening, setShowOpening] = useState(props.phase === "classifying");
  const [showMoveRight, setShowMoveRight] = useState(false);

  useEffect(() => {
    if (props.phase !== "classifying") {
      setShowOpening(false);
      return;
    }
    setShowOpening(true);
    setShowMoveRight(false);
    const cue = window.setTimeout(() => setShowMoveRight(true), 1100);
    return () => window.clearTimeout(cue);
  }, [props.boardId, props.phase]);

  useEffect(() => {
    if (!showOpening || !showMoveRight) return;
    const dismiss = () => setShowOpening(false);
    const host = document.querySelector("[data-calibrate-work-canvas]");
    const timer = window.setTimeout(dismiss, 6000);
    host?.addEventListener("pointerdown", dismiss);
    return () => {
      window.clearTimeout(timer);
      host?.removeEventListener("pointerdown", dismiss);
    };
  }, [showOpening, showMoveRight]);

  const fieldInput = calibrateFieldPrepareInput({
    topicText: props.topicText,
    topicId: props.topicId,
    questions: props.markQuestions,
    sessionId: props.sessionId,
    tapSessionId: props.tapSessionId,
    workspaceId: props.workspaceId,
    blockId: props.blockId,
    privateToken: props.privateToken,
    calibrationToken: props.calibrationToken,
    entryQueryParams: props.entryQueryParams,
  });
  const fieldSessionKey = (
    props.tapSessionId ||
    props.sessionId ||
    props.calibrationToken ||
    props.boardId ||
    "session"
  ).trim();

  return (
    <SessionBranchFieldBoundary
      enabled
      input={fieldInput}
    >
    {props.policyRef ? <SessionPolicyBridge target={props.policyRef} /> : null}
    <SessionWorkSurface
      mode="tap"
      policyTab
      stackBelow
      stage={
        <div
          data-scout-work-canvas-pane
          data-calibrate-work-canvas
          data-scout-canvas-readonly={props.readOnly ? "true" : "false"}
          className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <WorkCanvas
            key={`calibrate-work-canvas:${props.boardId || "board"}`}
            boardId={props.boardId || "board"}
            initialSceneData={props.scene}
            applyElements={props.applyElements}
            applyElementsNonce={props.applyNonce}
            viewModeEnabled={props.readOnly}
            heliosBusy={false}
            dictateTranscript={transcript}
            onDictateActive={onDictateActive}
            sessionMarkMode="calibrate"
            sessionMarkListKey={`calibrate:${fieldSessionKey}:${props.topicId || "topic"}`}
            sessionMarkQuestions={
              props.markQuestions && props.markQuestions.length > 0
                ? props.markQuestions
                : [{ id: props.topicId || "topic", text: props.topicText || "This topic" }]
            }
            onSceneChange={(scene) => {
              if (props.readOnly) return;
              if (!tapWorkCanvasShouldAcceptSceneUpdate(props.sceneRef.current, scene)) return;
              props.onSceneChange(scene);
            }}
            onCanvasPowActions={props.onCanvasPowActions}
            onAskSelected={async () => ({ text: "" })}
            openFocusRole="instruction"
            scrollAppliedElements={false}
          />
          {showOpening ? (
            <div
              className="@container/calibrate-open pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4"
              data-calibrate-opening
            >
              <div className="relative w-full min-w-0 max-w-md @[40rem]/calibrate-open:max-w-[min(28rem,calc(100cqw-26rem))]">
                <div className="bg-[#0b0b0b]/90 px-6 py-5">
                  <p className="text-center text-base leading-relaxed text-white" data-calibrate-opening-text>
                    {CALIBRATE_OPENING_INSTRUCTION}
                  </p>
                </div>
                {showMoveRight ? (
                  <div
                    className="absolute right-0 top-full mt-3 flex w-max items-center gap-2 text-white @[40rem]/calibrate-open:left-full @[40rem]/calibrate-open:right-auto @[40rem]/calibrate-open:top-1/2 @[40rem]/calibrate-open:mt-0 @[40rem]/calibrate-open:ml-4 @[40rem]/calibrate-open:-translate-y-1/2"
                    data-calibrate-opening-cue
                  >
                    <svg viewBox="0 0 72 16" className="h-4 w-16 shrink-0" aria-hidden>
                      <path d="M0 8h60" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path d="M52 2l12 6-12 6" fill="currentColor" />
                    </svg>
                    <span className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.16em]">
                      {CALIBRATE_MOVE_RIGHT_LABEL}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
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
      focusLabel="actions"
      focus={
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" data-calibrate-step>
          <SessionActionsPanel />
        </div>
      }
    />
    </SessionBranchFieldBoundary>
  );
}
