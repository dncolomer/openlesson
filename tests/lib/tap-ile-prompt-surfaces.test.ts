import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
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
import {
  buildTapOpeningQuestionFallback,
  buildTapScoreInstructions,
  buildTapStartingTopicsFallback,
  listenerStyle,
  type TapScoreBrief,
} from "@/lib/tap-score";
import { DEFAULT_PROMPTS, ILE_CONTEXT, getPrompt } from "@/lib/prompts";
import { buildTraceScoringInstructions } from "@/lib/tap-score-traces";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";

/** Identity phrases that must not appear as positive framing on TAP/ILE surfaces. */
const SOCRATIC_IDENTITY =
  /Socratic companion|Socratic method|Socratic learning demonstration|Socratic tutor|Socratic style|Socratic essence|Socratic questioning|Socratic probe|Socratic exchange|Socratic opening/i;

/** Legacy prescribed stage-direction copy that must not reappear as model speech examples. */
const LEGACY_CRINGE_EXAMPLES = [
  /"say the next sentence out loud"/i,
  /Say the causal link out loud/i,
  /Talk through what you learned here out loud/i,
  /You facilitate a TAP session for Uncertain Systems/i,
] as const;

function expectNoSocraticIdentity(text: string, label: string) {
  expect(text, label).not.toMatch(SOCRATIC_IDENTITY);
}

/** Extract the suggested opening line the model is told to use (not ban-list quotes). */
function suggestedOpeningSpeech(text: string): string {
  const match = text.match(
    /Suggested opening[\s\S]*?\n"([^"]+)"/i,
  );
  return match?.[1] ?? "";
}

function expectNoLegacyCringeExamples(text: string, label: string) {
  for (const pattern of LEGACY_CRINGE_EXAMPLES) {
    expect(text, label).not.toMatch(pattern);
  }
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
  it("frames dual-stream System 1/2 elicitation without Socratic identity", () => {
    expect(TAP_SURFACE).toMatch(/System 1/);
    expect(TAP_SURFACE).toMatch(/System 2/);
    expect(TAP_SURFACE).toMatch(/proof of work|PoW/i);
    expectNoSocraticIdentity(TAP_SURFACE, "TAP_SURFACE");
    expectNoSocraticIdentity(TAP_SELECTIVE_THOUGHT_OVERLAY, "TAP overlay");

    const facilitator = buildTapFacilitatorInstructions({
      assessmentTarget: 'the performance block "ICP"',
      listenerStyle: "a neutral knowledge-verification facilitator",
      markers: "Conceptual Clarity, Causal Reasoning",
      minutes: 15,
      workspaceBlock: "Workspace: Onboarding",
    });
    expect(facilitator).toMatch(/System 1|System 2|thought-trace|thought trace/i);
    expect(facilitator).toMatch(/knowledge-verification|knowledge verification|knowledge-check/i);
    expectNoSocraticIdentity(facilitator, "buildTapFacilitatorInstructions");

    const selective = buildTapSelectiveThoughtSystemPrompt(facilitator);
    expect(selective).toMatch(/SELECTIVE THOUGHT|selective thought/i);
    expect(selective).toMatch(/System 1|System 2/);
    expectNoSocraticIdentity(selective, "selective thought system");

    expectNoSocraticIdentity(buildTapOpeningQuestionTask(), "opening task");
    expectNoSocraticIdentity(buildTapStartingTopicsTask(3), "topics task");
  });

  it("forbids cringe out-loud stage directions in learner-facing speech examples", () => {
    const facilitator = buildTapFacilitatorInstructions({
      assessmentTarget: 'the performance block "ICP"',
      listenerStyle: listenerStyle("curious"),
      markers: "Conceptual Clarity, Causal Reasoning",
      minutes: 15,
      workspaceBlock: "Workspace: Onboarding",
    });
    const selective = buildTapSelectiveThoughtSystemPrompt(facilitator);
    const openingTask = buildTapOpeningQuestionTask();
    const topicsTask = buildTapStartingTopicsTask(3);
    const runtime = buildTapScoreInstructions(sampleBrief, "curious", 15);

    for (const [label, text] of [
      ["TAP_SURFACE", TAP_SURFACE],
      ["TAP_SELECTIVE_THOUGHT_OVERLAY", TAP_SELECTIVE_THOUGHT_OVERLAY],
      ["facilitator", facilitator],
      ["selective", selective],
      ["openingTask", openingTask],
      ["topicsTask", topicsTask],
      ["buildTapScoreInstructions", runtime],
    ] as const) {
      // Surface must ban the pattern as a speech rule, not prescribe it as an example tactic.
      expect(text, label).toMatch(/out loud/i);
      expect(text, label).toMatch(
        /NEVER use think-aloud stage directions|Never use "say\/talk\/think|never stage-direct with "out loud"|No "out loud"|not stage directions about speaking out loud/i,
      );
      expectNoLegacyCringeExamples(text, label);
    }

    // Suggested opening the model may copy must be natural knowledge verification.
    const opening = suggestedOpeningSpeech(facilitator);
    expect(opening.length).toBeGreaterThan(20);
    expect(opening).toMatch(/checkable|intermediate result|concrete/i);
    expect(opening).not.toMatch(/out loud|Uncertain Systems|Proof of Work|\bPoW\b|TAP|ILE/i);

    const runtimeOpening = suggestedOpeningSpeech(runtime);
    expect(runtimeOpening).toBe(opening);
    expect(suggestedOpeningSpeech(selective)).toBe(opening);

    // Offline opening/topic fallbacks are learner-visible — generic, no title shells.
    const openingFallback = buildTapOpeningQuestionFallback(sampleBrief);
    const topicsFallback = buildTapStartingTopicsFallback(sampleBrief);
    expect(openingFallback).not.toMatch(/out loud/i);
    expect(openingFallback).toMatch(/concrete claim|intermediate result|prove/i);
    expect(openingFallback).not.toMatch(
      /attachments\s*:|Given parameters\s+A\s*=|on this setup|Using “/i,
    );
    expect(openingFallback).not.toMatch(/Uncertain Systems|Proof of Work|\bPoW\b/i);
    for (const topic of topicsFallback) {
      expect(topic.openingQuestion).not.toMatch(/out loud/i);
      expect(topic.openingQuestion).not.toMatch(
        /attachments\s*:|Given parameters\s+A\s*=|on this setup/i,
      );
      expect(topic.title + topic.subtitle + topic.openingQuestion).not.toMatch(
        /Uncertain Systems|Proof of Work|\bPoW\b|Think Aloud Protocol/i,
      );
    }
  });

  it("requires learner-visible turns never leak platform/product mechanics", () => {
    const facilitator = buildTapFacilitatorInstructions({
      assessmentTarget: 'the performance block "ICP"',
      listenerStyle: listenerStyle("curious"),
      markers: "Conceptual Clarity",
      minutes: 10,
      workspaceBlock: "Workspace: Onboarding",
    });
    const selective = buildTapSelectiveThoughtSystemPrompt(facilitator);
    const runtime = buildTapScoreInstructions(sampleBrief, "curious", 15);

    for (const [label, text] of [
      ["TAP_SURFACE", TAP_SURFACE],
      ["TAP_SELECTIVE_THOUGHT_OVERLAY", TAP_SELECTIVE_THOUGHT_OVERLAY],
      ["facilitator", facilitator],
      ["selective", selective],
      ["runtime", runtime],
      ["openingTask", buildTapOpeningQuestionTask()],
      ["topicsTask", buildTapStartingTopicsTask(3)],
    ] as const) {
      // Explicit speech ban present (model is told not to say these to the learner).
      expect(text, label).toMatch(/Never (?:mention|reference)|NEVER mention/i);
      expect(text, label).toMatch(/Uncertain Systems/);
      expect(text, label).toMatch(/PoW|Proof of Work/i);
      expectNoLegacyCringeExamples(text, label);
    }

    // Positive knowledge-verification framing (not protocol theater).
    expect(TAP_SURFACE).toMatch(/definitions, causal links, examples, comparisons, predictions/i);
    expect(TAP_SELECTIVE_THOUGHT_OVERLAY).toMatch(
      /definitions, causal steps, examples|application\/transfer|comparisons, predictions/i,
    );

    // listenerStyle keeps dual-stream goals for the model while forbidding stage directions / platform talk.
    const style = listenerStyle("curious");
    expect(style).toMatch(/System 1/);
    expect(style).toMatch(/System 2/);
    expect(style).toMatch(/knowledge-verification|knowledge verification/i);
    expect(style).toMatch(/without stage directions|platform talk/i);
  });

  it("buildTapScoreInstructions uses the TAP surface (runtime entry)", () => {
    const text = buildTapScoreInstructions(sampleBrief, "curious", 15);
    expect(text).toMatch(/PRODUCT SURFACE: Think Aloud Protocol|knowledge-verification facilitator|System 1/i);
    expect(text).toContain("Onboarding mastery");
    expect(text).toContain("ICP");
    expect(text).toMatch(/System 1/);
    expect(text).toMatch(/System 2/);
    expect(text).toMatch(/definitions|causal|examples|comparisons|predictions|repairs/i);
    expectNoSocraticIdentity(text, "buildTapScoreInstructions");
    // Identity is not "facilitator for Uncertain Systems" as a product pitch to the learner.
    expect(text).not.toMatch(/You facilitate a TAP session for Uncertain Systems/);
  });
});

describe("ILE prompt surface (shipped builders + registry)", () => {
  it("frames chapter-aware optimize/augment (not TAP dual-stream primary)", () => {
    expect(ILE_SURFACE).toMatch(/Optimize/i);
    expect(ILE_SURFACE).toMatch(/Augment/i);
    expect(ILE_SURFACE).toMatch(/current chapter/i);
    expect(ILE_SURFACE).toMatch(/Canvas|Notebook|tools/i);
    // Dual-stream must not be the primary ILE conversation goal.
    expect(ILE_SURFACE).toMatch(/NOT a TAP dual-stream|not TAP dual-stream|not optimize for System 1/i);
    expectNoSocraticIdentity(ILE_SURFACE, "ILE_SURFACE");

    const chat = buildIleHeliosChatSystemPrompt();
    expect(chat).toMatch(/practice coach|Optimize|Augment|Mark as Done/i);
    expect(chat).toMatch(/current chapter/i);
    expect(chat).toMatch(/Canvas|Notebook|tool/i);
    expect(chat).toMatch(/next (or adjacent )?chapter|adjacent chapter|next chapter/i);
    expect(chat).not.toMatch(/primary goal.*System 1|elicit System 1 and System 2/i);
    expectNoSocraticIdentity(chat, "Helios chat system");

    const welcome = buildIleWelcomeSystemPrompt();
    expect(welcome).toMatch(/chapter/i);
    expectNoSocraticIdentity(welcome, "welcome system");
    expectNoSocraticIdentity(ILE_CONTEXT_BODY, "ILE_CONTEXT_BODY");
    expect(ILE_CONTEXT).toBe(ILE_CONTEXT_BODY);
    expect(ILE_CONTEXT_BODY).toMatch(/current.?chapter|Mark as Done|Canvas/i);
  });

  it("bans cringe out-loud stage directions and platform product talk in learner-visible ILE speech rules", () => {
    const chat = buildIleHeliosChatSystemPrompt();
    const welcome = buildIleWelcomeSystemPrompt();

    for (const [label, text] of [
      ["ILE_SURFACE", ILE_SURFACE],
      ["ILE_CONTEXT_BODY", ILE_CONTEXT_BODY],
      ["heliosChat", chat],
      ["welcome", welcome],
      ["opening_probe", getPrompt("opening_probe")],
      ["probe_generation", getPrompt("probe_generation")],
      ["session_plan_create", getPrompt("session_plan_create")],
      ["session_plan_update", getPrompt("session_plan_update")],
    ] as const) {
      // Ban rules present (may name forbidden terms only as bans).
      expect(text, label).toMatch(/out loud/i);
      expect(text, label).toMatch(
        /NEVER use think-aloud stage directions|Never use "say\/talk\/think|never use "out loud"|NEVER use "out loud"|No "out loud"|never use "out loud"|Say\/talk\/think … out loud|never put "out loud"/i,
      );
      expect(text, label).toMatch(/Uncertain Systems|PoW|Proof of Work/i);
      expect(text, label).toMatch(
        /Never (?:mention|put)|NEVER mention|never mention|Mentions of Uncertain Systems/i,
      );
      // No prescribed TAP-style dual-stream primary goal for ILE coaching speech.
      expect(text, label).not.toMatch(/"say the next sentence out loud"|Say the causal link out loud|Talk through what you learned here out loud/i);
    }

    // Practice tools remain allowed for routing deeper work.
    expect(ILE_SURFACE).toMatch(/Canvas|Notebook|Grokipedia|screen share/i);
    expect(chat).toMatch(/Canvas|Notebook|Grokipedia|screen share/i);
    expect(DEFAULT_PROMPTS.opening_probe).toMatch(/Canvas|Notebook/);
    expect(DEFAULT_PROMPTS.probe_generation).toMatch(/Canvas|Notebook|Grokipedia/);
  });

  it("registry defaults are chapter-aware tool-driving practice coaches (getPrompt path)", () => {
    for (const key of [
      "opening_probe",
      "probe_generation",
      "session_plan_create",
      "session_plan_update",
    ] as const) {
      const text = getPrompt(key);
      expectNoSocraticIdentity(text, `DEFAULT_PROMPTS.${key}`);
      expect(text, key).toMatch(/chapter/i);
    }

    expect(DEFAULT_PROMPTS.session_plan_create).toMatch(/optimize|augment|proof of work|practice artifacts/i);
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
    expect(DEFAULT_PROMPTS.session_plan_create).not.toMatch(/ILE session planner for Uncertain Systems/);

    expect(DEFAULT_PROMPTS.session_plan_update).toMatch(/practice coach|Optimize|good enough|Mark as Done/i);
    expect(DEFAULT_PROMPTS.session_plan_update).toMatch(/next or adjacent chapter|adjacent chapter|next chapter/i);
    expect(DEFAULT_PROMPTS.session_plan_update).toMatch(/not TAP System 1|not TAP dual-stream/i);
    expect(DEFAULT_PROMPTS.opening_probe).toMatch(/practice coach|Canvas|task|deeper work|chapter/i);
    expect(DEFAULT_PROMPTS.probe_generation).toMatch(/practice coach|tool|Optimize|chapter/i);
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

/** TAP conversation API routes that assemble resolveTapSessionAccess for chat/topics/start/etc. */
const TAP_SCORE_ROUTES = [
  "chat",
  "complete",
  "idle",
  "speech",
  "start",
  "topics",
  "performance",
  "trace",
] as const;

describe("TAP score routes (shipped source integrity)", () => {
  it("pass entryQueryParams into resolveTapSessionAccess without lone-comma syntax", () => {
    for (const name of TAP_SCORE_ROUTES) {
      const filePath = path.join(
        process.cwd(),
        "app/api/workspace-tap-score",
        name,
        "route.ts",
      );
      const source = fs.readFileSync(filePath, "utf8");
      // TS1136 regression: a lone comma line inside object literals breaks every TAP route.
      expect(source, name).not.toMatch(/^\s*,\s*$/m);
      expect(source, name).toContain("resolveTapSessionAccess");
      expect(source, name).toContain("entryQueryParamsFromBody");
      expect(source, name).toMatch(
        /entryQueryParams:\s*entryQueryParamsFromBody\(body/,
      );
    }
  });

  it("entryQueryParamsFromBody (shipped helper used by TAP routes) normalizes body params", () => {
    // Drive the real helper the routes call — not a reimplementation.
    const params = entryQueryParamsFromBody({
      entryQueryParams: { cohort: "a", role: ["lead", "ic"] },
      privateToken: "secret",
    });
    expect(params).toEqual({ cohort: "a", role: ["lead", "ic"] });
    expect(entryQueryParamsFromBody({})).toEqual({});
  });
});
