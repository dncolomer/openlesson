import { describe, expect, it } from "vitest";
import { createTimeToolActions } from "@/lib/evidence-api-demo/demo-definition";
import {
  buildCustomDemoDefinition,
  CUSTOM_DEMO_ID,
  type GeneratedSimulationSpec,
} from "@/lib/evidence-api-demo/custom-demo";

const SAMPLE_SPEC: GeneratedSimulationSpec = {
  product_name: "Acme CRM",
  tagline: "Revenue operations platform",
  saas_category: "CRM",
  use_case: "Trial workspace certification",
  scenario_title: "Trial workspace setup",
  scenario_intro: "Learners configure a trial CRM workspace across setup, integrations, and activation.",
  eval_definition: "Verify trial users can configure Acme CRM end-to-end.",
  integration_name: "acme-crm-trial-agent",
  tool_name: "acme_crm",
  competency_rows:
    "| workspace_setup | Trial start and profile completion |\n| pipeline_build | Creates a usable pipeline |",
  categories: [
    {
      category: "onboarding",
      label: "Trial setup",
      description: "Workspace enrollment and profile steps.",
      actions: [
        {
          id: "start_trial",
          label: "Start trial",
          description: "Create workspace and accept terms.",
          block_hint: "Trial setup",
          cta: "Start trial",
          dimension: "workspace_setup",
          outcome: "success",
        },
        {
          id: "complete_profile",
          label: "Complete profile",
          description: "Fill role and company fields.",
          block_hint: "Profile",
          cta: "Save profile",
          dimension: "workspace_setup",
          outcome: "success",
        },
      ],
    },
    {
      category: "projects",
      label: "Pipeline",
      description: "Pipeline configuration milestones.",
      actions: [
        {
          id: "create_pipeline",
          label: "Create pipeline",
          description: "Add stages and first deals.",
          block_hint: "Pipeline",
          cta: "Create pipeline",
          dimension: "pipeline_build",
          outcome: "partial",
        },
      ],
    },
  ],
};

describe("custom demo builder", () => {
  it("merges generated evidence actions with standard calendar gap tools", () => {
    const demo = buildCustomDemoDefinition(SAMPLE_SPEC, "Verify Acme CRM trial certification.");

    expect(demo.id).toBe(CUSTOM_DEMO_ID);
    expect(demo.actions.filter((action) => action.kind === "evidence").length).toBe(3);
    expect(demo.actions.filter((action) => action.kind === "time_simulation").length).toBe(
      createTimeToolActions().length
    );
    expect(demo.categoryOrder).toContain("simulation_tools");
    expect(demo.categoryOrder.at(-1)).toBe("simulation_tools");
    expect(demo.integrationHints.event_verbs).toContain("time_gap_elapsed");
    expect(demo.modelDoc).toContain("Acme CRM");
    expect(demo.workspacePrompt).toContain("Verify Acme CRM trial certification");
  });
});