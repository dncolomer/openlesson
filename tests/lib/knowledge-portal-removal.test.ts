/**
 * Knowledge Portal was removed from the product. The migration stays.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readExerciseTapSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("Knowledge Portal removal", () => {
  it("drops the portal from the product and keeps the database migration", () => {
    const gone = [
      "lib/practice-portal.ts",
      "components/WorkspaceKnowledgePortalPanel.tsx",
      "components/PracticePortalLandingClient.tsx",
      "components/PracticePortalShell.tsx",
      "app/portal/[token]/page.tsx",
      "app/practice-portal/[token]/page.tsx",
      "app/api/workspace/practice-portals/route.ts",
      "app/api/practice-portal/[token]/route.ts",
      "app/api/practice-portal/[token]/mint/route.ts",
    ];
    for (const rel of gone) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(false);
    }
    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    expect(settings).not.toMatch(/knowledge-portal|WorkspaceKnowledgePortalPanel|Knowledge Portal/);
    const en = read("messages/en.json");
    expect(en).not.toMatch(/Knowledge Portal/);
    expect(en).not.toMatch(/practicePortalTitle/);
    const middleware = read("middleware.ts");
    expect(middleware).not.toMatch(/\/portal/);
    const migration = read(
      "supabase/migrations/20260730120000_workspace_practice_portals.sql",
    );
    expect(migration).toMatch(/workspace_practice_portals/);
  });

  it("keeps learner onboarding copy that used to sit beside the portal test", () => {
    const enCopy = JSON.parse(read("messages/en.json")) as {
      tap?: { briefing?: { intro?: string }; welcome?: { panelIntro?: string } };
      onboardingGuide?: {
        tap?: { step1?: { title?: string; body?: string; highlight?: string } };
        ile?: {
          step1?: { body?: string };
          step3?: { start?: string; body?: string; highlight?: string };
        };
      };
      welcome?: { panelIntro?: string };
    };
    expect(enCopy.tap?.briefing?.intro).toBeTruthy();
    expect((enCopy.tap?.briefing?.intro || "").length).toBeLessThan(80);
    expect(enCopy.onboardingGuide?.tap?.step1?.title).toMatch(/What you'll do/i);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).toMatch(/think out loud/i);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).toMatch(/I'm done answering/);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).toMatch(/Stay speaking/i);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).not.toMatch(/^Think out loud on a timer\./);
    expect((enCopy.onboardingGuide?.tap?.step1?.body || "").length).toBeGreaterThan(180);
    expect(enCopy.onboardingGuide?.ile?.step3?.start).toMatch(/^Start$/);
    expect(enCopy.onboardingGuide?.ile?.step3?.body).toMatch(/craft insights/i);
    expect(enCopy.onboardingGuide?.ile?.step3?.body).toMatch(/canvas/i);
    expect(enCopy.onboardingGuide?.ile?.step3?.body).not.toMatch(/\bboard\b|end turn/i);
    expect((enCopy.onboardingGuide?.ile?.step3?.body || "").length).toBeLessThan(120);
    expect(enCopy.onboardingGuide?.ile?.step3?.highlight).toBe("");
    expect(enCopy.tap?.welcome?.panelIntro).toMatch(/How it works:|Socratic follow-ups/i);
    expect(enCopy.welcome?.panelIntro).toMatch(/desktop-first workspace|comic-style dialogue/i);

    const simulationPanel = read("components/SimulateInsightsSurface.tsx");
    expect(simulationPanel).not.toMatch(/offline template/i);
    expect(simulationPanel).not.toMatch(/via xAI/i);
    expect(simulationPanel).not.toMatch(/xAI output/i);
    expect(simulationPanel).not.toMatch(/xAI questions and exercises/i);
    expect(simulationPanel).toContain("data-simulation-generate");
    expect(simulationPanel).toContain("data-simulation-collection");
    expect(simulationPanel).not.toContain("Generate workspace samples");
    const blockSimPanel = read("components/WorkspaceBlockSimulationPanel.tsx");
    expect(blockSimPanel).not.toMatch(/for xAI samples/i);
    expect(blockSimPanel).not.toMatch(/via xAI/i);
    expect(blockSimPanel).not.toMatch(/offline template/i);
    expect(blockSimPanel).toContain("SimulateInsightsSurface");
    const newsWidget = read("components/WorkspaceTopicNewsWidget.tsx");
    expect(newsWidget).not.toMatch(/xAI-powered headlines/i);

    const exerciseTap = readExerciseTapSurface();
    expect(exerciseTap).toContain("SessionOnboardingGuide");
    expect(exerciseTap).not.toMatch(/Solution Stack — that stack is what will be evaluated/i);
    expect(exerciseTap).toMatch(/Solo practice|Del stashes|Solution/);
    const tapClient = readTapScoreSurface();
    expect(tapClient).toContain("SessionOnboardingGuide");

    const migration = read(
      "supabase/migrations/20260730120000_workspace_practice_portals.sql",
    );
    expect(migration).toMatch(/workspace_practice_portals/);
    expect(migration).toMatch(/private_token_hash/);
    expect(migration).toMatch(/config jsonb/);
  });
});
