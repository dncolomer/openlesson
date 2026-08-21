/**
 * AYCL shopper names (play mode only / Play + Build), Play/Build tooltips,
 * preview notes+layer toggles, and map-preview fullscreen.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface, readWorkspaceViewSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ayclBuildTooltip,
  ayclOfferCheckoutCta,
  ayclOfferLabel,
  ayclOfferTooltip,
  ayclPlayTooltip,
  resolveAyclCapabilities,
} from "@/lib/aycl-shared";
import { parseAyclClonePracticeOptions } from "@/lib/block-practice-options";
import {
  visibleWorkspaceMapToggleIds,
  workspaceModeDisplayLabel,
} from "@/lib/workspace-mode";
import {
  ayclMapPreviewFullscreenActive,
  resolveAyclPreviewOverlayChrome,
  toggleAyclMapPreviewFullscreen,
} from "@/lib/aycl-landing";
import {
  canDeleteMapNote,
  canEditMapNoteContent,
  defaultMapNotesPlaneVisible,
  mapNotesForPlaneRender,
  shouldRenderMapNotesOnPlane,
  shouldShowMapNotesPlaneToggle,
  toggleMapNotesPlaneVisible,
  type LearnerMapNote,
} from "@/lib/learner-map-notes";
import {
  canDeleteAnnotationLayer,
  canDrawOnAnnotationLayer,
  createAnnotationLayer,
  shouldShowAnnotationLayerToggles,
  toggleAnnotationLayerVisible,
} from "@/lib/map-annotation-layers";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-9eec571c30da/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("AYCL offer labels", () => {
  it("learner is play mode only; full is Play + Build", () => {
    expect(ayclOfferLabel("learner")).toBe("play mode only");
    expect(ayclOfferLabel("full")).toBe("Play + Build");
    expect(ayclOfferCheckoutCta("learner")).toBe("Get play mode only");
    expect(ayclOfferCheckoutCta("full")).toBe("Get Play + Build");
    expect(ayclOfferLabel("learner")).not.toMatch(/Practice access/i);
    expect(ayclOfferLabel("full")).not.toMatch(/Full access/i);
    expect(ayclOfferCheckoutCta("learner")).not.toMatch(/practice access/i);
    expect(ayclOfferCheckoutCta("full")).not.toMatch(/full access/i);

    writeScratch(
      "aycl-play-build-labels.txt",
      [
        `learner=${ayclOfferLabel("learner")}`,
        `full=${ayclOfferLabel("full")}`,
        `cta_learner=${ayclOfferCheckoutCta("learner")}`,
        `cta_full=${ayclOfferCheckoutCta("full")}`,
      ].join("\n"),
    );
  });
});

describe("Play / Build tooltips", () => {
  it("both modes have brief explanations attached on landing and catalog", () => {
    const play = ayclPlayTooltip();
    const build = ayclBuildTooltip();
    expect(play.length).toBeGreaterThan(12);
    expect(build.length).toBeGreaterThan(12);
    expect(play.toLowerCase()).toMatch(/play|practice|explore/);
    expect(build.toLowerCase()).toMatch(/build|author|grow/);
    expect(ayclOfferTooltip("learner")).toBe(play);
    expect(ayclOfferTooltip("full")).toContain(play);
    expect(ayclOfferTooltip("full")).toContain(build);

    const landing = read("components/AyclLandingClient.tsx");
    const catalog = read("app/all-you-can-learn/page.tsx");
    for (const src of [landing, catalog]) {
      expect(src).toContain("ayclPlayTooltip");
      expect(src).toContain("ayclBuildTooltip");
      expect(src).toContain("ayclOfferTooltip");
      expect(src).toContain('data-aycl-play-tooltip');
      expect(src).toContain('data-aycl-build-tooltip');
      expect(src).toContain('data-aycl-offer-tooltip="learner"');
      expect(src).toContain('data-aycl-offer-tooltip="full"');
    }

    writeScratch(
      "aycl-play-build-tooltips.txt",
      [
        `play=${play}`,
        `build=${build}`,
        `offer_learner=${ayclOfferTooltip("learner")}`,
        `offer_full=${ayclOfferTooltip("full")}`,
        "landing+catalog attach data-aycl-play-tooltip / data-aycl-build-tooltip",
      ].join("\n"),
    );
  });
});

describe("preview notes + handwriting visibility", () => {
  it("defaults on; toggle flips; empty collections stay empty; view-only cannot author", () => {
    expect(defaultMapNotesPlaneVisible()).toBe(true);
    expect(shouldRenderMapNotesOnPlane(true)).toBe(true);
    expect(toggleMapNotesPlaneVisible(true)).toBe(false);
    expect(toggleMapNotesPlaneVisible(false)).toBe(true);

    const layer = createAnnotationLayer({ name: "Ink" });
    expect(layer.visible).toBe(true);
    const hidden = toggleAnnotationLayerVisible(layer);
    expect(hidden.visible).toBe(false);
    expect(toggleAnnotationLayerVisible(hidden).visible).toBe(true);

    expect(shouldShowMapNotesPlaneToggle(0)).toBe(false);
    expect(shouldShowMapNotesPlaneToggle(2)).toBe(true);
    expect(shouldShowAnnotationLayerToggles(0)).toBe(false);
    expect(shouldShowAnnotationLayerToggles(1)).toBe(true);

    const emptyChrome = resolveAyclPreviewOverlayChrome({
      noteCount: 0,
      layerCount: 0,
    });
    expect(emptyChrome.showNotesToggle).toBe(false);
    expect(emptyChrome.showLayerToggles).toBe(false);
    expect(emptyChrome.showStack).toBe(false);

    const liveChrome = resolveAyclPreviewOverlayChrome({
      noteCount: 1,
      layerCount: 2,
    });
    expect(liveChrome.showNotesToggle).toBe(true);
    expect(liveChrome.showLayerToggles).toBe(true);
    expect(liveChrome.showStack).toBe(true);

    const note: LearnerMapNote = {
      id: "n1",
      body: "hi",
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      collapsed: false,
      source: "creator",
      createdAt: 1,
      updatedAt: 1,
    };
    expect(mapNotesForPlaneRender([], true)).toEqual([]);
    expect(mapNotesForPlaneRender([note], false)).toEqual([]);
    expect(mapNotesForPlaneRender([note], true)).toHaveLength(1);

    expect(canDeleteMapNote(note, { learnerMode: false, viewOnly: true })).toBe(
      false,
    );
    expect(
      canEditMapNoteContent(note, { learnerMode: false, viewOnly: true }),
    ).toBe(false);
    expect(canDrawOnAnnotationLayer({ viewOnly: true })).toBe(false);
    expect(canDeleteAnnotationLayer({ viewOnly: true })).toBe(false);

    const landing = read("components/AyclLandingClient.tsx");
    const grid = readMapGridSurface();
    expect(landing).toContain("viewOnly");
    expect(landing).toContain("workspaceId={landing.workspaceId}");
    expect(landing).toContain("canEdit={false}");
    expect(grid).toContain("shouldShowMapNotesPlaneToggle");
    expect(grid).toContain("shouldShowAnnotationLayerToggles");
    expect(grid).toContain("data-map-notes-visibility-toggle");
    expect(grid).toContain("data-annotation-layer-toggle");
    expect(grid).toContain("viewOnly");

    writeScratch(
      "aycl-preview-notes-layers.txt",
      [
        `default_notes_on=${defaultMapNotesPlaneVisible()}`,
        `toggle_off=${toggleMapNotesPlaneVisible(true)}`,
        `layer_default_visible=${layer.visible}`,
        `empty_stack=${emptyChrome.showStack}`,
        `live_stack=${liveChrome.showStack}`,
        `viewOnly_no_delete=${!canDeleteMapNote(note, { learnerMode: false, viewOnly: true })}`,
        `viewOnly_no_draw=${!canDrawOnAnnotationLayer({ viewOnly: true })}`,
      ].join("\n"),
    );
  });
});

describe("Explore on purchased clones", () => {
  it("both play-only and Play+Build keep Explore; play-only hides Build", () => {
    const learner = resolveAyclCapabilities("learner");
    const full = resolveAyclCapabilities("full");
    expect(learner.allowExplore).toBe(true);
    expect(full.allowExplore).toBe(true);
    expect(ayclOfferLabel("learner")).toBe("play mode only");
    expect(ayclOfferLabel("full")).toBe("Play + Build");

    const playOnlyIds = visibleWorkspaceMapToggleIds({
      allowCreator: learner.allowCreatorModeToggle,
      allowExplore: learner.allowExplore,
    });
    const playBuildIds = visibleWorkspaceMapToggleIds({
      allowCreator: full.allowCreatorModeToggle,
      allowExplore: full.allowExplore,
    });
    expect(playOnlyIds).toEqual(["learner", "explore"]);
    expect(playOnlyIds).not.toContain("creator");
    expect(playBuildIds).toEqual(["creator", "learner", "explore"]);
    expect(playOnlyIds.map(workspaceModeDisplayLabel)).toEqual([
      "Play",
      "Explore",
    ]);
    expect(playBuildIds.map(workspaceModeDisplayLabel)).toEqual([
      "Build",
      "Play",
      "Explore",
    ]);

    expect(
      parseAyclClonePracticeOptions({ allow_explore: false }).allowExplore,
    ).toBe(true);

    const fork = read("lib/fork-workspace.ts");
    const aycl = read("lib/aycl.ts");
    const mapCol = read("components/workspace-view/workspace-map-column.tsx");
    const view = readWorkspaceViewSurface();
    const shared = read("lib/aycl-shared.ts");
    expect(aycl).toContain("isAyclFork: true");
    expect(fork).toContain("isAyclFork");
    expect(fork).toContain("parseAyclClonePracticeOptions");
    expect(fork).toContain("practice_options");
    expect(mapCol).toContain("visibleWorkspaceMapToggleIds");
    expect(mapCol).toContain("allowExplore");
    expect(view).toContain("ayclClone: true");
    expect(view).toContain("parseWorkspacePracticeOptions");
    expect(shared).toContain("allowExplore: true");
    expect(shared).not.toMatch(/allowExplore:\s*false/);

    writeScratch(
      "aycl-explore-always.txt",
      [
        `learner_allowExplore=${learner.allowExplore}`,
        `full_allowExplore=${full.allowExplore}`,
        `play_only_toggles=${playOnlyIds.join(",")}`,
        `play_build_toggles=${playBuildIds.join(",")}`,
        `catalog_off_clone_explore=${parseAyclClonePracticeOptions({ allow_explore: false }).allowExplore}`,
        `offer_learner=${ayclOfferLabel("learner")}`,
        `offer_full=${ayclOfferLabel("full")}`,
        "fork writes parseAyclClonePracticeOptions when isAyclFork",
      ].join("\n"),
    );
  });
});

describe("map preview fullscreen", () => {
  it("toggle expands the snapshot; landing mounts the control", () => {
    expect(ayclMapPreviewFullscreenActive(false)).toBe(false);
    expect(toggleAyclMapPreviewFullscreen(false)).toBe(true);
    expect(ayclMapPreviewFullscreenActive(true)).toBe(true);
    expect(toggleAyclMapPreviewFullscreen(true)).toBe(false);

    const landing = read("components/AyclLandingClient.tsx");
    expect(landing).toContain("data-aycl-map-fullscreen-toggle");
    expect(landing).toContain("data-aycl-map-fullscreen");
    expect(landing).toContain("toggleAyclMapPreviewFullscreen");
    expect(landing).toContain("ayclMapPreviewFullscreenActive");
    expect(landing).toContain("data-aycl-map-snapshot");
    expect(landing).toMatch(/fixed inset-0/);
    expect(landing).not.toContain("data-aycl-page-fullscreen");

    writeScratch(
      "aycl-preview-fullscreen.txt",
      [
        `off_to_on=${toggleAyclMapPreviewFullscreen(false)}`,
        `on_to_off=${toggleAyclMapPreviewFullscreen(true)}`,
        "landing: data-aycl-map-fullscreen-toggle on data-aycl-map-snapshot",
        "expands snapshot (fixed inset-0), not the marketing page",
      ].join("\n"),
    );
  });
});
