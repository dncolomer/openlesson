/**
 * Session assert-graph UI and layout helpers were unmounted leftovers.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("session assert graph leftover", () => {
  it("does not ship the React view or layout module", () => {
    expect(existsSync(join(ROOT, "components/session-view/session-assert-graph.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/session-assert-graph.ts"))).toBe(false);
  });
});
