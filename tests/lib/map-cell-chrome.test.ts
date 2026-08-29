/**
 * Neutral map cell chrome: white selection; Done = tick; self-progress = gear.
 * Drives shipped helpers used by workspace block maps and ILE chapter maps.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAP_CELL_EMPTY_SELECTED_CLASS,
  MAP_CELL_GENERATION_PENDING_CLASS,
  MAP_CELL_MULTI_SELECTED_CLASS,
  MAP_CELL_NEUTRAL_CLASS,
  MAP_CELL_PREREQ_CLASS,
  MAP_CELL_SELECTED_CLASS,
  MAP_CELL_TARGET_CLASS,
  mapCellChromeClasses,
  mapCellChromeIsNeutral,
  mapCellFreeformColors,
  resolveMapCellStatusIcon,
} from "@/lib/map-cell-chrome";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.MAP_CANVAS_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-29340150e801/implementer";

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

describe("resolveMapCellStatusIcon", () => {
  it("Done is a tick; self-progress is a gear; untouched has no icon", () => {
    expect(resolveMapCellStatusIcon("completed", false)).toBe("tick");
    expect(resolveMapCellStatusIcon("done", true, "block")).toBe("tick");
    expect(resolveMapCellStatusIcon("completed", true, "chapter")).toBe("tick");
    expect(resolveMapCellStatusIcon("completed", true, "block", true)).toBe("tick");
    expect(resolveMapCellStatusIcon("in_progress", true, "block", true)).toBe("gear");
    expect(resolveMapCellStatusIcon("available", true, "chapter", true)).toBe("gear");
    expect(resolveMapCellStatusIcon("in_progress", false)).toBeNull();
    expect(resolveMapCellStatusIcon("in_progress", true)).toBeNull();
    expect(resolveMapCellStatusIcon("active", true)).toBeNull();
    expect(resolveMapCellStatusIcon("available", true)).toBeNull();

    writeEvidence(
      "map-cell-title-only.log",
      [
        "in_progress=" + String(resolveMapCellStatusIcon("in_progress", true)),
        "completed=" + String(resolveMapCellStatusIcon("completed", true)),
        "available=" + String(resolveMapCellStatusIcon("available", true)),
        "workedOn=" + String(resolveMapCellStatusIcon("available", true, "block", true)),
      ].join("\n"),
    );
  });
});

describe("mapCellChromeClasses", () => {
  it("unselected default is neutral (no status tints)", () => {
    const cls = mapCellChromeClasses({
      status: "available",
      selected: false,
      showProgress: true,
    });
    expect(cls).toContain("border-neutral");
    expect(mapCellChromeIsNeutral(cls)).toBe(true);
    expect(cls).not.toMatch(/emerald|amber|cyan|yellow|green-/i);
  });

  it("selected uses white highlight tokens, not cyan/blue", () => {
    const cls = mapCellChromeClasses({
      status: "available",
      selected: true,
      showProgress: true,
    });
    expect(cls).toMatch(/ring-white|border-white/);
    expect(cls).not.toMatch(/cyan|blue-|sky-/i);
    expect(mapCellChromeIsNeutral(cls)).toBe(true);
    expect(MAP_CELL_SELECTED_CLASS).toMatch(/white/);
  });

  it("in_progress without workedOn stays neutral; completed is white Done (no status tints)", () => {
    const progress = mapCellChromeClasses({
      status: "in_progress",
      selected: false,
      showProgress: true,
    });
    const done = mapCellChromeClasses({
      status: "completed",
      selected: false,
      showProgress: true,
    });
    expect(progress).toBe(MAP_CELL_NEUTRAL_CLASS);
    expect(done).toMatch(/bg-white/);
    expect(done).toMatch(/border-white/);
    expect(done).not.toMatch(/emerald|amber|cyan|yellow|green-/i);
    expect(mapCellChromeIsNeutral(progress)).toBe(true);
    expect(mapCellChromeIsNeutral(done)).toBe(true);
  });

  it("focused (active chapter) uses white selection language", () => {
    const cls = mapCellChromeClasses({
      status: "in_progress",
      selected: false,
      focused: true,
      showProgress: true,
    });
    expect(cls).toMatch(/ring-white|border-white/);
    expect(cls).not.toMatch(/amber|cyan/i);
  });
});

describe("multi-select / empty selection tokens", () => {
  it("multi and empty selection are white, not cyan", () => {
    expect(MAP_CELL_MULTI_SELECTED_CLASS).toMatch(/white/);
    expect(MAP_CELL_MULTI_SELECTED_CLASS).not.toMatch(/cyan/i);
    expect(MAP_CELL_EMPTY_SELECTED_CLASS).toMatch(/white/);
    expect(MAP_CELL_EMPTY_SELECTED_CLASS).not.toMatch(/cyan/i);
    // Generation-pending slots pulse white until each cell is created.
    expect(MAP_CELL_GENERATION_PENDING_CLASS).toMatch(/white/);
    expect(MAP_CELL_GENERATION_PENDING_CLASS).toMatch(/animate-pulse/);
    expect(MAP_CELL_GENERATION_PENDING_CLASS).not.toMatch(/cyan/i);
    const free = mapCellFreeformColors(true);
    expect(free.border).toMatch(/255,\s*255,\s*255/);
    expect(free.fill).not.toMatch(/6,\s*182,\s*212|34,\s*211,\s*238/);
  });
});

describe("structural: BlockSkillGrid title-only map tiles", () => {
  it("BlockSkillGrid uses title path plus tick/gear from the chrome mapper", () => {
    const grid = readMapGridSurface();
    expect(grid).toContain("resolveOccupiedMapTileChrome");
    expect(grid).toContain("ileChapterCellChrome");
    expect(grid).toContain("MapCellStatusGlyph");
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).toContain("resolveMapCellStatusIcon");
    expect(badges).toContain('data-map-cell-status="title"');
    expect(badges).toContain("data-ile-chapter-done-tick");
    expect(grid).toContain('suggestMode === "chapter"');
    expect(read("lib/map-cell-chrome.ts")).toContain("MAP_CELL_PREREQ_CLASS");
    expect(grid).toContain("MAP_CELL_EMPTY_SELECTED_CLASS");
    expect(grid).toContain("MAP_CELL_GENERATION_PENDING_CLASS");
    expect(grid).toContain("data-generation-pending");
    expect(grid).toContain("mergeActiveExpandJobPreviews");
    // Expand progress bar + stop are white (not cyan/red)
    expect(grid).toMatch(/bg-white[\s\S]{0,80}?data-map-expand-progress-fill/);
    expect(grid).toMatch(/data-map-expand-stop[\s\S]{0,220}?bg-white/);
    expect(grid).toContain("highlightRole");
    expect(grid).toContain("BlockDependencyLockBadge");
    expect(badges).toContain("data-block-dependency-lock");
    expect(badges).toContain("data-map-cell-self-progress-gear");
    expect(badges).toContain("data-map-cell-done-tick");
    expect(grid).not.toContain("M8 2.4v1.5M8 12.1v1.5");
    expect(badges).toContain('fillRule="evenodd"');
    expect(grid).not.toMatch(/>\s*Busy\s*</);
    expect(grid).not.toContain("data-generator-busy-label");
    expect(badges).not.toMatch(/from "lucide-react"/);
    expect(grid).toContain("from \"lucide-react\"");
    expect(grid).not.toContain("data-map-cell-status=\"in_progress\"");
    expect(grid).not.toContain("data-map-cell-status=\"completed\"");
    expect(grid).not.toMatch(/border-emerald-500|bg-emerald-950|border-amber-400\/55 bg-amber-950/);
    expect(grid).not.toMatch(/border-cyan-400\/80 bg-cyan-500\/20 text-cyan-50 ring-2 ring-cyan-400\/70/);
  });

  it("prereq highlight role uses mild white dashed outline, not full multi-select", () => {
    const prereq = mapCellChromeClasses({
      status: "available",
      selected: false,
      highlightRole: "prereq",
    });
    const target = mapCellChromeClasses({
      status: "available",
      selected: false,
      highlightRole: "target",
    });
    expect(prereq).toBe(MAP_CELL_PREREQ_CLASS);
    expect(target).toBe(MAP_CELL_TARGET_CLASS);
    expect(prereq).toMatch(/white/);
    expect(prereq).toMatch(/dashed/);
    expect(prereq).not.toMatch(/cyan/i);
    expect(MAP_CELL_PREREQ_CLASS).toMatch(/border-dashed/);
  });

  it("ILE ChapterMapPanel and workspace SessionList use BlockSkillGrid", () => {
    const chapter = read("components/ChapterMapPanel.tsx");
    const list = read("components/SessionList.tsx");
    expect(chapter).toContain("BlockSkillGrid");
    expect(list).toContain("BlockSkillGrid");
    expect(chapter).toContain('from "@/components/BlockSkillGrid"');
  });
});
