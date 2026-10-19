/**
 * Pure: map document badge eligibility for blocks with attached local context.
 */
import { describe, expect, it } from "vitest";
import { blockHasAttachedLocalContext } from "@/lib/block-skill-grid";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readMapGridSurface } from "../helpers/surface-source";

describe("blockHasAttachedLocalContext", () => {
  it("is true for notes, files, global refs, or external resources", () => {
    expect(blockHasAttachedLocalContext(null)).toBe(false);
    expect(blockHasAttachedLocalContext({})).toBe(false);
    expect(blockHasAttachedLocalContext({ local_context: null })).toBe(false);
    expect(
      blockHasAttachedLocalContext({ local_context: { notes: "   " } }),
    ).toBe(false);
    expect(
      blockHasAttachedLocalContext({ local_context: { notes: "notes" } }),
    ).toBe(true);
    expect(
      blockHasAttachedLocalContext({
        local_context: { local_files: [{ name: "a.md" }] },
      }),
    ).toBe(true);
    expect(
      blockHasAttachedLocalContext({
        local_context: { global_file_refs: ["spec.pdf"] },
      }),
    ).toBe(true);
    expect(
      blockHasAttachedLocalContext({
        local_context: { external_resource_ids: ["ext-1"] },
      }),
    ).toBe(true);
  });

  it("map tiles do not show a local-context badge", () => {
    const root = join(__dirname, "../..");
    const grid = readMapGridSurface();
    expect(existsSync(join(root, "lib/block-skill-grid.ts"))).toBe(true);
    expect(grid).not.toContain("blockHasAttachedLocalContext");
    expect(grid).not.toContain("data-block-local-context-badge");
    expect(grid).not.toContain("data-block-local-context-icon");
    expect(grid).not.toContain("data-block-has-local-context");
    expect(grid).not.toContain("localContextBadge");
    expect(grid).not.toContain("resolveMapOccupiedTileBadges");
  });
});
