import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  ILE_HELIOS_WIDGET_TOP_PX,
  ILE_HELIOS_WIDGET_WIDTH_PX,
  ILE_MAP_OVERLAY_TOOLS,
  ILE_MAP_VOICE_BAR_CLEARANCE_CLASS,
  isIleMapOverlayTool,
} from "@/lib/ile-map-chrome";
import { MINIMAP_FRAME_HEIGHT } from "@/lib/map-minimap-frame";

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

describe("ILE map-first session chrome (shipped surface)", () => {
  it("is full-viewport map with overlay widgets, not a tools/Helios split", () => {
    const view = readSessionViewSurface();
    const chrome = read("components/session-view/session-chrome.tsx");
    const tools = read("components/ToolsPanel.tsx");
    const helios = read("components/SessionHeliosPanel.tsx");
    const voice = read("components/session-view/ile-voice-bar.tsx");
    const mini = read("components/block-skill-grid/map-minimap-chrome.tsx");

    expect(view).toContain("data-ile-map-stage");
    expect(view).toContain("<ChapterMapPanel");
    expect(chrome).toContain("data-ile-map-stage");
    expect(chrome).toContain("data-ile-tools-widget");
    expect(chrome).toContain("data-ile-pow-resource-bar");
    expect(chrome).toContain("SessionIdentityBadge");
    expect(chrome).toContain("data-ile-identity-row");
    expect(chrome).not.toContain("<SensorStrip");
    expect(chrome).not.toContain("data-ile-signal-strip");
    expect(tools).toContain("data-ile-signal-strip");
    expect(chrome).toContain("data-ile-pow-resource-label");
    expect(chrome).toContain("Proof of Work Resources");
    expect(chrome).toContain("data-ile-pow-count");
    expect(chrome).toContain("data-ile-tool-overlay");
    expect(chrome).toContain("IleChapterWidgetFrame");
    expect(chrome).toContain("heliosOpen");
    expect(view).toContain("heliosOpen={heliosWidgetOpen}");
    expect(view).toContain("introOpen={showWelcomePanel}");
    expect(chrome).toContain("data-ile-intro-widget");
    expect(chrome).not.toContain("data-ile-intro-widget-close");
    expect(chrome).not.toContain(">Briefing</span>");
    expect(chrome).not.toContain(">Intro</span>");
    const introWidgetIdx = chrome.indexOf("data-ile-intro-widget");
    const heliosOpenIdx = chrome.indexOf("{heliosOpen ? (");
    expect(introWidgetIdx).toBeGreaterThan(-1);
    expect(heliosOpenIdx).toBeGreaterThan(introWidgetIdx);
    expect(chrome.slice(introWidgetIdx, heliosOpenIdx)).not.toContain("✕");
    expect(chrome).not.toContain("onCloseIntro");
    expect(view).not.toContain("onCloseIntro");
    expect(chrome).toContain("max-h-[min(88vh,44rem)]");
    expect(chrome).not.toMatch(/(?<!max-)h-\[min\(88vh,44rem\)\]/);
    expect(view).toContain("<SessionOnboardingGuide");
    expect(helios).not.toContain("SessionOnboardingGuide");
    expect(helios).not.toContain("data-ile-intro-widget");
    const helpChrome = read("components/session-view/use-session-chrome.ts");
    expect(helpChrome).toContain('if (tool === "help")');
    expect(helpChrome).toContain("setShowWelcomePanel(true)");
    expect(view).not.toContain("onChapterClick");
    expect(view).toContain("onWorkChapter");
    expect(view).not.toContain("onChapterDoubleClick");
    expect(view).toContain("<IleVoiceBar");
    expect(chrome).toContain("ILE_HELIOS_WIDGET_TOP_PX");
    expect(chrome).toContain("ILE_HELIOS_WIDGET_WIDTH_PX");
    const frame = read("components/session-view/ile-chapter-widget-frame.tsx");
    expect(frame).toContain("data-ile-helios-widget");
    expect(frame).toContain(">Chapter</span>");
    expect(chrome).toContain("ILE_MAP_VOICE_BAR_CLEARANCE_CLASS");
    expect(ILE_HELIOS_WIDGET_WIDTH_PX).toBeGreaterThanOrEqual(520);

    expect(chrome).not.toContain("ResizablePane");
    expect(chrome).not.toContain("session-split-tools-helios");
    expect(view).not.toContain("session-split-tools-helios");
    expect(view).not.toContain("ResizablePane");
    expect(chrome).not.toContain("<ResizablePane");

    expect(tools).toContain("data-ile-tools-widget");
    expect(tools).not.toContain("data-ile-tools-collapse");
    expect(tools).not.toContain("{t('tools.tools')}");
    expect(tools).not.toContain('t("tools.tools")');
    expect(tools).not.toContain(">Hide</button>");
    expect(tools).toContain('data-ile-tools-layout="compact"');
    expect(tools).toContain("w-[min(20rem,calc(100vw-1rem))]");
    expect(tools).not.toContain("max-w-[36rem]");
    expect(tools).toContain("data-ile-tools-grid");
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
    expect(tools).toContain("grid grid-cols-4");
    expect(tools).toContain("auto-rows-[3.25rem]");
    expect(tools).toContain("flex-col items-center justify-center");
    expect(tools).toContain("overflow-hidden");
    expect(tools).not.toContain("overflow-y-auto");
    expect(tools).not.toContain("w-[168px]");
    const toolsGridIdx = tools.indexOf("data-ile-tools-grid");
    expect(toolsGridIdx).toBeGreaterThan(-1);
    const toolsGridEnd = tools.indexOf("export function WebcamMiniPreview");
    expect(toolsGridEnd).toBeGreaterThan(toolsGridIdx);
    expect(tools.slice(toolsGridIdx, toolsGridEnd)).not.toContain("flex-wrap");
    expect(tools.slice(toolsGridIdx, toolsGridEnd)).not.toContain("data-save-and-exit");
    expect(voice).toContain("VoiceBarUtilityRow");
    expect(tools).toContain("data-ile-voice-utility");
    expect(tools).toContain("data-save-and-exit");
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
    expect(grid).toContain("overlayAnchorClass");
    expect(grid).toContain('suggestMode === "chapter" ? "top-12" : "top-2"');

    expect(voice).toContain("data-ile-voice-bar");
    expect(voice).toContain("w-full");
    expect(voice).toContain("inset-x-0 bottom-0");
    expect(voice).toContain("<SlidingTranscript");
    expect(helios).not.toContain("<SlidingTranscript");
    expect(helios).not.toContain("data-ile-voice-bar");

    const chapter = read("components/ChapterMapPanel.tsx");
    expect(chapter).not.toContain("data-ile-chapter-inspector");
    expect(chapter).not.toContain('t("chapterMap.markDone")');
    expect(chrome).toContain("ILE_MAP_VOICE_BAR_CLEARANCE_CLASS");
    expect(ILE_MAP_VOICE_BAR_CLEARANCE_CLASS).toBe("bottom-24");
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
    expect(chrome).toContain("ILE_POW_DISPLAY_COUNTER_TYPES");
    expect(chrome).toContain("data-ile-pow-count={type}");
    expect(chrome).toContain("ILE_POW_COUNTER_LABELS[type]");
    expect(chrome).toContain("ILE_POW_COUNTER_ICONS[type]");
    expect(chrome).not.toContain(">Traces<");
    expect(chrome).toContain("thoughts:");
    const counters = read("lib/ile-pow-counters.ts");
    expect(counters).toContain('"tool"');
    expect(counters).toContain('"screen"');
    expect(counters).toContain('"video"');
    expect(counters).toContain('"eeg"');
    expect(counters).toContain('"thoughts"');
    expect(counters).toContain("isIleSpokenThoughtArtifact");

    expect(isIleMapOverlayTool("canvas")).toBe(true);
    expect(isIleMapOverlayTool("chapters")).toBe(false);
    expect(ILE_MAP_OVERLAY_TOOLS).toContain("notebook");
    expect(ILE_HELIOS_WIDGET_TOP_PX).toBe(8 + MINIMAP_FRAME_HEIGHT + 8);

    writeScratch(
      "ile-map-chrome-excerpts.txt",
      [
        "map-stage=data-ile-map-stage",
        "minimap=data-block-minimap right-2 top-2",
        "no ResizablePane in session-chrome",
        `overlayTools=${ILE_MAP_OVERLAY_TOOLS.join(",")}`,
        `heliosTop=${ILE_HELIOS_WIDGET_TOP_PX}`,
        "voice bar owns SlidingTranscript; Helios widget does not",
        `voiceBarClearance=${ILE_MAP_VOICE_BAR_CLEARANCE_CLASS}`,
        "chapter inspector + tools widget sit above voice bar",
        "pow counters tool/screen/video/eeg",
        "rounded-none overlay chrome",
        "tools widget = equal 4-col grid cells",
      ].join("\n"),
    );
  });
});
