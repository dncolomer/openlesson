/**
 * ILE Work chrome: no I'm done answering on chapter/PiP; session turn close;
 * expense slider beside aesthetics/map type; Work/PoW visualization.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { ILE_END_TURN_LABEL, ILE_SUBMIT_TURN_LABEL } from "@/lib/ile-session-turn-close";
import {
  aestheticImageForId,
  assignIleWorkAestheticImages,
  parseIleWorkAestheticStored,
  resolveIleWorkAestheticImage,
} from "@/lib/aesthetics";
import { ileTabUnfocusPowFromFocusEvent, ILE_TAB_UNFOCUS_TOOL_ACTION } from "@/lib/ile-thought-traces";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b5fb51e17c96/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("assignIleWorkAestheticImages", () => {
  it("keeps existing picks and assigns unused images to new Work ids", () => {
    const pool = ["/a.jpg", "/b.jpg", "/c.jpg"];
    const first = assignIleWorkAestheticImages({
      ids: ["ch-a"],
      images: pool,
      random: () => 0,
    });
    expect(first["ch-a"]).toBe("/a.jpg");
    const second = assignIleWorkAestheticImages({
      ids: ["ch-a", "ch-b"],
      current: first,
      images: pool,
      random: () => 0,
    });
    expect(second["ch-a"]).toBe("/a.jpg");
    expect(second["ch-b"]).toBe("/b.jpg");
    const dropped = assignIleWorkAestheticImages({
      ids: ["ch-b"],
      current: second,
      images: pool,
      random: () => 0,
    });
    expect(dropped).toEqual({ "ch-b": "/b.jpg" });
  });
});

describe("resolveIleWorkAestheticImage", () => {
  it("uses the session-lived assigned still, else a stable per-id pick", () => {
    const pool = ["/a.jpg", "/b.jpg", "/c.jpg"];
    expect(
      resolveIleWorkAestheticImage({
        id: "ch-a",
        assigned: "/b.jpg",
        images: pool,
      }),
    ).toBe("/b.jpg");
    expect(
      resolveIleWorkAestheticImage({
        id: "ch-a",
        images: pool,
      }),
    ).toBe(aestheticImageForId("ch-a", pool));
    expect(
      resolveIleWorkAestheticImage({
        id: "ch-b",
        assigned: "  ",
        images: pool,
      }),
    ).toBe(aestheticImageForId("ch-b", pool));

    const firstVisit = assignIleWorkAestheticImages({
      ids: ["ch-a"],
      images: pool,
    });
    expect(firstVisit["ch-a"]).toBe(aestheticImageForId("ch-a", pool));
    const stored = JSON.stringify(firstVisit);
    const parsed = parseIleWorkAestheticStored(stored);
    const remount = assignIleWorkAestheticImages({
      ids: ["ch-a"],
      current: parsed,
      images: pool,
    });
    expect(remount["ch-a"]).toBe(firstVisit["ch-a"]);
    expect(remount["ch-a"]).toBeTruthy();
  });
});

describe("ILE tab unfocus PoW (shipped)", () => {
  it("visibilitychange hidden and blur produce a stable tab_unfocus action", () => {
    const hidden = ileTabUnfocusPowFromFocusEvent({
      type: "visibilitychange",
      hidden: true,
      sessionId: "s1",
      workspaceId: "w1",
    });
    expect(hidden?.toolAction).toBe(ILE_TAB_UNFOCUS_TOOL_ACTION);
    expect(hidden?.toolAction).toBe("tab_unfocus");
    expect(hidden?.reason).toBe("tab_hidden");

    const visible = ileTabUnfocusPowFromFocusEvent({
      type: "visibilitychange",
      hidden: false,
    });
    expect(visible).toBeNull();

    const blur = ileTabUnfocusPowFromFocusEvent({ type: "blur" });
    expect(blur?.toolAction).toBe("tab_unfocus");
    expect(blur?.reason).toBe("window_blur");

    const speech = read("components/session-view/use-session-speech.ts");
    expect(speech).toContain("ileTabUnfocusPowFromFocusEvent");
    expect(speech).toContain("visibilitychange");
    expect(speech).toContain('addEventListener("blur"');
  });
});

describe("ILE Work / PoW chrome (shipped source)", () => {
  it("chapter widget and PiP omit I'm done answering; TAP keeps it; slider and Work bar ship", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    const compact = read("components/IleCompactStashWindow.tsx");
    const chrome = read("components/session-view/session-chrome.tsx");
    const welcome = read("components/session-view/session-welcome-modal.tsx");
    expect(welcome).toContain("data-ile-session-settings");
    expect(welcome).toContain("h-screen");
    expect(welcome).not.toContain("DialogFrame");
    expect(existsSync(join(ROOT, "app/session/settings/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/ile/session/[token]/settings/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/learn/[token]/session/settings/page.tsx"))).toBe(true);
    const view = readSessionViewSurface();
    const speech = read("components/session-view/use-session-speech.ts");
    const tapPhases = read("components/tap-score/tap-score-phases.tsx");
    const tapShell = read("components/exercise-tap/ExerciseTapShell.tsx");
    const docs = read("docs/ile-pow-resources.md");

    expect(helios).not.toContain("ImDoneAnsweringControl");
    expect(helios).not.toContain("data-ile-im-done-answering-overlay");
    expect(helios).not.toContain("I'm done answering");
    expect(compact).not.toContain("ImDoneAnsweringControl");
    expect(compact).not.toContain("I'm done answering");
    expect(compact).not.toContain("data-ile-im-done-answering");

    expect(tapPhases).toContain("ImDoneAnsweringControl");
    expect(tapShell).toContain("ImDoneAnsweringControl");

    expect(welcome).toContain("data-ile-pow-expense-slider");
    expect(welcome).toContain("AestheticPicker");
    expect(welcome).toContain("InitialChaptersPicker");
    expect(welcome).toContain("session.powExpense");
    expect(view).toContain("powExpense={powExpense}");
    expect(view).toContain("tryStartWork");
    expect(view).toContain("handleWorkChapter");
    expect(view).toContain("closeIleOpenWorkTurn");
    expect(view).toContain("resolveIleWorkChatTarget");
    expect(view).toContain("chapterId");
    expect(view).toContain("spentUnits");
    expect(speech).toContain("submitHeliosChatMessageNow(text, undefined, chapterId)");

    expect(chrome).toContain("data-ile-pow-resource-bar");
    expect(chrome).toContain("data-ile-pow-submitted");
    expect(chrome).toContain("data-ile-pow-unsubmitted");
    expect(chrome).toContain("data-ile-pow-dual-pill");
    expect(chrome).toContain("data-ile-work-dock");
    expect(chrome).toContain("IleWorkDockBar");
    expect(chrome).not.toContain("IleSubmitWorkButton");
    expect(chrome).toContain("IleChapterToolTabs");
    expect(chrome).not.toContain("data-ile-work-dock-shifted");
    expect(chrome).toContain("data-ile-chapter-dock-panel");
    expect(chrome).toContain("ILE_MAP_WIDGET_FRAME_CLASS");
    expect(chrome).toContain("onMinimize={onMinimizeHelios ?? onCloseHelios}");
    const workFrame = chrome.slice(
      chrome.indexOf("<IleChapterWidgetFrame"),
      chrome.indexOf("</IleChapterWidgetFrame>"),
    );
    expect(workFrame).toContain("onMinimize=");
    expect(workFrame).not.toContain("onClose=");
    const dockBar = read("components/session-view/ile-work-dock-bar.tsx");
    expect(dockBar).toContain("data-ile-work-dock-bar");
    expect(dockBar).not.toContain("data-ile-global-resources");
    expect(dockBar).toContain("data-ile-submit-turn");
    expect(dockBar).toContain("data-ile-end-turn");
    expect(dockBar).toContain("data-ile-end-turn-cluster");
    expect(dockBar).toContain("data-ile-end-turn-double-border");
    expect(dockBar).toContain("ArrowRight");
    expect(dockBar).not.toContain("data-ile-end-turn-stem");
    expect(dockBar).not.toContain("data-ile-review-work");
    expect(dockBar).toContain("emphasized");
    expect(dockBar).toContain("compact");
    expect(dockBar).not.toContain("data-ile-open-work-count");
    expect(dockBar).not.toContain("data-ile-pow-budget-remaining");
    expect(dockBar).toContain("data-ile-open-work-tabs");
    expect(dockBar).toContain("data-ile-chapter-minimized");
    expect(dockBar).toContain("data-ile-chapter-chip-image");
    expect(dockBar).toContain("data-ile-chapter-chip-keyword");
    expect(dockBar).toContain("resolveIleWorkAestheticImage");
    expect(dockBar).toContain("assigned: work.image");
    expect(view).toContain("assignIleWorkAestheticImages");
    expect(view).toContain("workAestheticById");
    expect(view).toContain("workAestheticImage={workAestheticById[activeChapterKey]}");
    const thoughtPane = read("components/session-view/session-thought-pane.tsx");
    expect(thoughtPane).toContain("workId={activeChapterKey}");
    expect(thoughtPane).toContain("workAestheticImage={workAestheticImage}");
    expect(helios).toContain("resolveIleWorkAestheticImage");
    expect(helios).toContain("assigned: workAestheticImage");
    expect(helios).not.toContain("Math.random");
    expect(helios).not.toContain("THOUGHT_BACKGROUND_IMAGES");
    expect(dockBar).toContain("FALLBACK_AESTHETIC_IMAGES");
    expect(dockBar).toContain("h-24");
    expect(view).toContain("resolveBlockMapGlyph");
    expect(view).toContain("map_keyword");
    expect(view).toContain("countIleUnsubmittedPowDisplay");
    expect(view).toContain("handleSubmitToHelios");
    expect(view).toContain("canvasDirtyForHelios");
    const panes = read("components/session-view/session-tool-panes.tsx");
    expect(panes).not.toContain("onSubmitToHelios");
    expect(panes).not.toContain("NotebookSubmitButton");
    expect(panes).not.toContain("doneWriting");
    expect(view).toContain("thought-history");
    expect(view).toContain("renderCompactWorkspace");
    const tabs = read("components/session-view/ile-chapter-tool-tabs.tsx");
    expect(tabs).toContain("data-ile-chapter-tool-tabs");
    expect(tabs).toContain("ILE_CHAPTER_WIDGET_TOOLS");
    expect(tabs).not.toContain("thought-history");
    expect(tabs).not.toContain('"data-input"');
    expect(tabs).not.toContain("logs:");
    expect(chrome).toContain("data-ile-session-insights-count");
    expect(chrome).not.toContain("data-ile-review-work");
    expect(chrome).toContain("right-2");
    const dockSlice = chrome.slice(chrome.indexOf("data-ile-work-dock"));
    expect(dockSlice).not.toContain("onOpenGlobalResources");
    expect(dockSlice).toContain("onSubmitTurn");
    expect(dockSlice).not.toContain("onReviewWork");
    const powBar = chrome.slice(
      chrome.indexOf("data-ile-pow-resource-bar"),
      chrome.indexOf("data-ile-session-modal"),
    );
    expect(powBar).toContain("data-ile-session-insights-count");
    expect(powBar).toContain("data-ile-global-resources");
    expect(powBar.indexOf("data-ile-session-insights-count")).toBeLessThan(
      powBar.indexOf("data-ile-global-resources"),
    );
    expect(powBar).not.toContain("IleSubmitWorkButton");
    expect(powBar).not.toContain("data-ile-review-work");
    expect(powBar).not.toContain("data-ile-submit-turn");
    expect(view).toContain("compact");
    expect(view).toContain("onSubmitTurn={() => void handleSubmitTurn()}");
    expect(view).toContain("setCraftingInsightsOpen(true)");
    expect(view).toContain("data-ile-compact-insight-craft");
    expect(view).toContain("turnInsightCraft(false)");
    expect(view).toContain("ileSessionSettingsPath");
    expect(view).toContain("if (showWelcomeModal)");
    expect(view).toContain("IleTurnInsightCraft");
    expect(view).toContain("IleSessionInsightsPanel");
    const craft = read("components/session-view/ile-turn-insight-craft.tsx");
    expect(craft).toContain("data-ile-turn-insight-craft");
    expect(craft).toContain("data-ile-turn-insight-craft-still");
    expect(craft).toContain("data-ile-turn-insight-chapters");
    expect(craft).toContain("data-ile-turn-insight-path=\"type\"");
    expect(craft).toContain("data-ile-turn-insight-path=\"pool\"");
    expect(craft).toContain("Continue with the next turn");
    expect(craft).toContain("Save and go out of the workspace");
    expect(craft).toContain("ILE_TURN_INSIGHT_EVALUATE_PATH");
    expect(craft).toContain("buildIleThoughtsPoolCandidateRequest");
    expect(craft).toContain("portal={portal}");
    expect(read("components/ui/DialogFrame.tsx")).toContain("portal = true");
    expect(view).toContain("onMinimizeHelios");
    expect(view).toContain("aestheticImages={selectedAesthetic?.images}");
    expect(view).toContain("openWorkIds={openWorkIds}");
    const chapterMap = read("components/ChapterMapPanel.tsx");
    expect(chapterMap).toContain("openWorkIds={openWorkIds}");
    expect(chapterMap).toContain("aestheticImages={aestheticImages}");
    expect(chapterMap).toContain("workAestheticById={workAestheticById}");
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).toContain("data-ile-open-work-tile-image");
    expect(world).toContain("workAestheticById");
    expect(world).toContain("resolveIleWorkAestheticImage");
    expect(world).toContain("aestheticImageForId");
    expect(world).toContain("hideIcon={Boolean(tileAesthetic)}");
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).toContain("hideIcon");
    expect(view).toContain("parseIleOpenWorkIdsFromMetadata");
    expect(view).toContain("restoreIleOpenWorkIds");
    expect(view).toContain("openWorkIdsRef");
    const phase = read("components/session-view/use-session-phase.ts");
    expect(phase).toContain("applyIleOpenWorkIdsToMetadata");
    expect(phase).toContain("openWorkIdsRef.current");
    const frame = read("components/session-view/ile-chapter-widget-frame.tsx");
    expect(frame).toContain("data-ile-helios-widget-minimize");
    expect(ILE_END_TURN_LABEL).toBe("End turn");
    expect(ILE_SUBMIT_TURN_LABEL).toBe(ILE_END_TURN_LABEL);
    expect(ILE_END_TURN_LABEL.toLowerCase()).toMatch(/end|turn/);

    expect(docs).toMatch(/Work expense/i);
    expect(docs).toMatch(/End turn/);
    expect(docs).toMatch(/Gather resources/);

    writeScratch(
      "ile-turn-followup-chrome.txt",
      [
        "PoW bar: Insights then quieter Global resources; no Review work",
        "dock: End turn double border + ArrowRight; no stem; no Review work; no Global resources square",
        "PiP: data-ile-compact-insight-craft + portal=false",
        "settings: data-ile-session-settings full-screen route, not DialogFrame",
        "help: Generate Work in turns / Create Insights / next turn",
      ].join("\n"),
    );
    writeScratch(
      "ile-end-turn-chrome.txt",
      [
        "PoW bar: dual pills + Insights + quieter Global resources; no Review work",
        "bottom-right: End turn double border + ArrowRight; no stem; no Review work",
        "PiP compact hosts crafting insights in-window (portal=false)",
        "Welcome settings is a dedicated /settings route, not a map DialogFrame",
        `endTurnLabel=${ILE_END_TURN_LABEL}`,
      ].join("\n"),
    );
    writeScratch(
      "ile-work-chrome.txt",
      [
        "chapter widget: no ImDoneAnsweringControl",
        "PiP compact: no I'm done answering",
        "TAP: ImDoneAnsweringControl kept",
        "welcome: data-ile-pow-expense-slider beside aesthetics/map type",
        "chrome: Insights + Global resources on PoW bar; End turn on dock with double border",
        "minimized chips use aesthetic stills + map two-word keyword; bar has no bg image",
        "Work widget bg uses the same session-lived still as the chapter dock chip and map tile",
        "chapters open from the dock; minimize keeps chips on the bar",
        "save stores ile_open_work_ids; resume restores unclosed Work",
        "submit routes resolveIleWorkChatTarget + sendThought chapterId",
        "PoW bar shows submitted + unsubmitted + session insights count; End turn is the dock cluster",
        `submitLabel=${ILE_END_TURN_LABEL}`,
      ].join("\n"),
    );
  });
});
