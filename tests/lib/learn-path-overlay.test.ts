/**
 * Chapter path overlay was an unmounted leftover.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("ILE path overlay leftover", () => {
  it("does not ship lib/learn-path-overlay", () => {
    expect(existsSync(join(ROOT, "lib/learn-path-overlay.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/learn-altitude-map.ts"))).toBe(false);
  });
});
