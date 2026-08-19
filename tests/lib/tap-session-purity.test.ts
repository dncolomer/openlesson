import { describe, expect, it } from "vitest";
import { readExerciseTapSurface, readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
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

describe("TAP client wires purity UX (not ILE)", () => {
  it("TapScoreClient implements silence fade, purity UI, auto_stash, and impure retry", () => {
    const client = readTapScoreSurface();
    expect(client).toContain("TAP_SILENCE_AUTO_STASH_MS");
    expect(client).toContain("data-tap-session-purity");
    expect(client).toContain("data-tap-transcript-fade");
    expect(client).toContain("data-tap-session-impure");
    expect(client).toContain('auto_stash');
    expect(client).toContain("sessionQuality");
    expect(client).toContain("window.location.reload()");
    expect(client).toContain("tap.postSession.impureBody");
    // Purity silence ticks skip while Helios is answering (isSending).
    expect(client).toContain("shouldEvaluateSessionPurity");
    expect(client).toContain("isSendingRef");
    expect(client).toContain("waitingForHelios: isSendingRef.current");
    expect(client).toContain("shouldAutoStashOnSilence");
    expect(client).toContain("shouldPenalizeEmptyBarSilence");
    // Live-entry grace so briefing elapsed time / UI settle does not burn purity.
    expect(client).toContain("isWithinTapPurityGrace");
    expect(client).toContain("liveEnteredAt");
    const en = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/en.json"), "utf8")) as {
      tap: { postSession: { impureTitle: string; impureBody: string; impureTryAgain: string } };
    };
    expect(en.tap.postSession.impureTitle).toBe("Session Invalidated");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("session purity");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("auto-stash");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("why:");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("how to fix");
    expect(en.tap.postSession.impureTryAgain).toBe("Try again");
    // Dedicated impure results branch (not generic thank-you)
    expect(client).toContain("sessionEndedImpure");
    expect(client).toContain("data-tap-session-impure");
    expect(client).toContain("data-tap-impure-retry");
  });

  it("Exercise TAP shows the same Session Invalidated screen on purity close", () => {
    const exercise = readExerciseTapSurface();
    expect(exercise).toContain("sessionEndedImpure");
    expect(exercise).toContain("data-tap-session-impure");
    expect(exercise).toContain("tap.postSession.impureTitle");
    expect(exercise).toContain("tap.postSession.impureBody");
    expect(exercise).toContain("tap.postSession.impureTryAgain");
    expect(exercise).toContain("data-tap-impure-retry");
    expect(exercise).toContain("setSessionEndedImpure(impure)");
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

  it("ILE SessionView does not import session purity auto-stash", () => {
    const ile = readSessionViewSurface();
    expect(ile).not.toContain("tap-session-purity");
    expect(ile).not.toContain("TAP_SILENCE_AUTO_STASH_MS");
  });
});
