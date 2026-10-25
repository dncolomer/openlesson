import { describe, expect, it } from "vitest";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
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
import { buildTapPracticeOpeningQuestionFallback } from "@/lib/tap-score";
import {
  buildTapPracticeOpeningQuestionTask,
  buildTapSelectiveThoughtSystemPrompt,
  TAP_PRACTICE_THOUGHT_OVERLAY,
} from "@/lib/prompt-kernel/surfaces/tap";

const ROOT = process.cwd();

describe("tap-practice pure helpers", () => {
  it("forces practice duration to 5 minutes / 300 seconds", () => {
    expect(TAP_PRACTICE_DURATION_MINUTES).toBe(5);
    expect(TAP_PRACTICE_DURATION_SECONDS).toBe(300);
    expect(resolveTapLiveMinutes({ practice: true, minutes: 30 })).toBe(5);
    expect(resolveTapLiveDurationSeconds({ practice: true, minutes: 30 })).toBe(300);
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

  it("practice + impure still keeps Practice PoW flags (early stop or invalidated)", () => {
    const both = buildTapTranscriptPayload({
      tapSessionId: "t1",
      workspaceId: "w1",
      transcript: [{ role: "assistant", text: "hi" }],
      durationSeconds: 12,
      practice: true,
      sessionQuality: "impure",
    });
    expect(both.practice).toBe(true);
    expect(both.pow_label).toBe(TAP_PRACTICE_POW_LABEL);
    expect(both.impure).toBe(true);
    expect(both.session_quality).toBe("impure");
    expect(isPracticePoWMetadata(both as unknown as Record<string, unknown>)).toBe(true);

    // Complete path stamps practice after impure so practice flags survive.
    const complete = fs.readFileSync(
      path.join(ROOT, "app/api/workspace-tap-score/complete/route.ts"),
      "utf8",
    );
    expect(complete).toContain("flagTapSessionProofOfWorkPractice");
    expect(complete).toContain("flagTapSessionProofOfWorkImpure");
    expect(complete).toContain("complete_practice_impure");
    const impureIdx = complete.indexOf("flagTapSessionProofOfWorkImpure");
    const practiceIdx = complete.indexOf("flagTapSessionProofOfWorkPractice");
    expect(practiceIdx).toBeGreaterThan(impureIdx);
  });
});

describe("TAP client practice surface (not TAP Learning)", () => {
  it("does not expose Practice First on Verify briefing, live, or done screens", () => {
    const client = readTapScoreSurface();
    const cards = fs.readFileSync(path.join(ROOT, "components/TapStartingTopicCards.tsx"), "utf8");
    expect(cards).not.toContain("data-tap-practice-first");
    expect(cards).not.toContain("PracticeFirstCard");
    expect(cards).not.toContain("onPracticeFirst");
    expect(cards).toContain('data-tap-topic-grid="topics"');
    expect(client).not.toContain("onPracticeFirst");
    expect(client).not.toContain("choosePractice");
    expect(client).not.toContain("data-tap-practice-pill");
    expect(client).not.toContain("data-tap-practice-done");
    expect(client).not.toContain("data-tap-practice-restart");
    expect(client).not.toContain("TapPracticePill");
    expect(client).not.toMatch(/phase:\s*"practice_done"|setPhase\("practice_done"\)/);
    expect(client).toContain("TAP_SILENCE_AUTO_STASH_MS");
    expect(client).not.toContain("data-tap-session-purity");
    expect(client).not.toContain("data-tap-transcript-fade");
    expect(client).toMatch(/phase:\s*"live"|setPhase\("live"\)/);
    expect(client).toContain("sessionQuality: impure ? \"impure\" : \"pure\"");
  });

  it("keeps Start label width stable while loading (no card reflow)", () => {
    const cards = fs.readFileSync(path.join(ROOT, "components/TapStartingTopicCards.tsx"), "utf8");
    expect(cards).toContain("data-stable-start-label");
    expect(cards).toContain("StableStartButtonLabel");
    expect(cards).toMatch(/inline-grid place-items-center/);
    expect(cards).not.toMatch(
      /<span>\{\s*isThisStarting\s*\?\s*startingLabel\s*:\s*startLabel\s*\}<\/span>/,
    );
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

  it("TAP Learning SessionView does not gain Practice First", () => {
    const ile = readSessionViewSurface();
    expect(ile).not.toContain("data-tap-practice-first");
    expect(ile).not.toContain("Practice First");
    expect(ile).not.toContain("tap-practice");
  });

  it("keeps the live control strip without a practice pill — stash/submit box stays neutral", () => {
    const client = readTapScoreSurface();
    expect(client).not.toContain("data-tap-practice-pill");
    expect(client).not.toContain("data-tap-practice-banner");
    expect(client).not.toContain("SessionIdentityBadge");
    expect(client).not.toContain("TapPracticePill");
    expect(client).toContain('data-tap-live-control-strip');
    expect(client).not.toMatch(/isPracticeMode\s*\?\s*[\s\S]*border-cyan-400\/30 bg-cyan-950\/40/);
    expect(client).toContain('data-tap-aesthetic-section={kind}');
    expect(client).toContain('kind="shortcuts"');
    expect(client).not.toContain('kind="convo-stash"');
    expect(client).not.toContain('kind="thought-memory"');
    expect(client).not.toMatch(/fixed inset-0 z-0 bg-cover/);
  });

  it("practice conversation prompts stay on-topic but easier", () => {
    const task = buildTapPracticeOpeningQuestionTask();
    expect(task.toLowerCase()).toMatch(/practice|simple|easy|introductory/);
    expect(task.toLowerCase()).toMatch(/workspace|block|topic|domain/);
    expect(TAP_PRACTICE_THOUGHT_OVERLAY.toLowerCase()).toContain("practice mode");
    expect(TAP_PRACTICE_THOUGHT_OVERLAY.toLowerCase()).toMatch(/easy|simple/);

    const practicePrompt = buildTapSelectiveThoughtSystemPrompt("ctx", { practice: true });
    const scoredPrompt = buildTapSelectiveThoughtSystemPrompt("ctx", { practice: false });
    expect(practicePrompt).toContain(TAP_PRACTICE_THOUGHT_OVERLAY);
    expect(scoredPrompt).not.toContain(TAP_PRACTICE_THOUGHT_OVERLAY);

    const fallback = buildTapPracticeOpeningQuestionFallback({
      plan: { id: "p1", title: "Orbital Mechanics", root_topic: "orbits" },
      nodes: [{ id: "n1", title: "Kepler's laws", description: null, status: null }],
      sessions: [],
    });
    // Offline practice warm-up: generic, no block-title shell (prefer raw xAI)
    expect(fallback).not.toContain("Kepler's laws");
    expect(fallback).not.toContain("Orbital Mechanics");
    expect(fallback.toLowerCase()).toMatch(/simple|basic/);
    expect(fallback).not.toMatch(/attachments\s*:|on this setup|Given parameters/i);
  });
});
