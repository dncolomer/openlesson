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

  it("BlockSkillGrid wires document badge from pure helper", () => {
    const root = join(__dirname, "../..");
    const grid = readMapGridSurface();
    expect(existsSync(join(root, "lib/block-skill-grid.ts"))).toBe(true);
    expect(grid).toContain("blockHasAttachedLocalContext");
    expect(grid).toContain("data-block-local-context-badge");
    expect(grid).toContain("data-block-local-context-icon");
    expect(grid).toContain('data-block-has-local-context={hasLocalContext ? "true" : "false"}');
    // Both freeform label tile and rect tile render the badge.
    expect(grid).toMatch(/localContextBadge[\s\S]*lockBadge/);
  });
});
