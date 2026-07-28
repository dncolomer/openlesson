/**
 * Neutral map cell chrome: white selection, gear/tick status icons (no green/yellow fills).
 * Drives shipped helpers used by workspace block maps and ILE chapter maps.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAP_CELL_EMPTY_SELECTED_CLASS,
  MAP_CELL_MULTI_SELECTED_CLASS,
  MAP_CELL_NEUTRAL_CLASS,
  MAP_CELL_SELECTED_CLASS,
  mapCellChromeClasses,
  mapCellChromeIsNeutral,
  mapCellFreeformColors,
  resolveMapCellStatusIcon,
} from "@/lib/map-cell-chrome";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("resolveMapCellStatusIcon", () => {
  it("returns null when progress is hidden", () => {
    expect(resolveMapCellStatusIcon("completed", false)).toBeNull();
    expect(resolveMapCellStatusIcon("in_progress", false)).toBeNull();
  });

  it("maps in_progress → gear and completed → tick", () => {
    expect(resolveMapCellStatusIcon("in_progress", true)).toBe("gear");
    expect(resolveMapCellStatusIcon("completed", true)).toBe("tick");
    expect(resolveMapCellStatusIcon("available", true)).toBeNull();
    expect(resolveMapCellStatusIcon("pending", true)).toBeNull();
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

  it("in_progress and completed stay neutral (icons carry status, not color)", () => {
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
    expect(done).toBe(MAP_CELL_NEUTRAL_CLASS);
    expect(mapCellChromeIsNeutral(progress)).toBe(true);
    expect(mapCellChromeIsNeutral(done)).toBe(true);
    expect(progress).not.toMatch(/amber|yellow|emerald|green/i);
    expect(done).not.toMatch(/amber|yellow|emerald|green/i);
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
    const free = mapCellFreeformColors(true);
    expect(free.border).toMatch(/255,\s*255,\s*255/);
    expect(free.fill).not.toMatch(/6,\s*182,\s*212|34,\s*211,\s*238/);
  });
});

describe("structural: BlockSkillGrid + ChapterMapPanel share chrome", () => {
  it("BlockSkillGrid uses shared helper + gear/tick glyphs", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("mapCellChromeClasses");
    expect(grid).toContain("resolveMapCellStatusIcon");
    expect(grid).toContain("MapCellStatusGlyph");
    expect(grid).toContain("MAP_CELL_MULTI_SELECTED_CLASS");
    expect(grid).toContain("MAP_CELL_EMPTY_SELECTED_CLASS");
    expect(grid).toContain("Settings"); // gear
    expect(grid).toContain("Check"); // tick
    // Occupied status path no longer hardcodes emerald/amber fills
    expect(grid).not.toMatch(/border-emerald-500|bg-emerald-950|border-amber-400\/55 bg-amber-950/);
    expect(grid).not.toMatch(/border-cyan-400\/80 bg-cyan-500\/20 text-cyan-50 ring-2 ring-cyan-400\/70/);
    expect(grid).not.toMatch(/border-cyan-400\/70 bg-cyan-500\/15 text-cyan-100 ring-2 ring-cyan-400\/40/);
  });

  it("ILE ChapterMapPanel and workspace SessionList use BlockSkillGrid", () => {
    const chapter = read("components/ChapterMapPanel.tsx");
    const list = read("components/SessionList.tsx");
    expect(chapter).toContain("BlockSkillGrid");
    expect(list).toContain("BlockSkillGrid");
    expect(chapter).toContain('from "@/components/BlockSkillGrid"');
  });
});
