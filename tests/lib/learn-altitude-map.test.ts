/**
 * Altitude-map leftover is gone. Chapter grid nodes stay covered by chapter-skill-grid tests.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("ILE altitude map leftover", () => {
  it("does not ship lib/learn-altitude-map", () => {
    expect(existsSync(join(ROOT, "lib/learn-altitude-map.ts"))).toBe(false);
  });
});
