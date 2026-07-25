import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  AUTO_STASH_CONTEXT_LABEL,
  THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  contextAutoStashAffectsPurity,
  shouldAutoStashOnContextFull,
  thoughtContextBarTone,
  thoughtContextBarToneClass,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";

const ROOT = process.cwd();

describe("thought-context-auto-stash helpers", () => {
  it("computes fill ratio from char count / max", () => {
    // ≤400 and ≥⅓ smaller than the prior 600 capacity.
    expect(THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS).toBeLessThanOrEqual(400);
    expect(THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS).toBeLessThanOrEqual(Math.floor(600 * (2 / 3)));
    expect(THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS).toBe(400);
    expect(thoughtContextFillRatio("", 100)).toBe(0);
    expect(thoughtContextFillRatio("a".repeat(50), 100)).toBe(0.5);
    expect(thoughtContextFillRatio("a".repeat(100), 100)).toBe(1);
    expect(thoughtContextFillRatio("a".repeat(150), 100)).toBe(1);
    // Fixed length fills faster vs old 600 max.
    const sample = "a".repeat(300);
    expect(thoughtContextFillRatio(sample, 400)).toBeGreaterThan(thoughtContextFillRatio(sample, 600));
  });

  it("color bands: green <50%, yellow ≥50%, red ≥75%", () => {
    expect(thoughtContextBarTone(0)).toBe("green");
    expect(thoughtContextBarTone(0.49)).toBe("green");
    expect(thoughtContextBarTone(0.5)).toBe("yellow");
    expect(thoughtContextBarTone(0.74)).toBe("yellow");
    expect(thoughtContextBarTone(0.75)).toBe("red");
    expect(thoughtContextBarTone(1)).toBe("red");
    expect(thoughtContextBarToneClass("green")).toContain("emerald");
    expect(thoughtContextBarToneClass("yellow")).toContain("amber");
    expect(thoughtContextBarToneClass("red")).toContain("red");
  });

  it("auto-stashes at full; context auto-stash does not affect purity", () => {
    expect(shouldAutoStashOnContextFull(0.99)).toBe(false);
    expect(shouldAutoStashOnContextFull(1)).toBe(true);
    expect(contextAutoStashAffectsPurity()).toBe(false);
  });
});

describe("TAP + ILE mount Auto-stash context bar", () => {
  it("shared bar label and surfaces wire context stash without purity", () => {
    expect(AUTO_STASH_CONTEXT_LABEL).toBe("Auto-stash context");

    const bar = fs.readFileSync(
      path.join(ROOT, "components/thought-ui/AutoStashContextBar.tsx"),
      "utf8",
    );
    expect(bar).toContain("AUTO_STASH_CONTEXT_LABEL");
    expect(bar).toContain("data-auto-stash-context-bar");
    expect(bar).toContain("data-auto-stash-context-label");
    expect(bar).toContain("data-auto-stash-context-track");
    expect(bar).toContain("animate-pulse");
    expect(bar).toContain("thoughtContextBarToneClass");
    // Same vertical geometry as purity markers (label + h-7 content)
    expect(bar).toContain("flex-col gap-1");
    expect(bar).toContain("h-7");
    expect(bar).not.toContain("mb-1 flex items-center justify-between");

    const tap = fs.readFileSync(path.join(ROOT, "components/TapScoreClient.tsx"), "utf8");
    expect(tap).toContain("AutoStashContextBar");
    expect(tap).toContain('data-surface="tap"');
    expect(tap).toContain("fromContext");
    expect(tap).toContain("shouldAutoStashOnContextFull");
    // Context path must not call applyPurityHit
    const fromContextBlock = tap.slice(
      tap.indexOf("fromContext"),
      tap.indexOf("fromContext") + 400,
    );
    expect(fromContextBlock).not.toContain("applyPurityHit");
    // Silence purity path still present
    expect(tap).toContain("shouldAutoStashOnSilence");
    expect(tap).toContain("applyPurityHit");
    // No misaligned self-end/padding wrapper around the bar
    expect(tap).not.toMatch(/self-end pb-0\.5[\s\S]{0,80}AutoStashContextBar/);

    const ile = fs.readFileSync(path.join(ROOT, "components/SessionHeliosPanel.tsx"), "utf8");
    expect(ile).toContain("AutoStashContextBar");
    expect(ile).toContain('data-surface="ile"');
    expect(ile).toContain("shouldAutoStashOnContextFull");
    expect(ile).toContain("stashCurrentTranscription");

    // TAP strip order: purity → Auto-stash context bar → End session
    const purityIdx = tap.indexOf("data-tap-session-purity");
    const barIdx = tap.lastIndexOf("<AutoStashContextBar");
    const endIdx = tap.indexOf("data-tap-end-session");
    expect(purityIdx).toBeGreaterThan(-1);
    expect(barIdx).toBeGreaterThan(purityIdx);
    expect(endIdx).toBeGreaterThan(barIdx);
    expect(tap).toContain("data-tap-live-control-strip");

    // ILE bar remains with transcript chrome
    const ileBarJsx = ile.lastIndexOf("<AutoStashContextBar");
    const ileTranscript = ile.lastIndexOf("<SlidingTranscript");
    expect(ileBarJsx).toBeGreaterThan(ileTranscript);
    expect(ileBarJsx - ileTranscript).toBeLessThan(3000);
  });
});
