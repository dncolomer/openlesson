/**
 * ILE Work chrome: no I'm done answering on chapter/PiP; session turn close;
 * expense slider beside aesthetics/map type; Work/PoW visualization.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { ILE_SUBMIT_TURN_LABEL } from "@/lib/ile-session-turn-close";
import {
  aestheticImageForId,
  assignIleWorkAestheticImages,
  resolveIleWorkAestheticImage,
} from "@/lib/aesthetics";

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
  });
});

describe("ILE Work / PoW chrome (shipped source)", () => {
  it("chapter widget and PiP omit I'm done answering; TAP keeps it; slider and Work bar ship", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    const compact = read("components/IleCompactStashWindow.tsx");
    const chrome = read("components/session-view/session-chrome.tsx");
    const welcome = read("components/session-view/session-welcome-modal.tsx");
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
    expect(chrome).toContain("IleSubmitWorkButton");
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
    expect(dockBar).toContain("data-ile-global-resources");
    expect(dockBar).toContain("data-ile-submit-turn");
    expect(dockBar).toContain("data-ile-review-work");
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
    expect(dockBar).toContain("size-24");
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
    expect(chrome).toContain("data-ile-review-work");
    expect(chrome).toContain("right-2");
    const dockSlice = chrome.slice(chrome.indexOf("data-ile-work-dock"));
    expect(dockSlice).toContain("onOpenGlobalResources");
    expect(dockSlice).not.toContain("onSubmitTurn");
    expect(view).toContain("compact");
    expect(view).toContain("onSubmitTurn={() => void handleSubmitTurn()}");
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
    expect(ILE_SUBMIT_TURN_LABEL.toLowerCase()).toMatch(/submit|work/);

    expect(docs).toMatch(/Work expense/i);
    expect(docs).toMatch(/Submit work/);
    expect(docs).toMatch(/Gather resources/);

    writeScratch(
      "ile-work-chrome.txt",
      [
        "chapter widget: no ImDoneAnsweringControl",
        "PiP compact: no I'm done answering",
        "TAP: ImDoneAnsweringControl kept",
        "welcome: data-ile-pow-expense-slider beside aesthetics/map type",
        "chrome: Submit work left of identity pill; dock is Global resources + chapter chips",
        "minimized chips use aesthetic stills + map two-word keyword; bar has no bg image",
        "Work widget bg uses the same session-lived still as the chapter dock chip and map tile",
        "chapters open from the dock; minimize keeps chips on the bar",
        "save stores ile_open_work_ids; resume restores unclosed Work",
        "submit routes resolveIleWorkChatTarget + sendThought chapterId",
        "PoW bar shows submitted + red unsubmitted; Submit work left of identity pill",
        `submitLabel=${ILE_SUBMIT_TURN_LABEL}`,
      ].join("\n"),
    );
  });
});
