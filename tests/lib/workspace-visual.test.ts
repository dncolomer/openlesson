import { describe, expect, it } from "vitest";
import {
  resolveWorkspaceCoverImage,
  seededUnit,
  workspaceAbstractPalette,
  workspaceVisualSeed,
} from "@/lib/workspace-visual";

describe("workspace-visual", () => {
  it("falls back to a stable aesthetic image when no cover is stored", () => {
    const first = resolveWorkspaceCoverImage("workspace-123");
    const second = resolveWorkspaceCoverImage("workspace-123", null);
    expect(first).toBe(second);
    expect(first.startsWith("/aesthetics/")).toBe(true);
  });

  it("prefers an explicit cover image", () => {
    expect(resolveWorkspaceCoverImage("workspace-123", "/custom-cover.jpg")).toBe("/custom-cover.jpg");
  });

  it("produces stable abstract palette and seeded values", () => {
    const seed = workspaceVisualSeed("workspace-abc");
    expect(workspaceAbstractPalette(seed)).toHaveLength(3);
    expect(seededUnit(seed, 0)).toBe(seededUnit(seed, 0));
    expect(seededUnit(seed, 1)).not.toBe(seededUnit(seed, 0));
  });
});