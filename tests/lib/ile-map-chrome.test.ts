import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  ILE_CHAPTER_DOCK_PANEL_HEIGHT_CLASS,
  ILE_HELIOS_WIDGET_TOP_PX,
  ILE_HELIOS_WIDGET_WIDTH_PX,
  ILE_MAP_OVERLAY_TOOLS,
  ILE_MAP_VOICE_BAR_CLEARANCE_CLASS,
  ILE_VOICE_BAR_HEIGHT_CLASS,
  ILE_MAP_WIDGET_BOTTOM_CLASS,
  ILE_MAP_WIDGET_FRAME_CLASS,
  ILE_MAP_POW_BAR_CLEARANCE_CLASS,
  ILE_MAP_WIDGET_TOP_CLASS,
  ILE_MAP_WIDGET_WIDTH_CLASS,
  ILE_POW_RESOURCE_BAR_CLASS,
  ILE_POW_RESOURCE_BAR_PAD_CLASS,
  ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS,
  ILE_SESSION_TOP_BAR_PAD_CLASS,
  ILE_MAP_INSIGHT_CRAFT_Z_CLASS,
  ileMapInsightCraftFrameClass,
  ileMapWorkFrameClass,
  ileWorkCanvasCoversMap,
  isIleMapOverlayTool,
} from "@/lib/ile-map-chrome";
import { MINIMAP_FRAME_HEIGHT } from "@/lib/map-minimap-frame";
import {
  SESSION_SIDEBAR_COLLAPSED_REM,
  SESSION_SIDEBAR_EXPANDED_REM,
} from "@/lib/session-sidebar";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a5fcb6d60ed5/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const BOX_ROUNDED_RE = /rounded-(sm|md|lg|xl)\b/;

describe("TAP Learning map-first session chrome (shipped surface)", () => {
  it("is full-viewport map with overlay widgets, not a tools/Helios split", () => {
    const view = readSessionViewSurface();
    const chrome = read("components/session-view/session-chrome.tsx");
    const tools = read("components/ToolsPanel.tsx");
    const helios = read("components/SessionHeliosPanel.tsx");
    const voice = read("components/session-view/ile-voice-bar.tsx");
    const mini = read("components/block-skill-grid/map-minimap-chrome.tsx");

    expect(view).toContain('data-ile-canvas-stage="true"');
    expect(view).not.toContain("<ChapterMapPanel");
    expect(view).not.toContain('circularMenuSurface="ile"');
    expect(chrome).toContain('data-ile-canvas-stage="true"');
    expect(chrome).not.toContain("data-ile-map-stage");
    expect(chrome).not.toContain("data-ile-pow-resource-bar");
    expect(chrome).not.toContain("data-ile-global-resources");
    expect(chrome).not.toContain("onOpenGlobalResources");
    expect(chrome).toContain("resources={resources}");
    expect(read("components/session-view/session-sidebar.tsx")).toContain(
      "data-ile-global-resources",
    );
    expect(chrome).not.toContain("End turn");
    expect(chrome).toContain("data-ile-tools-widget");
    expect(chrome).not.toContain("SessionIdentityBadge");
    expect(chrome).not.toContain("data-ile-identity-row");
    expect(chrome).not.toContain("<SensorStrip");
    expect(chrome).not.toContain("data-ile-signal-strip");
    expect(tools).toContain("data-ile-signal-strip");
    expect(chrome).not.toContain("data-ile-pow-resource-label");
    expect(chrome).not.toContain("Proof of Work Resources");
    expect(chrome).not.toContain("data-ile-pow-count");
    expect(chrome).toContain("data-ile-tool-overlay");
    expect(chrome).not.toContain("IleChapterWidgetFrame");
    expect(chrome).toContain('id="insights"');
    expect(chrome).toContain('id="chapters"');
    expect(chrome).toContain('id="sensors"');
    const collapsible = read("components/session-view/ile-collapsible-overlay.tsx");
    expect(collapsible).toContain("data-ile-overlay-widget");
    expect(collapsible).toContain("data-ile-widget-collapse");
    expect(collapsible).toContain("data-ile-overlay-collapsed");
    expect(chrome).toContain("heliosOpen");
    expect(view).toContain("heliosOpen={heliosWidgetOpen}");
    expect(view).toContain("introOpen={showWelcomePanel}");
    expect(view).not.toContain("introOpen={showWelcomePanel || activeTool === \"help\"}");
    expect(chrome).toContain("data-ile-intro-widget");
    expect(chrome).toContain("data-ile-session-modal");
    expect(chrome).toContain("data-ile-session-modal-close");
    expect(chrome).not.toContain("data-ile-intro-widget-close");
    expect(chrome).not.toContain(">Briefing</span>");
    expect(chrome).not.toContain(">Intro</span>");
    expect(chrome).not.toContain(">Help</span>");
    expect(chrome).toContain("session.beforeYouStart");
    const introWidgetIdx = chrome.indexOf("data-ile-intro-widget");
    const canvasIdx = chrome.indexOf("{workCanvas}");
    expect(introWidgetIdx).toBeGreaterThan(-1);
    expect(canvasIdx).toBeGreaterThan(introWidgetIdx);
    expect(chrome).not.toContain("{heliosOpen ? (");
    expect(chrome).not.toContain("onCloseIntro");
    expect(view).not.toContain("onCloseIntro");
    expect(view).toContain("onCloseSessionModal");
    expect(view).toContain("isIleSessionModalTool");
    expect(chrome).toContain("max-h-[min(88vh,44rem)]");
    expect(chrome).toContain('modalTool === "logs" ? "h-[min(88vh,44rem)]"');
    expect(view).toContain("<SessionOnboardingGuide");
    expect(helios).not.toContain("SessionOnboardingGuide");
    expect(helios).not.toContain("data-ile-intro-widget");
    const helpChrome = read("components/session-view/use-session-chrome.ts");
    expect(helpChrome).toContain('if (tool === "help")');
    expect(helpChrome).toContain("setShowWelcomePanel(true)");
    expect(view).not.toContain("onChapterClick");
    expect(view).not.toContain("onWorkChapter");
    expect(view).toContain("onFocusOpenWork={handleFocusOpenWork}");
    expect(view).not.toContain("onChapterDoubleClick");
    expect(view).toContain("<IleVoiceBar");
    expect(chrome).toContain("data-ile-work-dock");
    expect(chrome).not.toContain("data-ile-work-dock-shifted");
    expect(chrome).not.toContain("ileWorkDockBarRightPx");
    expect(chrome).not.toContain("ILE_GOLDEN_RATIO");
    expect(chrome).not.toContain("ileChapterOverlayWidthClass");
    expect(ILE_CHAPTER_DOCK_PANEL_HEIGHT_CLASS).toContain("flex-1");
    expect(ILE_CHAPTER_DOCK_PANEL_HEIGHT_CLASS).not.toContain("52vh");
    expect(chrome).toContain("<IleWorkDockBar");
    expect(chrome).not.toContain("onSubmitTurn=");
    expect(chrome).not.toContain("onShowMap=");
    expect(ileMapWorkFrameClass()).toContain("z-40");
    const splitAt = chrome.indexOf("data-ile-canvas-sidebar-split");
    expect(splitAt).toBeGreaterThan(-1);
    const split = chrome.slice(splitAt, chrome.indexOf("data-ile-tool-overlay"));
    expect(split).toContain("flex-row");
    expect(split).toContain("{workCanvas}");
    expect(split).toContain("<SessionSidebar");
    expect(split.indexOf("{workCanvas}")).toBeLessThan(split.indexOf("<SessionSidebar"));
    expect(split).not.toContain("ChapterMapPanel");
    expect(split).not.toContain("ILE_CHAPTER_MODAL_SIZE_CLASS");
    expect(split).not.toContain("w-[59%]");
    expect(chrome).toContain(
      'data-ile-canvas-stage className="relative z-0 min-h-0 min-w-0 flex-1',
    );
    expect(chrome).not.toContain('data-ile-canvas-stage className="absolute inset-0');
    const overlayAt = chrome.indexOf("data-ile-tool-overlay");
    const overlay = chrome.slice(
      overlayAt,
      chrome.indexOf("data-ile-tool-overlay-close", overlayAt),
    );
    expect(overlay).toContain("ILE_MAP_WIDGET_FRAME_CLASS");
    expect(overlay).not.toContain("ILE_MAP_VOICE_BAR_CLEARANCE_CLASS");
    expect(overlay).not.toContain("top-14");
    expect(ILE_MAP_WIDGET_TOP_CLASS).toBe("top-2");
    expect(ILE_MAP_WIDGET_BOTTOM_CLASS).toBe(ILE_MAP_VOICE_BAR_CLEARANCE_CLASS);
    expect(ILE_MAP_WIDGET_BOTTOM_CLASS).toBe("bottom-12");
    expect(ILE_MAP_WIDGET_WIDTH_CLASS).toBe("w-[min(720px,calc(100%-28rem))]");
    expect(ILE_MAP_WIDGET_FRAME_CLASS).toContain(ILE_MAP_WIDGET_TOP_CLASS);
    expect(ILE_MAP_WIDGET_FRAME_CLASS).toContain(ILE_MAP_WIDGET_BOTTOM_CLASS);
    expect(ILE_MAP_WIDGET_FRAME_CLASS).toContain(ILE_MAP_WIDGET_WIDTH_CLASS);
    expect(ileMapWorkFrameClass()).not.toContain(ILE_MAP_WIDGET_WIDTH_CLASS);
    expect(ileMapWorkFrameClass(false)).toBe(ileMapWorkFrameClass(true));
    expect(ileWorkCanvasCoversMap({ heliosOpen: true })).toBe(true);
    expect(ileWorkCanvasCoversMap({ heliosOpen: false })).toBe(false);
    expect(ileWorkCanvasCoversMap({ heliosOpen: false })).toBe(false);
    expect(ileWorkCanvasCoversMap({ heliosOpen: true, wide: false })).toBe(true);
    expect(chrome).toContain("data-ile-work-covers-map");
    expect(chrome).toContain("data-ile-session-stage");
    expect(chrome).toContain("ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS");
    expect(ileMapWorkFrameClass(true)).not.toContain("fixed");
    expect(ileMapWorkFrameClass(true)).toContain("inset-0");
    expect(ileMapWorkFrameClass(true)).not.toContain("h-screen");
    expect(ileMapWorkFrameClass(true)).not.toContain("w-screen");
    expect(ileMapWorkFrameClass(true)).not.toContain("z-[70]");
    expect(ileMapWorkFrameClass(true)).toContain("absolute");
    expect(ileMapWorkFrameClass(true)).not.toContain("left-2");
    expect(ILE_MAP_POW_BAR_CLEARANCE_CLASS).toBe("top-0");
    expect(ileMapWorkFrameClass(true)).toContain("z-40");
    expect(ileMapWorkFrameClass(true)).not.toContain(ILE_MAP_WIDGET_BOTTOM_CLASS);
    expect(ileMapWorkFrameClass(true)).not.toContain(ILE_MAP_WIDGET_WIDTH_CLASS);
    expect(ileMapWorkFrameClass(true)).not.toContain(ILE_MAP_WIDGET_TOP_CLASS);
    const dock = chrome.slice(chrome.indexOf("data-ile-work-dock"));
    expect(dock).toContain("ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS");
    expect(dock).toContain('id="chapters"');
    expect(chrome).not.toContain("data-ile-pow-resource-bar");
    expect(chrome).toContain("data-ile-session-inner");
    expect(chrome).not.toContain("ILE_POW_RESOURCE_BAR_CLASS");
    expect(voice).toContain("ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS");
    const globals = read("app/globals.css");
    expect(globals).toContain('[data-ile-work-covers-map="true"] [data-block-minimap]');
    expect(globals).toContain('[data-ile-work-covers-map="true"] [data-map-minimap-stack]');
    expect(globals).toContain('[data-ile-work-covers-map="true"] [data-block-map-tool-strip]');
    const sensors = chrome.slice(
      chrome.indexOf("data-ile-tools-widget"),
      chrome.indexOf("{voiceBar}"),
    );
    expect(sensors).toContain('id="sensors"');
    expect(chrome).not.toContain("defaultCollapsed");
    expect(sensors).not.toContain("ILE_MAP_VOICE_BAR_CLEARANCE_CLASS");
    expect(sensors).not.toContain("absolute");
    expect(sensors).not.toContain("z-[35]");
    expect(chrome.indexOf("<SessionSidebar")).toBeLessThan(chrome.indexOf("data-ile-tools-widget"));
    expect(chrome.indexOf("data-ile-tools-widget")).toBeLessThan(chrome.indexOf("{voiceBar}"));
    const frame = read("components/session-view/ile-chapter-widget-frame.tsx");
    expect(frame).toContain("data-ile-helios-widget");
    expect(frame).toContain('title = "Work"');
    expect(frame).toContain("ILE_SESSION_TOP_BAR_PAD_CLASS");
    expect(ILE_POW_RESOURCE_BAR_CLASS).toContain(ILE_POW_RESOURCE_BAR_PAD_CLASS);
    expect(ILE_SESSION_TOP_BAR_PAD_CLASS).toBe("px-3 py-2.5");
    expect(ILE_POW_RESOURCE_BAR_PAD_CLASS).toBe("px-2 py-1.5");
    expect(chrome).not.toContain("data-ile-insight-craft-widget");
    expect(chrome).not.toContain("ileMapInsightCraftFrameClass()");
    expect(chrome).not.toContain("data-ile-work-dock-covered");
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).toContain("data-ile-end-turn-board");
    expect(ileMapInsightCraftFrameClass()).toContain(ILE_MAP_INSIGHT_CRAFT_Z_CLASS);
    expect(ileMapInsightCraftFrameClass()).toContain("inset-0");
    expect(ileMapInsightCraftFrameClass()).not.toContain(ILE_MAP_POW_BAR_CLEARANCE_CLASS);
    expect(ileMapInsightCraftFrameClass()).not.toContain(ILE_MAP_WIDGET_BOTTOM_CLASS);
    expect(ILE_MAP_INSIGHT_CRAFT_Z_CLASS).toBe("z-[70]");
    expect(ileMapInsightCraftFrameClass()).not.toContain("z-40");
    expect(chrome).not.toContain('title="End turn"');
    expect(chrome).toContain("mapInsightsWidget");
    expect(chrome).not.toContain("workCanvasHeaderExtra");
    expect(chrome).toContain("mapInsightsWidget");
    expect(chrome).not.toContain("ILE_MAP_INSIGHTS_WIDGET_CLASS");
    expect(frame).not.toContain(">Chapter</span>");
    expect(frame).not.toContain("data-ile-work-canvas-wide-toggle");
    expect(frame).not.toContain("Exit full screen");
    expect(frame).not.toContain("Full screen canvas");
    expect(frame).not.toContain("onToggleWide");
    expect(frame).toContain("data-ile-helios-widget-minimize");
    expect(frame).toContain('wide ? "border-0" : "border border-neutral-700"');
    expect(chrome).not.toContain("ILE_MAP_VOICE_BAR_CLEARANCE_CLASS");
    expect(chrome).not.toContain("left-1/2 top-2");
    expect(chrome).not.toContain("-translate-x-1/2");
    expect(chrome).not.toContain("ileSidebarSignalCount");
    expect(chrome).not.toContain("insightCount");
    expect(chrome).toContain('focusLabel="Insights"');
    expect(read("components/SessionView.tsx")).not.toContain("insightCount={sessionInsights.length}");
    expect(chrome).toContain('mode="ile"');
    expect(chrome).not.toContain("clock=");
    expect(chrome).not.toContain("IleWorkCanvasTimer");
    expect(read("components/SessionView.tsx")).not.toContain("IleWorkCanvasTimer");
    expect(chrome).not.toContain('mode="tap"');
    expect(chrome).not.toContain('mode="verification-tap"');
    expect(SESSION_SIDEBAR_COLLAPSED_REM).toBeGreaterThanOrEqual(5.5);
    expect(SESSION_SIDEBAR_COLLAPSED_REM).toBeLessThanOrEqual(7.5);
    expect(SESSION_SIDEBAR_EXPANDED_REM).toBeLessThanOrEqual(24);
    expect(SESSION_SIDEBAR_COLLAPSED_REM).toBeLessThan(SESSION_SIDEBAR_EXPANDED_REM);
    const sidebar = read("components/session-view/session-sidebar.tsx");
    expect(sidebar).toContain("sessionSidebarRailStyle");
    expect(sidebar).toContain("sessionSidebarHasSection");
    expect(sidebar).not.toContain("data-session-sidebar-toggle");
    expect(sidebar).toContain("data-session-sidebar-focus");
    expect(sidebar).toContain("data-session-sidebar-clock");
    expect(sidebar).not.toMatch(/(?:^|[\s"'`])w-0(?:[\s"'`]|$)/);
    expect(sidebar).not.toContain("translate-x-full");
    expect(sidebar).not.toContain("display:none");
    expect(sidebar).not.toContain("display: none");
    expect(ILE_HELIOS_WIDGET_WIDTH_PX).toBeGreaterThanOrEqual(520);

    expect(chrome).not.toContain("ResizablePane");
    expect(chrome).not.toContain("session-split-tools-helios");
    expect(view).not.toContain("session-split-tools-helios");
    expect(view).not.toContain("ResizablePane");
    expect(chrome).not.toContain("<ResizablePane");

    expect(chrome).toContain("data-ile-tools-widget");
    expect(chrome).not.toContain("<ToolsPanel");
    expect(tools).not.toContain("export function ToolsPanel");
    expect(tools).not.toContain("data-ile-tools-collapse");
    expect(tools).not.toContain("{t('tools.tools')}");
    expect(tools).not.toContain('t("tools.tools")');
    expect(tools).not.toContain(">Hide</button>");
    expect(tools).not.toContain('data-ile-tools-layout="compact"');
    expect(tools).not.toContain("data-ile-tools-grid");
    expect(tools).not.toContain("max-w-[36rem]");
    expect(tools).toContain("WebcamMiniPreview");
    expect(tools).toContain("data-ile-webcam-preview");
    expect(tools).toContain("grayscale");
    expect(chrome).toContain("WebcamMiniPreview");
    expect(chrome).toContain("onTurnOff={onTurnOffWebcam}");
    expect(chrome).toContain("onTurnOff={onStopScreenCapture}");
    expect(tools).toContain('data-ile-sensor-off={testId}');
    expect(tools).toContain("Turn off");
    expect(tools).toContain("aspect-video w-full object-cover");
    expect(tools).not.toContain("h-14 w-full object-cover");
    expect(chrome).toContain("data-ile-sensor-pair");
    expect(chrome).toContain("grid-cols-2");
    expect(tools).toContain("AudioMiniPreview");
    expect(tools).toContain("data-ile-audio-preview");
    expect(tools).toContain("data-ile-audio-mute");
    expect(chrome).toContain("<AudioMiniPreview");
    expect(chrome).not.toContain("onTurnOff={onToggleAudioMute}");
    expect(tools).toContain("EegMiniPreview");
    expect(tools).toContain("data-ile-eeg-preview");
    expect(tools).toContain("ScreenShareMiniPreview");
    expect(tools).toContain("data-ile-screenshare-preview");
    expect(chrome).toContain("museStatus === \"streaming\" ? (");
    expect(chrome).toContain("museChannelData={museChannelData}");
    expect(chrome).toContain("bandPowers={bandPowers}");
    expect(tools).toContain("data-ile-eeg-quality");
    expect(tools).toContain("data-ile-eeg-bands");
    const eegPreview = tools.slice(
      tools.indexOf("export function EegMiniPreview"),
      tools.indexOf("export function ScreenShareMiniPreview"),
    );
    expect(eegPreview).not.toContain("<canvas");
    expect(eegPreview).toContain("data-ile-eeg-band");
    expect(chrome).toContain("isScreenCapturing ? (");
    expect(chrome).toContain("<ScreenShareMiniPreview stream={screenShareStream}");
    expect(tools).toContain("aspect-video");
    expect(tools).toContain("overflow-hidden");
    expect(tools).not.toContain("overflow-y-auto");
    expect(tools).not.toContain("w-[168px]");
    expect(tools).not.toContain("data-ile-tools-grid");
    expect(voice).not.toContain("VoiceBarUtilityRow");
    expect(voice).toContain("data-ile-bar-data");
    expect(voice).toContain("data-ile-bar-logs");
    expect(voice).toContain("data-ile-bar-save");
    expect(voice).toMatch(/data-ile-bar-data[\s\S]{0,400}\n\s*Data/);
    expect(voice).toMatch(/data-ile-bar-logs[\s\S]{0,400}\n\s*Logs/);
    expect(voice).toMatch(/data-ile-bar-save[\s\S]{0,400}\n\s*Save/);
    expect(voice.indexOf("data-ile-transcription-box")).toBeLessThan(
      voice.indexOf("data-ile-voice-bar-actions"),
    );
    expect(voice.indexOf("data-ile-voice-bar-actions")).toBeLessThan(
      voice.indexOf("data-ile-bar-data"),
    );
    expect(voice).not.toContain("IleVoiceActionPad");
    expect(voice).not.toContain("data-ile-voice-chapter-brief");
    expect(tools).toContain("data-ile-voice-utility");
    expect(tools).toContain('const utilityTools: Tool[] = ["data-input", "logs"]');
    expect(tools).not.toContain('["help", "data-input", "logs"]');
    expect(tools).toContain("flex-col");
    expect(tools).not.toContain("grid-cols-4");
    expect(tools).toContain("data-save-and-exit");
    const utility = tools.slice(
      tools.indexOf("export function VoiceBarUtilityRow"),
      tools.indexOf("const sensorHalfWidgetShell"),
    );
    expect(utility).toContain("h-full");
    expect(utility).toContain("flex-1");
    expect(utility).toContain("self-stretch");
    expect(utility).not.toContain("justify-end");
    expect(utility).not.toContain("h-8");
    const fade = read("components/thought-ui/SlidingTranscript.tsx");
    expect(fade).toContain("data-ile-transcript-fade");
    expect(fade).toContain("overflowing");
    expect(fade).toContain("scrollWidth > el.clientWidth");

    expect(mini).toContain("data-block-minimap");
    expect(mini).toContain("right-2 top-2");

    const rail = read("components/block-skill-grid/map-tool-rail.tsx");
    expect(rail).toContain('data-block-map-tool-strip-layout="widget"');
    expect(rail).toContain("absolute left-2 z-20");
    expect(rail).toContain("overflow-hidden");
    expect(rail).not.toContain("overflow-y-auto");
    const grid = read("components/BlockSkillGrid.tsx");
    const chapterMap = read("components/ChapterMapPanel.tsx");
    expect(chapterMap).toContain("SKILL_GRID_ILE_DEFAULT_ZOOM_AT_REFERENCE");
    expect(grid).toContain("defaultZoomAtReference");
    expect(grid).toContain("overlayAnchorClass");
    expect(grid).toContain('suggestMode === "chapter" ? "top-12" : "top-2"');
    expect(grid).not.toContain('hidden: suggestMode === "chapter"');
    expect(rail).toContain("if (!annotationDrawingActive) return null");
    expect(rail).toContain("data-annotation-toolbox");

    expect(voice).toContain("data-ile-voice-bar");
    expect(voice).toContain("w-full");
    expect(voice).not.toContain("inset-x-0 bottom-0");
    expect(voice).not.toContain("absolute inset-x-0");
    expect(voice).toContain("ILE_VOICE_BAR_HEIGHT_CLASS");
    expect(voice).not.toContain("min-h-[7.25rem]");
    expect(ILE_VOICE_BAR_HEIGHT_CLASS).toBe("h-10");
    expect(voice).toContain("<SlidingTranscript");
    expect(helios).not.toContain("<SlidingTranscript");
    expect(helios).not.toContain("data-ile-voice-bar");

    const chapter = read("components/ChapterMapPanel.tsx");
    expect(chapter).not.toContain("data-ile-chapter-inspector");
    expect(chapter).not.toContain('t("chapterMap.markDone")');
    expect(chrome).not.toContain("ILE_MAP_VOICE_BAR_CLEARANCE_CLASS");
    expect(ILE_MAP_VOICE_BAR_CLEARANCE_CLASS).toBe("bottom-12");
    const heliosActions = read("components/session-view/ile-chapter-helios-actions.tsx");
    expect(heliosActions).toContain("data-ile-chapter-helios-actions");
    expect(heliosActions).toContain("data-ile-chapter-actions");
    expect(heliosActions).toContain("doneAnswering");
    expect(heliosActions).not.toContain('t("chapterMap.complete")');
    expect(heliosActions).not.toContain('t("chapterMap.edit")');
    expect(heliosActions).not.toContain('t("chapterMap.gatherResources")');
    expect(heliosActions).not.toContain('t("chapterMap.reloadChapter")');
    expect(heliosActions).not.toContain('t("chapterMap.loadChapter")');
    expect(heliosActions).not.toContain("data-ile-close-override");
    expect(helios).toContain("IleChapterHeliosActions");
    expect(view).toContain("chapterActions");

    for (const src of [chrome, tools, voice]) {
      expect(src).toContain("rounded-none");
      expect(src).not.toMatch(BOX_ROUNDED_RE);
    }
    expect(chrome).not.toContain("ILE_POW_DISPLAY_COUNTER_TYPES");
    expect(chrome).not.toContain("data-ile-pow-count={type}");
    expect(chrome).not.toContain("data-ile-pow-submitted");
    expect(chrome).not.toContain("data-ile-pow-unsubmitted");
    expect(chrome).not.toContain("data-ile-pow-dual-pill");
    expect(chrome).not.toContain("IleSubmitWorkButton");
    expect(chrome).not.toContain("data-ile-identity-row");
    expect(chrome).not.toContain("data-ile-session-insights-count");
    expect(chrome).not.toContain("data-ile-review-work");
    expect(chrome).not.toContain("data-ile-submit-turn");
    expect(chrome).not.toContain("ILE_POW_COUNTER_LABELS[type]");
    expect(chrome).not.toContain("ILE_POW_COUNTER_ICONS[type]");
    expect(chrome).not.toContain("onReviewWork");
    expect(chrome).not.toContain("data-ile-global-resources");
    expect(chrome).not.toContain("onOpenGlobalResources");
    expect(chrome).not.toContain("globalResourcesOpen");
    expect(chrome).toContain("resources={resources}");
    expect(chrome).toContain("resourcesOpen={resourcesOpen}");
    expect(read("components/session-view/session-sidebar.tsx")).toContain(
      "data-ile-global-resources",
    );
    expect(chrome).not.toContain("data-ile-end-turn");
    expect(chrome).not.toContain(">Traces<");
    const powIcons = read("components/session-view/ile-pow-icons.tsx");
    expect(powIcons).toContain("thoughts:");
    const counters = read("lib/ile-pow-counters.ts");
    expect(counters).toContain('"tool"');
    expect(counters).toContain('"screen"');
    expect(counters).toContain('"video"');
    expect(counters).toContain('"eeg"');
    expect(counters).toContain('"thoughts"');
    expect(counters).toContain("isIleSpokenThoughtArtifact");

    expect(isIleMapOverlayTool("canvas")).toBe(false);
    expect(isIleMapOverlayTool("plan-resources")).toBe(false);
    expect(isIleMapOverlayTool("thought-history")).toBe(true);
    expect(isIleMapOverlayTool("chapters")).toBe(false);
    expect(ILE_MAP_OVERLAY_TOOLS).not.toContain("plan-resources");
    expect(ILE_MAP_OVERLAY_TOOLS).toContain("thought-history");
    expect(ILE_MAP_OVERLAY_TOOLS).not.toContain("notebook");
    expect(ILE_HELIOS_WIDGET_TOP_PX).toBe(8 + MINIMAP_FRAME_HEIGHT + 8);

    writeScratch(
      "ile-map-chrome-excerpts.txt",
      [
        "stage=data-ile-canvas-stage",
        "minimap=data-block-minimap right-2 top-2",
        "no ResizablePane in session-chrome",
        `overlayTools=${ILE_MAP_OVERLAY_TOOLS.join(",")}`,
        `heliosTop=${ILE_HELIOS_WIDGET_TOP_PX}`,
        "voice bar owns SlidingTranscript; Helios widget does not",
        `voiceBarClearance=${ILE_MAP_VOICE_BAR_CLEARANCE_CLASS}`,
        "insights, chapters, signals, transcript, and clock share the right sidebar",
        "pow counters tool/screen/video/eeg",
        "rounded-none overlay chrome",
        "tools widget = equal 4-col grid cells",
      ].join("\n"),
    );
  });
});
