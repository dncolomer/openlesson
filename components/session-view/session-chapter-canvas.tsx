"use client";

import type { Dispatch, SetStateAction } from "react";
import { WorkCanvas } from "@/components/ExcalidrawCanvas";
import type { IleCanvasCraftInsightConfig } from "@/components/session-view/ile-canvas-craft-insight";
import type { InsightSummary } from "@/lib/insights";
import type { IlePowCounterArtifact } from "@/lib/ile-pow-counters";
import { ileChapterCanvasRemountKey } from "@/lib/ile-session-global-context";
import {
  serializeIleWorkCanvasScene,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import type { IleWorkCanvasPowEvent } from "@/lib/ile-work-canvas-pow";
import type { Session } from "@/lib/storage";

export function SessionChapterWorkCanvas({
  session,
  activeChapterKey,
  whiteboardData,
  whiteboardSceneData,
  isHeliosAssistantPending,
  setWhiteboardData,
  setCanvasDirtyForHelios,
  sessionRef,
  whiteboardSceneDataRef,
  updateActiveChapterWorkspace,
  canvasApplyElements,
  canvasApplyNonce,
  handleCanvasPowActions,
  handleAskCanvasSelection,
  sessionThoughtInterface,
  activeStep,
  activeChapterLabel,
  workspaceId,
  ileToken,
  recordSessionPowArtifact,
  sessionPowArtifactsRef,
  insightWorkMarkRef,
  setSessionInsights,
}: {
  session: Session | null;
  activeChapterKey: string;
  whiteboardData: string | null | undefined;
  whiteboardSceneData: IleWorkCanvasScene | null;
  isHeliosAssistantPending: boolean;
  setWhiteboardData: (data: string) => void;
  setCanvasDirtyForHelios: (dirty: boolean) => void;
  sessionRef: { current: Session | null };
  whiteboardSceneDataRef: { current: IleWorkCanvasScene | null };
  updateActiveChapterWorkspace: (patch: { whiteboardSceneData: IleWorkCanvasScene }) => void;
  canvasApplyElements: readonly IleWorkCanvasElement[] | null;
  canvasApplyNonce: string | number | null;
  handleCanvasPowActions: (events: IleWorkCanvasPowEvent[]) => void;
  handleAskCanvasSelection: NonNullable<Parameters<typeof WorkCanvas>[0]["onAskSelected"]>;
  sessionThoughtInterface: { crystallizableText?: string };
  activeStep: { id?: string | null } | null | undefined;
  activeChapterLabel: string;
  workspaceId?: string | null;
  ileToken?: string;
  recordSessionPowArtifact: IleCanvasCraftInsightConfig["recordSessionPowArtifact"];
  sessionPowArtifactsRef: { current: IlePowCounterArtifact[] };
  insightWorkMarkRef: { current: number };
  setSessionInsights: Dispatch<SetStateAction<InsightSummary[]>>;
}) {
  if (!session) return null;
  const boardId = ileChapterCanvasRemountKey(session.id, activeChapterKey);
  return (
    <WorkCanvas
      key={`${boardId}:work`}
      boardId={boardId}
      initialData={whiteboardData || undefined}
      initialSceneData={whiteboardSceneData}
      heliosBusy={isHeliosAssistantPending}
      onCanvasChange={(data) => {
        setWhiteboardData(data);
        setCanvasDirtyForHelios(true);
        if (sessionRef.current) {
          sessionRef.current = {
            ...sessionRef.current,
            metadata: { ...sessionRef.current.metadata, whiteboardData: data },
          };
        }
      }}
      onSceneChange={(data) => {
        const scene = serializeIleWorkCanvasScene(data);
        whiteboardSceneDataRef.current = scene;
        updateActiveChapterWorkspace({ whiteboardSceneData: scene });
      }}
      applyElements={canvasApplyElements}
      applyElementsNonce={canvasApplyNonce}
      onCanvasPowActions={handleCanvasPowActions}
      onAskSelected={handleAskCanvasSelection}
      dictateTranscript={sessionThoughtInterface.crystallizableText}
      craftInsight={
        activeStep?.id
          ? {
              chapterId: activeStep.id,
              chapterLabel: activeChapterLabel,
              sessionId: session.id,
              workspaceId,
              ileToken,
              recordSessionPowArtifact,
              workArtifacts: sessionPowArtifactsRef.current,
              workSinceIndex: insightWorkMarkRef.current,
              onCrafted: (insight) => {
                insightWorkMarkRef.current = sessionPowArtifactsRef.current.length;
                setSessionInsights((current) => {
                  if (current.some((row) => row.id === insight.id)) return current;
                  return [insight, ...current];
                });
              },
            }
          : null
      }
    />
  );
}
