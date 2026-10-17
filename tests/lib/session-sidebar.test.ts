import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IleVoiceBar, IleVoiceBarActions } from "@/components/session-view/ile-voice-bar";
import {
  IleMapInsightsWidget,
  IleWorkCanvasTimer,
} from "@/components/session-view/ile-insight-trophies";
import type { InsightSummary } from "@/lib/insights";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import { applySessionPress, emptySessionMarkState, freezeMistakeList } from "@/lib/session-marks";
import { SessionDataCard } from "@/components/session-view/session-data-card";
import {
  SessionTopicCard,
  sessionSidebarTopic,
} from "@/components/session-view/ile-work-dock-bar";
import {
  SESSION_DATA_CARD_REM,
  SESSION_SIDEBAR_COLLAPSED_REM,
  SESSION_SIDEBAR_EXPANDED_REM,
  SESSION_TOPIC_CARD_REM,
  SESSION_TOPIC_DOCK_CHIP_REM,
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
  "save",
];

const TAP_SECTIONS: SessionSidebarSection[] = [
  "focus",
  "chapters",
  "signals",
  "clock",
  "save",
];

function voiceBar() {
  return createElement(IleVoiceBar, { thought });
}

function voiceActions(mode: SessionSidebarMode) {
  return createElement(IleVoiceBarActions, {
    onBackToDashboard: () => {},
    showSave: sessionSidebarHasSection(mode, "save"),
  });
}

const insightRow: InsightSummary = {
  id: "ins-rail",
  title: "Rail insight",
  summary: "Fits the column",
  created_at: "2026-01-01T00:00:00.000Z",
};

const TOPIC_TITLE = "Just war";
const TOPIC_STILL = "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg";

function topicCard() {
  return createElement(SessionTopicCard, {
    id: "chapter-1",
    title: TOPIC_TITLE,
    systemImages: [TOPIC_STILL],
    customUrls: [],
  });
}

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
      chapters: topicCard(),
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
    expect(sessionSidebarSections("calibrate")).toEqual([
      "focus",
      "chapters",
      "signals",
      "clock",
      "save",
    ]);
    expect(sessionSidebarHasSection("calibrate", "clock")).toBe(true);
    expect(sessionSidebarHasSection("calibrate", "transcript")).toBe(false);

    for (const mode of ["tap", "verification-tap"] as const) {
      const sections = sessionSidebarSections(mode);
      expect(sections).toContain("focus");
      expect(sections).toContain("chapters");
      expect(sections).toContain("signals");
      expect(sections.join(",")).not.toContain("data");
      expect(sections).not.toContain("transcript");
      expect(sections).toContain("clock");
      expect(sessionSidebarHasSection(mode, "signals")).toBe(true);
      expect(sections).not.toContain("logs");
      expect(sessionSidebarHasSection(mode, "save")).toBe(true);
    }

    expect(sessionSidebarHasSection("ile", "focus")).toBe(true);
    expect(sessionSidebarHasSection("ile", "chapters")).toBe(true);
    expect(sessionSidebarHasSection("ile", "signals")).toBe(true);
    expect(sessionSidebarSections("ile").join(",")).not.toContain("data");
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

  it("renders the TAP Learning sidebar beside a clock, widgets, and Data", () => {
    const html = renderSidebar("ile", 65);
    expect(html).toContain('data-session-sidebar-mode="ile"');
    expect(html).toContain(`width:${SESSION_SIDEBAR_EXPANDED_REM}rem`);
    expect(html).toContain("min-h-0 flex-1 flex-col overflow-hidden");
    expect(html).not.toContain("data-session-sidebar-toggle");
    expect(html).not.toContain("Collapse sidebar");
    expect(html).toContain('data-session-sidebar-section="focus"');
    expect(html).toContain('data-session-sidebar-focus-label');
    expect(html).toContain(">Insights<");
    expect(html).toContain('data-session-sidebar-section="topic"');
    expect(html).not.toContain('data-session-sidebar-section="chapters"');
    expect(html).not.toContain(">Chapters<");
    expect(html).toContain('data-session-sidebar-section="signals"');
    expect(html).not.toContain('data-session-sidebar-section="transcript"');
    const topicAt = html.indexOf('data-session-sidebar-section="topic"');
    const focusAt = html.indexOf('data-session-sidebar-section="focus"');
    const signalsAt = html.indexOf('data-session-sidebar-section="signals"');
    expect(topicAt).toBe(html.indexOf("data-session-sidebar-section"));
    expect(topicAt).toBeLessThan(focusAt);
    expect(focusAt).toBeLessThan(signalsAt);
    const card = html.slice(topicAt, focusAt);
    expect(card).toContain('data-session-topic-card="chapter-1"');
    expect(card).toContain("data-session-topic-card-image");
    expect(card).toContain(TOPIC_STILL);
    expect(card).toContain(TOPIC_TITLE);
    expect(card.match(/data-session-topic-card=/g)).toHaveLength(1);
    expect(card.match(/data-session-topic-card-image/g)).toHaveLength(1);
    expect(card).toContain('data-session-topic-card-media="image"');
    expect(card).toContain('data-session-topic-card-video=""');
    expect(card).toContain("/aesthetics/session-topic-loop.mp4");
    expect(card).toContain(">Loop<");
    expect(card.match(/<button/g)).toHaveLength(1);
    expect(card).not.toContain("onClick");
    expect(card).not.toContain("tabindex");
    expect(card).not.toContain("href=");
    expect(card).not.toContain("grid-cols-2");
    expect(card).not.toContain("data-ile-chapter-dock-chapters");
    expect(card).not.toContain("data-ile-open-work-chip");
    expect(card).not.toContain("onFocusOpenWork");
    expect(SESSION_TOPIC_CARD_REM).toBeGreaterThan(SESSION_TOPIC_DOCK_CHIP_REM);
    expect(card).toContain(`var(--session-topic-card-height, ${SESSION_TOPIC_CARD_REM}rem)`);
    expect(card).toContain(">01<");
    const stillTag = card.slice(
      card.indexOf("data-session-topic-card-image"),
      card.indexOf("data-session-topic-card-video"),
    );
    expect(stillTag).not.toContain("grayscale");
    expect(html.slice(focusAt, signalsAt)).toContain(">02<");
    expect(html.slice(signalsAt, html.indexOf("data-session-sidebar-signals-frame"))).toContain(">03<");
    const sidebarSource = readFileSync(join(ROOT, "components/session-view/session-sidebar.tsx"), "utf8");
    expect(sidebarSource).toContain(
      'className="relative box-border flex h-full min-h-0 flex-col overflow-hidden border-l border-white/40 bg-black"',
    );
    expect(sidebarSource).not.toContain("overflow-y-auto border-l");
    expect(sidebarSource).not.toContain("SESSION_SIDEBAR_FOCUS_REM");
    const asideClass = html.slice(html.indexOf('class="'), html.indexOf(">", html.indexOf('class="')));
    expect(asideClass).toContain("overflow-hidden");
    expect(asideClass).not.toContain("overflow-y-auto");
    expect(sidebarSource).not.toMatch(/text-(red|green|amber|emerald|yellow|blue|orange|rose|lime)-/);
    expect(sidebarSource).not.toMatch(/bg-(red|green|amber|emerald|yellow|blue|orange)-/);
    const widgetAt = html.indexOf("data-ile-map-insights-widget");
    expect(widgetAt).toBeGreaterThan(focusAt);
    expect(html.slice(widgetAt, html.indexOf("data-ile-map-insights-slots"))).toContain(
      "w-full min-w-0 max-w-full",
    );
    expect(html).not.toContain("w-[min(20rem,calc(100vw-2rem))]");
    expect(html).toContain("data-ile-map-insights-count");
    expect(html).toContain("Rail insight");
    expect(html).toContain(TOPIC_TITLE);
    expect(html).toContain("data-session-sidebar-signals-frame");
    expect(html).toContain("data-session-sidebar-signals-label");
    expect(html).toContain(">Data<");
    expect(html).not.toContain(">Signals<");
    const signalsFrameAt = html.indexOf("data-session-sidebar-signals-frame");
    expect(signalsFrameAt).toBeGreaterThan(signalsAt);
    const signalsFrame = html.slice(signalsFrameAt, html.indexOf("data-session-sidebar-actions"));
    expect(SESSION_TOPIC_CARD_REM).toBeGreaterThan(SESSION_DATA_CARD_REM);
    expect(signalsFrame).toContain(`height:${SESSION_DATA_CARD_REM}rem`);
    expect(signalsFrame).not.toContain(`height:${SESSION_TOPIC_CARD_REM}rem`);
    expect(signalsFrame).toContain("border border-white/25 bg-black");
    expect(signalsFrame).not.toContain("p-2");
    expect(html.indexOf("Signals body")).toBeGreaterThan(signalsFrameAt);
    expect(html).not.toContain("data-ile-transcription-box");
    expect(html).not.toContain("live speech line");
    const actionsRowAt = html.indexOf("data-session-sidebar-actions");
    const actionsAt = html.indexOf("data-ile-voice-bar-actions");
    expect(actionsRowAt).toBeGreaterThan(signalsFrameAt);
    expect(actionsAt).toBeGreaterThan(actionsRowAt);
    expect(html.indexOf("data-ile-bar-save")).toBeGreaterThan(actionsAt);
    expect(html.slice(signalsFrameAt, actionsAt)).not.toContain("data-ile-bar-save");
    expect(html).not.toContain("data-ile-bar-data");
    expect(html).not.toContain("data-ile-bar-logs");
    expect(html).toContain("data-ile-bar-save");
    expect(html).toContain(">Data<");
    expect(html).not.toContain(">Logs<");
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
    expect(html).not.toContain("live speech line");
    expect(html).toContain("data-session-sidebar-actions");
    expect(html).toContain("data-ile-bar-save");
    expect(html).toContain(">Exit<");
    expect(html).toContain(TOPIC_TITLE);
    expect(html).not.toContain(">Chapters<");
    expect(html).toContain('data-session-sidebar-signals-label');
    expect(html).toContain(">Data<");
    expect(html).not.toContain(">Signals<");
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("translate");
    expect(html).not.toContain("data-ile-global-resources");
  });

  it("keeps the Learn focus on its own content and off the policy tab", () => {
    const resources = createElement("div", null, "Resource body");
    const focus = createElement("div", null, "Insight body");
    const collapsed = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "ile",
        resources,
        focus,
        focusLabel: "Insights",
        chapters: topicCard(),
        transcript: voiceBar(),
        actions: voiceActions("ile"),
      }),
    );
    const sidebarSource = readFileSync(
      join(ROOT, "components/session-view/session-sidebar.tsx"),
      "utf8",
    );
    const chromeSource = readFileSync(
      join(ROOT, "components/session-view/session-chrome.tsx"),
      "utf8",
    );
    expect(existsSync(join(ROOT, "components/session-view/session-mark-controls.tsx"))).toBe(false);
    expect(sidebarSource).toContain("useState(false)");
    expect(sidebarSource).toContain('mode === "ile"');
    expect(sidebarSource).not.toContain("data-session-policy-tab");
    expect(sidebarSource).not.toContain("data-session-assert-tab");
    expect(sidebarSource).not.toContain("SessionAssertGraph");
    expect(sidebarSource).not.toContain("SessionPolicyPanel");
    expect(sidebarSource).not.toContain("policyTab");
    expect(sidebarSource).not.toContain("onOpenGlobalResources");
    expect(sidebarSource).not.toContain("aria-pressed");
    expect(sidebarSource).not.toContain("py-2.5");
    expect(chromeSource).toContain("SessionPolicyProvider");
    expect(chromeSource).toContain('<SessionGuidePanel guide="learn" />');
    expect(chromeSource).toContain('id="actions"');
    expect(chromeSource).not.toContain("SessionActionsPanel");
    expect(chromeSource).not.toContain('focusLabel="actions"');
    expect(collapsed).not.toContain("data-session-policy-tab");
    expect(collapsed).not.toContain("data-session-assert-tab");
    expect(collapsed).not.toContain('data-session-sidebar-section="policy"');
    expect(collapsed).not.toContain('data-session-sidebar-focus-tab="policy"');
    expect(collapsed).not.toContain('data-session-sidebar-focus-tab="main"');
    expect(collapsed).not.toContain(">policy<");
    expect(collapsed).toContain(">Insights<");
    expect(collapsed).toContain("Insight body");
    expect(collapsed).not.toContain("session resources");
    expect(collapsed).not.toContain("data-ile-global-resources");
    expect(collapsed).not.toContain("Resource body");
    expect(collapsed).not.toContain("data-ile-tool-overlay");
    expect(collapsed).not.toContain("data-session-sidebar-toggle");
    expect(collapsed).not.toContain("data-ile-bar-data");
    expect(collapsed).not.toContain("data-session-sidebar-count");
    expect(collapsed.indexOf('data-session-sidebar-section="topic"')).toBeLessThan(
      collapsed.indexOf('data-session-sidebar-section="focus"'),
    );

    const opened = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "ile",
        resources,
        focus,
        focusLabel: "Insights",
        chapters: topicCard(),
      }),
    );
    expect(opened).toContain("Insight body");
    expect(opened).not.toContain("data-session-sidebar-policy");
    expect(opened).not.toContain("data-session-policy-empty");
    expect(opened).not.toContain("data-session-policy-tab");
    expect(opened).not.toContain("data-session-assert-tab");
    expect(opened).not.toContain("Resource body");
    expect(opened).not.toContain("session resources");

    const pressed = applySessionPress(
      emptySessionMarkState(freezeMistakeList([{ id: "q1", text: "What holds?" }])),
      { button: "try", aimedMistakeId: "q1", slice: "a sketch", at: 1 },
    );
    expect(pressed.ok).toBe(true);
    if (!pressed.ok) return;
    expect(existsSync(join(ROOT, "components/session-view/session-policy-panel.tsx"))).toBe(false);

    expect(renderSidebar("ile", 65)).not.toContain("data-ile-global-resources");
    expect(renderSidebar("ile", 65)).not.toContain('data-session-sidebar-focus-tab="policy"');
    expect(renderToStaticMarkup(voiceBar())).not.toContain("data-ile-global-resources");
  });

  it("keeps session resources as the second tab outside Learn", () => {
    const resources = createElement("div", null, "Resource body");
    const collapsed = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "tap",
        resources,
        focus: createElement("div", null, "Stash body"),
        focusLabel: "Stash",
      }),
    );
    expect(collapsed).toContain("data-ile-global-resources");
    expect(collapsed).toContain(">session resources<");
    expect(collapsed).not.toContain("Resource body");
    expect(collapsed).toContain("Stash body");
    const opened = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "tap",
        resources,
        focus: createElement("div", null, "Stash body"),
        focusLabel: "Stash",
        resourcesOpen: true,
      }),
    );
    expect(opened).toContain("data-session-sidebar-resources");
    expect(opened).toContain("Resource body");
    expect(opened).not.toContain("Stash body");
  });

  it("keeps chapters, signals, and the focus block for TAP and verification TAP", () => {
    for (const mode of ["tap", "verification-tap"] as const) {
      const html = renderSidebar(mode, 16);
      expect(html).toContain(`data-session-sidebar-mode="${mode}"`);
      expect(html).toContain('data-session-sidebar-section="focus"');
      expect(html).toContain(">Stash<");
      expect(html).toContain("Stash body");
      expect(html).toContain(TOPIC_TITLE);
      expect(html).toContain(TOPIC_STILL);
      expect(html).toContain("Signals body");
      expect(html).not.toContain(">Chapters<");
      expect(html).not.toContain("data-ile-chapter-dock-chapters");
      expect(html).toContain('data-session-sidebar-signals-label');
      expect(html).toContain(">Data<");
      expect(html).not.toContain(">Signals<");
      expect(html).toContain("min-h-0 flex-1 flex-col overflow-hidden");
      expect(html).not.toContain("overflow-y-auto");
      expect(html).not.toContain("live speech line");
      const modeTopic = html.indexOf('data-session-sidebar-section="topic"');
      const modeCard = html.slice(modeTopic, html.indexOf('data-session-sidebar-section="focus"'));
      expect(modeTopic).toBeLessThan(html.indexOf('data-session-sidebar-section="focus"'));
      expect(modeCard.match(/<button/g)).toHaveLength(1);
      expect(modeCard).toContain('data-session-topic-card-media="image"');
      expect(modeCard).toContain("data-session-sidebar-clock");
      expect(modeCard).toContain('data-session-topic-card-timer="true"');
      expect(modeCard).toContain("items-start");
      expect(modeCard).toContain("justify-end");
      expect(modeCard).toContain("text-left");
      expect(modeCard).not.toContain("text-right");
      expect(modeCard).not.toContain("max-w-[58%]");
      expect(modeCard.indexOf('data-session-topic-card-timer="true"')).toBeGreaterThan(
        modeCard.indexOf('data-session-topic-card="chapter-1"'),
      );
      expect(modeCard.indexOf('data-session-topic-card-timer="true"')).toBeLessThan(
        modeCard.indexOf("data-session-topic-card-title"),
      );
      expect(modeCard).toContain(">0:16<");
      expect(modeCard.match(/data-session-topic-card=/g)).toHaveLength(1);
      expect(html).not.toContain("data-ile-transcription-box");
      expect(html.indexOf("data-session-sidebar-actions")).toBeGreaterThan(
        html.indexOf("data-session-sidebar-signals-frame"),
      );
      expect(html.indexOf("data-ile-voice-bar-actions")).toBeGreaterThan(
        html.indexOf("data-session-sidebar-actions"),
      );
      expect(html).not.toContain("data-ile-bar-logs");
      expect(html).not.toContain(">Logs<");
      expect(html).toContain("data-ile-bar-save");
      expect(html).toContain(">0:16<");
      expect(html).not.toContain('data-ile-work-canvas-timer-urgent="true"');
      expect(html).not.toContain("data-ile-map-insights-widget");
      expect(html).not.toContain("data-session-sidebar-toggle");
      expect(html).not.toContain("data-ile-bar-data");
    }
  });

  it("renders the Data card as four monochrome stream tabs", () => {
    const cardSource = readFileSync(
      join(ROOT, "components/session-view/session-data-card.tsx"),
      "utf8",
    );
    expect(cardSource).toContain('audio: { index: "01", label: "Audio" }');
    expect(cardSource).toContain('muse: { index: "02", label: "Muse" }');
    expect(cardSource).toContain('video: { index: "03", label: "Video" }');
    expect(cardSource).toContain('screen: { index: "04", label: "Screen" }');
    expect(cardSource).toContain("data-session-data-enable");
    expect(cardSource).toContain("data-session-data-audio");
    expect(cardSource).not.toMatch(/text-(red|green|amber|emerald|yellow|blue|orange|rose|lime)-/);
    expect(cardSource).not.toMatch(/bg-(red|green|amber|emerald|yellow|blue|orange)-/);

    const standby = renderToStaticMarkup(
      createElement(SessionDataCard, {
        audioEnabled: false,
        museEnabled: false,
        videoEnabled: false,
        screenEnabled: false,
      }),
    );
    expect(standby).toContain('data-session-data-card');
    expect(standby).toContain('data-session-data-active="audio"');
    expect(standby).toContain('data-session-data-tab="audio"');
    expect(standby).toContain('data-session-data-tab="muse"');
    expect(standby).toContain('data-session-data-tab="video"');
    expect(standby).toContain('data-session-data-tab="screen"');
    expect(standby).toContain('data-session-data-enable="audio"');
    expect(standby).toContain(">Enable<");
    expect(standby).not.toContain("data-session-data-audio");

    const live = renderToStaticMarkup(
      createElement(SessionDataCard, {
        audioEnabled: true,
        museEnabled: false,
        videoEnabled: false,
        screenEnabled: false,
        audioStream: null,
      }),
    );
    expect(live).toContain("data-session-data-audio");
    expect(live).toContain(">MIC-01<");
    expect(live).not.toContain('data-session-data-enable="audio"');

    const muse = renderToStaticMarkup(
      createElement(SessionDataCard, {
        defaultTab: "muse",
        audioEnabled: false,
        museEnabled: false,
        videoEnabled: false,
        screenEnabled: false,
        museNote: "No headset on this mode.",
      }),
    );
    expect(muse).toContain('data-session-data-active="muse"');
    expect(muse).toContain('data-session-data-enable="muse"');
    expect(muse).toContain("No headset on this mode.");
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
    expect(existsSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"))).toBe(false);

    const tap = readFileSync(join(ROOT, "components/tap-score/tap-score-phases.tsx"), "utf8");
    const client = readFileSync(join(ROOT, "components/TapScoreClient.tsx"), "utf8");
    const verify = readFileSync(join(ROOT, "components/VerificationFlowRunner.tsx"), "utf8");
    const host = readFileSync(join(ROOT, "components/session-view/session-work-surface.tsx"), "utf8");
    for (const src of [tap]) {
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
    expect(prepare).toContain("<CalibrateSoundingSurface");
    expect(prepare).toContain("<SessionWorkSurface");
    expect(prepare).toContain('mode="calibrate"');
    expect(prepare).not.toContain('focusLabel="actions"');
    expect(prepare).not.toContain("SessionActionsPanel");
    const calibrateSurface = readFileSync(
      join(ROOT, "components/calibrate/calibrate-sounding-surface.tsx"),
      "utf8",
    );
    expect(calibrateSurface).not.toContain("policyTab");
    expect(calibrateSurface).not.toContain("data-calibrate-done-classifying");
    expect(calibrateSurface).not.toContain("<TapSessionSignals");
    expect(prepare).toContain("<TapSessionSignals");
    expect(prepare).not.toContain("captureAudio");
    expect(calibrateSurface).toContain("data-calibrate-sounding");
    expect(tap).toContain('? null : "Stash"');
    expect(tap).toContain('<SessionGuidePanel guide="verification" remainingSeconds={remainingSeconds} />');
    expect(tap).not.toContain("SessionActionsPanel");
    expect(tap).not.toContain("policyTab");
    expect(tap).toContain("<SessionTopicChapter");
    expect(tap).toContain("<TapSessionSignals captureAudio");
    const signals = readFileSync(join(ROOT, "components/session-view/session-signals.tsx"), "utf8");
    expect(signals).toContain("SessionDataCard");
    expect(signals).toContain("getUserMedia");
    expect(signals).toContain("getDisplayMedia");
    expect(signals).toContain("echoCancellation: true");
    expect(signals).toContain('setMuseNote("No headset on this mode.")');
    expect(signals).not.toContain("<AudioMiniPreview");
    expect(signals).not.toContain("stream={null}");
    const mountEffect = signals.slice(
      signals.indexOf("useEffect(() =>"),
      signals.indexOf("const replace"),
    );
    expect(mountEffect).not.toContain("getUserMedia");
    expect(mountEffect).not.toContain("getDisplayMedia");
    expect(signals).toContain("captureAudio");
    expect(signals).toContain("if (!captureAudio) return;");
    expect(signals).toContain("void openMic()");
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
    expect(chrome).toContain("<SessionTopicCard");
    expect(chrome).toContain("sessionSidebarTopic");
    expect(chrome).not.toContain("<IleWorkDockBar");
    expect(chrome).not.toContain("onFocusOpenWork");
    expect(calibrateSurface).not.toContain("<SessionTopicChapter");
    expect(prepare).toContain("<SessionTopicChapter");
    expect(tap.match(/<SessionTopicChapter/g)).toHaveLength(1);
    for (const src of [prepare, tap, chrome]) {
      expect(src).not.toContain("data-ile-chapter-dock-chapters");
      expect(src).not.toContain(">Chapters<");
    }
    const one = sessionSidebarTopic([
      { id: "a", label: "Ch 1", keyword: "Alpha" },
      { id: "b", label: "Ch 2", keyword: "Beta", focused: true },
      { id: "c", label: "Ch 3", keyword: "Gamma" },
    ]);
    expect(one).toEqual({ id: "b", title: "Beta" });
  });
});
