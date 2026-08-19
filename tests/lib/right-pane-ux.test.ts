import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Right-pane UX: narrow column, Explore/Drill×timebox launch, mini tabs, news widget.
 * Drives shipped pure helpers + structural checks of UI source.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveLaunchFromStyleAndModality,
  resolveProductIntent,
} from "@/lib/product-intent";
import {
  BLOCK_DETAIL_MINI_TABS,
  WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS,
  WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS,
  nextBlockDetailMiniTab,
  resolveExclusiveBlockDetailDrawer,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";
import { deriveBlockExampleTopics } from "@/lib/block-example-topics";


const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.RIGHT_PANE_UX_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a6b66a4f65ae/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("Explore|Drill × Dialog/Solo → four launch targets", () => {
  it("maps all four combinations via resolveLaunchFromStyleAndModality (solo flag)", () => {
    // soloEnabled false → dialog; true → solo
    expect(resolveLaunchFromStyleAndModality("explore", false)).toEqual(
      resolveProductIntent("explore", "dialog"),
    );
    expect(resolveLaunchFromStyleAndModality("drill", false)).toEqual(
      resolveProductIntent("drill", "dialog"),
    );
    expect(resolveLaunchFromStyleAndModality("explore", true)).toEqual(
      resolveProductIntent("explore", "solo"),
    );
    expect(resolveLaunchFromStyleAndModality("drill", true)).toEqual(
      resolveProductIntent("drill", "solo"),
    );
    expect(resolveLaunchFromStyleAndModality("explore", false).id).toBe(
      "explore_dialog",
    );
    expect(resolveLaunchFromStyleAndModality("drill", true).id).toBe("drill_solo");

    writeEvidence(
      "launch-intent-timebox.log",
      [
        "explore dialog=" + resolveLaunchFromStyleAndModality("explore", false).id,
        "drill dialog=" + resolveLaunchFromStyleAndModality("drill", false).id,
        "explore solo=" + resolveLaunchFromStyleAndModality("explore", true).id,
        "drill solo=" + resolveLaunchFromStyleAndModality("drill", true).id,
      ].join("\n"),
    );
  });
});

describe("desktop layout + block detail chrome", () => {
  it("right column is half of prior half-width tokens (map 3/4, right 1/4)", () => {
    expect(WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS).toBe("md:w-3/4");
    expect(WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS).toBe("md:w-1/4");
    // Prior split was md:w-1/2 each; new right is 50% of that width.
    const view = readWorkspaceViewSurface();
    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(view).toContain("WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS");
    expect(view).toContain("WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS");
    expect(view).not.toMatch(/md:w-1\/2 md:border-b-0 md:border-r/);
    // AYCL is a thin access wrapper that mounts WorkspaceView (inherits map split).
    expect(aycl).toContain("WorkspaceView");
  });

  it("BlockDetailCard is Explore/Drill + Dialog/Solo; no ? help", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("resolveLaunchFromStyleAndModality");
    expect(card).toContain("data-style-option={id}");
    expect(card).toContain('id: "explore"');
    expect(card).toContain('id: "drill"');
    expect(card).toContain("data-modality-control");
    expect(card).toContain("data-modality-toggle");
    expect(card).toContain("data-modality-option");
    expect(card).toContain("data-product-intent-modality-grid");
    // Legacy timebox hooks kept as aliases for structural continuity
    expect(card).toContain("data-timebox-control");
    expect(card).toContain("data-timebox-toggle");
    expect(card).toContain('data-style-icon="explore"');
    expect(card).toContain('data-style-icon="drill"');
    // Style is select-only; Start + duration live on the card
    expect(card).toContain("data-style-select");
    expect(card).toContain("data-launch-start");
    expect(card).toContain("data-launch-duration-picker");
    expect(card).toContain("onClick={() => setStyle(id)}");
    expect(card).not.toContain("openEndedExploreHint");
    // No "?" help control chrome
    expect(card).not.toContain("setShowHelp");
    expect(card).not.toContain("modesHelpTitle");
    expect(card).not.toMatch(/>\s*\?\s*</);
    expect(card).not.toContain("How context shapes practice");
  });

  it("Customize the session on launch card; exclusive drawers local + examples (no Prompt tab)", () => {
    const item = read("components/SessionItem.tsx");
    expect(item).toContain("Customize the session");
    expect(item).toContain("data-customize-session");
    // Detail path must not load or pass aesthetics hero image
    expect(item).not.toContain("aestheticImageForId");
    expect(item).not.toContain("fetchAestheticPackages");
    expect(item).not.toContain("thumbnailSrc=");

    // Peer top-level drawers live on WorkspaceBlockDetailPane (not nested Tabs)
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toContain("data-block-detail-mini-tabs");
    expect(detail).toContain("data-block-detail-drawers");
    expect(detail).toContain('drawerId="local"');
    expect(detail).toContain('drawerId="simulation"');
    // Creator Details/Sessions drawer removed — Edit owns title/description.
    expect(detail).not.toContain('drawerId="detail"');
    expect(detail).toContain('title="Local context"');
    expect(detail).toContain('title="Block Simulation"');
    // Local drawer expands when materials already attached; simulation stays collapsed.
    expect(detail).toContain("defaultExpanded={hasLocalMaterials}");
    expect(detail).toContain("defaultExpanded={false}");
    expect(detail).toContain("hasLocalMaterials");
    // Edit drawer (update) + peer Danger zone drawer (delete)
    expect(detail).toContain('drawerId="edit"');
    expect(detail).toContain("WorkspaceBlockEditPanel");
    expect(detail).toContain("onUpdateBlock");
    expect(detail).toContain("WorkspaceBlockDangerPanel");
    expect(detail).toContain("onDeleteBlock");
    expect(detail).toContain("WORKSPACE_EDITOR_DANGER_DRAWER_ID");
    const editPanel = read("components/WorkspaceBlockEditPanel.tsx");
    expect(editPanel).toContain("data-block-edit-panel");
    expect(editPanel).toContain("data-block-edit-save");
    expect(editPanel).not.toContain("Danger zone");
    expect(editPanel).not.toContain("data-block-edit-delete");
    const dangerPanel = read("components/WorkspaceBlockDangerPanel.tsx");
    expect(dangerPanel).toContain("data-block-edit-delete");
    expect(dangerPanel).toContain("data-block-danger-pane");
    const tools = read("lib/block-map-tools.ts");
    expect(tools).not.toMatch(/BLOCK_MAP_TOOL_STRIP[\s\S]*"edit"/);
    expect(tools).toContain("edit is omitted");
    expect(detail).not.toContain('prompt: "Prompt"');
    expect(detail).not.toContain("WorkspacePromptImpactPanel");
    expect(detail).toContain("WorkspaceBlockSimulationPanel");
    expect(detail).not.toContain("data-block-detail-close");

    const simPanel = read("components/WorkspaceBlockSimulationPanel.tsx");
    expect(simPanel).toContain("data-simulation-regenerate");
    expect(simPanel).toContain("/api/workspace/block-content-samples");
    expect(simPanel).toContain("data-simulation-questions");
    expect(simPanel).toContain("data-simulation-exercises");
    expect(simPanel).not.toContain("data-simulation-audience");

    const local = read("components/WorkspaceBlockLocalContextPanel.tsx");
    expect(local).not.toContain("WorkspacePromptImpactPanel");
    expect(local).not.toContain("How context shapes practice");
    // Flat authoring — no outer nested card chrome stack
    expect(local).toContain('data-block-local-authoring');
    expect(local).not.toMatch(/rounded-xl border[\s\S]{0,40}rounded-xl border/);

    expect(BLOCK_DETAIL_MINI_TABS).toEqual(["local", "simulation"]);
    expect(BLOCK_DETAIL_MINI_TABS).not.toContain("prompt" as never);
    expect(nextBlockDetailMiniTab("local", "simulation")).toBe("simulation");
    expect(nextBlockDetailMiniTab("local", "prompt")).toBe("local");
    expect(nextBlockDetailMiniTab("local", "nope")).toBe("local");
    expect(resolveExclusiveBlockDetailDrawer("local", "simulation")).toBe("simulation");
    expect(resolveExclusiveBlockDetailDrawer("simulation", "local")).toBe("local");
    expect(resolveExclusiveBlockDetailDrawer("local", "prompt")).toBe("local");

    const examples = deriveBlockExampleTopics({
      title: "Bayes rule",
      description: "Update beliefs with evidence. How do priors work?",
      planningPrompt: "Focus on medical testing examples",
    });
    expect(examples.topics.some((t) => /Bayes/i.test(t))).toBe(true);
    expect(examples.questions.length).toBeGreaterThan(0);

    const view = readWorkspaceViewSurface();
    expect(view).toContain("WorkspaceBlockDetailPane");
    expect(view).not.toContain("WorkspaceBlockDetailTabs");
    expect(view).not.toMatch(
      /WorkspaceBlockLocalContextPanel[\s\S]*How context shapes practice/,
    );
    const aycl = read("components/AyclWorkspaceView.tsx");
    // AYCL mounts WorkspaceView which owns block detail drawers.
    expect(aycl).toContain("WorkspaceView");
    expect(aycl).not.toContain("WorkspaceBlockDetailTabs");

    const cardSrc = read("components/BlockDetailCard.tsx");
    expect(cardSrc).toContain("data-block-detail-no-hero-image");
    expect(cardSrc).not.toMatch(/<img[\s\S]*thumbnail|thumbnailSrc[\s\S]*<img/);
    // thumbnailSrc accepted for API compat but not rendered as hero
    expect(cardSrc).toContain("void thumbnailSrc");

    writeEvidence(
      "block-detail-drawers.log",
      [
        "tabs=" + BLOCK_DETAIL_MINI_TABS.join(","),
        "hasPromptTab=" + BLOCK_DETAIL_MINI_TABS.includes("prompt" as never),
        "drawersMarker=" + detail.includes("data-block-detail-drawers"),
        "peerLocal=" + detail.includes('drawerId="local"'),
        "peerSimulation=" + detail.includes('drawerId="simulation"'),
        "localCollapsed=" +
          /drawerId="local"[\s\S]*?defaultExpanded=\{false\}/.test(detail),
        "nextInvalidStaysLocal=" +
          String(nextBlockDetailMiniTab("local", "prompt") === "local"),
      ].join("\n"),
    );
    writeEvidence(
      "block-detail-no-hero.log",
      [
        "noHeroImageMarker=" + cardSrc.includes("data-block-detail-no-hero-image"),
        "voidsThumbnail=" + cardSrc.includes("void thumbnailSrc"),
        "sessionItemNoAesthetic=" + !item.includes("aestheticImageForId"),
        "titleChrome=" + cardSrc.includes("data-block-detail-header"),
        "styleTimebox=" + cardSrc.includes("data-product-intent-ui=\"style-timebox\""),
      ].join("\n"),
    );
    writeEvidence(
      "right-pane-layout-ui.log",
      [
        "mapWidth=" + WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS,
        "rightWidth=" + WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS,
        "tabs=" + BLOCK_DETAIL_MINI_TABS.join(","),
        "examplesTopics=" + examples.topics.slice(0, 2).join("|"),
        "noHelpButton=" + !cardHasHelp(cardSrc),
      ].join("\n"),
    );
  });
});

function cardHasHelp(card: string) {
  return card.includes("setShowHelp") || card.includes("modesHelpTitle");
}

describe("workspace map right pane empty selection", () => {
  it("empty selection shows map tools hint — no canvas, no news", () => {
    const pane = read("components/WorkspaceMapAuthoringPane.tsx");
    expect(pane).toContain("data-workspace-map-authoring-pane");
    expect(pane).not.toContain("WorkspaceMapCanvas");
    expect(pane).not.toContain("data-map-right-canvas");
    expect(pane).not.toContain("WorkspaceTopicNewsWidget");
    expect(pane).not.toContain("data-map-empty-news");
    expect(pane).not.toContain("Recent news");
    expect(pane).not.toContain("@excalidraw/excalidraw");
    expect(pane).not.toContain("How context shapes practice");

    expect(resolveWorkspaceRightPane(null)).toBe("map_tools");
  });
});
