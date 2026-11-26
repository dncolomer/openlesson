import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("retired Calibrate sounding", () => {
  it("deletes the sounding surface and scout TAP client", () => {
    expect(existsSync(join(ROOT, "components/calibrate/calibrate-sounding-surface.tsx"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "components/scout-tap/ScoutTapClient.tsx"))).toBe(false);
  });
});
