"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { WorkCanvas } from "@/components/ExcalidrawCanvas";
import { SessionTopicChapter } from "@/components/session-view/ile-work-dock-bar";
import { SessionBranchFieldBoundary } from "@/components/session-view/session-branch-prepare";
import { calibrateFieldPrepareInput } from "@/lib/session-branch-prepare";
import { SessionPolicyBridge, type SessionPolicySnapshot } from "@/components/session-view/session-policy-context";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import {
  CALIBRATE_DATA_DISABLED_LABEL,
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
            fitOpenBoard
            scrollAppliedElements={false}
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
      focus={
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" data-calibrate-step>
          <SessionGuidePanel guide="calibrate" />
        </div>
      }
    />
    </SessionBranchFieldBoundary>
  );
}
