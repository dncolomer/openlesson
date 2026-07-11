import { describe, expect, it } from "vitest";
import { orbitDemo } from "@/lib/openlesson-demo/demos/orbit";
import { selectPracticeBlock, selectTapValidationBlock } from "@/lib/openlesson-demo/tap-validation";
import { getDemoVerificationPills } from "@/lib/openlesson-demo/verification-pills";

describe("demo verification pills", () => {
  it("marks Orbit as Proof-of-Work API plus TAP", () => {
    expect(getDemoVerificationPills(orbitDemo)).toEqual(["Proof-of-Work API", "TAP"]);
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