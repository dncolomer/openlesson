/**
 * Knowledge region create lives on the dashboard simulation, not workspace Settings.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Knowledge Regions inner sub-tabs (shipped UI)", () => {
  it("does not mount workspace region create", () => {
    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    expect(settings).not.toContain("CustomVerificationModelsPanel");
    expect(settings).not.toContain('data-settings-tab-panel="regions"');
    expect(settings).not.toContain('data-settings-section="custom-knowledge-regions"');
    expect(settings).not.toContain("WorkspaceDataStudioPanel");
    expect(read("components/product-flow/knowledge-region-create.tsx")).toContain(
      "RegionSimulationSetup",
    );
    expect(read("components/product-flow/region-simulation-setup.tsx")).toContain(
      "data-run-simulation",
    );
    expect(read("app/api/workspace/custom-knowledge-regions/route.ts")).toContain(
      "Regions are created by running a simulation",
    );
    expect(read("app/api/workspace/verification-regions/route.ts")).toContain(
      "Regions are created by running a simulation",
    );
  });
});
