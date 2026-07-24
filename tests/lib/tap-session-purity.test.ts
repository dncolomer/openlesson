import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  TAP_SESSION_PURITY_MAX,
  TAP_SILENCE_AUTO_STASH_MS,
  isSessionPurityDepleted,
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
  it("uses a 5s silence threshold and starts purity at 3", () => {
    expect(TAP_SILENCE_AUTO_STASH_MS).toBe(5_000);
    expect(TAP_SESSION_PURITY_MAX).toBe(3);
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
    const client = fs.readFileSync(path.join(ROOT, "components/TapScoreClient.tsx"), "utf8");
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
    const en = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/en.json"), "utf8")) as {
      tap: { postSession: { impureTitle: string; impureBody: string } };
    };
    expect(en.tap.postSession.impureTitle).toBe("Session Invalidated");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("session purity");
    expect(en.tap.postSession.impureBody.toLowerCase()).toContain("auto-stash");
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
    const ile = fs.readFileSync(path.join(ROOT, "components/SessionView.tsx"), "utf8");
    expect(ile).not.toContain("tap-session-purity");
    expect(ile).not.toContain("auto_stash");
    expect(ile).not.toContain("TAP_SILENCE_AUTO_STASH_MS");
  });
});
