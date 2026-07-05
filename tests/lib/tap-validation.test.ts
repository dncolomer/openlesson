import { describe, expect, it } from "vitest";
import { gridworksDemo } from "@/lib/evidence-api-demo/demos/gridworks";
import { nexusfrontDemo } from "@/lib/evidence-api-demo/demos/nexusfront";
import { selectPracticeBlock, selectTapValidationBlock } from "@/lib/evidence-api-demo/tap-validation";
import { CUSTOM_DEMO_PICKER } from "@/lib/evidence-api-demo/custom-demo";
import {
  ALL_DEMO_VERIFICATION_PILLS,
  getDemoVerificationPills,
} from "@/lib/evidence-api-demo/verification-pills";

describe("demo verification pills", () => {
  it("marks Haven Rise as Evidence API only", () => {
    expect(getDemoVerificationPills(nexusfrontDemo)).toEqual(["Evidence API"]);
  });

  it("marks GridWorks as Evidence API plus TAP", () => {
    expect(getDemoVerificationPills(gridworksDemo)).toEqual(["Evidence API", "TAP"]);
  });

  it("marks custom simulation with all product pills", () => {
    expect(getDemoVerificationPills(CUSTOM_DEMO_PICKER)).toEqual(ALL_DEMO_VERIFICATION_PILLS);
  });
});

describe("selectPracticeBlock", () => {
  it("returns the first workspace block", () => {
    expect(selectPracticeBlock([{ id: "a", title: "First" }, { id: "b", title: "Second" }])?.id).toBe("a");
  });
});

describe("selectTapValidationBlock", () => {
  it("prefers modeling and close blocks for spreadsheet validation", () => {
    const selected = selectTapValidationBlock([
      { id: "a", title: "Onboarding checklist" },
      { id: "b", title: "Variance formulas and close reconciliation" },
      { id: "c", title: "Support escalation" },
    ]);

    expect(selected?.id).toBe("b");
  });
});