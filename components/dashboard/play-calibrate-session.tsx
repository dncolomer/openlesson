"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { CalibrateSoundingSurface } from "@/components/calibrate/calibrate-sounding-surface";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { SessionTopicChapter } from "@/components/session-view/learn-work-dock-bar";
import { TapSessionSignals } from "@/components/session-view/session-signals";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { TapLiveClock } from "@/components/tap-score/tap-live-clock";
import { IleStartLoading } from "@/components/session-view/learn-start-loading";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import { fetchAestheticPackages } from "@/lib/aesthetics";
import { pickTapBackgroundImage } from "@/lib/tap-score-client-helpers";
import { FLOW_END_KICKERS } from "@/lib/session-stage-progress";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import { normalizeCalibrateQuestions } from "@/lib/calibrate-session";
import {
  absorbSoundingStills,
  commitSoundingTaps,
  createSoundingState,
  createSoundingTree,
  finishSounding,
  soundingStillsFromBranchModel,
  submitSoundingProof,
  type SoundingState,
} from "@/lib/calibrate-sounding";
import { inferSoundingVoiceStep } from "@/lib/calibrate-sounding-voice-client";
import {
  loadSessionBranchField,
  sessionClockMayStart,
  subscribeSessionBranchField,
} from "@/lib/session-branch-field-load";
import { calibrateFieldPrepareInput } from "@/lib/session-branch-prepare";
import { releaseSessionLocalMemory } from "@/lib/session-local-memory";
import {
  DASHBOARD_PLAY_CALIBRATE_QUESTIONS_PATH,
  isDashboardPlaySession,
} from "@/lib/dashboard-play";
import { getSession } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

const PLAY_MINUTES = 15;

function Viewport({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white"
      data-dashboard-play-session="calibrate"
    >
      {children}
    </main>
  );
}

function Finished({ marker }: { marker: string }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-play-calibrate-done={marker}>
      <SessionFinishedScreen
        kicker={FLOW_END_KICKERS.calibrate}
        title="Thank you"
        frameLabel={null}
        actions={
          <TapThoughtButton
            size="md"
            variant="primary"
            data-tap-explore-uncertain-systems
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Explore Uncertain Systems
          </TapThoughtButton>
        }
      />
    </section>
  );
}

export function PlayCalibrateSession({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [voiceReady, setVoiceReady] = useState(false);
  const [fieldHold, setFieldHold] = useState<null | "preparing" | "failed">(null);
  const [fieldError, setFieldError] = useState("");
  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [sounding, setSounding] = useState<SoundingState | null>(null);
  const soundingRef = useRef<SoundingState | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [done, setDone] = useState(false);
  const [bgImage, setBgImage] = useState("");
  const questionsRef = useRef<{ id: string; text: string }[]>([]);

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
    let cancelled = false;
    void getSession(sessionId).then((session) => {
      if (cancelled) return;
      if (!session || !isDashboardPlaySession(session.metadata)) {
        setError("This play session is not available.");
        return;
      }
      setPrompt(String(session.problem || "").trim() || "This topic");
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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

  const startField = useCallback(async () => {
    const topic = prompt || "This topic";
    setFieldHold("preparing");
    setFieldError("");
    setError("");
    try {
      const response = await fetch(DASHBOARD_PLAY_CALIBRATE_QUESTIONS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, prompt: topic }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessageFromBody(payload, "Could not load questions"));
      const questions = normalizeCalibrateQuestions(payload.questions);
      if (questions.length === 0) throw new Error("Could not load questions");
      questionsRef.current = questions;
      const field = await loadSessionBranchField(
        calibrateFieldPrepareInput({
          topicText: topic,
          topicId: "play-calibrate",
          questions,
          sessionId,
        }),
      );
      if (!sessionClockMayStart({ mode: "calibrate", fieldReady: field.ok })) {
        setFieldError(field.ok ? "The field could not be prepared." : field.error);
        setFieldHold("failed");
        return;
      }
      const tree = createSoundingTree({
        model: field.ok ? field.model : null,
        questions,
      });
      const opened = createSoundingState(tree, sessionId, field.ok ? field.model : null);
      if (!opened.current) {
        setFieldError("The sounding could not be prepared.");
        setFieldHold("failed");
        return;
      }
      setFieldKey(field.key);
      setRemainingSeconds(PLAY_MINUTES * 60);
      setStartedAt(Date.now());
      setTimeUp(false);
      setSounding(opened);
      soundingRef.current = opened;
      setFieldHold(null);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not start calibration");
      setFieldHold("failed");
    }
  }, [prompt, sessionId]);

  useEffect(() => {
    if (!startedAt || done || timeUp) return;
    const total = PLAY_MINUTES * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0) setTimeUp(true);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [done, startedAt, timeUp]);

  useEffect(() => {
    if (!timeUp || done) return;
    const live = soundingRef.current;
    if (!live) return;
    const closed = finishSounding(live, false);
    soundingRef.current = closed;
    setSounding(closed);
    setDone(true);
  }, [done, timeUp]);

  useEffect(() => {
    if (done || !sounding || sounding.phase !== "complete") return;
    setDone(true);
  }, [done, sounding]);

  if (error && !prompt) {
    return (
      <Viewport>
        <p className="m-auto text-sm text-neutral-400">{error}</p>
      </Viewport>
    );
  }

  if (fieldHold && !sounding) {
    return (
      <Viewport>
        <SessionPageLoading data-play-calibrate-field="">
          <IleStartLoading
            t={t}
            fieldStatus={fieldHold === "failed" ? "failed" : "preparing"}
            fieldError={fieldError}
          />
          {fieldHold === "failed" ? (
            <button
              type="button"
              onClick={() => void startField()}
              className="mt-6 border border-white/40 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-white"
            >
              Try again
            </button>
          ) : null}
        </SessionPageLoading>
      </Viewport>
    );
  }

  if (!voiceReady) {
    return (
      <Viewport>
        <section className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0b0b0b] px-6">
          <div className="w-full max-w-xl">
            <PracticeVoiceChallenge
              variant="prepare"
              onPass={() => {
                setVoiceReady(true);
                void startField();
              }}
            />
            {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
          </div>
        </section>
      </Viewport>
    );
  }

  if (done) {
    return (
      <Viewport>
        <Finished marker={timeUp ? "time-up" : "thank-you"} />
      </Viewport>
    );
  }

  if (!sounding) {
    return (
      <Viewport>
        <SessionPageLoading>
          <IleStartLoading t={t} fieldStatus="preparing" fieldError="" />
        </SessionPageLoading>
      </Viewport>
    );
  }

  return (
    <Viewport>
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
                  topicText: prompt || "This topic",
                  topicId: "play-calibrate",
                  questions: questionsRef.current,
                  sessionId,
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
          <div className="flex w-full min-w-0 flex-col gap-2 px-1 py-1">
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
            onClick={() => {
              const current = soundingRef.current;
              if (!current) return;
              const closed = finishSounding(current, current.phase === "expert-proof" ? false : true);
              soundingRef.current = closed;
              setSounding(closed);
              if (closed.phase === "expert-proof") return;
              setDone(true);
            }}
            className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} w-full`}
          >
            End session
          </button>
        }
        chapters={
          <SessionTopicChapter id="play-calibrate" keyword={prompt || "Calibration"} image={bgImage} />
        }
        signals={<TapSessionSignals />}
        focus={<SessionGuidePanel guide="calibrate" />}
      />
    </Viewport>
  );
}
