import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IleVoiceBar, IleVoiceBarActions } from "@/components/session-view/ile-voice-bar";
import {
  IleMapInsightsWidget,
  IleWorkCanvasTimer,
} from "@/components/session-view/ile-insight-trophies";
import type { InsightSummary } from "@/lib/insights";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import {
  SESSION_SIDEBAR_COLLAPSED_REM,
  SESSION_SIDEBAR_EXPANDED_REM,
  SESSION_SIDEBAR_FOCUS_REM,
  ileSidebarSignalCount,
  sessionSidebarHasSection,
  sessionSidebarRailStyle,
  sessionSidebarSections,
  sessionSidebarWidthRem,
  type SessionSidebarMode,
  type SessionSidebarSection,
} from "@/lib/session-sidebar";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";

const ROOT = join(__dirname, "../..");

const thought = {
  crystallizableText: "live speech line",
  speechError: null,
  speechSupported: true,
  isListening: true,
  speechEnabled: true,
  retryMicrophone: async () => {},
} as unknown as SessionThoughtInterface;

const ILE_SECTIONS: SessionSidebarSection[] = [
  "focus",
  "chapters",
  "signals",
  "transcript",
  "data",
  "logs",
  "save",
];

const TAP_SECTIONS: SessionSidebarSection[] = [
  "focus",
  "chapters",
  "signals",
  "transcript",
  "clock",
  "logs",
  "save",
];

function voiceBar() {
  return createElement(IleVoiceBar, { thought });
}

function voiceActions(mode: SessionSidebarMode) {
  return createElement(IleVoiceBarActions, {
    activeTool: "chapters",
    onToolChange: () => {},
    onBackToDashboard: () => {},
    showData: sessionSidebarHasSection(mode, "data"),
    showLogs: sessionSidebarHasSection(mode, "logs"),
    showSave: sessionSidebarHasSection(mode, "save"),
  });
}

const insightRow: InsightSummary = {
  id: "ins-rail",
  title: "Rail insight",
  summary: "Fits the column",
  created_at: "2026-01-01T00:00:00.000Z",
};

function renderSidebar(mode: SessionSidebarMode, remainingSeconds: number) {
  return renderToStaticMarkup(
    createElement(SessionSidebar, {
      mode,
      focusLabel: mode === "ile" ? "Insights" : "Stash",
      clock: createElement(IleWorkCanvasTimer, { remainingSeconds }),
      focus:
        mode === "ile"
          ? createElement(IleMapInsightsWidget, {
              insights: [insightRow],
              visible: true,
              slotCount: 1,
            })
          : createElement("div", { "data-slot": "stash" }, "Stash body"),
      chapters: createElement("div", { "data-slot": "chapters" }, "Chapters body"),
      signals: createElement("div", { "data-slot": "signals" }, "Signals body"),
      transcript: voiceBar(),
      actions: voiceActions(mode),
    }),
  );
}

describe("session sidebar mode configuration", () => {
  it("keeps TAP Learning, TAP, and verification TAP section sets", () => {
    expect(sessionSidebarSections("ile")).toEqual(ILE_SECTIONS);
    expect(sessionSidebarSections("tap")).toEqual(TAP_SECTIONS);
    expect(sessionSidebarSections("verification-tap")).toEqual(TAP_SECTIONS);

    for (const mode of ["tap", "verification-tap"] as const) {
      const sections = sessionSidebarSections(mode);
      expect(sections).toContain("focus");
      expect(sections).toContain("chapters");
      expect(sections).toContain("signals");
      expect(sections).not.toContain("data");
      expect(sections).toContain("transcript");
      expect(sections).toContain("clock");
      expect(sessionSidebarHasSection(mode, "data")).toBe(false);
      expect(sessionSidebarHasSection(mode, "signals")).toBe(true);
      expect(sessionSidebarHasSection(mode, "logs")).toBe(true);
      expect(sessionSidebarHasSection(mode, "save")).toBe(true);
    }

    expect(sessionSidebarHasSection("ile", "focus")).toBe(true);
    expect(sessionSidebarHasSection("ile", "chapters")).toBe(true);
    expect(sessionSidebarHasSection("ile", "signals")).toBe(true);
    expect(sessionSidebarHasSection("ile", "data")).toBe(true);
    expect(sessionSidebarHasSection("ile", "clock")).toBe(false);
  });

  it("locks the rail and expanded column widths", () => {
    expect(SESSION_SIDEBAR_COLLAPSED_REM).toBeGreaterThanOrEqual(5.5);
    expect(SESSION_SIDEBAR_COLLAPSED_REM).toBeLessThanOrEqual(7.5);
    expect(SESSION_SIDEBAR_EXPANDED_REM).toBeLessThanOrEqual(24);
    expect(SESSION_SIDEBAR_COLLAPSED_REM).toBeLessThan(SESSION_SIDEBAR_EXPANDED_REM);
    expect(sessionSidebarWidthRem(true)).toBe(SESSION_SIDEBAR_COLLAPSED_REM);
    expect(sessionSidebarWidthRem(false)).toBe(SESSION_SIDEBAR_EXPANDED_REM);

    const collapsed = sessionSidebarRailStyle(true);
    const expanded = sessionSidebarRailStyle(false);
    expect(collapsed.width).toBe(`${SESSION_SIDEBAR_COLLAPSED_REM}rem`);
    expect(collapsed.minWidth).toBe(collapsed.width);
    expect(collapsed.maxWidth).toBe(collapsed.width);
    expect(collapsed.flexShrink).toBe(0);
    expect(expanded.width).toBe(`${SESSION_SIDEBAR_EXPANDED_REM}rem`);
    expect(expanded.width).not.toBe("0");
    expect(collapsed.width).not.toBe("0");
    expect(Number.parseFloat(collapsed.width)).toBeGreaterThan(0);
  });

  it("renders the TAP Learning sidebar beside a clock, widgets, and the live transcript", () => {
    const html = renderSidebar("ile", 65);
    expect(html).toContain('data-session-sidebar-mode="ile"');
    expect(html).toContain(`width:${SESSION_SIDEBAR_EXPANDED_REM}rem`);
    expect(html).toContain(`height:${SESSION_SIDEBAR_FOCUS_REM}rem`);
    expect(html).not.toContain("data-session-sidebar-toggle");
    expect(html).not.toContain("Collapse sidebar");
    expect(html).toContain('data-session-sidebar-section="focus"');
    expect(html).toContain('data-session-sidebar-focus-label');
    expect(html).toContain(">Insights<");
    expect(html).toContain('data-session-sidebar-section="chapters"');
    expect(html).toContain('data-session-sidebar-section="signals"');
    expect(html).toContain('data-session-sidebar-section="transcript"');
    const focusAt = html.indexOf('data-session-sidebar-section="focus"');
    const chaptersAt = html.indexOf('data-session-sidebar-section="chapters"');
    const signalsAt = html.indexOf('data-session-sidebar-section="signals"');
    expect(focusAt).toBeLessThan(chaptersAt);
    expect(chaptersAt).toBeLessThan(signalsAt);
    const widgetAt = html.indexOf("data-ile-map-insights-widget");
    expect(widgetAt).toBeGreaterThan(focusAt);
    expect(html.slice(widgetAt, html.indexOf("data-ile-map-insights-slots"))).toContain(
      "w-full min-w-0 max-w-full",
    );
    expect(html).not.toContain("w-[min(20rem,calc(100vw-2rem))]");
    expect(html).toContain("data-ile-map-insights-count");
    expect(html).toContain("Rail insight");
    expect(html).toContain("Chapters body");
    expect(html).toContain("data-session-sidebar-signals-frame");
    expect(html).toContain("border border-white/20 bg-neutral-950/95 p-2");
    const signalsFrameAt = html.indexOf("data-session-sidebar-signals-frame");
    expect(signalsFrameAt).toBeGreaterThan(signalsAt);
    expect(html.indexOf("Signals body")).toBeGreaterThan(signalsFrameAt);
    expect(html).toContain("live speech line");
    const transcriptAt = html.indexOf("data-ile-transcription-box");
    const actionsRowAt = html.indexOf("data-session-sidebar-actions");
    const actionsAt = html.indexOf("data-ile-voice-bar-actions");
    expect(transcriptAt).toBeGreaterThan(-1);
    expect(actionsRowAt).toBeGreaterThan(transcriptAt);
    expect(actionsAt).toBeGreaterThan(actionsRowAt);
    expect(html.indexOf("data-ile-bar-data")).toBeGreaterThan(actionsAt);
    expect(html.slice(transcriptAt, actionsAt)).not.toContain("data-ile-bar-data");
    expect(html).toContain("data-ile-bar-data");
    expect(html).toContain("data-ile-bar-logs");
    expect(html).toContain("data-ile-bar-save");
    expect(html).toContain(">Data<");
    expect(html).toContain(">Logs<");
    expect(html).toContain(">Exit<");
    expect(html).not.toContain("data-ile-work-canvas-timer");
    expect(html).not.toContain("data-session-sidebar-clock");
    expect(html).not.toContain("data-session-sidebar-count");
    expect(html).not.toContain(">1:05<");
    expect(html).not.toContain("translate");
  });

  it("stays expanded and does not offer a collapse control", () => {
    const html = renderSidebar("ile", 15);
    expect(html).toContain(`width:${SESSION_SIDEBAR_EXPANDED_REM}rem`);
    expect(html).toContain(`min-width:${SESSION_SIDEBAR_EXPANDED_REM}rem`);
    expect(html).not.toContain(`width:${SESSION_SIDEBAR_COLLAPSED_REM}rem`);
    expect(html).not.toContain("data-session-sidebar-toggle");
    expect(html).not.toContain("Expand sidebar");
    expect(html).not.toContain("Collapse sidebar");
    expect(html).not.toContain("data-session-sidebar-count");
    expect(html).not.toContain("data-ile-work-canvas-timer");
    expect(html).not.toContain("data-session-sidebar-clock");
    expect(html).toContain("data-ile-map-insights-widget");
    expect(html).toContain("live speech line");
    expect(html).toContain("data-session-sidebar-actions");
    expect(html).toContain("data-ile-bar-save");
    expect(html).toContain(">Exit<");
    expect(html).toContain(">Chapters<");
    expect(html).toContain(">Signals<");
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("translate");
    expect(html).not.toContain("data-ile-global-resources");
  });

  it("shows session resources as a small section, collapsed until opened", () => {
    const resources = createElement("div", null, "Resource body");
    const collapsed = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "ile",
        resources,
        chapters: createElement("div", null, "Chapters body"),
        transcript: voiceBar(),
        actions: voiceActions("ile"),
      }),
    );
    const sidebarSource = readFileSync(
      join(ROOT, "components/session-view/session-sidebar.tsx"),
      "utf8",
    );
    expect(sidebarSource).toContain("useState(false)");
    expect(sidebarSource).not.toContain("onOpenGlobalResources");
    expect(sidebarSource).not.toContain("aria-pressed");
    expect(sidebarSource).not.toContain("py-2.5");
    expect(collapsed).toContain("data-ile-global-resources");
    expect(collapsed).toContain('data-session-sidebar-section="resources"');
    expect(collapsed).toContain(">session resources<");
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).toContain("text-[11px]");
    expect(collapsed).not.toContain("Resource body");
    const resourcesButton = collapsed.slice(
      collapsed.indexOf("data-ile-global-resources"),
      collapsed.indexOf("</button>"),
    );
    expect(resourcesButton).toContain('aria-expanded="false"');
    expect(resourcesButton).not.toContain("aria-pressed");
    expect(resourcesButton).not.toContain("text-sm");
    expect(resourcesButton).not.toContain("py-2.5");
    expect(collapsed).not.toContain("data-ile-tool-overlay");
    expect(collapsed).not.toContain("data-session-sidebar-toggle");
    expect(collapsed).toContain("data-ile-bar-data");
    expect(collapsed).not.toContain("data-session-sidebar-count");
    expect(collapsed.indexOf('data-session-sidebar-section="resources"')).toBeLessThan(
      collapsed.indexOf('data-session-sidebar-section="chapters"'),
    );

    const opened = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "ile",
        resources,
        resourcesOpen: true,
        chapters: createElement("div", null, "Chapters body"),
      }),
    );
    expect(opened).toContain('aria-expanded="true"');
    expect(opened).toContain("data-session-sidebar-resources");
    expect(opened).toContain("max-h-36");
    expect(opened).toContain("Resource body");

    expect(renderSidebar("ile", 65)).not.toContain("data-ile-global-resources");
    expect(renderToStaticMarkup(voiceBar())).not.toContain("data-ile-global-resources");
  });

  it("keeps chapters, signals, and the focus block for TAP and verification TAP", () => {
    for (const mode of ["tap", "verification-tap"] as const) {
      const html = renderSidebar(mode, 16);
      expect(html).toContain(`data-session-sidebar-mode="${mode}"`);
      expect(html).toContain('data-session-sidebar-section="focus"');
      expect(html).toContain(">Stash<");
      expect(html).toContain("Stash body");
      expect(html).toContain("Chapters body");
      expect(html).toContain("Signals body");
      expect(html).toContain(">Chapters<");
      expect(html).toContain(">Signals<");
      expect(html).toContain(`height:${SESSION_SIDEBAR_FOCUS_REM}rem`);
      expect(html).toContain("live speech line");
      expect(html.indexOf('data-session-sidebar-section="focus"')).toBeLessThan(
        html.indexOf('data-session-sidebar-section="chapters"'),
      );
      expect(html.indexOf("data-session-sidebar-actions")).toBeGreaterThan(
        html.indexOf("data-ile-transcription-box"),
      );
      expect(html.indexOf("data-ile-voice-bar-actions")).toBeGreaterThan(
        html.indexOf("data-session-sidebar-actions"),
      );
      expect(html).toContain("data-ile-bar-logs");
      expect(html).toContain("data-ile-bar-save");
      expect(html).toContain(">0:16<");
      expect(html).not.toContain('data-ile-work-canvas-timer-urgent="true"');
      expect(html).not.toContain("data-ile-map-insights-widget");
      expect(html).not.toContain("data-session-sidebar-toggle");
      expect(html).not.toContain("data-ile-bar-data");
      expect(html).not.toContain(">Data<");
    }
  });

  it("counts live signal tiles with audio always included", () => {
    expect(
      ileSidebarSignalCount({
        eegStreaming: false,
        screenCapturing: false,
        webcamEnabled: false,
      }),
    ).toBe(1);
    expect(
      ileSidebarSignalCount({
        eegStreaming: true,
        screenCapturing: true,
        webcamEnabled: false,
      }),
    ).toBe(3);
    expect(
      ileSidebarSignalCount({
        eegStreaming: true,
        screenCapturing: true,
        webcamEnabled: true,
      }),
    ).toBe(4);
  });

  it("formats the work-canvas clock as m:ss and marks 15 seconds urgent", () => {
    const calm = renderToStaticMarkup(
      createElement(IleWorkCanvasTimer, { remainingSeconds: 125 }),
    );
    const edge = renderToStaticMarkup(
      createElement(IleWorkCanvasTimer, { remainingSeconds: 15 }),
    );
    const above = renderToStaticMarkup(
      createElement(IleWorkCanvasTimer, { remainingSeconds: 16 }),
    );
    expect(calm).toContain(">2:05<");
    expect(calm).not.toContain('data-ile-work-canvas-timer-urgent="true"');
    expect(edge).toContain(">0:15<");
    expect(edge).toContain('data-ile-work-canvas-timer-urgent="true"');
    expect(above).toContain(">0:16<");
    expect(above).not.toContain('data-ile-work-canvas-timer-urgent="true"');
  });

  it("mounts the shared sidebar for Prepare, Drill, conversational TAP, and verification TAP", () => {
    const prepare = readFileSync(join(ROOT, "components/scout-tap/scout-tap-phases.tsx"), "utf8");
    const drill = readFileSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"), "utf8");
    const tap = readFileSync(join(ROOT, "components/tap-score/tap-score-phases.tsx"), "utf8");
    const client = readFileSync(join(ROOT, "components/TapScoreClient.tsx"), "utf8");
    const verify = readFileSync(join(ROOT, "components/VerificationFlowRunner.tsx"), "utf8");
    const host = readFileSync(join(ROOT, "components/session-view/session-work-surface.tsx"), "utf8");
    for (const src of [prepare, drill, tap]) {
      expect(src).toContain("<SessionWorkSurface");
      expect(src).not.toContain("data-scout-live-split");
      expect(src).not.toContain("data-tap-convo-live-split");
      expect(src).not.toContain("data-exercise-tap-live-split");
    }
    expect(host).toContain("<SessionSidebar");
    expect(host).toContain("data-session-work-surface");
    expect(host).toContain("data-ile-canvas-stage");
    expect(client).toContain("sidebarMode={sidebarMode}");
    expect(verify).toContain('sidebarMode="verification-tap"');
    expect(prepare).toContain("focusLabel=");
    expect(prepare).toContain("<SessionTopicChapter");
    expect(prepare).toContain("<TapSessionSignals");
    expect(prepare).toContain("data-scout-questions-pane");
    expect(drill).toContain('focusLabel="Stash"');
    expect(drill).toContain("<SessionTopicChapter");
    expect(drill).toContain("<TapSessionSignals");
    expect(tap).toContain('focusLabel="Stash"');
    expect(tap).toContain("<SessionTopicChapter");
    expect(tap).toContain("<TapSessionSignals");
    expect(readFileSync(join(ROOT, "components/thought-ui/ThoughtMemoryPanel.tsx"), "utf8")).not.toContain(
      "Search traces",
    );
    const chrome = readFileSync(
      join(ROOT, "components/session-view/session-chrome.tsx"),
      "utf8",
    );
    expect(chrome).toContain('mode="ile"');
    expect(chrome).not.toContain('mode="tap"');
    expect(chrome).not.toContain('mode="verification-tap"');
  });
});
