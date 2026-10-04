/**
 * Live Prepare, Learn, Drill, and Verify mount the canvas-plus-sidebar
 * work surface. The old 70/30 and 50/50 splits must stay unmounted.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";

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

  it("Learn live play stays on the TAP Learning canvas sidebar without a visible countdown", () => {
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

  it("puts leave and end controls in the sidebar actions row, not the clock", () => {
    expect(host).toContain("actions={actions}");
    const sidebar = read("components/session-view/session-sidebar.tsx");
    expect(sidebar).toContain("data-session-sidebar-actions");
    expect(sidebar).toContain("data-session-sidebar-focus");
    expect(sidebar).not.toContain("data-session-sidebar-counts");
    expect(sidebar).not.toContain("data-session-sidebar-toggle");

    const prepareClock = prepare.slice(prepare.indexOf("clock={"), prepare.indexOf("actions={"));
    expect(prepareClock).toContain("data-scout-live-control-strip");
    expect(prepareClock).toContain("<TapLiveClock");
    expect(prepareClock).not.toContain("data-scout-end-session");
    const prepareActions = prepare.slice(prepare.indexOf("actions={"), prepare.indexOf("chapters={"));
    expect(prepareActions).toContain("showEndSession");
    expect(prepareActions).toContain("data-scout-end-session");
    expect(prepareActions).toContain("End session");
    expect(prepareActions).toContain("SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS");

    const tapClock = tap.slice(tap.indexOf("clock={"), tap.indexOf("actions={"));
    expect(tapClock).toContain("data-tap-live-control-strip");
    expect(tapClock).not.toContain("data-tap-end-session");
    const tapActions = tap.slice(tap.indexOf("actions={"), tap.indexOf("transcript={"));
    expect(tapActions).toContain("showEndSession");
    expect(tapActions).toContain("data-tap-end-session");
    expect(tapActions).toContain("End session");

    const drillPhases = read("components/exercise-tap/exercise-tap-phases.tsx");
    const drillShell = read("components/exercise-tap/ExerciseTapShell.tsx");
    expect(drillPhases).not.toContain("data-exercise-live-control-strip");
    expect(drillShell).toContain("clock={clock}");
    expect(drillShell).toContain("actions={actions}");
    expect(drillShell).not.toContain("controlStrip");
    const drillClock = drillPhases.slice(drillPhases.indexOf("clock={"), drillPhases.indexOf("actions={"));
    expect(drillClock).toContain("<TapLiveClock");
    expect(drillClock).not.toContain("data-tap-end-session");
    const drillActions = drillPhases.slice(
      drillPhases.indexOf("actions={"),
      drillPhases.indexOf("speechBar={"),
    );
    expect(drillActions).toContain("showEndSession");
    expect(drillActions).toContain("data-tap-end-session");
    expect(drillActions).toContain("End session");

    const voice = read("components/session-view/ile-voice-bar.tsx");
    expect(voice).toContain("data-ile-bar-save");
    expect(voice).toContain("data-save-and-exit");
    expect(voice).toMatch(/data-ile-bar-save[\s\S]{0,400}\n\s*Save/);
    expect(learn).toContain("actions={actions}");
    expect(learn).toContain("transcript={voiceBar}");
    expect(read("components/SessionView.tsx")).toContain("<IleVoiceBarActions");
    expect(read("components/SessionView.tsx")).not.toContain("IleWorkCanvasTimer");
  });

  it("renders finished sessions, waits, and confirms through the shared chrome", () => {
    const html = renderToStaticMarkup(
      createElement(
        SessionFinishedScreen,
        {
          kicker: "Kicker",
          title: "Finished title",
          body: "Finished body",
          actions: createElement("button", { "data-finished-action": "go" }, "Go"),
        },
        createElement("div", { "data-finished-content": "report" }, "Report"),
      ),
    );
    const kickerAt = html.indexOf("Kicker");
    const titleAt = html.indexOf("Finished title");
    const bodyAt = html.indexOf("Finished body");
    const contentAt = html.indexOf("data-finished-content");
    const actionAt = html.indexOf("data-finished-action");
    expect(kickerAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(kickerAt);
    expect(bodyAt).toBeGreaterThan(titleAt);
    expect(contentAt).toBeGreaterThan(bodyAt);
    expect(actionAt).toBeGreaterThan(contentAt);
    expect(html).toContain('data-session-finished-screen=""');
    expect(html).toContain("my-auto");
    const sectionClass = html.slice(html.indexOf('class="'), html.indexOf('">'));
    expect(sectionClass).not.toContain("justify-center");
    expect(sectionClass).toContain("overflow-y-auto");

    const wideHtml = renderToStaticMarkup(
      createElement(
        SessionFinishedScreen,
        { wide: true, title: "Report title", body: "Report hint" },
        createElement("div", { "data-finished-report": "card" }, "Card"),
      ),
    );
    expect(wideHtml).toContain('data-session-finished-fill="true"');
    const wideSectionClass = wideHtml.slice(wideHtml.indexOf('class="'), wideHtml.indexOf('">'));
    expect(wideSectionClass).toContain("overflow-hidden");
    expect(wideSectionClass).not.toContain("overflow-y-auto");
    expect(wideSectionClass).not.toContain("justify-center");
    expect(wideHtml).toContain("min-h-0");
    expect(wideHtml).toContain("flex-1");
    expect(wideHtml).not.toContain("my-auto");
    const reportAt = tap.indexOf("<PerformanceReportCard");
    const reportWrapper = tap.slice(Math.max(0, reportAt - 350), reportAt);
    expect(reportWrapper).toContain("min-h-0");
    expect(reportWrapper).toContain("flex-1");
    expect(reportWrapper).toContain("flex-col");
    expect(reportWrapper).toContain("overflow-hidden");
    expect(read("components/PerformanceReportCard.tsx")).toMatch(
      /fillHeight \? "min-h-0 flex-1 overflow-hidden"/,
    );

    const finished = [
      prepare,
      tap,
      read("components/exercise-tap/exercise-tap-phases.tsx"),
      read("components/session-view/ile-silence-lock-screen.tsx"),
    ];
    for (const src of finished) {
      expect(src).toContain("<SessionFinishedScreen");
    }
    expect(prepare).toContain("data-scout-thank-you");
    expect(prepare).toContain("data-tap-session-thank-you");
    expect(prepare).toContain("data-scout-restart");
    expect(prepare).toContain("data-scout-workspace");
    expect(prepare).toContain("data-scout-jump-work");
    expect(prepare).toContain("data-scout-jump-drill");
    expect(tap).toContain("data-tap-session-thank-you");
    expect(tap).toContain("data-tap-session-impure");
    expect(tap).toContain("data-tap-practice-done");
    expect(tap).toContain("Could not end TAP session");
    expect(tap).toContain("<PerformanceReportCard");
    const drill = read("components/exercise-tap/exercise-tap-phases.tsx");
    expect(drill).toContain("data-tap-practice-done");
    expect(drill).toContain("data-exercise-practice-retry");
    expect(drill).toContain("data-tap-session-impure");
    expect(drill).toContain("data-exercise-session-impure");
    expect(drill).toContain("data-tap-session-thank-you");
    expect(drill).toContain("data-exercise-session-thank-you");
    expect(drill).toContain("Exercise TAP complete");
    const silence = read("components/session-view/ile-silence-lock-screen.tsx");
    expect(silence).toContain("data-ile-silence-rest");
    expect(silence).toContain("data-ile-session-impurity");
    expect(silence).toContain("PracticeVoiceChallenge");
    expect(silence).toContain("data-ile-impurity-save");
    expect(silence).toContain("data-ile-impurity-logoff");

    for (const src of [
      prepare,
      tap,
      drill,
      read("components/SessionView.tsx"),
      read("components/session-view/session-welcome-modal.tsx"),
    ]) {
      expect(src).toContain("<SessionPageLoading");
    }
    expect(read("components/session-view/session-welcome-modal.tsx")).toContain(
      "data-ile-start-loading-page",
    );
    expect(read("components/session-view/ile-start-loading.tsx")).toContain("data-ile-start-loading");
    expect(read("components/session-view/session-page-loading.tsx")).toContain(
      "data-session-page-loading",
    );

    const confirm = read("components/ui/ConfirmDialog.tsx");
    expect(confirm).toContain("<DialogFrame");
    const cancelAt = confirm.indexOf("onClick={onCancel}");
    const confirmAt = confirm.indexOf("onClick={onConfirm}");
    const tertiaryAt = confirm.indexOf("onClick={onTertiary}");
    expect(cancelAt).toBeGreaterThan(-1);
    expect(confirmAt).toBeGreaterThan(cancelAt);
    expect(tertiaryAt).toBeGreaterThan(confirmAt);
    expect(learn).toContain("<ConfirmDialog");
    expect(learn).toContain("<DialogFrame");
    expect(learn).toContain("data-ile-session-modal-close");
    expect(learn).toContain("data-ile-tool-overlay-close");
    expect(learn).toContain("data-ile-tool-overlay-backdrop");
    expect(read("components/ui/DialogFrame.tsx")).toContain('event.key !== "Escape"');
    expect(read("components/ui/DialogFrame.tsx")).toContain("onClick={closeOnOverlay ? onClose : undefined}");
    expect(read("components/ui/DialogFrame.tsx")).toContain("data-dialog-header-close");
    expect(read("components/thought-ui/ThoughtEditPanel.tsx")).toContain("headerClose");
    expect(read("components/thought-ui/ThoughtEditPanel.tsx")).toContain("<ConfirmDialog");
  });
});
