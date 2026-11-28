/**
 * Neutral map cell chrome: white selection; Done = tick; self-progress = gear.
 * Drives shipped helpers used by workspace block maps and TAP Learning chapter maps.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapCellStatusGlyph } from "@/components/block-skill-grid/map-tile-badges";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAP_CELL_EMPTY_SELECTED_CLASS,
  MAP_CELL_GENERATION_PENDING_CLASS,
  MAP_CELL_MULTI_SELECTED_CLASS,
  MAP_CELL_NEUTRAL_CLASS,
  MAP_CELL_PREVIOUS_SESSIONS_CLASS,
  MAP_CELL_PREREQ_CLASS,
  MAP_CELL_SELECTED_CLASS,
  MAP_CELL_TARGET_CLASS,
  mapCellChromeClasses,
  mapCellChromeIsNeutral,
  mapCellFreeformColors,
  resolveMapCellStatusIcon,
} from "@/lib/map-cell-chrome";
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.MAP_CANVAS_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-29340150e801/implementer");

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
    expect(cls).toContain("border-white/35");
    expect(cls).toContain("bg-black");
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

  it("workspace previous-sessions tiles are slightly lighter; chapter stays neutral", () => {
    const workspace = mapCellChromeClasses({
      status: "available",
      selected: false,
      hasPreviousSessions: true,
      surface: "block",
    });
    const chapter = mapCellChromeClasses({
      status: "available",
      selected: false,
      hasPreviousSessions: true,
      surface: "chapter",
    });
    expect(workspace).toBe(MAP_CELL_PREVIOUS_SESSIONS_CLASS);
    expect(workspace).toContain("bg-neutral-800");
    expect(chapter).toBe(MAP_CELL_NEUTRAL_CLASS);
    expect(MAP_CELL_PREVIOUS_SESSIONS_CLASS).not.toMatch(/bg-white\/40|bg-white /);
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

  it("workspace SessionList and the All-you-can-learn preview mount BlockSkillGrid without a chapter suggest mode", () => {
    expect(existsSync(join(ROOT, "components/ChapterMapPanel.tsx"))).toBe(false);
    expect(read("components/BlockSkillGrid.tsx")).not.toContain("suggestMode");
    const list = read("components/SessionList.tsx");
    expect(list).toContain("<BlockSkillGrid");
    expect(list).not.toContain("SKILL_GRID_ILE_DEFAULT_ZOOM_AT_REFERENCE");
    expect(existsSync(join(ROOT, "components/AyclLandingClient.tsx"))).toBe(false);
  });
});
