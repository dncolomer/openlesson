/**
 * Four-mark rail / SessionActionsPanel leftover is gone.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("session mark-rail leftover", () => {
  it("does not ship SessionMarkControls / SessionActionsPanel", () => {
    expect(existsSync(join(ROOT, "components/session-view/session-mark-controls.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/session-view/session-policy-focus.tsx"))).toBe(false);
  });
});
