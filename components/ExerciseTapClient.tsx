"use client";

/**
 * Exercise TAP client — separate shell from conversational TapScoreClient.
 * Layout: exercise prompt at top + submitted thoughts list with remove (no Helios/user bubbles).
 * Core mechanics: speak → crystallize/submit as PoW; remove emits remove-trace PoW.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getIlePostSessionPath } from "@/lib/storage";
import { ThoughtCompactAction } from "@/components/thought-ui/ThoughtUi";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { AutoStashContextBar } from "@/components/thought-ui/AutoStashContextBar";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { MobileBlockScreen } from "@/components/MobileBlockScreen";
import { SessionIdentityBadge } from "@/components/SessionIdentityBadge";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { ExerciseTapShell } from "@/components/exercise-tap/ExerciseTapShell";
import { isSmartphoneClient } from "@/lib/is-smartphone";
import { useI18n } from "@/lib/i18n";
import type { TapPostSessionMode } from "@/lib/pow-api/tap-link-config";
import type { TapStartingTopic } from "@/lib/tap-score";
import {
  tapTracePayload,
  TAP_SESSION_RUNTIME_PATHS,
  isTapLiveThoughtSpeechEnabled,
  shouldRestartLocalTapSpeechBindings,
  tapLiveSpeechFlushText,
  tapHookFormingText,
} from "@/lib/tap-session-runtime";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  formatSpeechTranscriptDisplay,
  restartLiveSpeechRecognition,
  startLiveSpeechRecognition,
  stopLiveSpeechRecognition,
  useSessionThoughtInterface,
  useSpeechSupported,
  type LiveSpeechRecognitionBindings,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from "@/lib/useSessionThoughtInterface";
import {
  coerceSpokenLocale,
  toSpeechBcp47,
  type SpokenLocale,
} from "@/lib/tutoring-languages";
import {
  type Phase,
  BACKGROUND_IMAGES,
  resolveInitialMinutes,
  normalize,
  formatCountdown,
  thoughtButtonClasses,
} from "@/lib/tap-score-client-helpers";
import {
  TAP_SESSION_PURITY_MAX,
  isSessionPurityDepleted,
  isWithinTapPurityGrace,
  nextSessionPurityAfterAutoStash,
  shouldAutoStashOnSilence,
  shouldEvaluateSessionPurity,
  shouldFadeLiveBar,
  shouldPenalizeEmptyBarSilence,
  transcriptFadeOpacity,
  TAP_SILENCE_AUTO_STASH_MS,
} from "@/lib/tap-session-purity";
import {
  TAP_PRACTICE_DURATION_SECONDS,
  resolveTapLiveMinutes,
} from "@/lib/tap-practice";
import {
  buildExercisePromptText,
  emptyExerciseDualLists,
  demoteExerciseSubmissionToStash,
  promoteExerciseStashToSubmission,
  resolveExercisePromptAfterIntro,
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
  type ExerciseDualLists,
  type ExerciseThought,
} from "@/lib/exercise-tap";
import {
  buildPowParticipantIdentity,
  type PowParticipantIdentity,
} from "@/lib/session-participant-identity";
import { resolveTapShowEndSession } from "@/components/TapScoreClient";
import { cn } from "@/lib/utils";

interface ExerciseTapClientProps {
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  initialSession?: Record<string, unknown> | null;
  showEndSession?: boolean;
  entryQueryParams?: Record<string, string | string[]>;
  participantIdentity?: PowParticipantIdentity | null;
  /** Pre-selected duration from workspace launch (minutes). */
  initialMinutes?: number;
  /** When true, hide the briefing duration picker. */
  lockDuration?: boolean;
}

function ThoughtButton({
  size = "md",
  variant = "ghost",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "primary" | "toggleOn" | "toggleOff";
}) {
  return <button className={thoughtButtonClasses({ size, variant, className })} {...props} />;
}

export function ExerciseTapClient({
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
}: ExerciseTapClientProps) {
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
  const speechLang = toSpeechBcp47(conversationLanguage);
  const postSession = (initialSession?.post_session as TapPostSessionMode) || "redirect_workspace";
  const configuredRedirectUrl =
    typeof initialSession?.redirect_url === "string" ? initialSession.redirect_url : null;
  const [workspaceTitle] = useState(
    (initialSession?.workspaceTitle as string) || "Workspace",
  );
  const [exerciseText, setExerciseText] = useState(() =>
    buildExercisePromptText({
      workspaceTitle: (initialSession?.workspaceTitle as string) || "Workspace",
    }),
  );
  const [lists, setLists] = useState<ExerciseDualLists>(() => emptyExerciseDualLists());
  const listsRef = useRef<ExerciseDualLists>(emptyExerciseDualLists());
  const [crystallizableText, setCrystallizableText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startingTopics, setStartingTopics] = useState<TapStartingTopic[]>([]);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [topicsError, setTopicsError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [bgImage, setBgImage] = useState("");
  const [tapSessionId, setTapSessionId] = useState<string | null>(
    (initialSession?.id as string) ?? null,
  );
  const tapSessionIdRef = useRef<string | null>((initialSession?.id as string) ?? null);
  const resolvedWorkspaceId = workspaceId || (initialSession?.workspace_id as string | undefined);
  const [sessionPurity, setSessionPurity] = useState(TAP_SESSION_PURITY_MAX);
  const [transcriptSilenceMs, setTranscriptSilenceMs] = useState(0);
  const [sessionEndedImpure, setSessionEndedImpure] = useState(false);
  const [liveMinutes, setLiveMinutes] = useState(resolvedLaunchMinutes);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const isPracticeModeRef = useRef(false);

  const isEndingRef = useRef(false);
  const endAndScoreRef = useRef<(options?: { impure?: boolean }) => void>(() => {});
  const autoStashInFlightRef = useRef(false);
  const lastSpeechActivityAtRef = useRef(Date.now());
  const crystallizableTextRef = useRef("");
  const acceptEmptyTranscriptRef = useRef(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(speechLang);
  const finalBufferRef = useRef<string[]>([]);
  const speechResultsLengthRef = useRef(0);
  const consumedResultsIndexRef = useRef(0);

  const speechSupported = useSpeechSupported();

  useEffect(() => {
    tapSessionIdRef.current = tapSessionId;
  }, [tapSessionId]);

  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  useEffect(() => {
    langRef.current = speechLang;
  }, [speechLang]);

  useEffect(() => {
    isPracticeModeRef.current = isPracticeMode;
  }, [isPracticeMode]);

  // Same topics fetch as conversational TAP intro step 3.
  useEffect(() => {
    if (phase !== "briefing") return;

    let cancelled = false;
    setStartingTopics([]);
    setTopicsError("");

    void (async () => {
      try {
        const response = await fetch("/api/workspace-tap-score/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            blockId,
            sessionId,
            privateToken,
            entryQueryParams: entryQueryParamsRef.current,
            minutes,
            tapSessionId: tapSessionIdRef.current,
            conversationLanguage,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(errorMessageFromBody(payload, "Could not load starting topics"));
        if (cancelled) return;
        setStartingTopics(Array.isArray(payload.topics) ? payload.topics : []);
      } catch (err) {
        if (cancelled) return;
        setTopicsError(err instanceof Error ? err.message : "Could not load starting topics");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, workspaceId, blockId, sessionId, privateToken, minutes, conversationLanguage]);

  const logExerciseTrace = useCallback(
    (input: {
      traceType: "system1" | "system2";
      action: "pause_finalize" | "auto_stash" | "send" | "remove";
      thoughtId?: string;
      chainId?: string;
      text?: string;
      timestampMs?: number;
    }) => {
      const activeTapSessionId = tapSessionIdRef.current;
      if (!activeTapSessionId) return;
      void fetch("/api/workspace-tap-score/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tapTracePayload({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          tapSessionId: activeTapSessionId,
          entryQueryParams: entryQueryParamsRef.current,
          practice: isPracticeModeRef.current,
          ...input,
        })),
      }).catch(() => {});
    },
    [workspaceId, blockId, sessionId, privateToken],
  );

  const tapThoughtSpeech = useSessionThoughtInterface({
    enabled: isTapLiveThoughtSpeechEnabled(phase),
    speechLang,
    sessionId: tapSessionId || sessionId || undefined,
    captureKeys: false,
    onLogTrace: () => {},
    onSendToProbe: async () => {},
    onSpeechTranscript: (text) => {
      lastSpeechActivityAtRef.current = Date.now();
      crystallizableTextRef.current = text;
      setCrystallizableText(text);
    },
  });

  function clearTranscriptionDisplay() {
    finalBufferRef.current = [];
    setCrystallizableText("");
    crystallizableTextRef.current = "";
    acceptEmptyTranscriptRef.current = true;
    lastSpeechActivityAtRef.current = Date.now();
    setTranscriptSilenceMs(0);
    tapThoughtSpeech.clearCurrentTranscription();
  }

  const applyPurityHit = useCallback(() => {
    setSessionPurity((current) => {
      const next = nextSessionPurityAfterAutoStash(current);
      if (isSessionPurityDepleted(next)) {
        window.setTimeout(() => {
          endAndScoreRef.current({ impure: true });
        }, 0);
      }
      return next;
    });
  }, []);

  const speechBindings = useMemo<LiveSpeechRecognitionBindings>(
    () => ({
      recognitionRef,
      shouldListenRef,
      restartTimerRef,
      langRef,
      onResult: (event: SpeechRecognitionEventLike) => {
        speechResultsLengthRef.current = event.results.length;
        const finals: string[] = [];
        let interim = "";
        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = normalize(result[0]?.transcript || "");
          if (!transcript) continue;
          if (result.isFinal) finals.push(transcript);
          else if (i >= event.resultIndex) interim = normalize(`${interim} ${transcript}`);
        }
        finalBufferRef.current = finals;
        const displayText = normalize(`${finals.join(" ")} ${interim}`.trim());

        if (!displayText) {
          if (!acceptEmptyTranscriptRef.current && crystallizableTextRef.current) {
            return;
          }
          setCrystallizableText("");
          crystallizableTextRef.current = "";
          return;
        }

        acceptEmptyTranscriptRef.current = false;
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        setCrystallizableText(displayText);
        crystallizableTextRef.current = displayText;
      },
      onListeningChange: setIsListening,
      onError: setSpeechError,
    }),
    [],
  );

  const restartSpeechRecognitionSession = useCallback(() => {
    consumedResultsIndexRef.current = 0;
    speechResultsLengthRef.current = 0;
    if (!shouldRestartLocalTapSpeechBindings(phase)) return;
    restartLiveSpeechRecognition(speechBindings);
  }, [phase, speechBindings]);

  /** System 1: Del / silence — stash live speech into stash history. */
  const stashCurrentTranscription = useCallback(
    (options?: { auto?: boolean }) => {
      const text = tapHookFormingText(tapThoughtSpeech);
      clearTranscriptionDisplay();
      restartSpeechRecognitionSession();
      if (!text) {
        autoStashInFlightRef.current = false;
        return;
      }
      setLists((current) => {
        const { lists: next, added } = stashExerciseSpeech(current, text);
        if (added) {
          logExerciseTrace({
            traceType: "system1",
            action: options?.auto ? "auto_stash" : "pause_finalize",
            thoughtId: added.id,
            chainId: added.chainId,
            text: added.text,
            timestampMs: added.timestamp,
          });
        }
        return next;
      });
      if (options?.auto) applyPurityHit();
      autoStashInFlightRef.current = false;
    },
    [crystallizableText, restartSpeechRecognitionSession, applyPurityHit, logExerciseTrace],
  );

  /** System 2: promote one stashed thought onto the submission stack. */
  const submitStashThought = useCallback(
    (thoughtId: string) => {
      setLists((current) => {
        const { lists: next, moved } = promoteExerciseStashToSubmission(current, thoughtId);
        if (moved) {
          logExerciseTrace({
            traceType: "system2",
            action: "send",
            thoughtId: moved.id,
            chainId: moved.chainId,
            text: moved.text,
            timestampMs: moved.timestamp,
          });
        }
        return next;
      });
    },
    [logExerciseTrace],
  );

  /**
   * System 2 Enter: with live speech → direct submit to stack;
   * without live speech → promote latest stash item.
   */
  const submitCurrentOrLatestStash = useCallback(() => {
    const text = tapHookFormingText(tapThoughtSpeech);
    if (text) {
      clearTranscriptionDisplay();
      restartSpeechRecognitionSession();
      setLists((current) => {
        const { lists: next, added } = submitExerciseSpeechDirect(current, text);
        if (added) {
          logExerciseTrace({
            traceType: "system2",
            action: "send",
            thoughtId: added.id,
            chainId: added.chainId,
            text: added.text,
            timestampMs: added.timestamp,
          });
        }
        return next;
      });
      return;
    }
    const latest = listsRef.current.stash[listsRef.current.stash.length - 1];
    if (latest) submitStashThought(latest.id);
  }, [
    crystallizableText,
    restartSpeechRecognitionSession,
    logExerciseTrace,
    submitStashThought,
  ]);

  /** System 2 undo: demote Solution Stack → stash (thought preserved, leaves evaluated set). */
  const handleUndoSubmissionToStash = useCallback(
    (thoughtId: string) => {
      setLists((current) => {
        const { lists: next, moved } = demoteExerciseSubmissionToStash(current, thoughtId);
        if (moved) {
          logExerciseTrace({
            traceType: "system2",
            action: "remove",
            thoughtId: moved.id,
            chainId: moved.chainId,
            text: moved.text,
          });
        }
        return next;
      });
    },
    [logExerciseTrace],
  );

  // Silence auto-stash (system 1) — same purity mechanics as conversational TAP.
  // Grace after live entry so briefing elapsed time / UI settle does not burn purity.
  useEffect(() => {
    if (phase !== "live") {
      setTranscriptSilenceMs(0);
      autoStashInFlightRef.current = false;
      return;
    }
    const liveEnteredAt = Date.now();
    lastSpeechActivityAtRef.current = liveEnteredAt;
    setTranscriptSilenceMs(0);

    const id = window.setInterval(() => {
      if (isWithinTapPurityGrace(liveEnteredAt)) {
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        return;
      }
      if (!shouldEvaluateSessionPurity({ waitingForHelios: false })) return;
      const silence = Date.now() - lastSpeechActivityAtRef.current;
      setTranscriptSilenceMs(silence);
      const hasText = Boolean(tapHookFormingText(tapThoughtSpeech));
      if (shouldAutoStashOnSilence(silence, hasText) && !autoStashInFlightRef.current) {
        autoStashInFlightRef.current = true;
        stashCurrentTranscription({ auto: true });
        return;
      }
      if (shouldPenalizeEmptyBarSilence(silence, hasText) && !autoStashInFlightRef.current) {
        autoStashInFlightRef.current = true;
        applyPurityHit();
        lastSpeechActivityAtRef.current = Date.now();
        autoStashInFlightRef.current = false;
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, stashCurrentTranscription, applyPurityHit]);

  async function startSession(
    topicOrOptions?: TapStartingTopic | { practice?: boolean; topic?: TapStartingTopic },
  ) {
    const practice =
      !!topicOrOptions &&
      "practice" in topicOrOptions &&
      topicOrOptions.practice === true;
    const topic =
      topicOrOptions && "practice" in topicOrOptions
        ? topicOrOptions.topic
        : (topicOrOptions as TapStartingTopic | undefined);

    isEndingRef.current = false;
    setIsStartingSession(true);
    setStartingTopicId(practice ? "practice" : topic?.id ?? null);
    setIsPracticeMode(practice);
    isPracticeModeRef.current = practice;
    const sessionMinutes = resolveTapLiveMinutes({ practice, minutes });
    setLiveMinutes(sessionMinutes);
    setError("");
    setSpeechError(null);
    setLists(emptyExerciseDualLists());
    listsRef.current = emptyExerciseDualLists();
    setSessionPurity(TAP_SESSION_PURITY_MAX);
    setSessionEndedImpure(false);
    setTranscriptSilenceMs(0);
    if (!isTapLiveThoughtSpeechEnabled("live")) {
      startLiveSpeechRecognition(speechBindings, speechLang);
    }

    try {
      const response = await fetch(TAP_SESSION_RUNTIME_PATHS.start, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          entryQueryParams: entryQueryParamsRef.current,
          minutes: sessionMinutes,
          practice,
          tapSessionId: tapSessionIdRef.current,
          interaction_kind: "exercise",
          openingQuestion: topic?.openingQuestion,
          topicId: topic?.id,
          topicTitle: topic?.title,
          conversationLanguage,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessageFromBody(payload, "Could not start Exercise TAP"));
      if (payload.tapSessionId) {
        tapSessionIdRef.current = payload.tapSessionId;
        setTapSessionId(payload.tapSessionId);
      }

      // Topic cards seed the solo exercise prompt; server opening is next priority.
      const prompt = resolveExercisePromptAfterIntro({
        topicOpeningQuestion: topic?.openingQuestion,
        serverOpeningQuestion: String(payload.openingQuestion || "").trim() || null,
        workspaceTitle,
      });
      if (!prompt) throw new Error("Could not generate exercise prompt");
      setExerciseText(prompt);

      const started = Date.now();
      setStartedAt(started);
      setRemainingSeconds(sessionMinutes * 60);
      setPhase("live");
    } catch (err) {
      stopLiveSpeechRecognition(speechBindings);
      setIsPracticeMode(false);
      isPracticeModeRef.current = false;
      setError(err instanceof Error ? err.message : "Could not start Exercise TAP");
    } finally {
      setIsStartingSession(false);
      setStartingTopicId(null);
    }
  }

  async function endSession(options?: { impure?: boolean }) {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    const impure = options?.impure === true;
    const practice = isPracticeModeRef.current;
    setSessionEndedImpure(impure);
    let finalLists = listsRef.current;
    if (!impure) {
      const text = tapHookFormingText(tapThoughtSpeech);
      if (text) {
        // Flush remaining live speech into stash (sys1), then promote to submission (sys2).
        const stashed = stashExerciseSpeech(finalLists, text);
        if (stashed.added) {
          logExerciseTrace({
            traceType: "system1",
            action: "pause_finalize",
            thoughtId: stashed.added.id,
            chainId: stashed.added.chainId,
            text: stashed.added.text,
            timestampMs: stashed.added.timestamp,
          });
          const promoted = promoteExerciseStashToSubmission(stashed.lists, stashed.added.id);
          finalLists = promoted.lists;
          if (promoted.moved) {
            logExerciseTrace({
              traceType: "system2",
              action: "send",
              thoughtId: promoted.moved.id,
              chainId: promoted.moved.chainId,
              text: promoted.moved.text,
              timestampMs: promoted.moved.timestamp,
            });
          }
        } else {
          finalLists = stashed.lists;
        }
        setLists(finalLists);
        listsRef.current = finalLists;
      }
      clearTranscriptionDisplay();
    } else {
      clearTranscriptionDisplay();
    }
    setPhase("saving");
    stopLiveSpeechRecognition(speechBindings);

    try {
      const durationSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      // Transcript: exercise prompt + submitted stack (sys2), then leftover stash (sys1).
      const timeline: ExerciseThought[] = [
        ...finalLists.submitted,
        ...finalLists.stash,
      ].sort((a, b) => a.timestamp - b.timestamp);
      const transcript = [
        { role: "assistant", text: exerciseText, at: new Date(startedAt || Date.now()).toISOString() },
        ...timeline.map((thought) => ({
          role: "user" as const,
          text: thought.text,
          at: new Date(thought.timestamp).toISOString(),
        })),
      ];
      const safeTranscript =
        transcript.length > 0
          ? transcript
          : [{ role: "assistant", text: exerciseText || "Exercise TAP", at: new Date().toISOString() }];

      const response = await fetch(TAP_SESSION_RUNTIME_PATHS.complete, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          entryQueryParams: entryQueryParamsRef.current,
          tapSessionId: tapSessionIdRef.current,
          transcript: safeTranscript,
          durationSeconds,
          requestedDurationSeconds: practice ? TAP_PRACTICE_DURATION_SECONDS : liveMinutes * 60,
          sessionQuality: impure ? "impure" : "pure",
          impure,
          practice,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessageFromBody(payload, "Could not save Exercise TAP"));

      if (practice) {
        setPhase("practice_done");
        return;
      }

      if (impure || privateToken) {
        setPhase("results");
        return;
      }

      const resolvedPostSession = (payload.postSession as TapPostSessionMode) || postSession;
      const resolvedRedirectUrl =
        typeof payload.redirectUrl === "string" ? payload.redirectUrl : configuredRedirectUrl;

      if (resolvedPostSession === "show_results") {
        setPhase("results");
        return;
      }
      if (resolvedPostSession === "redirect_url" && resolvedRedirectUrl) {
        window.location.href = resolvedRedirectUrl;
        return;
      }
      const targetWorkspaceId = payload.workspaceId || resolvedWorkspaceId;
      if (targetWorkspaceId) {
        router.push(getIlePostSessionPath({ metadata: { workspace_id: targetWorkspaceId } }));
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Exercise TAP");
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

  useEffect(() => {
    return () => {
      stopLiveSpeechRecognition(speechBindings);
    };
  }, [speechBindings]);

  // Live shortcuts: Del = sys1 stash; Enter = sys2 submit; 1–3 promote stash slots.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase !== "live" || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        submitCurrentOrLatestStash();
        return;
      }
      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        stashCurrentTranscription();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && ["1", "2", "3"].includes(event.key)) {
        const ordered = listsRef.current.stash.slice().reverse();
        const thought = ordered[Number(event.key) - 1];
        if (!thought) return;
        event.preventDefault();
        submitStashThought(thought.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, submitCurrentOrLatestStash, stashCurrentTranscription, submitStashThought]);

  function retryMicrophone() {
    setSpeechError(null);
    tapThoughtSpeech.retryMicrophone();
  }

  if (isMobile) {
    return <MobileBlockScreen product="tap" />;
  }

  return (
    <div
      data-exercise-tap-client
      className="relative min-h-screen bg-[#0a0a0a] text-white"
    >
      {bgImage ? (
        <div
          className="pointer-events-none fixed inset-0 opacity-30"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : null}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-5">
        {phase === "briefing" && (
          <section
            className="relative flex min-h-[calc(100vh-2.5rem)] flex-1 py-4"
            data-exercise-briefing
            data-exercise-tap-intro
          >
            <div className="grid min-h-0 w-full flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950/65 backdrop-blur-sm">
                <SessionOnboardingGuide
                  variant="tap"
                  hideStep3Quote
                  renderStep3Action={() => (
                    <>
                      <TapStartingTopicCards
                        topics={startingTopics}
                        isStarting={isStartingSession}
                        startingTopicId={startingTopicId}
                        onStartTopic={(selectedTopic) => void startSession(selectedTopic)}
                        onPracticeFirst={() => void startSession({ practice: true })}
                        practiceTitle={t("tap.practice.practiceFirst")}
                        practiceSubtitle={t("tap.practice.practiceFirstHint")}
                        practiceStartLabel={t("tap.practice.cardStart")}
                        practiceStartingLabel={t("tap.practice.starting")}
                        loadingLabel={t("tap.briefing.topicsLoading")}
                        startLabel={t("onboardingGuide.tap.step3.start")}
                        startingLabel={t("onboardingGuide.tap.step3.starting")}
                      />
                      {topicsError ? (
                        <p className="mt-2 text-center text-xs text-neutral-300/90">{topicsError}</p>
                      ) : null}
                    </>
                  )}
                />
              </div>
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900/80 bg-neutral-950/55 backdrop-blur-md">
                <TapBriefingConfig
                  kicker="Exercise TAP"
                  workspaceTitle={workspaceTitle}
                  minutes={minutes}
                  onMinutesChange={setMinutes}
                  conversationLanguage={conversationLanguage}
                  onConversationLanguageChange={(locale) =>
                    setConversationLanguage(coerceSpokenLocale(locale))
                  }
                  showDurationPicker={!privateToken && !durationLocked}
                  disabled={isStartingSession}
                  intro="Solo practice. Del stashes; Enter promotes to Solution."
                  shortcutRows={[
                    { keys: ["Del"], label: "Stash (System 1)" },
                    { keys: ["Enter"], label: "To Solution Stack (System 2)" },
                    { keys: ["1", "2", "3"], label: "Promote stashed slot" },
                    { keys: ["5s"], label: t("tap.briefing.shortcutSilence") },
                  ]}
                />
              </div>
              {error ? (
                <p className="absolute inset-x-0 bottom-0 z-20 px-6 pb-5 text-center text-sm text-red-300 lg:col-span-2">
                  {error}
                </p>
              ) : null}
            </div>
          </section>
        )}

        {phase === "live" && (
          <>
            {isPracticeMode ? (
              <div
                data-tap-practice-banner
                className="mb-3 shrink-0 rounded-xl border border-neutral-500/40 bg-neutral-800/10 px-4 py-2.5 text-center"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/90">
                  {t("tap.practice.bannerKicker")}
                </p>
                <p className="mt-0.5 text-sm font-medium text-neutral-50">{t("tap.practice.bannerTitle")}</p>
                <p className="mt-0.5 text-xs text-neutral-200/70">{t("tap.practice.bannerHint")}</p>
              </div>
            ) : null}
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
          <ExerciseTapShell
            exerciseText={exerciseText}
            stash={lists.stash}
            submitted={lists.submitted}
            onSubmitStashThought={submitStashThought}
            onRemoveSubmission={handleUndoSubmissionToStash}
            identityBadge={
              participantIdentity ? (
                <SessionIdentityBadge identity={participantIdentity} />
              ) : undefined
            }
            controlStrip={
              <div
                className="flex w-full flex-wrap items-end justify-between gap-3 rounded-xl border border-neutral-800/90 bg-neutral-950/70 px-3 py-2"
                data-exercise-live-control-strip
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4 sm:gap-5">
                  <div className="flex shrink-0 flex-col gap-1">
                    <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                      Time
                    </div>
                    <div
                      className={`flex h-7 items-center font-mono text-lg leading-none tabular-nums tracking-tight ${
                        remainingSeconds <= 60 ? "text-neutral-300" : "text-white"
                      }`}
                    >
                      {formatCountdown(remainingSeconds)}
                    </div>
                  </div>
                  <div
                    className="flex shrink-0 flex-col gap-1"
                    data-tap-session-purity
                    aria-label={t("tap.live.sessionPurityAria", {
                      purity: sessionPurity,
                      max: TAP_SESSION_PURITY_MAX,
                    })}
                  >
                    <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                      {t("tap.live.sessionPurity")}
                    </div>
                    <div className="flex h-7 items-center gap-1.5">
                      {Array.from({ length: TAP_SESSION_PURITY_MAX }, (_, index) => {
                        const filled = index < sessionPurity;
                        return (
                          <span
                            key={index}
                            className={`h-2.5 w-2.5 shrink-0 rounded-full border transition-colors ${
                              filled
                                ? sessionPurity === 1
                                  ? "border-neutral-600/80 bg-neutral-300"
                                  : "border-emerald-400/70 bg-emerald-400"
                                : "border-neutral-700 bg-transparent"
                            }`}
                            aria-hidden
                          />
                        );
                      })}
                      <span
                        className={`ml-0.5 font-mono text-sm leading-none tabular-nums ${
                          sessionPurity <= 1 ? "text-neutral-300" : "text-neutral-400"
                        }`}
                      >
                        {sessionPurity}/{TAP_SESSION_PURITY_MAX}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-[8rem] max-w-md flex-1">
                    <AutoStashContextBar data-surface="tap" text={crystallizableText} />
                  </div>
                </div>
                {showEndSession ? (
                  <div
                    className="flex h-[calc(0.625rem+0.25rem+1.75rem)] shrink-0 flex-wrap items-end gap-2"
                    data-tap-end-session
                  >
                    <ThoughtButton size="sm" variant="primary" onClick={() => void endSession()}>
                      End session
                    </ThoughtButton>
                  </div>
                ) : null}
              </div>
            }
            speechBar={
              <>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <div
                    className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300 transition-opacity duration-150"
                    style={{
                      opacity: shouldFadeLiveBar(transcriptSilenceMs)
                        ? transcriptFadeOpacity(transcriptSilenceMs)
                        : 1,
                    }}
                    data-tap-transcript-fade
                  >
                    <SlidingTranscript
                      text={formatSpeechTranscriptDisplay({
                        text: crystallizableText,
                        speechError,
                        speechSupported,
                        isListening,
                        enabled: phase === "live",
                      })}
                      className={`w-full ${speechError ? "text-neutral-300/90" : "text-neutral-300"}`}
                    />
                  </div>
                  {speechSupported !== false && !isListening ? (
                    <ThoughtButton size="sm" variant="primary" onClick={() => void retryMicrophone()}>
                      {speechError ? "Retry" : "Start"}
                    </ThoughtButton>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ThoughtCompactAction
                      shortcut="Del"
                      label="Stash"
                      disabled={!crystallizableText}
                      onClick={() => stashCurrentTranscription()}
                    />
                    <ThoughtCompactAction
                      shortcut="↵"
                      label="To solution"
                      disabled={!crystallizableText && lists.stash.length === 0}
                      onClick={() => submitCurrentOrLatestStash()}
                    />
                  </div>
                </div>
                {error ? <p className="mt-1.5 text-sm text-red-300">{error}</p> : null}
              </>
            }
          />
          </div>
          </>
        )}

        {phase === "saving" && (
          <section className="flex flex-1 items-center justify-center">
            <LoadingStatusMessage
              tone="muted"
              message={
                isPracticeMode
                  ? t("tap.practice.saving")
                  : t("tap.postSession.savingAndReturning")
              }
            />
          </section>
        )}

        {phase === "practice_done" && (
          <section
            className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
            data-tap-practice-done
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/80">
              {t("tap.practice.doneKicker")}
            </p>
            <h2 className="mt-2 text-2xl font-medium text-white">{t("tap.practice.doneTitle")}</h2>
            <p className="mt-3 text-sm text-neutral-400">{t("tap.practice.doneBody")}</p>
            <button
              type="button"
              className={cn(thoughtButtonClasses({ size: "md", variant: "primary" }), "mt-8")}
              data-exercise-practice-retry
              onClick={() => {
                isEndingRef.current = false;
                setIsPracticeMode(false);
                isPracticeModeRef.current = false;
                setError("");
                setLists(emptyExerciseDualLists());
                listsRef.current = emptyExerciseDualLists();
                setExerciseText(
                  buildExercisePromptText({ workspaceTitle }),
                );
                setPhase("briefing");
              }}
            >
              {t("tap.practice.restart")}
            </button>
          </section>
        )}

        {phase === "results" &&
          (sessionEndedImpure ? (
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-impure
              data-exercise-session-impure
            >
              <h1 className="text-2xl font-medium text-neutral-100 sm:text-3xl">
                {t("tap.postSession.impureTitle")}
              </h1>
              <p className="mt-4 max-w-lg whitespace-pre-line text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t("tap.postSession.impureBody")}
              </p>
              <ThoughtButton
                size="md"
                variant="primary"
                className="mt-8"
                data-tap-impure-retry
                onClick={() => window.location.reload()}
              >
                {t("tap.postSession.impureTryAgain")}
              </ThoughtButton>
            </section>
          ) : privateToken ? (
            // Map of Knowledge / guest private links: same thank-you as conversational TAP
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-thank-you
              data-exercise-session-thank-you
            >
              <h1 className="text-2xl font-medium text-neutral-100 sm:text-3xl">
                {t("tap.postSession.thankYouTitle")}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t("tap.postSession.thankYouBody")}
              </p>
              <a
                href="/"
                data-tap-explore-uncertain-systems
                className="mt-8 inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                {t("tap.postSession.exploreUncertainSystems")}
              </a>
            </section>
          ) : (
            <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/80">
                Exercise TAP complete
              </p>
              <h2 className="mt-2 text-2xl font-medium text-white">
                {t("tap.postSession.resultsTitle")}
              </h2>
              <p className="mt-3 text-sm text-neutral-400">
                Your spoken exercise and submitted thoughts were recorded as proof of work.
              </p>
              <button
                type="button"
                className={cn(thoughtButtonClasses({ size: "md", variant: "primary" }), "mt-8")}
                onClick={() => {
                  if (resolvedWorkspaceId) {
                    router.push(
                      getIlePostSessionPath({ metadata: { workspace_id: resolvedWorkspaceId } }),
                    );
                    return;
                  }
                  router.push("/dashboard");
                }}
              >
                Done
              </button>
            </section>
          ))}

        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-300">{error || "Something went wrong"}</p>
            <ThoughtButton
              size="md"
              variant="primary"
              onClick={() => {
                isEndingRef.current = false;
                setPhase("briefing");
              }}
            >
              Back
            </ThoughtButton>
          </section>
        )}
      </div>
    </div>
  );
}
