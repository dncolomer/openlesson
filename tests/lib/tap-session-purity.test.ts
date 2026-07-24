import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  TAP_SESSION_PURITY_MAX,
  TAP_SILENCE_AUTO_STASH_MS,
  isSessionPurityDepleted,
  nextSessionPurityAfterAutoStash,
  shouldAutoStashOnSilence,
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
