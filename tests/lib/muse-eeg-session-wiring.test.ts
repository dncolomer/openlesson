import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("Muse EEG quality + verification signal wiring", () => {
  it("scores live sample windows and tracks contact calibration in muse-athena client", () => {
    const client = read("lib/muse-athena.ts");
    expect(client).toContain("ingestEegForQuality");
    expect(client).toContain("scoreEegContactWindow");
    expect(client).toContain("applyContactScore");
    expect(client).toContain("calibrationPassed");
  });

  it("wires Muse EEG signals into verification session signals", () => {
    const signals = read("components/session-view/session-signals.tsx");
    expect(signals).toContain("muse-athena");
    expect(signals).toContain("channels.muse");
  });
});
