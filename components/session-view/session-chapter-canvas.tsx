"use client";

import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { WorkCanvas } from "@/components/ExcalidrawCanvas";
import { SessionPolicyAutosave } from "@/components/session-view/session-policy-autosave";
import { useSessionBranchField } from "@/components/session-view/session-branch-prepare";
import { SessionFieldLoader } from "@/components/session-view/session-field-gate";
import {
  SessionPolicyBridge,
  useSessionBranchSlot,
  type SessionPolicySnapshot,
} from "@/components/session-view/session-policy-context";
import { sessionCanvasMayOpen } from "@/lib/session-field-gate";
import type { IleCanvasCraftInsightConfig } from "@/components/session-view/ile-canvas-craft-insight";
import type { InsightSummary } from "@/lib/insights";
import type { IlePowCounterArtifact } from "@/lib/ile-pow-counters";
import { ilePowNextIndex } from "@/lib/ile-pow-counters";
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
  chapterTitle,
  chapterBrief,
  fieldScope,
  workspaceId,
  ileToken,
  ayclToken,
  recordSessionPowArtifact,
  sessionPowArtifactsRef,
  insightWorkMarkRef,
  setSessionInsights,
  onInsightKept,
  policyRef,
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
  /** Chapter material for the field. This is not the "Chapter N" label. */
  chapterTitle: string;
  chapterBrief: string;
  /** Same slice key the tips screen used. A later chapter passes its own id. */
  fieldScope?: string | null;
  workspaceId?: string | null;
  ileToken?: string;
  ayclToken?: string;
  recordSessionPowArtifact: IleCanvasCraftInsightConfig["recordSessionPowArtifact"];
  sessionPowArtifactsRef: { current: IlePowCounterArtifact[] };
  insightWorkMarkRef: { current: number };
  setSessionInsights: Dispatch<SetStateAction<InsightSummary[]>>;
  /** Fires after the insight is accepted, cleaned up, and saved. */
  onInsightKept?: (insight: InsightSummary) => void;
  policyRef?: MutableRefObject<SessionPolicySnapshot>;
}) {
  const chapterId = activeStep?.id || activeChapterKey || "chapter";
  useSessionBranchField(
    {
      enabled: Boolean(session?.id),
      sessionId: session?.id,
      chapterTitle,
      chapterBrief,
      ileToken,
      ayclToken,
      scope: fieldScope || chapterId,
    },
    session?.metadata,
  );
  const fieldSlot = useSessionBranchSlot();

  const bridge = policyRef ? <SessionPolicyBridge target={policyRef} /> : null;
  const autosave = session ? (
    <SessionPolicyAutosave sessionRef={sessionRef} ayclToken={ayclToken} ileToken={ileToken} />
  ) : null;
  if (!session) return bridge;
  if (!sessionCanvasMayOpen(fieldSlot)) {
    return (
      <>
        {bridge}
        {autosave}
        <SessionFieldLoader status={fieldSlot?.status} error={fieldSlot?.error} />
      </>
    );
  }
  const sessionMarkQuestions = [
    {
      id: chapterId,
      text: chapterTitle.trim() || activeChapterLabel || "This chapter",
    },
  ];
  const boardId = ileChapterCanvasRemountKey(session.id, activeChapterKey);
  return (
    <>
    {bridge}
    {autosave}
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
      sessionMarkMode="learn"
      sessionMarkListKey={`${session.id}:${chapterId}`}
      sessionMarkQuestions={sessionMarkQuestions}
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
                insightWorkMarkRef.current = ilePowNextIndex(
                  sessionPowArtifactsRef.current,
                );
                setSessionInsights((current) => {
                  if (current.some((row) => row.id === insight.id)) return current;
                  return [insight, ...current];
                });
                onInsightKept?.(insight);
              },
            }
          : null
      }
    />
    </>
  );
}
