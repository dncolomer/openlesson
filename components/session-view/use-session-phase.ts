"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  endSession,
  getIlePostSessionPath,
  getSession,
  getSessionPlan,
  pauseSession,
  type Session,
  type SessionPlan,
} from "@/lib/storage";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import { releaseSessionLocalMemory } from "@/lib/session-local-memory";
import {
  chapterStatusAfterHydrate,
  fetchWelcomeChapterSnapshot,
} from "@/lib/session-plan-chapters-status";
import { applyIleSessionNameToMetadata } from "@/lib/learn-session-name";
import { applyIleOpenWorkIdsToMetadata } from "@/lib/learn-pow-spend";
import {
  flagIleSessionProofOfWorkImpure,
  textToBase64,
  uploadIleProofOfWork,
} from "@/lib/learn-proof-of-work-client";
import { withImpurePoWData } from "@/lib/tap-session-purity";
import { postWorkspaceFlowEmbedding } from "@/lib/flow-embedding-client";
import { FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";
import type { SessionPolicySnapshot } from "@/components/session-view/session-policy-context";
import { persistIleSessionRow } from "@/lib/learn-session-persist";
import { discardUnsavedIleSession } from "@/lib/learn-unsaved-exit";
import type { GuestAccessKind, ChapterPlanStatus } from "@/components/session-view/types";

export type SessionPhaseInput = {
  session: Session | null;
  setSession: (s: Session | null | ((prev: Session | null) => Session | null)) => void;
  sessionRef: { current: Session | null };
  sessionId: string;
  guestAccessKind: GuestAccessKind;
  ayclToken?: string;
  ileToken?: string;
  guestAccessBody: Record<string, unknown>;
  entryQueryParams?: Record<string, string | string[]>;
  entryParamsKey: string;
  router: ReturnType<typeof useRouter>;
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  setElapsedSeconds: (v: number | ((n: number) => number)) => void;
  setIsPaused: (v: boolean) => void;
  setTutoringLanguage: (l: SpokenLocale) => void;
  setLanguageConfirmed: (v: boolean) => void;
  setSessionPlan: (p: SessionPlan | null) => void;
  sessionPlanRef: { current: SessionPlan | null };
  setPlanLoading: (v: boolean) => void;
  setPlanError: (e: string | null) => void;
  setChapterPlanStatus: (s: ChapterPlanStatus) => void;
  setObjectives: (o: string[]) => void;
  setObjectiveStatuses: (s: Array<"red" | "yellow" | "green" | "blue">) => void;
  setShowEndDialog: (v: boolean) => void;
  handleDisconnectMuse: () => void;
  flushRemainingIlePow: (options?: { force?: boolean }) => Promise<void>;
  handlePause: () => Promise<void>;
  stopRecording: (options?: { stayOnScreen?: boolean }) => Promise<void>;
  openWorkIdsRef: { current: string[] };
  policyRef?: { current: SessionPolicySnapshot };
};

export function useSessionPhase(input: SessionPhaseInput) {
  const {
    session,
    setSession,
    sessionRef,
    sessionId,
    guestAccessKind,
    ayclToken,
    ileToken,
    guestAccessBody,
    entryQueryParams,
    entryParamsKey,
    router,
    isRecording,
    isPaused,
    elapsedSeconds,
    setElapsedSeconds,
    setIsPaused,
    setTutoringLanguage,
    setLanguageConfirmed,
    setSessionPlan,
    sessionPlanRef,
    setPlanLoading,
    setPlanError,
    setChapterPlanStatus,
    setObjectives,
    setObjectiveStatuses,
    setShowEndDialog,
    handleDisconnectMuse,
    flushRemainingIlePow,
    handlePause,
    stopRecording,
    openWorkIdsRef,
  } = input;

  useEffect(() => {
    const handleProbeRevealed = (e: Event) => {
      const probeId = (e as CustomEvent).detail;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          probes: prev.probes.map((p) =>
            p.id === probeId ? { ...p, isRevealed: true } : p,
          ),
        };
      });
      if (sessionRef.current) {
        sessionRef.current = {
          ...sessionRef.current,
          probes: sessionRef.current.probes.map((p) =>
            p.id === probeId ? { ...p, isRevealed: true } : p,
          ),
        };
      }
    };

    const handleProbeStarToggled = (e: Event) => {
      const { probeId, starred } = (e as CustomEvent).detail;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          probes: prev.probes.map((p) =>
            p.id === probeId ? { ...p, starred } : p,
          ),
        };
      });
    };

    window.addEventListener("probe-revealed", handleProbeRevealed);
    window.addEventListener("probe-star-toggled", handleProbeStarToggled);

    return () => {
      window.removeEventListener("probe-revealed", handleProbeRevealed);
      window.removeEventListener("probe-star-toggled", handleProbeStarToggled);
    };
  }, [sessionRef, setSession]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPlanLoading(true);
      const chapterStatusPromise = fetchWelcomeChapterSnapshot(
        sessionId,
        guestAccessBody,
      );
      void chapterStatusPromise.then((snapshot) => {
        if (cancelled) return;
        setChapterPlanStatus(snapshot.status);
        if (snapshot.plan && (snapshot.plan.steps?.length ?? 0) > 0) {
          setSessionPlan(snapshot.plan);
          sessionPlanRef.current = snapshot.plan;
        }
      });

      const s =
        guestAccessKind === "aycl" && ayclToken
          ? await (await import("@/lib/aycl-storage")).getAyclSession(ayclToken, sessionId)
          : guestAccessKind === "ile" && ileToken
            ? await (await import("@/lib/learn-link-storage")).getIleLinkSession(ileToken, sessionId)
            : await getSession(sessionId);
      if (cancelled) return;
      if (s) {
        setSession(s);
        sessionRef.current = s;
        setElapsedSeconds(Math.floor((s.durationMs || 0) / 1000));

        setLanguageConfirmed(false);

        if (s.metadata?.tutoringLanguage) {
          setTutoringLanguage(coerceSpokenLocale(String(s.metadata.tutoringLanguage)));
        }

        if (s.status === "paused") {
          setIsPaused(true);
        }

        setPlanError(null);

        const objectivesPromise = (async () => {
          let loadedObjectives: string[] = [];
          if (s.objectives && s.objectives.length > 0) {
            loadedObjectives = s.objectives;
          } else {
            try {
              const objRes = await fetch("/api/generate-objectives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  problem: s.problem,
                  ...guestAccessBody,
                }),
              });
              if (!cancelled && objRes.ok) {
                const { objectives: generatedObjectives } = await objRes.json();
                if (generatedObjectives && generatedObjectives.length > 0) {
                  loadedObjectives = generatedObjectives;
                }
              }
            } catch {
              /* objectives are optional */
            }
          }
          if (loadedObjectives.length > 0 && !cancelled) {
            setObjectives(loadedObjectives);
            setObjectiveStatuses(loadedObjectives.map(() => "blue"));
          }
        })();

        setPlanLoading(true);
        try {
          const snapshot = await chapterStatusPromise;
          if (cancelled) return;
          let status = snapshot.status;
          let existingPlan = snapshot.plan;
          if (snapshot.plan && (snapshot.plan.steps?.length ?? 0) > 0) {
            setSessionPlan(snapshot.plan);
            sessionPlanRef.current = snapshot.plan;
          }
          if (status === "exists" && !(existingPlan?.steps?.length)) {
            try {
              existingPlan = await getSessionPlan(s.id);
              if (
                !cancelled &&
                existingPlan &&
                (existingPlan.steps?.length ?? 0) > 0
              ) {
                setSessionPlan(existingPlan);
                sessionPlanRef.current = existingPlan;
              }
            } catch (err) {
              console.warn("Session plan hydrate failed:", err);
            }
          }
          if (!cancelled) {
            setChapterPlanStatus(chapterStatusAfterHydrate(status, existingPlan));
          }
        } catch (err) {
          console.warn("Session plan existence check failed:", err);
          if (!cancelled) setChapterPlanStatus("failed");
        } finally {
          if (!cancelled) setPlanLoading(false);
        }

        await objectivesPromise;
      } else {
        if (!cancelled) setPlanLoading(false);
        router.push("/");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    router,
    guestAccessKind,
    ayclToken,
    ileToken,
    entryParamsKey,
    guestAccessBody,
    sessionPlanRef,
    sessionRef,
    setChapterPlanStatus,
    setElapsedSeconds,
    setIsPaused,
    setLanguageConfirmed,
    setObjectives,
    setObjectiveStatuses,
    setPlanError,
    setPlanLoading,
    setSession,
    setSessionPlan,
    setTutoringLanguage,
  ]);

  const pauseAndGoToDashboard = useCallback(async (
    sessionName?: string | null,
    options?: { persistSession?: boolean },
  ) => {
    const persistSession = options?.persistSession !== false;
    const current = sessionRef.current ?? session;
    if (current) {
      if (persistSession) {
        const latest = sessionRef.current ?? current;
        const metadata = applyIleOpenWorkIdsToMetadata(
          applyIleSessionNameToMetadata(
            latest.metadata as Record<string, unknown>,
            sessionName,
          ),
          openWorkIdsRef.current,
        ) as Session["metadata"];
        const named = { ...latest, metadata };
        setSession(named);
        sessionRef.current = named;
        try {
          await persistIleSessionRow(() => sessionRef.current, { ayclToken, ileToken });
        } catch {
          /* Still pause and leave — name is best-effort. */
        }
      } else {
        try {
          await flushRemainingIlePow({ force: true });
          await discardUnsavedIleSession({
            sessionId: current.id,
            guestAccessBody,
          });
        } catch {
          /* Still pause and leave — discard is best-effort. */
        }
      }
    }
    if (session && isRecording && !isPaused) {
      await handlePause();
    } else if (session && isPaused) {
      await pauseSession(session.id, elapsedSeconds * 1000);
    }
    const next = sessionRef.current ?? session;
    releaseSessionLocalMemory(next?.id ?? current?.id);
    router.push(next ? getIlePostSessionPath(next) : "/dashboard");
  }, [
    session,
    isRecording,
    isPaused,
    elapsedSeconds,
    handlePause,
    router,
    ayclToken,
    ileToken,
    setSession,
    guestAccessBody,
    flushRemainingIlePow,
    openWorkIdsRef,
    sessionRef,
  ]);

  const handleConfirmEnd = async (options?: { impure?: boolean }) => {
    setShowEndDialog(false);
    const impure = options?.impure === true;
    const workspaceId =
      session && typeof session.metadata?.workspace_id === "string"
        ? session.metadata.workspace_id
        : "";
    if (session) {
      const snapshot = input.policyRef?.current;
      if (snapshot?.model) {
        const sequence = snapshot.sequence ?? [];
        if (workspaceId) {
          void postWorkspaceFlowEmbedding({
            workspaceId,
            flowKind: "learn",
            runId: session.id,
            source: "learn",
            model: snapshot.model,
            sequence,
            pow: sequence.map((action, index) => ({
              type: "tool",
              tool_name: "session_policy",
              tool_action: action,
              timestamp_ms: index + 1,
            })),
            sessionId: session.id,
            ileToken,
          });
          const policyMetadata = {
            flowKind: "learn",
            embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
            policy_sequence: sequence,
          };
          void uploadIleProofOfWork({
            workspaceId,
            sessionId: session.id,
            ileToken,
            type: "tool",
            mime_type: "application/json",
            data: textToBase64(
              JSON.stringify({
                flowKind: "learn",
                sequence,
                ...(impure ? { quality: "impure", impure: true, session_quality: "impure" } : {}),
              }),
            ),
            file_name: "session-policy.json",
            tool_name: "session_policy",
            tool_action: impure ? "policy_score_impure" : "policy_score",
            metadata: impure ? withImpurePoWData(policyMetadata) : policyMetadata,
          });
        }
      }
      const finalSession = endSession(session, elapsedSeconds * 1000, "completed");
      setSession(finalSession);
      sessionRef.current = finalSession;
    }
    await stopRecording({ stayOnScreen: impure });
    if (impure && workspaceId && session) {
      void flagIleSessionProofOfWorkImpure({
        workspaceId,
        sessionId: session.id,
        ileToken,
        entryQueryParams,
      });
    }
  };

  useEffect(() => {
    return () => {
      handleDisconnectMuse();
      releaseSessionLocalMemory(sessionRef.current?.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pauseAndGoToDashboard,
    handleConfirmEnd,
  };
}
