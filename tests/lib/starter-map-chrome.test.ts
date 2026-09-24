import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readMapGridSurface } from "../helpers/surface-source";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d5c6027932ea/implementer";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("starter map chrome", () => {
  it("map does not label a Starter block badge; stored is_start stays on the tile", () => {
    const grid = readMapGridSurface();
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).not.toContain("Starter block");
    expect(grid).not.toContain("BlockStarterFlagBadge");
    expect(grid).not.toContain("<BlockStarterFlagBadge");
    expect(grid).toContain("data-block-is-start");
    expect(grid).toContain("const isStarter = Boolean(node.is_start)");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "starter-map-chrome.log"),
      [
        "starter-map-chrome",
        "badge_component=" + grid.includes("BlockStarterFlagBadge"),
        "data_flag=" + badges.includes("data-block-starter-flag"),
        "data_is_start=" + grid.includes("data-block-is-start"),
        "gated_on_is_start=" + grid.includes("Boolean(node.is_start)"),
      ].join("\n") + "\n",
    );
  });
});
