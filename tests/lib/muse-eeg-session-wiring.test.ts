import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("session Muse EEG quality + PoW gate wiring", () => {
  it("scores live sample windows and only uploads gated EEG PoW after a contact pass", () => {
    const runtime = read("components/session-view/use-session-runtime.ts");
    expect(runtime).toContain("scoreEegContactWindow");
    expect(runtime).toContain("eegChannelsFromMap");
    expect(runtime).toContain("buildGatedIleEegUploadItem");
    expect(runtime).toContain("calibrationPassed");
    expect(runtime).toContain("contactEvaluated");
    expect(runtime).toContain('void uploadPowItem(item, "eeg")');
    expect(runtime).toMatch(/if \(!item\) return;/);
    expect(runtime).not.toMatch(/buildIleEegUploadItem\(/);

    const client = read("lib/muse-athena.ts");
    expect(client).toContain("ingestEegForQuality");
    expect(client).toContain("scoreEegContactWindow");
    expect(client).toContain("applyContactScore");
    expect(client).toContain("calibrationPassed");
  });

  it("shows live quality/calibration in Muse data-input and EEG preview, not only streaming", () => {
    const dataInput = read("components/DataInputTool.tsx");
    expect(dataInput).toContain("museEegPreviewState");
    expect(dataInput).toContain("data-muse-calibration");
    expect(dataInput).toContain("data-muse-signal-quality");
    expect(dataInput).toContain("data-muse-eeg-ready");
    expect(dataInput).toContain("data-muse-eeg-pow");
    expect(dataInput).toContain("dataInput.checkingContact");
    expect(dataInput).toContain("dataInput.calibrated");
    expect(dataInput).toContain("dataInput.eegEvidenceReady");
    expect(dataInput).toContain("dataInput.eegEvidenceBlocked");
    expect(dataInput).not.toContain("dataInput.receivingData");

    const tools = read("components/ToolsPanel.tsx");
    expect(tools).toContain("museEegPreviewState");
    expect(tools).toContain("data-muse-eeg-preview");
    expect(tools).toContain("data-muse-calibration");
    expect(tools).not.toContain("inferredQuality");
  });
});
