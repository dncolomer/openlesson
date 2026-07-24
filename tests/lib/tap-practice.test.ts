import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  TAP_PRACTICE_DURATION_MINUTES,
  TAP_PRACTICE_DURATION_SECONDS,
  TAP_PRACTICE_POW_LABEL,
  isPracticePoWMetadata,
  isTapPracticeRequest,
  resolveTapLiveDurationSeconds,
  resolveTapLiveMinutes,
  stampPoWPracticeFlag,
  withPracticePoWData,
} from "@/lib/tap-practice";
import { buildTapTranscriptPayload } from "@/lib/tap-score-traces";

const ROOT = process.cwd();

describe("tap-practice pure helpers", () => {
  it("forces practice duration to 1 minute / 60 seconds", () => {
    expect(TAP_PRACTICE_DURATION_MINUTES).toBe(1);
    expect(TAP_PRACTICE_DURATION_SECONDS).toBe(60);
    expect(resolveTapLiveMinutes({ practice: true, minutes: 30 })).toBe(1);
    expect(resolveTapLiveDurationSeconds({ practice: true, minutes: 30 })).toBe(60);
    expect(resolveTapLiveMinutes({ practice: false, minutes: 30 })).toBe(30);
  });

  it("parses practice request flags", () => {
    expect(isTapPracticeRequest(true)).toBe(true);
    expect(isTapPracticeRequest("true")).toBe(true);
    expect(isTapPracticeRequest(false)).toBe(false);
    expect(isTapPracticeRequest(undefined)).toBe(false);
  });

  it("stamps Practice PoW into payload/metadata without new schema fields", () => {
    const stamped = withPracticePoWData({ tap_session_id: "t1" });
    expect(stamped.pow_label).toBe(TAP_PRACTICE_POW_LABEL);
    expect(stamped.practice).toBe(true);
    expect(stamped.practice_pow).toBe(true);
    expect(stamped.pow_kind).toBe("practice");
    expect(isPracticePoWMetadata(stamped)).toBe(true);
    expect(stampPoWPracticeFlag({ a: 1 }, false)).toEqual({ a: 1 });
    expect(isPracticePoWMetadata(stampPoWPracticeFlag({ a: 1 }, true) as Record<string, unknown>)).toBe(
      true,
    );
  });

  it("buildTapTranscriptPayload embeds practice flags when practice=true", () => {
    const pure = buildTapTranscriptPayload({
      tapSessionId: "t1",
      workspaceId: "w1",
      transcript: [{ role: "assistant", text: "hi" }],
      durationSeconds: 60,
    });
    expect(pure.practice).toBeUndefined();

    const practice = buildTapTranscriptPayload({
      tapSessionId: "t1",
      workspaceId: "w1",
      transcript: [{ role: "assistant", text: "hi" }],
      durationSeconds: 60,
      practice: true,
    });
    expect(practice.pow_label).toBe(TAP_PRACTICE_POW_LABEL);
    expect(practice.practice).toBe(true);
  });
});

describe("TAP client practice surface (not ILE)", () => {
  it("exposes Practice First (1 minute), practice banner, done+restart, and live mechanics", () => {
    const client = fs.readFileSync(path.join(ROOT, "components/TapScoreClient.tsx"), "utf8");
    expect(client).toContain("data-tap-practice-first");
    expect(client).toContain("data-tap-practice-banner");
    expect(client).toContain("data-tap-practice-done");
    expect(client).toContain("data-tap-practice-restart");
    expect(client).toContain("practice: true");
    expect(client).toContain("TAP_PRACTICE_DURATION");
    expect(client).toContain("restartBriefingFlow");
    // Full live mechanics still present on the shared live phase
    expect(client).toContain("TAP_SILENCE_AUTO_STASH_MS");
    expect(client).toContain("data-tap-session-purity");
    expect(client).toContain("data-tap-transcript-fade");
    expect(client).toContain('setPhase("live")');
    expect(client).toContain('setPhase("practice_done")');

    const en = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/en.json"), "utf8")) as {
      tap: { practice: Record<string, string> };
    };
    expect(en.tap.practice.practiceFirst.toLowerCase()).toContain("practice first");
    expect(en.tap.practice.practiceFirst.toLowerCase()).toContain("1 minute");
    expect(en.tap.practice.doneTitle.toLowerCase()).toContain("practice session is done");
  });

  it("API write paths accept practice and stamp Practice PoW", () => {
    for (const rel of [
      "app/api/workspace-tap-score/trace/route.ts",
      "app/api/workspace-tap-score/speech/route.ts",
      "app/api/workspace-tap-score/idle/route.ts",
      "app/api/workspace-tap-score/chat/route.ts",
      "app/api/workspace-tap-score/complete/route.ts",
      "app/api/workspace-tap-score/start/route.ts",
    ]) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(src, rel).toContain("isTapPracticeRequest");
      if (rel.includes("complete") || rel.includes("trace") || rel.includes("speech") || rel.includes("idle") || rel.includes("chat")) {
        expect(src, rel).toMatch(/stampPoWPracticeFlag|flagTapSessionProofOfWorkPractice|practice/);
      }
    }
  });

  it("ILE SessionView does not gain Practice First", () => {
    const ile = fs.readFileSync(path.join(ROOT, "components/SessionView.tsx"), "utf8");
    expect(ile).not.toContain("data-tap-practice-first");
    expect(ile).not.toContain("Practice First");
    expect(ile).not.toContain("tap-practice");
  });
});
