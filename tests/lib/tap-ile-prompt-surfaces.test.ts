import { describe, expect, it } from "vitest";
import {
  TAP_SURFACE,
  TAP_SELECTIVE_THOUGHT_OVERLAY,
  buildTapFacilitatorInstructions,
  buildTapSelectiveThoughtSystemPrompt,
  buildTapOpeningQuestionTask,
  buildTapStartingTopicsTask,
  ILE_SURFACE,
  ILE_CONTEXT_BODY,
  buildIleHeliosChatSystemPrompt,
  buildIleWelcomeSystemPrompt,
} from "@/lib/prompt-kernel";
import { buildTapScoreInstructions, type TapScoreBrief } from "@/lib/tap-score";
import { DEFAULT_PROMPTS, ILE_CONTEXT, getPrompt } from "@/lib/prompts";
import { buildTraceScoringInstructions } from "@/lib/tap-score-traces";

/** Identity phrases that must not appear as positive framing on TAP/ILE surfaces. */
const SOCRATIC_IDENTITY =
  /Socratic companion|Socratic method|Socratic learning demonstration|Socratic tutor|Socratic style|Socratic essence|Socratic questioning|Socratic probe|Socratic exchange|Socratic opening/i;

function expectNoSocraticIdentity(text: string, label: string) {
  expect(text, label).not.toMatch(SOCRATIC_IDENTITY);
}

const sampleBrief: TapScoreBrief = {
  plan: {
    id: "ws-1",
    title: "Onboarding mastery",
    root_topic: "Onboarding",
    description: "Activate new users",
    notes: null,
  },
  nodes: [
    {
      id: "b1",
      title: "ICP",
      description: "Define ideal customer",
      status: "available",
    },
  ],
  sessions: [],
  focusSession: null,
};

describe("TAP prompt surface (shipped builders)", () => {
  it("frames System 1/2 elicitation without Socratic identity", () => {
    expect(TAP_SURFACE).toMatch(/System 1/);
    expect(TAP_SURFACE).toMatch(/System 2/);
    expect(TAP_SURFACE).toMatch(/proof of work|PoW/i);
    expectNoSocraticIdentity(TAP_SURFACE, "TAP_SURFACE");
    expectNoSocraticIdentity(TAP_SELECTIVE_THOUGHT_OVERLAY, "TAP overlay");

    const facilitator = buildTapFacilitatorInstructions({
      assessmentTarget: 'the performance block "ICP"',
      listenerStyle: "a neutral TAP facilitator",
      markers: "Conceptual Clarity, Causal Reasoning",
      minutes: 15,
      workspaceBlock: "Workspace: Onboarding",
    });
    expect(facilitator).toMatch(/System 1|System 2|think-aloud|thought trace/i);
    expect(facilitator).toMatch(/TAP/);
    expectNoSocraticIdentity(facilitator, "buildTapFacilitatorInstructions");

    const selective = buildTapSelectiveThoughtSystemPrompt(facilitator);
    expect(selective).toMatch(/SELECTIVE THOUGHT|selective thought/i);
    expect(selective).toMatch(/System 1|System 2/);
    expectNoSocraticIdentity(selective, "selective thought system");

    expectNoSocraticIdentity(buildTapOpeningQuestionTask(), "opening task");
    expectNoSocraticIdentity(buildTapStartingTopicsTask(3), "topics task");
  });

  it("buildTapScoreInstructions uses the TAP surface (runtime entry)", () => {
    const text = buildTapScoreInstructions(sampleBrief, "curious", 15);
    expect(text).toMatch(/PRODUCT SURFACE: Think Aloud Protocol|TAP facilitator|System 1/i);
    expect(text).toContain("Onboarding mastery");
    expect(text).toContain("ICP");
    expectNoSocraticIdentity(text, "buildTapScoreInstructions");
  });
});

describe("ILE prompt surface (shipped builders + registry)", () => {
  it("frames optimize/augment without Socratic identity", () => {
    expect(ILE_SURFACE).toMatch(/Optimize/i);
    expect(ILE_SURFACE).toMatch(/Augment/i);
    expect(ILE_SURFACE).toMatch(/proof of work|PoW|tools/i);
    expectNoSocraticIdentity(ILE_SURFACE, "ILE_SURFACE");

    const chat = buildIleHeliosChatSystemPrompt();
    expect(chat).toMatch(/practice coach|Optimize|Augment|Mark as Done/i);
    expect(chat).toMatch(/tool/i);
    expectNoSocraticIdentity(chat, "Helios chat system");

    expectNoSocraticIdentity(buildIleWelcomeSystemPrompt(), "welcome system");
    expectNoSocraticIdentity(ILE_CONTEXT_BODY, "ILE_CONTEXT_BODY");
    expect(ILE_CONTEXT).toBe(ILE_CONTEXT_BODY);
  });

  it("registry defaults are goal-oriented (getPrompt path)", () => {
    for (const key of [
      "opening_probe",
      "probe_generation",
      "session_plan_create",
      "session_plan_update",
    ] as const) {
      const text = getPrompt(key);
      expectNoSocraticIdentity(text, `DEFAULT_PROMPTS.${key}`);
    }

    expect(DEFAULT_PROMPTS.session_plan_create).toMatch(/optimize|augment|proof of work/i);
    expect(DEFAULT_PROMPTS.session_plan_create).toMatch(/task|checkpoint|tool/i);
    // Explicitly rejects validate-for-its-own-sake plan design
    expect(DEFAULT_PROMPTS.session_plan_create).toMatch(/not validate-for-validation|Optimize for forward progress/i);
    // Spatial 2D map design + initial-chapters band placeholders
    expect(DEFAULT_PROMPTS.session_plan_create).toMatch(/axis|adjacent|branch|sparse|negative/i);
    expect(DEFAULT_PROMPTS.session_plan_create).toMatch(/position_x|position_y/);
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{initial_chapters_level}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{spatial_map_layout_rules}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{target_step_count}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{min_steps}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{max_steps}");

    expect(DEFAULT_PROMPTS.session_plan_update).toMatch(/practice coach|Optimize|good enough|Mark as Done/i);
    expect(DEFAULT_PROMPTS.opening_probe).toMatch(/practice coach|proof of work|Canvas|task/i);
    expect(DEFAULT_PROMPTS.probe_generation).toMatch(/practice coach|tool|Optimize/i);
    expect(DEFAULT_PROMPTS).not.toHaveProperty("stuck_policy_recommendation");
  });
});

describe("TAP trace scoring addendum", () => {
  it("does not frame dialogue as Socratic exchange", () => {
    const text = buildTraceScoringInstructions({
      system1Count: 2,
      system2Count: 1,
      manifestText: "[t] system1/crystallize: hello",
      fileIds: [],
    });
    expect(text).toMatch(/System 1|System 2|GHC/i);
    expectNoSocraticIdentity(text, "buildTraceScoringInstructions");
  });
});
