import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptyIleReviewWorkItems,
  ILE_REVIEW_WORK_LABEL,
  ILE_REVIEW_WORK_TOOL,
  listIleUnsubmittedReviewItems,
} from "@/lib/ile-review-work";
import { ILE_MAP_OVERLAY_TOOLS, ILE_CHAPTER_WIDGET_TOOLS } from "@/lib/ile-map-chrome";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ile-review-work/implementer";

function read(rel: string) {
  expect(existsSync(join(ROOT, rel)), `missing ${rel}`).toBe(true);
  return readFileSync(join(ROOT, rel), "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("listIleUnsubmittedReviewItems", () => {
  it("groups forming speech, stashed thoughts, and dirty tools; other types stay empty", () => {
    expect(listIleUnsubmittedReviewItems({})).toEqual(emptyIleReviewWorkItems());
    const items = listIleUnsubmittedReviewItems({
      thoughts: [
        { id: "t1", text: "first stash" },
        { id: "skip", text: "   " },
      ],
      formingText: "still speaking",
      canvasDirty: true,
      notebookDirty: true,
      notebookContent: "draft notes",
    });
    expect(items.thoughts.map((row) => row.id)).toEqual(["forming-speech", "t1"]);
    expect(items.thoughts[0]?.live).toBe(true);
    expect(items.tool.map((row) => row.id)).toEqual(["canvas", "notebook"]);
    expect(items.screen).toEqual([]);
    expect(items.video).toEqual([]);
    expect(items.eeg).toEqual([]);
    expect(items.tool[1]?.detail).toContain("draft notes");
  });
});

describe("Review work chrome (shipped source)", () => {
  it("is a map overlay with resource-type tabs; Thoughts is not a chapter tab", () => {
    expect(ILE_REVIEW_WORK_LABEL).toBe("Review work");
    expect(ILE_REVIEW_WORK_TOOL).toBe("thought-history");
    expect(ILE_MAP_OVERLAY_TOOLS).toContain("thought-history");
    expect(ILE_MAP_OVERLAY_TOOLS).toContain("plan-resources");
    expect(ILE_CHAPTER_WIDGET_TOOLS).not.toContain("thought-history");

    const chrome = read("components/session-view/session-chrome.tsx");
    expect(chrome).not.toContain("data-ile-review-work");
    expect(chrome).toContain("ILE_REVIEW_WORK_LABEL");
    expect(chrome).not.toContain("onReviewWork");
    const powBar = chrome.slice(
      chrome.indexOf("data-ile-pow-resource-bar"),
      chrome.indexOf("data-ile-session-modal"),
    );
    expect(powBar).not.toContain("IleSubmitWorkButton");
    expect(powBar).not.toContain("data-ile-review-work");
    expect(powBar).toContain("data-ile-session-insights-count");
    const insightsIdx = powBar.indexOf("data-ile-session-insights-count");
    expect(insightsIdx).toBeGreaterThan(-1);
    expect(powBar).not.toContain("data-ile-identity-row");

    const tabs = read("components/session-view/ile-chapter-tool-tabs.tsx");
    expect(tabs).not.toContain("thought-history");
    expect(tabs).not.toContain("Thoughts");

    const panel = read("components/session-view/ile-review-work-panel.tsx");
    expect(panel).toContain("data-ile-review-work-panel");
    expect(panel).toContain("IlePowTypeIcon");
    expect(panel).toContain("ILE_POW_DISPLAY_COUNTER_TYPES");
    expect(panel).not.toContain("Memory");
    expect(panel).not.toContain("Insights");
    expect(panel).not.toContain("ThoughtMemoryPanel");

    const panes = read("components/session-view/session-tool-panes.tsx");
    expect(panes).toContain("IleReviewWorkPanel");
    expect(panes).not.toContain("ThoughtMemoryPanel");
    expect(panes).toContain('activeTool === "thought-history"');

    const view = read("components/SessionView.tsx");
    expect(view).not.toContain("data-ile-compact-review-work");
    expect(view).toContain("data-ile-compact-insight-craft");
    const compact = view.slice(
      view.indexOf("const renderCompactWorkspace"),
      view.indexOf("renderCompact: () => renderCompactWorkspace()"),
    );
    expect(compact).not.toContain("data-ile-compact-review-work");
    expect(compact).toContain("IleWorkDockBar");
    expect(compact).toContain("data-ile-compact-insight-craft");
    expect(compact).toContain("turnInsightCraft(false)");
    expect(compact).not.toContain("onReviewWork");
    const dockBar = read("components/session-view/ile-work-dock-bar.tsx");
    expect(dockBar).not.toContain("data-ile-review-work");
    expect(dockBar).toContain("data-ile-end-turn-cluster");
    expect(chrome).not.toContain("onReviewWork");

    const icons = read("components/session-view/ile-pow-icons.tsx");
    expect(icons).toContain("thoughts:");
    expect(icons).toContain("Wrench");
    expect(icons).toContain("Monitor");
    expect(icons).toContain("Video");
    expect(icons).toContain("Activity");
    expect(icons).toContain("MessageCircle");

    writeScratch(
      "ile-review-work.txt",
      [
        "Review work has no ILE chrome button; panel remains as a buried overlay tool",
        "overlay tool=thought-history",
        "tabs=tool/screen/video/eeg/thoughts",
        "chapter widget has no Thoughts tab",
      ].join("\n"),
    );
  });
});
