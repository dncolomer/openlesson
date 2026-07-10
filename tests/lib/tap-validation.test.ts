import { describe, expect, it } from "vitest";
import { orbitDemo } from "@/lib/evidence-api-demo/demos/orbit";
import { selectPracticeBlock, selectTapValidationBlock } from "@/lib/evidence-api-demo/tap-validation";
import { getDemoVerificationPills } from "@/lib/evidence-api-demo/verification-pills";

describe("demo verification pills", () => {
  it("marks Orbit as Evidence API plus TAP", () => {
    expect(getDemoVerificationPills(orbitDemo)).toEqual(["Evidence API", "TAP"]);
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