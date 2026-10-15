import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEARNING_MODEL_CATALOG_16,
  LEARNING_MODEL_CATALOG_4,
  LEARNING_MODEL_CATALOG_8,
  LEARNING_MODEL_NAME,
  LEARNING_MODEL_OBJECTS,
  LEARNING_MODEL_PUBLIC_LABEL,
  LEARNING_MODEL_SIZES,
  parseLearningModelSize,
} from "@/lib/learning-model";
import { SESSION_MARK_BUTTONS as MARKS } from "@/lib/session-marks";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("learning model vocabulary and catalogs", () => {
  it("names the product the unsys model", () => {
    expect(LEARNING_MODEL_NAME).toBe("unsys model");
    expect(LEARNING_MODEL_PUBLIC_LABEL).toBe("Unsys model");
    expect(read("components/learning-model/LearningModelSizePicker.tsx")).toContain(
      "LEARNING_MODEL_PUBLIC_LABEL",
    );
    expect(read("lib/science/learning-model-copy.ts")).toContain("The unsys model");
    expect(read("lib/science/learning-model-copy.ts")).toContain("UNSYS MODEL");
    expect(read("lib/science/hub.ts")).toContain("LEARNING_MODEL_PUBLIC_LABEL");
    expect(read("app/science/learning-model/page.tsx")).toContain("LEARNING_MODEL_PUBLIC_LABEL");
  });

  it("names the generative model objects in FEP terms", () => {
    const names = LEARNING_MODEL_OBJECTS.map((row) => row.name);
    expect(names).toEqual([
      "Generative model",
      "Hidden state",
      "State factor",
      "Observation",
      "Action",
      "Policy",
    ]);
    expect(LEARNING_MODEL_OBJECTS.find((row) => row.id === "state-factor")?.stored).toBe("territory");
    expect(LEARNING_MODEL_OBJECTS.find((row) => row.id === "observation")?.stored).toBe("observation");
  });

  it("ships nested 4, 8, and 16 action catalogs", () => {
    expect([...LEARNING_MODEL_SIZES]).toEqual([4, 8, 16]);
    expect(LEARNING_MODEL_CATALOG_4).toHaveLength(4);
    expect(LEARNING_MODEL_CATALOG_8).toHaveLength(8);
    expect(LEARNING_MODEL_CATALOG_16).toHaveLength(16);
    expect(LEARNING_MODEL_CATALOG_4.map((row) => row.label)).toEqual([
      "Forage",
      "Exploit",
      "Avoid",
      "Infer",
    ]);
    expect(new Set(LEARNING_MODEL_CATALOG_8.map((row) => row.id)).size).toBe(8);
    expect(new Set(LEARNING_MODEL_CATALOG_16.map((row) => row.id)).size).toBe(16);
    expect(parseLearningModelSize(8)).toBe(8);
    expect(parseLearningModelSize("16")).toBe(16);
    expect(parseLearningModelSize("nope")).toBe(4);
  });

  it("prints FEP labels on the live four session actions", () => {
    expect(MARKS.map((row) => `${row.id}:${row.label}`)).toEqual([
      "try:Exploit",
      "hold:Forage",
      "drop:Avoid",
      "insight:Infer",
    ]);
  });

  it("lets a learning workspace pick size in settings and a flow pick size per flow", () => {
    expect(read("components/WorkspaceIdentitySettings.tsx")).toContain("LearningModelSizePicker");
    expect(read("components/WorkspaceIdentitySettings.tsx")).toContain("showLearningModel");
    expect(read("components/CalibrationFlowsPanel.tsx")).toContain("LearningModelSizePicker");
    expect(read("components/CalibrationFlowsPanel.tsx")).toContain("actionCatalog");
    expect(read("components/VerificationFlowsPanel.tsx")).toContain("LearningModelSizePicker");
    expect(read("app/api/workspace/calibration-flows/route.ts")).toContain("actionCatalog");
    expect(read("app/api/workspace/verification-flows/route.ts")).toContain("actionCatalog");
    expect(read("app/api/workspaces/[id]/visibility/route.ts")).toContain("learning_model_size");
  });
});
