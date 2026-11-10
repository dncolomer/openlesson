/**
 * The shared map grid no longer selects a chapter suggest mode.
 * Workspace and All-you-can-learn still mount the block grid.
 * The session stage shows the work canvas and does not render a map.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readMapGridSurface, readSessionStageSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("chapter suggest mode is absent", () => {
  it("the shipped grid and its hooks do not branch on a chapter suggest mode", () => {
    const surface = readMapGridSurface();
    expect(surface).not.toContain("suggestMode");
    expect(surface).not.toContain('mapKind: "chapter"');
    expect(surface).toContain('mapKind: "workspace"');
    expect(surface).toContain('skillGridMetrics("workspace")');
    expect(surface).toContain('mode: "block"');
    expect(read("components/block-skill-grid/use-map-derived.ts")).not.toContain("suggestMode");
    expect(read("components/block-skill-grid/use-map-authoring.ts")).not.toContain("suggestMode");
    expect(read("components/block-skill-grid/use-map-grid-mutate.ts")).not.toContain(
      "suggestMode",
    );
    expect(read("components/block-skill-grid/use-map-self-progress.ts")).not.toContain(
      "suggestMode",
    );
    expect(read("components/block-skill-grid/map-world-layer.tsx")).not.toContain(
      "data-ile-map-board",
    );
  });

  it("the workspace map mounts the block grid; AYCL landing is gone", () => {
    expect(read("components/SessionList.tsx")).toContain("<BlockSkillGrid");
    expect(existsSync(join(ROOT, "components/AyclLandingClient.tsx"))).toBe(false);
  });

  it("the session stage shows the work canvas and does not render a map", () => {
    const chrome = read("components/session-view/session-chrome.tsx");
    const view = readSessionStageSurface();
    expect(chrome).toContain('data-ile-work-covers-map="true"');
    expect(chrome).toContain("{workCanvas}");
    expect(chrome).not.toMatch(/\{map\}/);
    expect(view).not.toContain("<ChapterMapPanel");
    expect(view).not.toContain("<BlockSkillGrid");
    expect(view).toContain("map={null}");
  });
});
