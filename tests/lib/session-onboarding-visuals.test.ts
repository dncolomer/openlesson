/**
 * TAP/ILE intro clips: screenshot-style square-corner stash UI, not 3-slot chrome.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-8cfa77ac4170/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const CLIPS = [
  "public/animations/grid_pan.mp4",
  "public/animations/speaking.mp4",
  "public/animations/selective_interface.mp4",
] as const;

describe("session intro visuals", () => {
  it("onboarding guide ships three screenshot-style clips and the updated stash copy", () => {
    const guide = read("components/SessionOnboardingGuide.tsx");
    expect(guide).toContain('STEP1_ILE_GRID_PAN_VIDEO = "/animations/grid_pan.mp4"');
    expect(guide).toContain('STEP1_TAP_SPEAKING_VIDEO = "/animations/speaking.mp4"');
    expect(guide).toContain(
      'STEP2_THOUGHT_INTERFACE_VIDEO = "/animations/selective_interface.mp4"',
    );
    expect(guide).toContain("rounded-none");
    expect(guide).not.toContain("rounded-xl");

    const briefing = read("components/TapBriefingConfig.tsx");
    expect(briefing).not.toContain("tap.briefing.keyboardShortcuts");
    expect(briefing).not.toContain("ThoughtShortcutChord");
    expect(briefing).not.toContain('["1", "2", "3"]');
    expect(briefing).not.toContain('["Enter"]');
    expect(briefing).not.toContain('["Del"]');
    expect(briefing).not.toContain('["E"]');

    const en = JSON.parse(read("messages/en.json")) as {
      onboardingGuide: {
        ile: { step2: { body: string; bodyProject: string } };
        tap: { step2: { body: string } };
      };
    };
    expect(en.onboardingGuide.ile.step2.body).toContain("I'm done answering");
    expect(en.onboardingGuide.ile.step2.body).not.toContain("Submit last Thought");
    expect(en.onboardingGuide.ile.step2.body).toContain("See Your thoughts");
    expect(en.onboardingGuide.ile.step2.body).toContain("Thought Memory");
    expect(en.onboardingGuide.ile.step2.body).not.toMatch(/Press 1, 2, or 3/);
    expect(en.onboardingGuide.ile.step2.bodyProject).toContain("See Your thoughts");
    expect(en.onboardingGuide.ile.step2.bodyProject).not.toMatch(/Solution stack/i);
    expect(en.onboardingGuide.tap.step2.body).toContain("I'm done answering");
    expect(en.onboardingGuide.tap.step2.body).not.toContain("Submit last Thought");
    expect(en.onboardingGuide.tap.step2.body).toContain("See Older Thoughts");
    expect(en.onboardingGuide.tap.step2.body).not.toMatch(/1 \/ 2 \/ 3/);

    const sizes = CLIPS.map((rel) => {
      const path = join(ROOT, rel);
      expect(existsSync(path), `missing ${rel}`).toBe(true);
      const bytes = statSync(path).size;
      expect(bytes).toBeGreaterThan(200_000);
      return `${rel}=${bytes}`;
    });

    writeScratch(
      "intro-visuals.txt",
      [
        "grid_pan=/animations/grid_pan.mp4",
        "speaking=/animations/speaking.mp4",
        "selective_interface=/animations/selective_interface.mp4",
        "copy=ILE+TAP I'm done answering + See Older Thoughts",
        "no 1-2-3 stash shortcuts in TAP briefing default",
        ...sizes,
      ].join("\n"),
    );
  });
});
