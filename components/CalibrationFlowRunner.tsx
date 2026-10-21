"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { TapLiveClock } from "@/components/tap-score/tap-live-clock";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import { CalibrateSoundingSurface } from "@/components/calibrate/calibrate-sounding-surface";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { SessionSoundingResult } from "@/components/session-view/session-sounding-result";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { SessionTopicChapter } from "@/components/session-view/learn-work-dock-bar";
import { TapSessionSignals } from "@/components/session-view/session-signals";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { FLOW_END_KICKERS } from "@/lib/session-stage-progress";
import { beginCalibrationSession } from "@/lib/calibration-flow";
import { fetchAestheticPackages } from "@/lib/aesthetics";
import { pickTapBackgroundImage } from "@/lib/tap-score-client-helpers";
import { IleStartLoading } from "@/components/session-view/learn-start-loading";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import {
  loadSessionBranchField,
  sessionClockMayStart,
  subscribeSessionBranchField,
} from "@/lib/session-branch-field-load";
import { releaseSessionLocalMemory } from "@/lib/session-local-memory";
import { calibrateFieldPrepareInput } from "@/lib/session-branch-prepare";
import { useI18n } from "@/lib/i18n";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import type { CalibrateState } from "@/lib/calibrate-session";
import {
  absorbSoundingStills,
  commitSoundingTaps,
  createSoundingState,
  createSoundingTree,
  finishSounding,
  soundingProofEvent,
  soundingProofMetadata,
  soundingResultPresentation,
  soundingStillsFromBranchModel,
  submitSoundingProof,
  type SoundingClassification,
  type SoundingState,
} from "@/lib/calibrate-sounding";
import { inferSoundingVoiceStep } from "@/lib/calibrate-sounding-voice-client";

function CalibrationViewport({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white"
      data-calibration-session
    >
      {children}
    </main>
  );
}

export function CalibrationFlowRunner({ token }: { token: string }) {
  const { t } = useI18n();
  const [identity, setIdentity] = useState("");
  const [claimedIdentity, setClaimedIdentity] = useState("");
  const [sounding, setSounding] = useState<SoundingState | null>(null);
  const soundingRef = useRef<SoundingState | null>(null);
  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [proofBusy, setProofBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [fieldHold, setFieldHold] = useState<null | "preparing" | "failed">(null);
  const [fieldError, setFieldError] = useState("");
  const pendingRef = useRef<{
    goal: string;
    identity: string;
    minutes: number;
    session: CalibrateState;
  } | null>(null);
  const [stored, setStored] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const storedRef = useRef(false);
  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    soundingRef.current = sounding;
  }, [sounding]);

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
      releaseSessionLocalMemory();
    };
  }, []);

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

  async function finishCalibrationStart() {
    const pending = pendingRef.current;
    if (!pending) return;
    setFieldHold("preparing");
    setFieldError("");
    const field = await loadSessionBranchField(
      calibrateFieldPrepareInput({
        topicText: pending.goal || "Calibration",
        topicId: "calibration-goal",
        questions: [],
        calibrationToken: token,
      }),
    );
    if (!sessionClockMayStart({ mode: "calibrate", fieldReady: field.ok })) {
      setFieldError(field.ok ? "The field could not be prepared." : field.error);
      setFieldHold("failed");
      return;
    }
    const tree = createSoundingTree({
      model: field.ok ? field.model : null,
      questions: pending.session.pool,
    });
    const opened = createSoundingState(tree, token, field.ok ? field.model : null);
    if (!opened.current) {
      setFieldError("The sounding could not be prepared.");
      setFieldHold("failed");
      return;
    }
    setFieldKey(field.key);
    setDurationMinutes(pending.minutes);
    setRemainingSeconds(pending.minutes * 60);
    setStartedAt(Date.now());
    setTimeUp(false);
    setClaimedIdentity(pending.identity);
    setSounding(opened);
    soundingRef.current = opened;
    setFieldHold(null);
  }

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    setClaiming(true);
    setError("");
    try {
      const response = await fetch(`/api/calibration-flow/public/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      });
      const raw = await response.text();
      let payload: {
        error?: { message?: string };
        verificationRun?: boolean;
        questions?: { id?: string; text: string }[];
        identity?: string;
        goal?: string;
        durationMinutes?: number;
      } = {};
      if (raw.trim()) {
        try {
          payload = JSON.parse(raw) as typeof payload;
        } catch {
          setError("Could not start");
          return;
        }
      } else if (!response.ok) {
        setError("Could not start");
        return;
      }
      if (!response.ok) {
        setError(
          payload?.error?.message === "duplicate"
            ? "That identity is already used for this calibration flow."
            : payload?.error?.message === "empty"
              ? "Enter a unique identity."
              : payload?.error?.message || "Could not start",
        );
        return;
      }
      if (payload.verificationRun === true) {
        setError("This link is not a calibration flow");
        return;
      }
      const started = beginCalibrationSession({ questions: payload.questions || [] });
      if (started.session.pool.length === 0) {
        setError("This calibration flow has no questions.");
        return;
      }
      const claimed = String(payload.identity || identity.trim());
      const minutes = flowCountdownMinutes(payload.durationMinutes);
      const goalText = String(payload.goal || "");
      pendingRef.current = {
        goal: goalText,
        identity: claimed,
        minutes,
        session: started.session,
      };
      setClaimedIdentity(claimed);
      setVoiceReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    if (!startedAt || stored || timeUp) return;
    const total = durationMinutes * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0) setTimeUp(true);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [durationMinutes, startedAt, stored, timeUp]);

  const storeProof = useCallback(async (state: SoundingState) => {
    if (storedRef.current) return;
    storedRef.current = true;
    const closed = state.phase === "complete" ? state : finishSounding(state, false);
    const response = await fetch(`/api/calibration-flow/public/${encodeURIComponent(token)}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: claimedIdentity,
        events: [soundingProofEvent(closed)],
        metadata: soundingProofMetadata(closed),
        model: closed.model,
      }),
    });
    if (!response.ok) {
      storedRef.current = false;
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error?.message || "Could not store calibration proof");
    }
    setSounding(closed);
    soundingRef.current = closed;
    setStored(true);
    releaseSessionLocalMemory();
  }, [claimedIdentity, token]);

  useEffect(() => {
    if (!timeUp || stored) return;
    const live = soundingRef.current;
    if (!live) return;
    void storeProof(finishSounding(live, false)).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not store calibration proof");
    });
  }, [storeProof, stored, timeUp]);

  useEffect(() => {
    if (stored || !sounding || sounding.phase !== "complete") return;
    void storeProof(sounding).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not store calibration proof");
    });
  }, [sounding, storeProof, stored]);

  if (fieldHold && !sounding) {
    return (
      <CalibrationViewport>
        <SessionPageLoading data-calibration-field-loading="">
          <IleStartLoading
            t={t}
            fieldStatus={fieldHold === "failed" ? "failed" : "preparing"}
            fieldError={fieldError}
          />
          {fieldHold === "failed" ? (
            <button
              type="button"
              data-calibration-field-retry
              onClick={() => void finishCalibrationStart()}
              className="mt-6 border border-white/40 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-white"
            >
              Try again
            </button>
          ) : null}
        </SessionPageLoading>
      </CalibrationViewport>
    );
  }

  if (!voiceReady) {
    return (
      <CalibrationViewport>
        <form
          onSubmit={(event) => void claim(event)}
          className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col justify-center gap-4 px-6"
          data-calibration-identity
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            Calibration flow
          </p>
          <h1 className="font-serif text-2xl">Identify yourself</h1>
          <p className="text-sm text-neutral-400">
            Enter a unique string for this flow. A duplicate does not start.
          </p>
          <input
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            data-calibration-identity-input
            className="border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            placeholder="Unique identity"
            autoComplete="off"
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={claiming}
            className="bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Continue
          </button>
        </form>
      </CalibrationViewport>
    );
  }

  if (!sounding) {
    return (
      <CalibrationViewport>
        <section
          className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0b0b0b] px-6"
          data-calibrate-voice-challenge=""
          data-prepare-briefing-step="challenge"
        >
          <div className="w-full max-w-xl">
            <PracticeVoiceChallenge
              variant="prepare"
              onPass={() => {
                void finishCalibrationStart();
              }}
            />
            {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
          </div>
        </section>
      </CalibrationViewport>
    );
  }

  if (timeUp && !stored) {
    return (
      <CalibrationViewport>
        <CalibrationSoundingFinished
          marker="data-calibration-time-up"
          classification={sounding.classification}
          fallbackTitle="Time is up"
          fallbackBody="The countdown for this calibration flow has ended."
        />
      </CalibrationViewport>
    );
  }
  if (stored) {
    return (
      <CalibrationViewport>
        <CalibrationSoundingFinished
          marker="data-calibration-thank-you"
          classification={sounding.classification}
          fallbackTitle="Thank you"
          fallbackBody="Your taps have been stored for later Learn sessions."
        />
      </CalibrationViewport>
    );
  }

  return (
    <CalibrationViewport>
      <SessionWorkSurface
        mode="calibrate"
        stage={
          <CalibrateSoundingSurface
            sounding={sounding}
            error={error}
            onCommitTaps={(tappedIds) => {
              const live = soundingRef.current;
              if (!live) return;
              const next = commitSoundingTaps(live, tappedIds);
              soundingRef.current = next;
              setSounding(next);
            }}
            proofBusy={proofBusy}
            onSubmitProof={(transcript) => {
              const live = soundingRef.current;
              if (!live || live.phase !== "expert-proof" || !live.proof || proofBusy) return;
              setProofBusy(true);
              setError("");
              void inferSoundingVoiceStep({
                prepare: calibrateFieldPrepareInput({
                  topicText: pendingRef.current?.goal || "Calibration",
                  topicId: "calibration-goal",
                  questions: [],
                  calibrationToken: token,
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
            }}
          />
        }
        clock={
          <div className="flex w-full min-w-0 flex-col gap-2 px-1 py-1" data-calibration-live-clock>
            <TapLiveClock
              label="Time left"
              remainingSeconds={remainingSeconds}
              waiting={false}
              listening={false}
              placement="card"
            />
          </div>
        }
        actions={
          <button
            type="button"
            data-calibration-end-session
            onClick={() => {
              const current = soundingRef.current;
              if (!current) return;
              if (current.phase === "expert-proof") {
                const closed = finishSounding(current, false);
                soundingRef.current = closed;
                setSounding(closed);
                void storeProof(closed).catch((err) => {
                  setError(err instanceof Error ? err.message : "Could not store calibration proof");
                });
                return;
              }
              const closed = finishSounding(current, true);
              soundingRef.current = closed;
              setSounding(closed);
              if (closed.phase === "expert-proof") return;
              void storeProof(closed).catch((err) => {
                setError(err instanceof Error ? err.message : "Could not store calibration proof");
              });
            }}
            className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} w-full`}
          >
            End session
          </button>
        }
        chapters={
          <SessionTopicChapter
            id="calibration-goal"
            keyword={pendingRef.current?.goal || "Calibration"}
            image={bgImage}
          />
        }
        signals={<TapSessionSignals />}
        focus={<SessionGuidePanel guide="calibrate" />}
      />
    </CalibrationViewport>
  );
}

function CalibrationSoundingFinished({
  marker,
  classification,
  fallbackTitle,
  fallbackBody,
}: {
  marker: "data-calibration-time-up" | "data-calibration-thank-you";
  classification: SoundingClassification | null;
  fallbackTitle: string;
  fallbackBody: string;
}) {
  const presentation = soundingResultPresentation(classification);
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" {...{ [marker]: "" }}>
      <SessionFinishedScreen
        kicker={presentation?.kicker ?? FLOW_END_KICKERS.calibrate}
        title={presentation?.title ?? fallbackTitle}
        body={presentation?.body ?? fallbackBody}
        frameLabel={null}
        actions={
          <TapThoughtButton size="md" variant="primary" onClick={() => { window.location.href = "/"; }}>
            Explore Uncertain Systems
          </TapThoughtButton>
        }
      >
        <SessionSoundingResult classification={classification} />
      </SessionFinishedScreen>
    </section>
  );
}
