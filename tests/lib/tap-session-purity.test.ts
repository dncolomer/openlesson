import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
import fs from "fs";
import path from "path";
import {
  TAP_PURITY_GRACE_MS,
  TAP_SESSION_PURITY_MAX,
  TAP_SILENCE_AUTO_STASH_MS,
  isSessionPurityDepleted,
  isWithinTapPurityGrace,
  nextSessionPurityAfterAutoStash,
  shouldAutoStashOnSilence,
  shouldEvaluateSessionPurity,
  shouldFadeLiveBar,
  shouldPenalizeEmptyBarSilence,
  stampPoWQuality,
  transcriptFadeOpacity,
  withImpurePoWData,
} from "@/lib/tap-session-purity";
import {
  advanceTapLiveClockPause,
  tapLiveClockRemainingSeconds,
} from "@/lib/tap-score-client-helpers";
import { buildTapTranscriptPayload } from "@/lib/tap-score-traces";

const ROOT = process.cwd();

describe("tap-session-purity helpers", () => {
  it("uses a 5s silence threshold, starts purity at 3, and has a live-entry grace", () => {
    expect(TAP_SILENCE_AUTO_STASH_MS).toBe(5_000);
    expect(TAP_SESSION_PURITY_MAX).toBe(3);
    expect(TAP_PURITY_GRACE_MS).toBe(3_000);
  });

  it("isWithinTapPurityGrace freezes purity until grace elapses after live entry", () => {
    const entered = 1_000_000;
    expect(isWithinTapPurityGrace(entered, entered)).toBe(true);
    expect(isWithinTapPurityGrace(entered, entered + 2_999)).toBe(true);
    expect(isWithinTapPurityGrace(entered, entered + 3_000)).toBe(false);
    expect(isWithinTapPurityGrace(null, entered)).toBe(true);
    expect(isWithinTapPurityGrace(undefined, entered)).toBe(true);
  });

  it("fades transcript opacity over the silence window", () => {
    expect(transcriptFadeOpacity(0)).toBe(1);
    expect(transcriptFadeOpacity(2_500)).toBeCloseTo(0.54, 2);
    expect(transcriptFadeOpacity(5_000)).toBeCloseTo(0.08, 2);
    expect(transcriptFadeOpacity(10_000)).toBe(0.08);
  });

  it("auto-stashes only when there is transcript and silence reaches threshold", () => {
    expect(shouldAutoStashOnSilence(4_999, true)).toBe(false);
    expect(shouldAutoStashOnSilence(5_000, true)).toBe(true);
    expect(shouldAutoStashOnSilence(5_000, false)).toBe(false);
  });

  it("disables purity evaluation while waiting for Helios; allows when idle", () => {
    expect(shouldEvaluateSessionPurity({ waitingForHelios: true })).toBe(false);
    expect(shouldEvaluateSessionPurity({ waitingForHelios: false })).toBe(true);
    expect(shouldEvaluateSessionPurity({ canvasLoading: true })).toBe(false);
    expect(shouldEvaluateSessionPurity({ waitingForXaiReply: true })).toBe(false);
    expect(shouldEvaluateSessionPurity({ imDoneAnsweringBusy: true })).toBe(false);
    expect(shouldEvaluateSessionPurity({
      waitingForHelios: false,
      canvasLoading: false,
      waitingForXaiReply: false,
      imDoneAnsweringBusy: false,
    })).toBe(true);
    // Helpers themselves are unchanged for non-waiting inputs.
    expect(shouldAutoStashOnSilence(5_000, true)).toBe(true);
    expect(shouldPenalizeEmptyBarSilence(5_000, false)).toBe(true);
  });

  it("penalizes empty-bar silence (Listening… after stash/submit) at the same threshold", () => {
    expect(shouldPenalizeEmptyBarSilence(4_999, false)).toBe(false);
    expect(shouldPenalizeEmptyBarSilence(5_000, false)).toBe(true);
    expect(shouldPenalizeEmptyBarSilence(5_000, true)).toBe(false);
    expect(shouldFadeLiveBar(0)).toBe(false);
    expect(shouldFadeLiveBar(1)).toBe(true);
  });

  it("decrements purity and detects depletion", () => {
    expect(nextSessionPurityAfterAutoStash(3)).toBe(2);
    expect(nextSessionPurityAfterAutoStash(1)).toBe(0);
    expect(nextSessionPurityAfterAutoStash(0)).toBe(0);
    expect(isSessionPurityDepleted(0)).toBe(true);
    expect(isSessionPurityDepleted(1)).toBe(false);
  });

  it("embeds impure flags in PoW data objects (no DB column)", () => {
    const stamped = withImpurePoWData({ tap_session_id: "t1", text: "hello" });
    expect(stamped).toMatchObject({
      tap_session_id: "t1",
      text: "hello",
      quality: "impure",
      impure: true,
      session_quality: "impure",
    });
    expect(stampPoWQuality({ a: 1 }, "pure")).toEqual({ a: 1 });
    const impureStamp = stampPoWQuality({ a: 1 }, "impure");
    expect("impure" in impureStamp && impureStamp.impure).toBe(true);
  });

  it("buildTapTranscriptPayload embeds impure quality when requested", () => {
    const pure = buildTapTranscriptPayload({
      tapSessionId: "t1",
      workspaceId: "w1",
      transcript: [{ role: "assistant", text: "hi" }],
      durationSeconds: 10,
    });
    expect(pure.impure).toBeUndefined();

    const impure = buildTapTranscriptPayload({
      tapSessionId: "t1",
      workspaceId: "w1",
      transcript: [{ role: "assistant", text: "hi" }],
      durationSeconds: 10,
      sessionQuality: "impure",
    });
    expect(impure).toMatchObject({
      quality: "impure",
      impure: true,
      session_quality: "impure",
    });
  });
});

describe("TAP client wires purity UX", () => {
  it("TapScoreClient implements silence auto_stash and impure retry without HUD fade/dots", () => {
    const client = readTapScoreSurface();
    expect(client).toContain("TAP_SILENCE_AUTO_STASH_MS");
    expect(client).not.toContain("data-tap-session-purity");
    expect(client).not.toContain("data-tap-transcript-fade");
    expect(client).not.toContain("shouldFadeLiveBar");
    expect(client).not.toContain("transcriptFadeOpacity(");
    expect(client).not.toContain("<AutoStashContextBar");
    expect(client).toContain("data-tap-session-impure");
    expect(client).toContain('auto_stash');
    expect(client).toContain("sessionQuality");
    expect(client).toContain("window.location.reload()");
    expect(client).toContain("tap.postSession.impureBody");
    // Purity silence ticks skip while Helios is answering (isSending).
    expect(client).toContain("shouldEvaluateSessionPurity");
    expect(client).toContain("isSendingRef");
    expect(client).toContain("waitingForHelios: isSendingRef.current");
    expect(client).toContain("canvasLoading: canvasLoadingRef.current");
    expect(client).toContain("waitingForXaiReply: xaiReplyWaitRef.current");
    expect(client).toContain("imDoneAnsweringBusy: imDoneBusyRef.current");
    expect(client).toContain("onLearnerWaitChange");
    expect(client).toContain("onImDoneBusyChange");
    const canvas = fs.readFileSync(path.join(ROOT, "components/ExcalidrawCanvas.tsx"), "utf8");
    expect(canvas).toContain("canvasApiReady");
    expect(canvas).toContain("canvasLoading: !canvasApiReady");
    expect(canvas).toContain("waitingForXaiReply: askInFlight > 0 || heliosBusy");
    const imDone = fs.readFileSync(
      path.join(ROOT, "components/thought-ui/ImDoneAnsweringButton.tsx"),
      "utf8",
    );
    expect(imDone).toContain("onBusyChange");
    expect(imDone).toContain("onBusyChange?.(true)");
    expect(client).toContain("shouldAutoStashOnSilence");
    expect(client).toContain("shouldPenalizeEmptyBarSilence");
    // Live-entry grace so briefing elapsed time / UI settle does not burn purity.
    expect(client).toContain("isWithinTapPurityGrace");
    expect(client).toContain("liveEnteredAt");
    const en = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/en.json"), "utf8")) as {
      tap: { postSession: { impureTitle: string; impureBody: string; impureTryAgain: string } };
    };
    expect(en.tap.postSession.impureTitle).toBe("Session Invalidated");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("silent for too long");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("think out loud");
    expect(en.tap.postSession.impureBody.toLowerCase()).not.toContain("practice run");
    expect(en.tap.postSession.impureBody.toLowerCase()).not.toContain("no limit");
    expect(en.tap.postSession.impureTryAgain).toBe("Try again");
    // Dedicated impure results branch (not generic thank-you)
    expect(client).toContain("sessionEndedImpure");
    expect(client).toContain("data-tap-session-impure");
    expect(client).toContain("data-tap-impure-retry");
    // Practice purity-close uses the same invalidated copy, not practice-done.
    expect(client).toContain('phase === "practice_done" && !sessionEndedImpure');
    expect(client).toContain('(phase === "results" || phase === "practice_done") && sessionEndedImpure');
  });

  it("Exercise TAP shows the same Session Invalidated screen on purity close", () => {
    expect(existsSync(join(ROOT, "components/ExerciseTapClient.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/exercise-tap"))).toBe(false);

    // Practice purity-close uses the same invalidated copy, not practice-done.
  });

  it("trace route accepts auto_stash and complete flags session PoW impure", () => {
    const trace = fs.readFileSync(
      path.join(ROOT, "app/api/workspace-tap-score/trace/route.ts"),
      "utf8",
    );
    const complete = fs.readFileSync(
      path.join(ROOT, "app/api/workspace-tap-score/complete/route.ts"),
      "utf8",
    );
    expect(trace).toContain("auto_stash");
    expect(complete).toContain("flagTapSessionProofOfWorkImpure");
    expect(complete).toContain('sessionQuality === "impure"');
  });

  it("Learn SessionView uses the same session purity auto-stash and impure close", () => {
    const ile = readSessionViewSurface();
    expect(ile).toContain("tap-session-purity");
    expect(ile).toContain("TAP_SILENCE_AUTO_STASH_MS");
    expect(ile).toContain("useIleSessionPurity");
    expect(ile).toContain("shouldAutoStashOnSilence");
    expect(ile).toContain("shouldPenalizeEmptyBarSilence");
    expect(ile).toContain("shouldEvaluateSessionPurity");
    expect(ile).toContain("isWithinTapPurityGrace");
    expect(ile).toContain("waitingForHelios: isSendingRef.current");
    expect(ile).toContain("canvasLoading: canvasLoadingRef.current");
    expect(ile).toContain("waitingForXaiReply: xaiReplyWaitRef.current");
    expect(ile).toContain('stashRef.current({ auto: true })');
    expect(ile).toContain("applyPurityHit");
    expect(ile).toContain("data-ile-session-impure");
    expect(ile).toContain("data-ile-impure-retry");
    expect(ile).toContain("window.location.reload()");
    expect(ile).toContain("tap.postSession.impureTitle");
    expect(ile).toContain("{ impure: true }");
    expect(ile).not.toContain("data-ile-silence-lock-minutes");
    expect(ile).not.toContain("IleSilenceRestScreen");
    expect(ile).not.toContain("useIleSilenceLock");
    const phase = fs.readFileSync(
      path.join(ROOT, "components/session-view/use-session-phase.ts"),
      "utf8",
    );
    expect(phase).toContain("flagIleSessionProofOfWorkImpure");
    expect(phase).toContain("withImpurePoWData");
    expect(phase).toContain("stayOnScreen: impure");
    const impureRoute = fs.readFileSync(
      path.join(ROOT, "app/api/workspace/proof-of-work/impure/route.ts"),
      "utf8",
    );
    expect(impureRoute).toContain("flagIleSessionProofOfWorkImpure");
    expect(impureRoute).toContain("requireSessionWorkspaceProofOfWorkAccess");
  });

  it("Learn purity is off on a development loopback host and stays on in production and Verify", () => {
    const hook = fs.readFileSync(
      path.join(ROOT, "components/session-view/use-learn-session-purity.ts"),
      "utf8",
    );
    expect(hook).toContain("practiceVoiceChallengeLocalSkipAllowed");
    expect(hook).toContain("process.env.NODE_ENV");
    expect(hook).toContain("window.location.hostname");
    expect(hook).toContain("localSkip");
    const tickGuard = hook.indexOf("if (!input.armed || sessionEndedImpure || localSkip)");
    const tickEval = hook.indexOf("shouldEvaluateSessionPurity({");
    expect(tickGuard).toBeGreaterThan(-1);
    expect(tickEval).toBeGreaterThan(tickGuard);
    const tap = fs.readFileSync(
      path.join(ROOT, "components/TapScoreClient.tsx"),
      "utf8",
    );
    expect(tap).not.toContain("practiceVoiceChallengeLocalSkipAllowed");
    expect(tap).not.toContain("learnPurityDisabledOnLocalhost");
  });
});

describe("TAP live clock", () => {
  it("freezes while waiting for an answer and resumes without skipping that wait", () => {
    const started = 1_000_000;
    expect(
      tapLiveClockRemainingSeconds({
        nowMs: started + 5_000,
        startedAtMs: started,
        durationSeconds: 60,
      }),
    ).toBe(55);

    const opened = advanceTapLiveClockPause({
      waiting: true,
      nowMs: started + 5_000,
      pauseStartedAtMs: null,
      pausedMs: 0,
    });
    expect(opened).toEqual({ pauseStartedAtMs: started + 5_000, pausedMs: 0 });
    expect(
      tapLiveClockRemainingSeconds({
        nowMs: started + 8_000,
        startedAtMs: started,
        durationSeconds: 60,
        pausedMs: opened.pausedMs,
        pauseStartedAtMs: opened.pauseStartedAtMs,
      }),
    ).toBe(55);
    const stillOpen = advanceTapLiveClockPause({
      waiting: true,
      nowMs: started + 8_000,
      pauseStartedAtMs: opened.pauseStartedAtMs,
      pausedMs: opened.pausedMs,
    });
    expect(stillOpen.pauseStartedAtMs).toBe(started + 5_000);

    const closed = advanceTapLiveClockPause({
      waiting: false,
      nowMs: started + 8_000,
      pauseStartedAtMs: stillOpen.pauseStartedAtMs,
      pausedMs: stillOpen.pausedMs,
    });
    expect(closed).toEqual({ pauseStartedAtMs: null, pausedMs: 3_000 });
    expect(
      tapLiveClockRemainingSeconds({
        nowMs: started + 10_000,
        startedAtMs: started,
        durationSeconds: 60,
        pausedMs: closed.pausedMs,
        pauseStartedAtMs: null,
      }),
    ).toBe(53);
  });

  it("shows a pause icon while waiting and a pulsing red dot while the mic is listening", () => {
    const client = readTapScoreSurface();
    expect(existsSync(join(ROOT, "components/ExerciseTapClient.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/exercise-tap"))).toBe(false);

    expect(client).toContain("advanceTapLiveClockPause");
    expect(client).toContain("tapLiveClockRemainingSeconds");
    expect(client).toContain("syncLiveClock(isSending || xaiReplyWaitRef.current)");
    expect(client).toContain("syncLiveClock(isSendingRef.current || wait.waitingForXaiReply)");
    expect(client).toContain("clockPaused={clockWaiting || isSending}");
    expect(client).toContain("data-tap-clock-paused");
    expect(client).toContain("data-tap-clock-listening-dot");
    expect(client).toContain("animate-ping");
    expect(client).toContain("bg-red-500");
    expect(client).toContain('aria-label="Paused"');
    expect(client).toContain('aria-label="Listening"');
    expect(client).toContain("listening && !waiting");
  });
});
