/**
 * Leave-focus screenshare leftover is gone.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("ILE blur screenshare leftover", () => {
  it("does not ship blur/screenshare helpers", () => {
    expect(existsSync(join(ROOT, "lib/learn-blur-screenshare.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/useIleBlurScreenshare.tsx"))).toBe(false);
  });
});
