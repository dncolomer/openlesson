import { describe, expect, it } from "vitest";
import { readRepo } from "../helpers/surface-source";

describe("dashboard leftover config state", () => {
  it("does not keep unused model/prompt savers on DashboardPage", () => {
    const page = readRepo("app/dashboard/page.tsx");
    expect(page).not.toContain("handleSaveModels");
    expect(page).not.toContain("tutorModel");
    expect(page).not.toContain("askModel");
    expect(page).not.toContain("plannerModel");
    expect(page).not.toContain("coderModel");
    expect(page).not.toContain("availableModels");
    expect(page).not.toContain("userPrompts");
    expect(page).not.toContain("handleSavePrompts");
    expect(page).not.toContain("DEFAULT_PROMPTS");
    expect(page).not.toContain("PROMPT_META");
    expect(page).toContain("DashboardConfigTab");
    expect(page).toContain("providerInfo={providerInfo}");
  });
});
