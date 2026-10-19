"use client";

/**
 * Scout TAP shell — briefing → voice check → sounding → frozen thank-you.
 * No think-aloud after the opening, mic, or session purity.
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
  loadSessionBranchField,
  sessionClockMayStart,
  subscribeSessionBranchField,
} from "@/lib/session-branch-field-load";
import { releaseSessionLocalMemory } from "@/lib/session-local-memory";
import { calibrateFieldPrepareInput } from "@/lib/session-branch-prepare";
import {
  advanceTapLiveClockPause,
  pickTapBackgroundImage,
  tapLiveClockRemainingSeconds,
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
import { uploadTapWorkCanvasPow } from "@/lib/tap-work-canvas";
import { postWorkspaceFlowEmbedding } from "@/lib/flow-embedding-client";
import {
  createCalibrateState,
  normalizeCalibrateQuestions,
  type CalibrateState,
} from "@/lib/calibrate-session";
import {
  SOUNDING_POOL_COUNT,
  absorbSoundingStills,
  commitSoundingTaps,
  createSoundingState,
  createSoundingTree,
  finishSounding,
  soundingCompleteTranscript,
  soundingProofMetadata,
  soundingProofUploadItem,
  soundingStillsFromBranchModel,
  soundingTreeIsTravelable,
  submitSoundingProof,
  type SoundingState,
} from "@/lib/calibrate-sounding";
import { inferSoundingVoiceStep } from "@/lib/calibrate-sounding-voice-client";
import {
  scoutLiveSpeechEnabled,
  scoutSessionPurityEnabled,
  scoutThankYouActions,
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
    return () => {
      window.removeEventListener("resize", check);
      releaseSessionLocalMemory(sessionId);
    };
  }, [sessionId]);

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
  const [proofBusy, setProofBusy] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [clockPaused, setClockPaused] = useState(false);
  const pauseStartedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const questionsLoadingRef = useRef(false);
  const [bgImage, setBgImage] = useState("");
  const [tapSessionId, setTapSessionId] = useState<string | null>(
    (initialSession?.id as string) ?? null,
  );
  const tapSessionIdRef = useRef<string | null>((initialSession?.id as string) ?? null);
  const resolvedWorkspaceId = workspaceId || (initialSession?.workspace_id as string | undefined);
  const [liveMinutes, setLiveMinutes] = useState(resolvedLaunchMinutes);
  const [practiceOptions, setPracticeOptions] = useState<BlockPracticeOptions>(
    parseBlockPracticeOptions(null),
  );

  const [seedText, setSeedText] = useState("Topic");
  const seedTextRef = useRef(seedText);
  const [calibrate, setCalibrate] = useState<CalibrateState>(() => createCalibrateState([]));
  const calibrateRef = useRef(calibrate);
  const [sounding, setSounding] = useState<SoundingState | null>(null);
  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const soundingRef = useRef<SoundingState | null>(null);
  const [startConfirmed, setStartConfirmed] = useState(false);
  const [challengePassed, setChallengePassed] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const questionsAbortRef = useRef<AbortController | null>(null);
  const questionsGenRef = useRef(0);

  const isEndingRef = useRef(false);
  const endAndScoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    tapSessionIdRef.current = tapSessionId;
  }, [tapSessionId]);
  useEffect(() => {
    seedTextRef.current = seedText;
  }, [seedText]);
  useEffect(() => {
    calibrateRef.current = calibrate;
  }, [calibrate]);
  useEffect(() => {
    soundingRef.current = sounding;
  }, [sounding]);

  useEffect(() => {
    if (!fieldKey) return;
    return subscribeSessionBranchField(fieldKey, (entry) => {
      if (!entry.model) return;
      const live = soundingRef.current;
      if (!live) return;
      const next = absorbSoundingStills(
        live,
        soundingStillsFromBranchModel(entry.model),
        entry.model,
      );
      if (next === live) return;
      soundingRef.current = next;
      setSounding(next);
    });
  }, [fieldKey]);

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

  const persistSounding = useCallback(async () => {
    const live = soundingRef.current;
    if (!live) return;
    await uploadTapWorkCanvasPow({
      workspaceId,
      blockId,
      sessionId,
      privateToken,
      tapSessionId: tapSessionIdRef.current,
      entryQueryParams: entryQueryParamsRef.current,
      item: soundingProofUploadItem(live),
    });
    if (workspaceId) {
      const metadata = soundingProofMetadata(live);
      await postWorkspaceFlowEmbedding({
        workspaceId,
        flowKind: "calibrate",
        runId: tapSessionIdRef.current || sessionId || null,
        source: "sounding",
        model: live.model,
        sequence: null,
        pow: [
          {
            type: "tool",
            tool_name: "probe",
            tool_action: "sounding",
            timestamp_ms: 1,
            payload: JSON.stringify(metadata),
            metadata,
          },
        ],
        sessionId,
        privateToken,
        tapSessionId: tapSessionIdRef.current,
        entryQueryParams: entryQueryParamsRef.current,
      });
    }
  }, [blockId, privateToken, sessionId, workspaceId]);

  const loadPool = useCallback(async (title: string, description: string) => {
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
          purpose: "calibrate",
          seedTitle: title,
          seedDescription: description,
          count: SOUNDING_POOL_COUNT,
          conversationLanguage,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (gen !== questionsGenRef.current) return;
      if (!res.ok) throw new Error(errorMessageFromBody(payload, "Could not load calibration questions"));
      const questions = normalizeCalibrateQuestions(payload.questions);
      const next = createCalibrateState(questions);
      setCalibrate(next);
      calibrateRef.current = next;
    } catch (err) {
      if (ac.signal.aborted || gen !== questionsGenRef.current) return;
      const next = createCalibrateState([]);
      setCalibrate(next);
      calibrateRef.current = next;
      setError(err instanceof Error ? err.message : "Could not load calibration questions");
    } finally {
      if (gen === questionsGenRef.current) setQuestionsLoading(false);
    }
  }, [blockId, conversationLanguage, privateToken, sessionId, workspaceId]);

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
      const description = String(payload.seedDescription || "").trim();
      setSeedText(seed);
      seedTextRef.current = seed;
      const next = createCalibrateState([]);
      setCalibrate(next);
      calibrateRef.current = next;
      const fieldInput = calibrateFieldPrepareInput({
        topicText: seed,
        topicId: "calibrate",
        questions: [],
        sessionId,
        tapSessionId: tapSessionIdRef.current,
        workspaceId,
        blockId,
        privateToken,
        entryQueryParams: entryQueryParamsRef.current,
      });
      const field = await loadSessionBranchField(fieldInput);
      if (!sessionClockMayStart({ mode: "calibrate", fieldReady: field.ok })) {
        throw new Error(field.ok ? "The field could not be prepared." : field.error);
      }
      const fromModel = soundingStillsFromBranchModel(field.ok ? field.model : null);
      if (!soundingTreeIsTravelable(fromModel)) {
        await loadPool(seed, description);
      }
      const tree = createSoundingTree({
        model: field.ok ? field.model : null,
        questions: calibrateRef.current.pool,
      });
      const opened = createSoundingState(
        tree,
        tapSessionIdRef.current || sessionId || "calibrate",
        field.ok ? field.model : null,
      );
      if (!opened.current) {
        throw new Error("The sounding could not be prepared.");
      }
      setFieldKey(field.key);
      setSounding(opened);
      soundingRef.current = opened;
      const startedAtMs = Date.now();
      pauseStartedAtRef.current = null;
      pausedMsRef.current = 0;
      setClockPaused(false);
      setStartedAt(startedAtMs);
      setRemainingSeconds(sessionMinutes * 60);
      setPhase("live");
      started = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Scout");
      setChallengePassed(false);
    } finally {
      setIsStartingSession(false);
    }
    return { ok: started };
  }

  function confirmStart() {
    setStartConfirmed(true);
  }

  function passChallenge() {
    setChallengePassed(true);
    void startSession();
  }

  async function endSession() {
    const live = soundingRef.current;
    if (live && live.phase === "sounding") {
      const closed = finishSounding(live, true);
      soundingRef.current = closed;
      setSounding(closed);
      if (closed.phase === "expert-proof") return;
    }
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setPhase("saving");
    try {
      if (soundingRef.current?.phase === "expert-proof") {
        const closed = finishSounding(soundingRef.current, false);
        soundingRef.current = closed;
        setSounding(closed);
      }
      await persistSounding();
      const durationSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const transcript = soundingCompleteTranscript({
        seedText: seedTextRef.current,
        state: soundingRef.current ?? createSoundingState([], "calibrate"),
      });
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
      releaseSessionLocalMemory(sessionId);
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
    if (phase !== "live") return;
    if (sounding?.phase !== "complete") return;
    void endAndScoreRef.current();
  }, [phase, sounding?.phase]);

  useEffect(() => {
    questionsLoadingRef.current = questionsLoading;
  }, [questionsLoading]);

  useEffect(() => {
    if (phase !== "live" || !startedAt) return;
    const tick = () => {
      const now = Date.now();
      const waiting = false;
      const next = advanceTapLiveClockPause({
        waiting,
        nowMs: now,
        pauseStartedAtMs: pauseStartedAtRef.current,
        pausedMs: pausedMsRef.current,
      });
      pauseStartedAtRef.current = next.pauseStartedAtMs;
      pausedMsRef.current = next.pausedMs;
      const remaining = tapLiveClockRemainingSeconds({
        nowMs: now,
        startedAtMs: startedAt,
        durationSeconds: liveMinutes * 60,
        pausedMs: next.pausedMs,
        pauseStartedAtMs: next.pauseStartedAtMs,
      });
      setClockPaused(waiting);
      setRemainingSeconds(remaining);
      if (remaining <= 0 && !waiting) {
        const live = soundingRef.current;
        if (live && live.phase !== "complete") {
          const closed = finishSounding(live, false);
          soundingRef.current = closed;
          setSounding(closed);
        }
        void endAndScoreRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [phase, startedAt, liveMinutes, questionsLoading]);

  const onCommitTaps = useCallback((tappedIds: readonly string[]) => {
    const live = soundingRef.current;
    if (!live) return;
    const next = commitSoundingTaps(live, tappedIds);
    soundingRef.current = next;
    setSounding(next);
  }, []);

  const onSubmitProof = useCallback((transcript: string) => {
    const live = soundingRef.current;
    if (!live || live.phase !== "expert-proof" || !live.proof || proofBusy) return;
    setProofBusy(true);
    setError("");
    void inferSoundingVoiceStep({
      prepare: calibrateFieldPrepareInput({
        topicText: seedTextRef.current,
        topicId: "calibrate",
        questions: [],
        sessionId,
        tapSessionId: tapSessionIdRef.current,
        workspaceId,
        blockId,
        privateToken,
        entryQueryParams: entryQueryParamsRef.current,
      }),
      stillText: live.proof.stillText,
      transcript,
      candidates: live.proof.candidates,
    }).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setProofBusy(false);
        return;
      }
      const current = soundingRef.current;
      if (!current || current.phase !== "expert-proof") {
        setProofBusy(false);
        return;
      }
      const next = submitSoundingProof(current, result.submission);
      soundingRef.current = next;
      setSounding(next);
      setProofBusy(false);
    });
  }, [blockId, privateToken, proofBusy, sessionId, workspaceId]);

  const restartBriefingFlow = useCallback(() => {
    isEndingRef.current = false;
    setPhase("briefing");
    setStartedAt(null);
    pauseStartedAtRef.current = null;
    pausedMsRef.current = 0;
    setClockPaused(false);
    setRemainingSeconds(0);
    setError("");
    setProofBusy(false);
    setResultsError("");
    setSeedText("Topic");
    seedTextRef.current = "Topic";
    const reset = createCalibrateState([]);
    setCalibrate(reset);
    calibrateRef.current = reset;
    setSounding(null);
    soundingRef.current = null;
    setFieldKey(null);
    setStartConfirmed(false);
    setChallengePassed(false);
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
      confirmStart={confirmStart}
      passChallenge={passChallenge}
      startConfirmed={startConfirmed}
      challengePassed={challengePassed}
      remainingSeconds={remainingSeconds}
      clockPaused={clockPaused}
      showEndSession={showEndSession}
      endSession={() => void endSession()}
      resultsError={resultsError}
      restartBriefingFlow={restartBriefingFlow}
      setPhase={setPhase}
      sounding={sounding}
      onCommitTaps={onCommitTaps}
      onSubmitProof={onSubmitProof}
      proofBusy={proofBusy}
      classification={sounding?.classification ?? null}
      thankYouActions={thankYouActions}
      onJumpWork={onJumpWork}
      onBackWorkspace={onBackWorkspace}
      onSettingsBackToWorkspace={
        resolvedWorkspaceId && !privateToken ? onBackWorkspace : undefined
      }
    />
  );
}

