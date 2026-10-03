/**
 * Live Prepare, Learn, Drill, and Verify mount the canvas-plus-sidebar
 * work surface. The old 70/30 and 50/50 splits must stay unmounted.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const OLD_LIVE_SPLITS = [
  "data-scout-live-split",
  'data-scout-split="70-30"',
  "data-tap-convo-live-split",
  'data-tap-split="70-30"',
  "data-exercise-tap-shell",
  "data-exercise-tap-live-split",
  "lg:grid-cols-[7fr_3fr]",
];

describe("shared live work surface", () => {
  const host = read("components/session-view/session-work-surface.tsx");
  const prepare = read("components/scout-tap/scout-tap-phases.tsx");
  const learn = read("components/session-view/session-chrome.tsx");
  const drill = read("components/exercise-tap/ExerciseTapShell.tsx");
  const tap = read("components/tap-score/tap-score-phases.tsx");
  const verify = read("components/VerificationFlowRunner.tsx");

  it("hosts the work stage beside the collapsible right sidebar", () => {
    expect(host).toContain("data-session-work-surface");
    expect(host).toContain("data-ile-canvas-sidebar-split");
    expect(host).toContain("data-ile-canvas-stage");
    const stageAt = host.indexOf("data-ile-canvas-stage className");
    const sidebarAt = host.indexOf("<SessionSidebar\n");
    expect(stageAt).toBeGreaterThan(-1);
    expect(sidebarAt).toBeGreaterThan(stageAt);
    expect(host).toContain('className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden"');
    expect(host).toContain("absolute inset-0 flex h-full min-h-0 w-full flex-col");
  });

  it("Prepare live play uses the sidebar and keeps questions, go back, and the paused clock", () => {
    expect(prepare).toContain("<SessionWorkSurface");
    expect(prepare).toContain('mode="tap"');
    expect(prepare).toContain("data-scout-work-canvas-pane");
    const paneAt = prepare.indexOf("data-scout-work-canvas-pane");
    expect(prepare.slice(paneAt, paneAt + 280)).toContain("h-full");
    expect(prepare).toContain("data-scout-questions-pane");
    expect(prepare).toContain("data-scout-go-back");
    expect(prepare).toMatch(/data-scout-go-back[\s\S]{0,180}disabled=\{readOnly\}/);
    expect(prepare).toContain("data-scout-live-control-strip");
    expect(prepare).toContain("waiting={clockPaused || questionsLoading}");
    expect(prepare).toContain("listening={false}");
    expect(prepare).not.toContain("useSessionThoughtInterface");
    for (const marker of OLD_LIVE_SPLITS) {
      expect(prepare, marker).not.toContain(marker);
    }
  });

  it("Learn live play stays on the ILE canvas sidebar without a visible countdown", () => {
    expect(learn).toContain("data-ile-canvas-sidebar-split");
    expect(learn).toContain("<SessionSidebar");
    expect(learn).toContain('mode="ile"');
    expect(learn.indexOf("data-ile-canvas-stage")).toBeLessThan(learn.indexOf("<SessionSidebar"));
    expect(learn).not.toContain("IleWorkCanvasTimer");
    expect(learn).not.toContain('mode="tap"');
    for (const marker of OLD_LIVE_SPLITS) {
      expect(learn, marker).not.toContain(marker);
    }
  });

  it("Drill live play uses the sidebar and keeps the map, stash, I'm done, and thought memory", () => {
    expect(drill).toContain("<SessionWorkSurface");
    expect(drill).toContain('mode="tap"');
    expect(drill).toContain("data-exercise-tap-map-pane");
    expect(drill).toContain("TapSessionMap");
    expect(drill).toContain("data-exercise-tap-stash-submit");
    expect(drill).toContain("data-tap-transcript-container");
    expect(drill).toContain("data-tap-im-done-slot");
    expect(drill).toContain("<ThoughtMemoryPanel");
    expect(drill).toContain("ImDoneAnsweringControl");
    const transcriptAt = drill.indexOf("data-tap-transcript-container");
    const doneAt = drill.indexOf("data-tap-im-done-slot");
    const memoryAt = drill.indexOf("<ThoughtMemoryPanel");
    expect(doneAt).toBeGreaterThan(transcriptAt);
    expect(memoryAt).toBeGreaterThan(doneAt);
    for (const marker of OLD_LIVE_SPLITS) {
      expect(drill, marker).not.toContain(marker);
    }
  });

  it("conversational TAP and Verify live play use the sidebar and keep stash, I'm done, and thought memory", () => {
    expect(tap).toContain("<SessionWorkSurface");
    expect(tap).toContain("mode={sidebarMode}");
    expect(tap).toContain("data-tap-convo-work-canvas-pane");
    expect(tap).toContain("<WorkCanvas");
    expect(tap).toContain("data-tap-transcript-container");
    expect(tap).toContain("data-tap-im-done-slot");
    expect(tap).toContain("<ThoughtMemoryPanel");
    expect(tap).toContain("I'm done answering");
    const transcriptAt = tap.indexOf("data-tap-transcript-container");
    const doneAt = tap.indexOf("data-tap-im-done-slot");
    const memoryAt = tap.indexOf("<ThoughtMemoryPanel");
    expect(doneAt).toBeGreaterThan(transcriptAt);
    expect(memoryAt).toBeGreaterThan(doneAt);
    expect(verify).toContain("<TapScoreClient");
    expect(verify).toContain('sidebarMode="verification-tap"');
    expect(verify).toContain("data-verification-identity");
    for (const marker of OLD_LIVE_SPLITS) {
      expect(tap, marker).not.toContain(marker);
      expect(verify, marker).not.toContain(marker);
    }
  });
});
