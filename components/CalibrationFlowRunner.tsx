"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TapLiveClock } from "@/components/tap-score/tap-live-clock";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import { CalibrateLiveSurface } from "@/components/calibrate/calibrate-live-surface";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import {
  beginCalibrationSession,
  calibrationProofMetadata,
} from "@/lib/calibration-flow";
import {
  calibrateRegionCounts,
  canFinishClassifying,
  canFinishComfortableAnswer,
  canFinishUncertainty,
  finishClassifying,
  finishComfortableAnswer,
  finishUncertainty,
  readCalibratePlacements,
  readCalibrateResponseTexts,
  seedCalibrateWorkCanvas,
  syncCalibratePlacements,
  type CalibrateState,
} from "@/lib/calibrate-session";
import { emptyTapWorkCanvasScene } from "@/lib/tap-work-canvas";
import type { IleWorkCanvasElement, IleWorkCanvasScene } from "@/lib/ile-work-canvas";

/** Full-viewport column so loading and the thank-you center like the other modes. */
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
  const [goal, setGoal] = useState("");
  const [identity, setIdentity] = useState("");
  const [claimedIdentity, setClaimedIdentity] = useState("");
  const [calibrate, setCalibrate] = useState<CalibrateState | null>(null);
  const calibrateRef = useRef<CalibrateState | null>(null);
  const [scene, setScene] = useState<IleWorkCanvasScene>(() => emptyTapWorkCanvasScene());
  const sceneRef = useRef<IleWorkCanvasScene | null>(scene);
  const [applyElements, setApplyElements] = useState<IleWorkCanvasElement[]>([]);
  const [applyNonce, setApplyNonce] = useState(0);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [stored, setStored] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const storedRef = useRef(false);

  useEffect(() => {
    calibrateRef.current = calibrate;
  }, [calibrate]);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

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
      const seeded = seedCalibrateWorkCanvas(started.session.pool);
      const claimed = String(payload.identity || identity.trim());
      const minutes = flowCountdownMinutes(payload.durationMinutes);
      setDurationMinutes(minutes);
      setRemainingSeconds(minutes * 60);
      setStartedAt(Date.now());
      setTimeUp(false);
      setClaimedIdentity(claimed);
      setGoal(String(payload.goal || ""));
      setCalibrate(started.session);
      calibrateRef.current = started.session;
      setScene(seeded.scene);
      sceneRef.current = seeded.scene;
      setApplyElements(seeded.scene.elements);
      setApplyNonce(1);
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

  const storeProof = useCallback(async (state: CalibrateState) => {
    if (storedRef.current) return;
    storedRef.current = true;
    const response = await fetch(`/api/calibration-flow/public/${encodeURIComponent(token)}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: claimedIdentity,
        events: state.events,
        metadata: calibrationProofMetadata(state),
      }),
    });
    if (!response.ok) {
      storedRef.current = false;
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error?.message || "Could not store calibration proof");
    }
    setStored(true);
  }, [claimedIdentity, token]);

  const onSceneChange = useCallback((nextScene: IleWorkCanvasScene) => {
    sceneRef.current = nextScene;
    setScene(nextScene);
    setCalibrate((prev) => {
      if (!prev) return prev;
      const next = syncCalibratePlacements(prev, readCalibratePlacements(nextScene));
      calibrateRef.current = next;
      return next;
    });
  }, []);

  const onAdvance = useCallback(() => {
    const current = calibrateRef.current;
    const live = sceneRef.current;
    if (!current || !live) return;
    const synced = syncCalibratePlacements(current, readCalibratePlacements(live));
    const texts = readCalibrateResponseTexts(live, synced);
    const advanced =
      synced.phase === "classifying"
        ? finishClassifying(synced)
        : synced.phase === "answer"
          ? finishComfortableAnswer(synced, texts)
          : synced.phase === "explain"
            ? finishUncertainty(synced, texts)
            : { ok: false as const, reason: "wrong_phase", state: synced };
    if (!advanced.ok) {
      setError("Finish this step on the canvas before continuing.");
      return;
    }
    setError("");
    calibrateRef.current = advanced.state;
    setCalibrate(advanced.state);
    if (advanced.state.phase === "complete") {
      void storeProof(advanced.state).catch((err) => {
        setError(err instanceof Error ? err.message : "Could not store calibration proof");
      });
    }
  }, [storeProof]);

  if (!calibrate) {
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
  if (timeUp && !stored) {
    return (
      <CalibrationViewport>
        <SessionFinishedScreen
          data-calibration-time-up=""
          title="Time is up"
          body="The countdown for this calibration flow has ended."
          actions={
            <TapThoughtButton size="md" variant="primary" onClick={() => { window.location.href = "/"; }}>
              Explore Uncertain Systems
            </TapThoughtButton>
          }
        />
      </CalibrationViewport>
    );
  }
  if (stored) {
    return (
      <CalibrationViewport>
        <SessionFinishedScreen
          data-calibration-thank-you=""
          title="Thank you"
          body="Your calibration proof of work has been stored."
          actions={
            <TapThoughtButton size="md" variant="primary" onClick={() => { window.location.href = "/"; }}>
              Explore Uncertain Systems
            </TapThoughtButton>
          }
        />
      </CalibrationViewport>
    );
  }

  const counts = calibrateRegionCounts(calibrate);
  const texts = readCalibrateResponseTexts(scene, calibrate);
  const canAdvance =
    calibrate.phase === "classifying"
      ? canFinishClassifying(calibrate)
      : calibrate.phase === "answer"
        ? canFinishComfortableAnswer(calibrate, texts)
        : canFinishUncertainty(calibrate, texts);

  return (
    <CalibrationViewport>
      <CalibrateLiveSurface
        boardId={token}
        phase={calibrate.phase}
        poolLoading={false}
        comfortableCount={counts.comfortable}
        unconfidentCount={counts.unconfident}
        canAdvance={canAdvance}
        readOnly={timeUp}
        scene={scene}
        sceneRef={sceneRef}
        applyElements={applyElements}
        applyNonce={applyNonce}
        onSceneChange={onSceneChange}
        onCanvasPowActions={() => {}}
        onAdvance={onAdvance}
        error={error}
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
        actions={null}
        topicId="calibration-goal"
        topicText={goal || "Calibration"}
        focusLabel="Calibrate"
      />
    </CalibrationViewport>
  );
}
