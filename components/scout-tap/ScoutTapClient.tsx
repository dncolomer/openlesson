"use client";

/**
 * Scout TAP shell — briefing → timed canvas/questions split → frozen thank-you.
 * No think-aloud, mic, or session purity.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getIlePostSessionPath } from "@/lib/storage";
import { MobileBlockScreen } from "@/components/MobileBlockScreen";
import { isSmartphoneClient } from "@/lib/is-smartphone";
import { useI18n } from "@/lib/i18n";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  postTutoringSessionComplete,
  postTutoringSessionStart,
} from "@/lib/tutoring-client";
import { resolveTapShowEndSession } from "@/components/TapScoreClient";
import { fetchAestheticPackages } from "@/lib/aesthetics";
import { ScoutTapPhases } from "@/components/scout-tap/scout-tap-phases";
import {
  pickTapBackgroundImage,
  type Phase,
  resolveInitialMinutes,
} from "@/lib/tap-score-client-helpers";
import { TAP_SESSION_RUNTIME_PATHS } from "@/lib/tap-session-runtime";
import { resolveTapLiveMinutes } from "@/lib/tap-practice";
import {
  parseBlockPracticeOptions,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  buildLearnerLaunchBody,
  WORKSPACE_LEARNER_LAUNCH_PATH,
} from "@/lib/workspace-learner-writes";
import {
  buildTapCanvasSnapshotUploadItem,
  emptyTapWorkCanvasScene,
  serializeTapWorkCanvasScene,
  tapWorkCanvasShouldAcceptSceneUpdate,
  uploadTapWorkCanvasPow,
} from "@/lib/tap-work-canvas";
import type { IleWorkCanvasElement, IleWorkCanvasScene } from "@/lib/ile-work-canvas";
import {
  SCOUT_FOLLOWUP_QUESTION_COUNT,
  buildScoutCanvasPowMetadata,
  buildScoutCompleteTranscript,
  canGoBackScoutNode,
  connectScoutQuestionToCanvas,
  createScoutLiveState,
  extractScoutCanvasText,
  goBackScoutNode,
  pickScoutQuestion,
  receiveScoutQuestions,
  scoutArtifactsFromLive,
  scoutCurrentNode,
  scoutLiveSpeechEnabled,
  scoutPathFromRoot,
  scoutSessionPurityEnabled,
  scoutThankYouActions,
  seedScoutWorkCanvas,
  type ScoutLiveState,
} from "@/lib/scout-session";
import {
  buildPowParticipantIdentity,
  type PowParticipantIdentity,
} from "@/lib/session-participant-identity";
import type { SpokenLocale } from "@/lib/tutoring-languages";

interface ScoutTapClientProps {
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  initialSession?: Record<string, unknown> | null;
  showEndSession?: boolean;
  entryQueryParams?: Record<string, string | string[]>;
  participantIdentity?: PowParticipantIdentity | null;
  initialMinutes?: number;
  lockDuration?: boolean;
}

export function ScoutTapClient({
  workspaceId,
  blockId,
  sessionId,
  privateToken,
  initialSession,
  showEndSession: showEndSessionProp,
  entryQueryParams = {},
  participantIdentity: participantIdentityProp = null,
  initialMinutes,
  lockDuration = false,
}: ScoutTapClientProps) {
  void scoutLiveSpeechEnabled();
  void scoutSessionPurityEnabled();

  const showEndSession = resolveTapShowEndSession({
    showEndSession: showEndSessionProp,
    initialSession: initialSession as { show_end_session?: boolean | null } | null,
  });
  const entryQueryParamsRef = useRef(entryQueryParams);
  useEffect(() => {
    entryQueryParamsRef.current = entryQueryParams;
  }, [entryQueryParams]);

  const router = useRouter();
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(isSmartphoneClient());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [participantIdentity, setParticipantIdentity] = useState<PowParticipantIdentity | null>(
    () => {
      if (participantIdentityProp) return participantIdentityProp;
      if (privateToken && initialSession) {
        return buildPowParticipantIdentity({
          guestUserId: (initialSession.guest_user_id as string | null) ?? null,
          assignedUserId: (initialSession.assigned_user_id as string | null) ?? null,
        });
      }
      return null;
    },
  );

  useEffect(() => {
    if (participantIdentityProp) {
      setParticipantIdentity(participantIdentityProp);
      return;
    }
    if (privateToken) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const id = data.user?.id ?? null;
      if (id) setParticipantIdentity(buildPowParticipantIdentity({ userId: id }));
    });
    return () => {
      cancelled = true;
    };
  }, [participantIdentityProp, privateToken]);

  const [phase, setPhase] = useState<Phase>("briefing");
  const resolvedLaunchMinutes =
    typeof initialMinutes === "number" && Number.isFinite(initialMinutes)
      ? resolveInitialMinutes(initialMinutes * 60)
      : resolveInitialMinutes(initialSession?.requested_duration_seconds);
  const [minutes, setMinutes] = useState(resolvedLaunchMinutes);
  const durationLocked = lockDuration || typeof initialMinutes === "number";
  const [conversationLanguage, setConversationLanguage] = useState<SpokenLocale>("en");
  const [workspaceTitle] = useState(
    (initialSession?.workspaceTitle as string) || "Workspace",
  );
  const [error, setError] = useState("");
  const [resultsError, setResultsError] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [bgImage, setBgImage] = useState("");
  const [tapSessionId, setTapSessionId] = useState<string | null>(
    (initialSession?.id as string) ?? null,
  );
  const tapSessionIdRef = useRef<string | null>((initialSession?.id as string) ?? null);
  const resolvedWorkspaceId = workspaceId || (initialSession?.workspace_id as string | undefined);
  const [liveMinutes, setLiveMinutes] = useState(resolvedLaunchMinutes);
  const [seedDescription, setSeedDescription] = useState("");
  const [practiceOptions, setPracticeOptions] = useState<BlockPracticeOptions>(
    parseBlockPracticeOptions(null),
  );

  const [scoutState, setScoutState] = useState<ScoutLiveState>(() =>
    createScoutLiveState("Topic"),
  );
  const scoutStateRef = useRef(scoutState);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const questionsAbortRef = useRef<AbortController | null>(null);
  const questionsGenRef = useRef(0);
  const [workCanvasScene, setWorkCanvasScene] = useState<IleWorkCanvasScene>(() =>
    emptyTapWorkCanvasScene(),
  );
  const workCanvasSceneRef = useRef<IleWorkCanvasScene | null>(workCanvasScene);
  const [canvasApplyElements, setCanvasApplyElements] = useState<IleWorkCanvasElement[]>(
    [],
  );
  const [canvasApplyNonce, setCanvasApplyNonce] = useState(0);

  const isEndingRef = useRef(false);
  const endAndScoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    tapSessionIdRef.current = tapSessionId;
  }, [tapSessionId]);
  useEffect(() => {
    scoutStateRef.current = scoutState;
  }, [scoutState]);
  useEffect(() => {
    workCanvasSceneRef.current = workCanvasScene;
  }, [workCanvasScene]);

  useEffect(() => {
    let cancelled = false;
    fetchAestheticPackages()
      .then((packages) => {
        if (!cancelled) setBgImage(pickTapBackgroundImage(packages));
      })
      .catch(() => {
        if (!cancelled) setBgImage(pickTapBackgroundImage([]));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!blockId) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("blocks")
      .select("practice_options")
      .eq("id", blockId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPracticeOptions(parseBlockPracticeOptions(data.practice_options));
      });
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  const persistScoutCanvas = useCallback(async () => {
    const scene = workCanvasSceneRef.current;
    const state = scoutStateRef.current;
    const sessionKey = tapSessionIdRef.current || sessionId;
    if (!scene || !sessionKey) return;
    const serialized = serializeTapWorkCanvasScene(scene);
    const artifacts = scoutArtifactsFromLive(state, scene);
    const item = buildTapCanvasSnapshotUploadItem(sessionKey, JSON.stringify(serialized));
    await uploadTapWorkCanvasPow({
      workspaceId,
      blockId,
      sessionId,
      privateToken,
      tapSessionId: tapSessionIdRef.current,
      entryQueryParams: entryQueryParamsRef.current,
      item: {
        ...item,
        metadata: {
          ...(item.metadata || {}),
          ...buildScoutCanvasPowMetadata(artifacts),
        },
      },
    });
  }, [blockId, privateToken, sessionId, workspaceId]);

  const loadQuestions = useCallback(async (state: ScoutLiveState, scene: IleWorkCanvasScene) => {
    questionsAbortRef.current?.abort();
    const ac = new AbortController();
    questionsAbortRef.current = ac;
    const gen = questionsGenRef.current + 1;
    questionsGenRef.current = gen;
    setQuestionsLoading(true);
    try {
      const res = await fetch(TAP_SESSION_RUNTIME_PATHS.scoutQuestions, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          tapSessionId: tapSessionIdRef.current,
          entryQueryParams: entryQueryParamsRef.current,
          seedTitle: state.seedText,
          seedDescription,
          path: scoutPathFromRoot(state),
          canvasText: extractScoutCanvasText(scene),
          currentNode: scoutCurrentNode(state).text,
          count: SCOUT_FOLLOWUP_QUESTION_COUNT,
          conversationLanguage,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (gen !== questionsGenRef.current) return;
      if (!res.ok) throw new Error(errorMessageFromBody(payload, "Could not load Scout questions"));
      setScoutState((prev) => receiveScoutQuestions(prev, payload.questions));
    } catch (err) {
      if (ac.signal.aborted || gen !== questionsGenRef.current) return;
      setScoutState((prev) => receiveScoutQuestions(prev, null));
      setError(err instanceof Error ? err.message : "Could not load Scout questions");
    } finally {
      if (gen === questionsGenRef.current) setQuestionsLoading(false);
    }
  }, [blockId, conversationLanguage, privateToken, seedDescription, sessionId, workspaceId]);

  async function startSession() {
    isEndingRef.current = false;
    setIsStartingSession(true);
    const sessionMinutes = resolveTapLiveMinutes({ minutes });
    setLiveMinutes(sessionMinutes);
    setError("");
    let started = false;
    try {
      const { ok, payload } = await postTutoringSessionStart({
        workspaceId,
        blockId,
        sessionId,
        privateToken,
        entryQueryParams: entryQueryParamsRef.current,
        minutes: sessionMinutes,
        tapSessionId: tapSessionIdRef.current,
        interaction_kind: "scout",
        conversationLanguage,
      });
      if (!ok) throw new Error(errorMessageFromBody(payload, "Could not start Scout"));
      if (typeof payload.tapSessionId === "string" && payload.tapSessionId) {
        tapSessionIdRef.current = payload.tapSessionId;
        setTapSessionId(payload.tapSessionId);
      }
      const seed =
        String(payload.seedTitle || payload.openingQuestion || "").trim() ||
        "Topic";
      setSeedDescription(String(payload.seedDescription || "").trim());
      const nextState = createScoutLiveState(seed);
      const seeded = seedScoutWorkCanvas(seed);
      setScoutState(nextState);
      scoutStateRef.current = nextState;
      setWorkCanvasScene(seeded.scene);
      workCanvasSceneRef.current = seeded.scene;
      setCanvasApplyElements([]);
      setCanvasApplyNonce(0);
      const startedAtMs = Date.now();
      setStartedAt(startedAtMs);
      setRemainingSeconds(sessionMinutes * 60);
      setPhase("live");
      started = true;
      void loadQuestions(nextState, seeded.scene);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Scout");
    } finally {
      setIsStartingSession(false);
    }
    return { ok: started };
  }

  async function endSession() {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setPhase("saving");
    try {
      await persistScoutCanvas();
      const durationSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const transcript = buildScoutCompleteTranscript(scoutStateRef.current);
      const { ok, payload } = await postTutoringSessionComplete({
        workspaceId,
        blockId,
        sessionId,
        privateToken,
        entryQueryParams: entryQueryParamsRef.current,
        tapSessionId: tapSessionIdRef.current,
        transcript,
        durationSeconds,
        requestedDurationSeconds: liveMinutes * 60,
        sessionQuality: "pure",
      });
      if (!ok) throw new Error(errorMessageFromBody(payload, "Could not save Scout"));
      setPhase("results");
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : "Could not save Scout");
      setError(err instanceof Error ? err.message : "Could not save Scout");
      setPhase("error");
      isEndingRef.current = false;
    }
  }

  endAndScoreRef.current = endSession;

  useEffect(() => {
    if (phase !== "live" || !startedAt) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, liveMinutes * 60 - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        void endAndScoreRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [phase, startedAt, liveMinutes]);

  const handleSceneChange = useCallback((scene: IleWorkCanvasScene) => {
    if (!tapWorkCanvasShouldAcceptSceneUpdate(workCanvasSceneRef.current, scene)) return;
    workCanvasSceneRef.current = scene;
    setWorkCanvasScene(scene);
  }, []);

  const onPickQuestion = useCallback(
    (index: number) => {
      const prev = scoutStateRef.current;
      const next = pickScoutQuestion(prev, index);
      if (next === prev) return;
      const picked = next.nodes[next.nodes.length - 1];
      const connected = connectScoutQuestionToCanvas(workCanvasSceneRef.current, {
        question: picked?.text || "",
        nodeId: picked?.id,
        parentNodeId: prev.currentNodeId,
      });
      setScoutState(next);
      scoutStateRef.current = next;
      workCanvasSceneRef.current = connected.scene;
      setWorkCanvasScene(connected.scene);
      if (connected.added.length) {
        setCanvasApplyElements(connected.added);
        setCanvasApplyNonce((n) => n + 1);
      }
      void persistScoutCanvas();
      void loadQuestions(next, connected.scene);
    },
    [loadQuestions, persistScoutCanvas],
  );

  const onGoBack = useCallback(() => {
    const prev = scoutStateRef.current;
    if (!canGoBackScoutNode(prev)) return;
    questionsAbortRef.current?.abort();
    const next = goBackScoutNode(prev);
    setScoutState(next);
    scoutStateRef.current = next;
    const scene = workCanvasSceneRef.current || emptyTapWorkCanvasScene();
    void loadQuestions(next, scene);
  }, [loadQuestions]);

  const restartBriefingFlow = useCallback(() => {
    isEndingRef.current = false;
    setPhase("briefing");
    setStartedAt(null);
    setRemainingSeconds(0);
    setError("");
    setResultsError("");
    setScoutState(createScoutLiveState("Topic"));
    const empty = emptyTapWorkCanvasScene();
    setWorkCanvasScene(empty);
    workCanvasSceneRef.current = empty;
    setCanvasApplyElements([]);
    setCanvasApplyNonce(0);
  }, []);

  const thankYouActions = useMemo(
    () => scoutThankYouActions({ practiceOptions }),
    [practiceOptions],
  );

  const onBackWorkspace = useCallback(() => {
    if (resolvedWorkspaceId) {
      router.push(getIlePostSessionPath({ metadata: { workspace_id: resolvedWorkspaceId } }));
      return;
    }
    router.push("/dashboard");
  }, [resolvedWorkspaceId, router]);

  const onJumpWork = useCallback(() => {
    if (!resolvedWorkspaceId || !blockId) {
      onBackWorkspace();
      return;
    }
    void (async () => {
      try {
        const res = await fetch(WORKSPACE_LEARNER_LAUNCH_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildLearnerLaunchBody({
              workspaceId: resolvedWorkspaceId,
              blockId,
              sessionMode: "learning",
            }),
          ),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.sessionId) {
          throw new Error(errorMessageFromBody(data, "Failed to launch Work"));
        }
        router.push(`/session?id=${data.sessionId}`);
      } catch {
        onBackWorkspace();
      }
    })();
  }, [blockId, onBackWorkspace, resolvedWorkspaceId, router]);

  const onJumpDrill = useCallback(() => {
    if (!resolvedWorkspaceId) return;
    const params = new URLSearchParams();
    if (blockId) params.set("blockId", blockId);
    params.set("interactionKind", "conversational");
    router.push(`/workspace/${resolvedWorkspaceId}/tap?${params.toString()}`);
  }, [blockId, resolvedWorkspaceId, router]);

  if (isMobile) {
    return <MobileBlockScreen product="tap" />;
  }

  return (
    <ScoutTapPhases
      phase={phase}
      bgImage={bgImage}
      t={t}
      workspaceTitle={workspaceTitle}
      minutes={minutes}
      setMinutes={setMinutes}
      conversationLanguage={conversationLanguage}
      setConversationLanguage={setConversationLanguage}
      privateToken={privateToken}
      durationLocked={durationLocked}
      isStartingSession={isStartingSession}
      error={error}
      startSession={startSession}
      participantIdentity={participantIdentity}
      remainingSeconds={remainingSeconds}
      showEndSession={showEndSession}
      endSession={() => void endSession()}
      workspaceId={workspaceId}
      blockId={blockId}
      sessionId={sessionId}
      tapSessionId={tapSessionId}
      resultsError={resultsError}
      restartBriefingFlow={restartBriefingFlow}
      setPhase={setPhase}
      workCanvasSceneRef={workCanvasSceneRef}
      workCanvasScene={workCanvasScene}
      canvasApplyElements={canvasApplyElements}
      canvasApplyNonce={canvasApplyNonce}
      handleSceneChange={handleSceneChange}
      scoutState={scoutState}
      questionsLoading={questionsLoading}
      onPickQuestion={onPickQuestion}
      onGoBack={onGoBack}
      thankYouActions={thankYouActions}
      onJumpWork={onJumpWork}
      onJumpDrill={onJumpDrill}
      onBackWorkspace={onBackWorkspace}
    />
  );
}

