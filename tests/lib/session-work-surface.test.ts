/**
 * Live Prepare, Learn, Drill, and Verify mount the canvas-plus-sidebar
 * work surface. The old 70/30 and 50/50 splits must stay unmounted.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { readSessionStageSurface } from "../helpers/surface-source";

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
  const learn = read("components/session-view/session-chrome.tsx");
  expect(existsSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"))).toBe(false);

  const tap = read("components/tap-score/tap-score-phases.tsx");
  const verify = read("components/VerificationFlowRunner.tsx");

  it("hosts the work stage beside the left sidebar", () => {
    expect(host).toContain("data-session-work-surface");
    expect(host).toContain("data-ile-canvas-sidebar-split");
    expect(host).toContain("data-ile-canvas-stage");
    const stageAt = host.indexOf("data-ile-canvas-stage");
    const sidebarAt = host.indexOf("<SessionSidebar");
    expect(stageAt).toBeGreaterThan(-1);
    expect(sidebarAt).toBeGreaterThan(-1);
    expect(sidebarAt).toBeLessThan(stageAt);
    expect(host).toContain("relative z-0 min-h-0 min-w-0 overflow-hidden");
    expect(host).toContain("absolute inset-0 flex h-full min-h-0 w-full flex-col");
    expect(host).toContain("<SessionPowLogOverlay");
    expect(learn).toContain("<SessionPowLogOverlay");
  });


  it("Learn live play stays on the TAP Learning canvas sidebar without a visible countdown", () => {
    expect(learn).toContain("data-ile-canvas-sidebar-split");
    expect(learn).toContain("<SessionSidebar");
    expect(learn).toContain('mode="ile"');
    const splitAt = learn.indexOf("data-ile-canvas-sidebar-split");
    const split = learn.slice(splitAt);
    expect(split.indexOf("<SessionSidebar")).toBeLessThan(split.indexOf("data-ile-canvas-stage"));
    expect(learn).not.toContain("IleWorkCanvasTimer");
    expect(learn).not.toContain('mode="tap"');
    for (const marker of OLD_LIVE_SPLITS) {
      expect(learn, marker).not.toContain(marker);
    }
  });

  it("Drill live play leftover is gone", () => {
    expect(existsSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"))).toBe(false);
  });

  it("conversational TAP and Verify live play use the sidebar and keep stash, I'm done, and thought memory", () => {
    expect(tap).toContain("<SessionWorkSurface");
    expect(tap).toContain('mode={kind === "verify" ? "verification-tap" : "tap"}');
    expect(tap).toContain("data-tap-convo-work-canvas-pane");
    expect(tap).toContain("<WorkCanvas");
    expect(tap).not.toContain("data-tap-transcript-container");
    expect(tap).toContain("data-tap-im-done-slot");
    expect(tap).toContain("<ThoughtMemoryPanel");
    expect(tap).toContain("I'm done answering");
    const doneAt = tap.indexOf("data-tap-im-done-slot");
    const memoryAt = tap.indexOf("<ThoughtMemoryPanel");
    expect(memoryAt).toBeGreaterThan(doneAt);
    expect(verify).toContain("<TapScoreClient");
    expect(verify).toContain('sidebarMode="verification-tap"');
    expect(verify).toContain("ProductFlowIdentityForm");
    expect(read("components/product-flow/product-flow-identity-form.tsx")).toContain(
      "data-verification-identity",
    );
    for (const marker of OLD_LIVE_SPLITS) {
      expect(tap, marker).not.toContain(marker);
      expect(verify, marker).not.toContain(marker);
    }
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

    const finished = [
      tap,
      read("components/session-view/learn-silence-lock-screen.tsx"),
    ];
    for (const src of finished) {
      expect(src).toContain("<SessionFinishedScreen");
    }
    expect(tap).toContain("data-tap-session-thank-you");
    expect(tap).toContain("data-tap-session-impure");
    expect(tap).not.toContain("data-tap-practice-done");
    expect(tap).toContain("Could not end Verify session");
    expect(tap).not.toContain("<PerformanceReportCard");
    expect(existsSync(join(ROOT, "components/PerformanceReportCard.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/exercise-tap/exercise-tap-phases.tsx"))).toBe(false);

    const silence = read("components/session-view/learn-silence-lock-screen.tsx");
    const live = read("components/session-view/session-live-stage.tsx");
    expect(silence).toContain("data-ile-session-impure");
    expect(silence).toContain("data-ile-impure-retry");
    expect(silence).toContain("tap.postSession.impureTitle");
    expect(live).toContain("window.location.reload()");
    expect(silence).not.toContain("data-ile-silence-rest");
    expect(silence).not.toContain("PracticeVoiceChallenge");
    expect(silence).not.toContain("data-ile-impurity-save");

    for (const src of [
      tap,
      read("components/SessionView.tsx"),
      read("components/session-view/session-welcome-modal.tsx"),
    ]) {
      expect(src).toContain("<SessionPageLoading");
    }
    expect(read("components/session-view/session-welcome-modal.tsx")).toContain(
      "data-ile-start-loading-page",
    );
    expect(read("components/session-view/learn-start-loading.tsx")).toContain("data-ile-start-loading");
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
