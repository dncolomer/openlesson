"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clampIlePowExpense,
  ILE_POW_EXPENSE_DEFAULT,
} from "@/lib/learn-pow-spend";
import {
  clampIleMinInsightsPerChapter,
  ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  ILE_TURN_INSIGHT_SLOT_MAX,
  clampIleTurnInsightSlotMax,
} from "@/lib/learn-turn-insights";
import {
  ILE_GATHER_MAX_PER_SESSION,
  clampIleGatherMaxPerSession,
} from "@/lib/learn-gather-resources";
import {
  ILE_SESSION_CHAPTER_COUNT_DEFAULT,
  readIleCanvasSessionConfig,
  writeIleCanvasSessionConfig,
} from "@/lib/learn-canvas-session";
import {
  decideIleSettingsEnterMap,
  ileSessionMapPath,
  ileSessionSettingsPath,
  ileWelcomeRouteSync,
  isIleSessionSettingsPath,
} from "@/lib/learn-session-routes";
import {
  isIleSessionSettingsConfirmed,
  isSessionWelcomeSeen,
  markSessionWelcomeSeen,
} from "@/lib/welcomeState";
import type { ChapterPlanStatus, HelpPreviousLayout } from "@/components/session-view/types";
import type { Session } from "@/lib/storage";

export function useSessionWelcomeState(sessionId: string) {
  const [showWelcomeModal, setShowWelcomeModal] = useState(
    () => !isIleSessionSettingsConfirmed(sessionId),
  );
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [chapterPlanStatus, setChapterPlanStatus] = useState<ChapterPlanStatus>("unknown");
  const [powExpense, setPowExpense] = useState(ILE_POW_EXPENSE_DEFAULT);
  const [insightSlotMax, setInsightSlotMax] = useState(ILE_TURN_INSIGHT_SLOT_MAX);
  const [gatherMaxPerSession, setGatherMaxPerSession] = useState(ILE_GATHER_MAX_PER_SESSION);
  const [allowThoughtsPoolInsights, setAllowThoughtsPoolInsights] = useState(true);
  const [allowParallelWork, setAllowParallelWork] = useState(true);
  const [allowGatherResources, setAllowGatherResources] = useState(true);
  const [minInsightsPerChapter, setMinInsightsPerChapter] = useState(
    ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  );
  const [autoAdvance, setAutoAdvance] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const saved = readIleCanvasSessionConfig(sessionId);
    if (!saved) return;
    setMinInsightsPerChapter(saved.insightGoal);
  }, [sessionId]);

  return {
    showWelcomeModal,
    setShowWelcomeModal,
    languageConfirmed,
    setLanguageConfirmed,
    isPreparing,
    setIsPreparing,
    chapterPlanStatus,
    setChapterPlanStatus,
    powExpense,
    setPowExpense: (value: number) => setPowExpense(clampIlePowExpense(value)),
    insightSlotMax,
    setInsightSlotMax: (value: number) => setInsightSlotMax(clampIleTurnInsightSlotMax(value)),
    gatherMaxPerSession,
    setGatherMaxPerSession: (value: number) =>
      setGatherMaxPerSession(clampIleGatherMaxPerSession(value)),
    allowThoughtsPoolInsights,
    setAllowThoughtsPoolInsights,
    allowParallelWork,
    setAllowParallelWork,
    allowGatherResources,
    setAllowGatherResources,
    minInsightsPerChapter,
    setMinInsightsPerChapter: (value: number) =>
      setMinInsightsPerChapter(clampIleMinInsightsPerChapter(value)),
    autoAdvance,
    setAutoAdvance,
  };
}

export type SessionWelcomeInput = {
  sessionId: string;
  session: Session | null;
  sessionRef: { current: Session | null };
  ileToken?: string;
  ayclToken?: string;
  resumeSession: boolean;
  pathname: string | null;
  router: ReturnType<typeof useRouter>;
  settingsRoute: boolean;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (v: boolean) => void;
  setShowWelcomePanel: (v: boolean) => void;
  setIsStartingSession: (v: boolean) => void;
  applyIleChapterGridStartup: () => void;
  helpPreviousLayoutRef: { current: HelpPreviousLayout | null };
  setPaneVisibility: (v: { tools: boolean; tutor: boolean; plan: boolean }) => void;
  isRecording: boolean;
  isPaused: boolean;
  startRecording: () => Promise<void>;
  handleResume: () => Promise<void>;
  minInsightsPerChapter: number;
  handleConfirmSettingsField: () => Promise<void>;
  handleWelcomeReadyStartField: () => Promise<void>;
};

export function useSessionWelcome(input: SessionWelcomeInput) {
  const {
    sessionId,
    session,
    sessionRef,
    ileToken,
    ayclToken,
    resumeSession,
    pathname,
    router,
    settingsRoute,
    showWelcomeModal,
    setShowWelcomePanel,
    setIsStartingSession,
    applyIleChapterGridStartup,
    helpPreviousLayoutRef,
    setPaneVisibility,
    isRecording,
    isPaused,
    startRecording,
    handleResume,
    minInsightsPerChapter,
    handleConfirmSettingsField,
    handleWelcomeReadyStartField,
  } = input;

  const mapEntryTailDoneRef = useRef(false);

  const handleConfirmSettings = useCallback(async () => {
    mapEntryTailDoneRef.current = true;
    if (session?.id) {
      writeIleCanvasSessionConfig(session.id, {
        chapterCount: ILE_SESSION_CHAPTER_COUNT_DEFAULT,
        insightGoal: minInsightsPerChapter,
      });
    }
    await handleConfirmSettingsField();
  }, [handleConfirmSettingsField, minInsightsPerChapter, session?.id]);

  const handleWelcomeReadyStart = useCallback(async () => {
    mapEntryTailDoneRef.current = true;
    await handleWelcomeReadyStartField();
  }, [handleWelcomeReadyStartField]);

  const handleWelcomePlay = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    setIsStartingSession(true);
    let didRevealChat = false;
    const revealChat = () => {
      if (didRevealChat) return;
      didRevealChat = true;
      setShowWelcomePanel(false);
      applyIleChapterGridStartup();
    };
    try {
      if (!isRecording) {
        await startRecording();
      } else if (isPaused) {
        await handleResume();
      }
      revealChat();
    } finally {
      markSessionWelcomeSeen(s.id);
      revealChat();
      setIsStartingSession(false);
      const prev = helpPreviousLayoutRef.current;
      if (prev) {
        helpPreviousLayoutRef.current = null;
        window.setTimeout(() => {
          const innerLeft = prev.inner.collapsedSide === "left";
          const innerRight = prev.inner.collapsedSide === "right";
          setPaneVisibility({
            tools: !innerLeft,
            tutor: true,
            plan: !innerRight,
          });
        }, 120);
      }
    }
  }, [
    applyIleChapterGridStartup,
    handleResume,
    helpPreviousLayoutRef,
    isPaused,
    isRecording,
    sessionRef,
    setIsStartingSession,
    setPaneVisibility,
    setShowWelcomePanel,
    startRecording,
  ]);

  useEffect(() => {
    if (!sessionId) return;
    const routeInput = {
      sessionId,
      ileToken,
      ayclToken,
      resume: resumeSession,
    };
    const sync = ileWelcomeRouteSync({
      showWelcome: showWelcomeModal,
      browserPath: window.location.pathname,
      routerPath: pathname ?? "",
      settingsHref: ileSessionSettingsPath(routeInput),
      mapHref: ileSessionMapPath(routeInput),
    });
    if (sync.kind === "replace-state") {
      window.history.replaceState(window.history.state, "", sync.href);
      return;
    }
    if (sync.kind === "router-replace") {
      router.replace(sync.href);
    }
  }, [
    ayclToken,
    ileToken,
    pathname,
    resumeSession,
    router,
    sessionId,
    showWelcomeModal,
  ]);

  useEffect(() => {
    if (!session?.id || showWelcomeModal || settingsRoute) return;
    if (mapEntryTailDoneRef.current) return;
    const action = decideIleSettingsEnterMap({
      settingsConfirmed: isIleSessionSettingsConfirmed(session.id),
      onSettingsRoute: settingsRoute,
      welcomeSeen: isSessionWelcomeSeen(session.id),
      recording: isRecording,
    });
    if (action === "idle") return;
    mapEntryTailDoneRef.current = true;
    if (action === "help") {
      setShowWelcomePanel(true);
      return;
    }
    void startRecording();
  }, [
    isRecording,
    session?.id,
    setShowWelcomePanel,
    settingsRoute,
    showWelcomeModal,
    startRecording,
  ]);

  return {
    handleConfirmSettings,
    handleWelcomeReadyStart,
    handleWelcomePlay,
    mapEntryTailDoneRef,
  };
}
