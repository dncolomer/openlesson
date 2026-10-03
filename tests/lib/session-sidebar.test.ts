import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IleVoiceBar } from "@/components/session-view/ile-voice-bar";
import {
  IleMapInsightsWidget,
  IleWorkCanvasTimer,
} from "@/components/session-view/ile-insight-trophies";
import type { InsightSummary } from "@/lib/insights";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import {
  SESSION_SIDEBAR_COLLAPSED_REM,
  SESSION_SIDEBAR_EXPANDED_REM,
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
  "insights",
  "chapters",
  "signals",
  "transcript",
  "data",
  "logs",
  "save",
];

const TAP_SECTIONS: SessionSidebarSection[] = [
  "chapters",
  "transcript",
  "clock",
  "logs",
  "save",
];

function voiceBar(mode: SessionSidebarMode) {
  return createElement(IleVoiceBar, {
    thought,
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

function renderSidebar(mode: SessionSidebarMode, collapsed: boolean, remainingSeconds: number) {
  return renderToStaticMarkup(
    createElement(SessionSidebar, {
      mode,
      defaultCollapsed: collapsed,
      clock: createElement(IleWorkCanvasTimer, { remainingSeconds }),
      insights: createElement(IleMapInsightsWidget, {
        insights: [insightRow],
        visible: true,
        slotCount: 1,
      }),
      chapters: createElement("div", { "data-slot": "chapters" }, "Chapters body"),
      signals: createElement("div", { "data-slot": "signals" }, "Signals body"),
      transcript: voiceBar(mode),
      counts: { insights: 4, chapters: 2, signals: 3 },
    }),
  );
}

describe("session sidebar mode configuration", () => {
  it("keeps ILE, TAP, and verification TAP section sets", () => {
    expect(sessionSidebarSections("ile")).toEqual(ILE_SECTIONS);
    expect(sessionSidebarSections("tap")).toEqual(TAP_SECTIONS);
    expect(sessionSidebarSections("verification-tap")).toEqual(TAP_SECTIONS);

    for (const mode of ["tap", "verification-tap"] as const) {
      const sections = sessionSidebarSections(mode);
      expect(sections).not.toContain("insights");
      expect(sections).not.toContain("signals");
      expect(sections).not.toContain("data");
      expect(sections).toContain("transcript");
      expect(sections).toContain("clock");
      expect(sessionSidebarHasSection(mode, "data")).toBe(false);
      expect(sessionSidebarHasSection(mode, "logs")).toBe(true);
      expect(sessionSidebarHasSection(mode, "save")).toBe(true);
    }

    expect(sessionSidebarHasSection("ile", "insights")).toBe(true);
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

  it("renders the ILE sidebar beside a clock, widgets, and the live transcript", () => {
    const html = renderSidebar("ile", false, 65);
    expect(html).toContain('data-session-sidebar-mode="ile"');
    expect(html).toContain('data-session-sidebar-collapsed="false"');
    expect(html).toContain(`width:${SESSION_SIDEBAR_EXPANDED_REM}rem`);
    expect(html).toContain("data-session-sidebar-toggle");
    expect(html).toContain("Collapse sidebar");
    expect(html).toContain('data-session-sidebar-section="insights"');
    expect(html).toContain('data-session-sidebar-section="chapters"');
    expect(html).toContain('data-session-sidebar-section="signals"');
    expect(html).toContain('data-session-sidebar-section="transcript"');
    const insightsAt = html.indexOf('data-session-sidebar-section="insights"');
    const widgetAt = html.indexOf("data-ile-map-insights-widget");
    expect(widgetAt).toBeGreaterThan(insightsAt);
    expect(html.slice(widgetAt, html.indexOf("data-ile-map-insights-slots"))).toContain(
      "w-full min-w-0 max-w-full",
    );
    expect(html).not.toContain("w-[min(20rem,calc(100vw-2rem))]");
    expect(html).toContain("data-ile-map-insights-count");
    expect(html).toContain("Rail insight");
    expect(html).toContain("Chapters body");
    expect(html).toContain("Signals body");
    expect(html).toContain("live speech line");
    const transcriptAt = html.indexOf("data-ile-transcription-box");
    const actionsAt = html.indexOf("data-ile-voice-bar-actions");
    expect(transcriptAt).toBeGreaterThan(-1);
    expect(actionsAt).toBeGreaterThan(transcriptAt);
    expect(html.indexOf("data-ile-bar-data")).toBeGreaterThan(actionsAt);
    expect(html.slice(transcriptAt, actionsAt)).not.toContain("data-ile-bar-data");
    expect(html).toContain("data-ile-bar-data");
    expect(html).toContain("data-ile-bar-logs");
    expect(html).toContain("data-ile-bar-save");
    expect(html).toContain(">Data<");
    expect(html).toContain(">Logs<");
    expect(html).toContain(">Save<");
    expect(html).not.toContain("data-ile-work-canvas-timer");
    expect(html).not.toContain("data-session-sidebar-clock");
    expect(html).not.toContain("data-session-sidebar-count");
    expect(html).not.toContain(">1:05<");
    expect(html).not.toContain("translate");
  });

  it("collapses to a rail that keeps the expand control and hides the countdown", () => {
    const html = renderSidebar("ile", true, 15);
    expect(html).toContain('data-session-sidebar-collapsed="true"');
    expect(html).toContain(`width:${SESSION_SIDEBAR_COLLAPSED_REM}rem`);
    expect(html).toContain(`min-width:${SESSION_SIDEBAR_COLLAPSED_REM}rem`);
    expect(html).toContain(`max-width:${SESSION_SIDEBAR_COLLAPSED_REM}rem`);
    expect(html).not.toContain(`width:${SESSION_SIDEBAR_EXPANDED_REM}rem`);
    expect(html).toContain("data-session-sidebar-toggle");
    expect(html).toContain("Expand sidebar");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("data-ile-work-canvas-timer");
    expect(html).not.toContain("data-session-sidebar-clock");
    expect(html).not.toContain(">0:15<");
    expect(html).toContain('data-session-sidebar-count="insights"');
    expect(html).toContain('data-session-sidebar-count-value="4"');
    expect(html).toContain('data-session-sidebar-count="chapters"');
    expect(html).toContain('data-session-sidebar-count-value="2"');
    expect(html).toContain('data-session-sidebar-count="signals"');
    expect(html).toContain('data-session-sidebar-count-value="3"');
    expect(html).toContain(">Insights<");
    expect(html).toContain(">Chapters<");
    expect(html).toContain(">Signals<");
    expect(html).not.toContain("data-ile-map-insights-widget");
    expect(html).not.toContain("live speech line");
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("translate");
    expect(html).not.toContain("data-ile-global-resources");
  });

  it("shows session resources on the header bar when a handler is passed", () => {
    const open = () => {};
    const expanded = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "ile",
        defaultCollapsed: false,
        onOpenGlobalResources: open,
        globalResourcesOpen: true,
        chapters: createElement("div", null, "Chapters body"),
        transcript: voiceBar("ile"),
      }),
    );
    expect(expanded).toContain("data-ile-global-resources");
    expect(expanded).toContain(">session resources<");
    expect(expanded).toContain("text-sm");
    expect(expanded).toContain("py-2.5");
    expect(expanded).not.toContain("text-[9px]");
    expect(expanded).toContain('aria-pressed="true"');
    expect(expanded.indexOf("data-ile-global-resources")).toBeGreaterThan(
      expanded.indexOf("data-session-sidebar-toggle"),
    );
    expect(expanded).toContain("data-ile-bar-data");
    expect(expanded).not.toContain("data-session-sidebar-count");

    const collapsed = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "ile",
        defaultCollapsed: true,
        onOpenGlobalResources: open,
        globalResourcesOpen: false,
        counts: { insights: 4, chapters: 2, signals: 3 },
      }),
    );
    expect(collapsed).toContain("data-ile-global-resources");
    expect(collapsed).toContain(">session resources<");
    expect(collapsed).toContain('aria-pressed="false"');
    expect(collapsed).toContain("Expand sidebar");
    expect(collapsed).toContain('data-session-sidebar-count="insights"');

    expect(renderSidebar("ile", false, 65)).not.toContain("data-ile-global-resources");
    expect(renderToStaticMarkup(voiceBar("ile"))).not.toContain("data-ile-global-resources");
  });

  it("drops insights and data-input channels for TAP and verification TAP", () => {
    for (const mode of ["tap", "verification-tap"] as const) {
      const html = renderSidebar(mode, false, 16);
      expect(html).toContain(`data-session-sidebar-mode="${mode}"`);
      expect(html).toContain("Chapters body");
      expect(html).toContain("live speech line");
      expect(html.indexOf("data-ile-voice-bar-actions")).toBeGreaterThan(
        html.indexOf("data-ile-transcription-box"),
      );
      expect(html).toContain("data-ile-bar-logs");
      expect(html).toContain("data-ile-bar-save");
      expect(html).toContain(">0:16<");
      expect(html).not.toContain('data-ile-work-canvas-timer-urgent="true"');
      expect(html).not.toContain("data-ile-map-insights-widget");
      expect(html).not.toContain("Signals body");
      expect(html).not.toContain("data-ile-bar-data");
      expect(html).not.toContain(">Data<");
    }
    const collapsedTap = renderSidebar("tap", true, 16);
    expect(collapsedTap).toContain('data-session-sidebar-count="chapters"');
    expect(collapsedTap).toContain('data-session-sidebar-count-value="2"');
    expect(collapsedTap).not.toContain('data-session-sidebar-count="insights"');
    expect(collapsedTap).not.toContain('data-session-sidebar-count="signals"');
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
    const chrome = readFileSync(
      join(ROOT, "components/session-view/session-chrome.tsx"),
      "utf8",
    );
    expect(chrome).toContain('mode="ile"');
    expect(chrome).not.toContain('mode="tap"');
    expect(chrome).not.toContain('mode="verification-tap"');
  });
});
