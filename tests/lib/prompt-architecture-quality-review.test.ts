/**
 * Structural verification for docs/prompt-architecture-and-quality-review.md.
 * Drives shipped builders (not re-implemented copies) so architecture and
 * quality-critical prompt rules stay grounded in real code.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  composePrompt,
  WORKSPACE_ONTOLOGY,
  WORKSPACE_ONTOLOGY_COMPACT,
  TAP_SURFACE,
  TAP_SELECTIVE_THOUGHT_OVERLAY,
  TAP_PRACTICE_THOUGHT_OVERLAY,
  buildTapFacilitatorInstructions,
  buildTapSelectiveThoughtSystemPrompt,
  buildTapOpeningQuestionTask,
  buildTapPracticeOpeningQuestionTask,
  buildTapStartingTopicsTask,
  ILE_SURFACE,
  ILE_CONTEXT_BODY,
  buildIleHeliosChatSystemPrompt,
  buildIleWelcomeSystemPrompt,
  SCORE_FIELD_DESCRIPTIONS,
  buildScoreContextSurface,
  SCORE_POW_CONTEXT_LAYER,
  SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY,
  scoreInstructionsRequirePowOnly,
  scoreInstructionsRequireSubmitStashAnalysis,
} from "@/lib/prompt-kernel";
import {
  LWM_SNAPSHOT_INSTRUCTIONS,
} from "@/lib/prompt-kernel/scores";
import {
  buildVerticalScoreInstructions,
  PERFORMANCE_REMEDIATION_GUARDRAILS,
} from "@/lib/pow-api/performance-report";
import {
  DEFAULT_PROMPTS,
  getPrompt,
  ILE_CONTEXT,
  type PromptKey,
} from "@/lib/prompts";
import {
  buildDomainExerciseAuthorSystemPrompt,
  buildDomainExerciseAuthorUserPrompt,
} from "@/lib/pow-api/tapbench-exercise-generate";
import { isLowQualityTapbenchExercise } from "@/lib/pow-api/tapbench-exercise-quality";
import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";
import { ileWorkCanvasXaiToolsInstruction } from "@/lib/learn-work-canvas-prompts";
import { buildCalibratePoolSystemMessage } from "@/lib/calibrate-session";
import { buildScoutQuestionsSystemMessage } from "@/lib/scout-session";
import { composeIleChapterGenerateSystemMessage } from "@/lib/learn-chapter-generate";
import {
  stripLearnerFacingWrappers,
  stripSessionFormatWrapper,
} from "@/lib/session-format-wrapper";
import { buildTapScoreInstructions, type TapScoreBrief } from "@/lib/tap-score";
import { buildTraceScoringInstructions } from "@/lib/tap-score-traces";

const ROOT = join(__dirname, "../..");

const sampleBrief: TapScoreBrief = {
  plan: {
    id: "ws-1",
    title: "Linear algebra fundamentals",
    root_topic: "Linear algebra",
    description: "Master vectors and matrices for ML",
    workspace_goal: "Explain and apply matrix multiplication",
    notes: null,
  },
  nodes: [
    {
      id: "b1",
      title: "Matrix multiplication",
      description: "Compute AB and interpret columns as linear combinations",
      status: "available",
    },
  ],
  sessions: [],
  focusSession: null,
};

describe("prompt architecture: composePrompt layering", () => {
  it("orders ontology → surface → task → contextNotes", () => {
    const text = composePrompt({
      ontology: "full",
      surface: "L1_SURFACE_MARKER",
      task: "L2_TASK_MARKER",
      contextNotes: "NOTES_MARKER",
    });
    const i0 = text.indexOf("WORKSPACE ONTOLOGY");
    const i1 = text.indexOf("L1_SURFACE_MARKER");
    const i2 = text.indexOf("L2_TASK_MARKER");
    const i3 = text.indexOf("NOTES_MARKER");
    expect(i0).toBeGreaterThanOrEqual(0);
    expect(i1).toBeGreaterThan(i0);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });

  it("supports compact ontology and ontology none", () => {
    const compact = composePrompt({
      ontology: "compact",
      surface: "S",
      task: "T",
    });
    expect(compact).toContain(WORKSPACE_ONTOLOGY_COMPACT.slice(0, 40));
    expect(compact).not.toContain("TEMPORAL PROOF OF WORK");

    const none = composePrompt({ ontology: "none", surface: "S", task: "T" });
    expect(none.startsWith("S")).toBe(true);
    expect(none).not.toContain("WORKSPACE ONTOLOGY");
  });
});

describe("prompt architecture: TAP call path (shipped builders)", () => {
  it("facilitator uses compact ontology + TAP_SURFACE + dual-stream PoW goals", () => {
    const facilitator = buildTapFacilitatorInstructions({
      assessmentTarget: 'the performance block "Matrix multiplication"',
      listenerStyle: "a neutral knowledge-verification facilitator",
      markers: "Conceptual Clarity, Causal Reasoning",
      minutes: 15,
      workspaceBlock: "Workspace: Linear algebra",
    });
    expect(facilitator.indexOf(WORKSPACE_ONTOLOGY_COMPACT.slice(0, 30))).toBeLessThan(
      facilitator.indexOf("PRODUCT SURFACE: Verify"),
    );
    expect(facilitator).toContain(TAP_SURFACE.slice(0, 50));
    expect(facilitator).toMatch(/observation/i);
    expect(facilitator).toMatch(/action/i);
    expect(facilitator).toMatch(/proof of work|thought-trace|thought trace/i);
    expect(facilitator).toMatch(
      /NEVER use think-aloud stage directions|Never use "say\/talk\/think/i,
    );
  });

  it("selective thought system stacks TAP_SURFACE + overlay without re-adding ontology", () => {
    const facilitator = buildTapFacilitatorInstructions({
      assessmentTarget: "topic X",
      listenerStyle: "curious facilitator",
      markers: "Conceptual Clarity",
      minutes: 10,
      workspaceBlock: "ctx",
    });
    const selective = buildTapSelectiveThoughtSystemPrompt(facilitator);
    const practice = buildTapSelectiveThoughtSystemPrompt(facilitator, {
      practice: true,
    });

    // ontology: none — full ontology must not appear twice as full TEMPORAL section
    expect(selective).toContain(TAP_SURFACE.slice(0, 40));
    expect(selective).toContain(TAP_SELECTIVE_THOUGHT_OVERLAY.slice(0, 40));
    expect(selective).toContain(facilitator.split("\n\n").pop()!.slice(0, 20) || "ctx");
    // Practice overlay only when requested
    expect(practice).toContain(TAP_PRACTICE_THOUGHT_OVERLAY.slice(0, 30));
    expect(selective).not.toContain(TAP_PRACTICE_THOUGHT_OVERLAY.slice(0, 30));
  });

  it("opening / practice / topics tasks demand concrete domain elicitation, not stage theater", () => {
    const opening = buildTapOpeningQuestionTask();
    const practice = buildTapPracticeOpeningQuestionTask();
    const topics = buildTapStartingTopicsTask(3);

    // Opening + topics explicitly ban out-loud stage directions; practice bans product/score jargon.
    expect(opening).toMatch(/out loud|think aloud|stage direction/i);
    expect(opening).toMatch(/Never|NEVER|No "out loud"/i);
    expect(topics).toMatch(/out loud|think aloud|stage direction/i);
    expect(topics).toMatch(/Never|NEVER|No "out loud"/i);
    expect(practice).toMatch(/Never mention practice mode|Uncertain Systems|PoW|TAP/i);
    for (const [label, text] of [
      ["opening", opening],
      ["practice", practice],
      ["topics", topics],
    ] as const) {
      expect(text, label).not.toMatch(/Socratic/i);
    }
    expect(opening).toMatch(/concrete|calculation|causal|debugging|scenario/i);
    expect(opening).toMatch(/not a generic icebreaker|not a meta question/i);
    expect(practice).toMatch(/PRACTICE|warm-up|simple|introductory/i);
    expect(topics).toMatch(/openingQuestion/);
    expect(topics).toMatch(/observation and action/);
  });

  it("runtime buildTapScoreInstructions grounds in workspace brief", () => {
    const runtime = buildTapScoreInstructions(sampleBrief, "curious", 12);
    expect(runtime).toContain("Linear algebra fundamentals");
    expect(runtime).toContain("Matrix multiplication");
    expect(runtime).toMatch(/PRODUCT SURFACE: Verify|observation/i);
  });

  it("TAP chat route wires selective thought system prompt", () => {
    const route = readFileSync(
      join(ROOT, "app/api/workspace-tap-score/chat/route.ts"),
      "utf8",
    );
    expect(route).toContain("buildTapScoreInstructions");
    expect(route).toContain("buildTapSelectiveThoughtSystemPrompt");
  });
});

describe("prompt architecture: TAP Learning call path (shipped builders + registry)", () => {
  it("Helios chat composes compact ontology + ILE_SURFACE with chapter optimize/augment", () => {
    const chat = buildIleHeliosChatSystemPrompt();
    expect(chat.indexOf(WORKSPACE_ONTOLOGY_COMPACT.slice(0, 30))).toBeLessThan(
      chat.indexOf("PRODUCT SURFACE: Learn"),
    );
    expect(chat).not.toContain("PRODUCT SURFACE: TAP Learning");
    expect(chat).toContain(ILE_SURFACE.slice(0, 40));
    expect(chat).toMatch(/Optimize|Augment|current chapter|Mark as Done/i);
    expect(chat).toMatch(/NOT a dual-stream|not running a dual-stream/i);
    expect(chat).toMatch(/Canvas|Notebook/);
  });

  it("welcome uses ILE_SURFACE without full ontology", () => {
    const welcome = buildIleWelcomeSystemPrompt();
    expect(welcome).toContain("PRODUCT SURFACE: Learn");
    expect(welcome).not.toContain("PRODUCT SURFACE: TAP Learning");
    expect(welcome).not.toContain("TEMPORAL PROOF OF WORK");
  });

  it("registry getPrompt path is overridable and chapter-aware for core TAP Learning keys", () => {
    const keys: PromptKey[] = [
      "opening_probe",
      "probe_generation",
      "session_plan_create",
      "session_plan_update",
    ];
    for (const key of keys) {
      const def = getPrompt(key);
      const over = getPrompt(key, { [key]: "CUSTOM_OVERRIDE_BODY" });
      expect(def).toBe(DEFAULT_PROMPTS[key]);
      expect(over).toBe("CUSTOM_OVERRIDE_BODY");
      expect(def).toMatch(/chapter/i);
    }
    // Registry does not go through composePrompt ontology
    expect(DEFAULT_PROMPTS.opening_probe).not.toContain("WORKSPACE ONTOLOGY");
    expect(DEFAULT_PROMPTS.opening_probe).toMatch(/GOOD patterns|Canvas|practice/i);
    expect(DEFAULT_PROMPTS.probe_generation).toMatch(/tool|Mark as Done|chapter/i);
    expect(DEFAULT_PROMPTS.session_plan_update).toMatch(/NO-ENDLESS-DRILLING|Mark as Done/i);
    expect(ILE_CONTEXT).toBe(ILE_CONTEXT_BODY);
  });

  it("session-chat route uses Helios builder", () => {
    const route = readFileSync(join(ROOT, "app/api/session-chat/route.ts"), "utf8");
    expect(route).toContain("buildIleHeliosChatSystemPrompt");
  });

  it("xai consumers resolve registry keys via getPrompt", () => {
    const xai = readFileSync(join(ROOT, "lib/xai.ts"), "utf8");
    for (const key of [
      "report_generation",
      "follow_up_sessions",
      "generate_objectives",
      "session_plan_create",
    ]) {
      expect(xai).toContain(`getPrompt("${key}"`);
    }
    expect(readFileSync(join(ROOT, "lib/session-plan-update.ts"), "utf8")).toContain(
      "session_plan_update",
    );
  });
});

describe("prompt architecture: domain exercise generation", () => {
  it("author system prompt bans weak openers and out-loud; surfaces differ by audience", () => {
    for (const surface of ["tap_exercise", "ile_project"] as const) {
      const sys = buildDomainExerciseAuthorSystemPrompt(surface);
      expect(sys).toMatch(/Exercise:/);
      expect(sys).toMatch(/Do NOT ask.*think aloud|out loud/i);
      expect(sys).toMatch(/Using what you know about|Demonstrate your understanding/);
      expect(sys).not.toContain("WORKSPACE ONTOLOGY");
    }
    expect(buildDomainExerciseAuthorSystemPrompt("ile_project")).toMatch(
      /chapter-scale|project chapter|longer-horizon/i,
    );
    expect(buildDomainExerciseAuthorSystemPrompt("tap_exercise")).toMatch(
      /timed TAP drill|solo exercise/i,
    );
  });

  it("user prompt assembles workspace/block grounding via shipped builder", () => {
    const user = buildDomainExerciseAuthorUserPrompt({
      surface: "tap_exercise",
      workspaceTitle: "Linear algebra fundamentals",
      blockTitle: "Matrix multiplication",
      blockDescription: "Compute AB and interpret columns",
      workspaceGoal: "Explain and apply matrix multiplication",
      durationSeconds: 900,
    });
    expect(user).toMatch(/Matrix multiplication/);
    expect(user).toMatch(/Linear algebra fundamentals/);
    expect(user).toMatch(/Time budget/i);
  });

  it("quality gate rejects syllabus-style non-exercises", () => {
    expect(
      isLowQualityTapbenchExercise("Using what you know about vectors, write something.", {
        blockTitle: "Vectors",
      }),
    ).toBe(true);
    expect(
      isLowQualityTapbenchExercise(
        "Integers, modular arithmetic, combinatorics, and graph theory.",
        { blockTitle: "Number theory" },
      ),
    ).toBe(true);
  });
});

describe("LWM Snapshot scoring stack (shipped composition)", () => {
  it("verification instructions layer full ontology → PoW-only → submit/stash → LWM task", () => {
    const instructions = buildVerticalScoreInstructions(
      "verification",
      "b1",
      "Explain and apply matrix multiplication",
    );

    const iOntology = instructions.indexOf("WORKSPACE ONTOLOGY");
    const iPow = instructions.indexOf("SCORE GENERATION CONTEXT");
    const iStash = instructions.indexOf("SUBMIT / STASH");
    const iTask = instructions.indexOf("You produce a structured");
    // L2 embeds required scoring outputs after the task opener (ontology also names LWM).
    const iLwmRequired = instructions.indexOf("Required scoring outputs for");

    expect(iOntology).toBeGreaterThanOrEqual(0);
    expect(iPow).toBeGreaterThan(iOntology);
    expect(iStash).toBeGreaterThan(iPow);
    expect(iTask).toBeGreaterThan(iStash);
    expect(iLwmRequired).toBeGreaterThan(iTask);

    expect(scoreInstructionsRequirePowOnly(instructions)).toBe(true);
    expect(scoreInstructionsRequireSubmitStashAnalysis(instructions)).toBe(true);
    expect(instructions).toContain(LWM_SNAPSHOT_INSTRUCTIONS.slice(0, 40));
    expect(instructions).toContain(PERFORMANCE_REMEDIATION_GUARDRAILS.slice(0, 40));
    expect(instructions).toContain("Explain and apply matrix multiplication");
    expect(instructions).toMatch(/marker_scores/);
    expect(instructions).toMatch(/gap_analysis\.next_steps/);
    expect(instructions).toMatch(/not a naive average of markers/i);
  });

  it("surface builder attaches submit/stash only for verification", () => {
    const ver = buildScoreContextSurface("verification");
    expect(ver).toContain(SCORE_POW_CONTEXT_LAYER.slice(0, 30));
    expect(ver).toContain(SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY.slice(0, 30));
    expect(buildScoreContextSurface("augmentation")).not.toContain(
      "VERIFICATION — SUBMIT / STASH",
    );
  });

  it("field descriptions define primary score + GHC but lack numeric band anchors (documented gap)", () => {
    expect(SCORE_FIELD_DESCRIPTIONS.score).toMatch(/0–100|0-100/);
    expect(SCORE_FIELD_DESCRIPTIONS.score).toMatch(
      /coverage|depth|demonstrated knowledge/i,
    );
    expect(SCORE_FIELD_DESCRIPTIONS.ghc_score).toMatch(/Genuine Human Cognition|observation|action/i);
    // Underspecification claim: no band tables like "0–20" / "81–100" in current instructions
    const instructions = buildVerticalScoreInstructions("verification", null);
    expect(instructions).not.toMatch(/0–20:|0-20:|81–100:|81-100:/);
    expect(LWM_SNAPSHOT_INSTRUCTIONS).not.toMatch(/PRIMARY SCORE BANDS/);
  });

  it("trace scoring addendum cites System1/2 counts for GHC", () => {
    const text = buildTraceScoringInstructions({
      system1Count: 3,
      system2Count: 2,
      manifestText: "[t1] system1/crystallize: foo",
      fileIds: ["file-1"],
    });
    expect(text).toMatch(/Observation traces \(3\)/);
    expect(text).toMatch(/Action traces \(2\)/);
    expect(text).toMatch(/ghc_score|GHC/);
  });

  it("ontology states single primary-score strategy and remediation rule", () => {
    expect(WORKSPACE_ONTOLOGY).toMatch(/primary score/i);
    expect(WORKSPACE_ONTOLOGY).toMatch(/ghc_score|GHC/);
    expect(WORKSPACE_ONTOLOGY).toMatch(/Never recommend Uncertain Systems platform mechanics/i);
    expect(WORKSPACE_ONTOLOGY).not.toMatch(/Cookie-auth Snapshot API/);
    expect(LWM_SNAPSHOT_INSTRUCTIONS).toMatch(/sole primary score strategy/i);
    expect(LWM_SNAPSHOT_INSTRUCTIONS).toMatch(
      /Do NOT invent separate augmentation or optimization primary/i,
    );
  });
});

function suggestedOpeningSpeech(text: string): string {
  const match = text.match(/Suggested opening[\s\S]*?\n"([^"]+)"/i);
  return match?.[1] ?? "";
}

describe("learner-visible tutor voice on live Calibrate / Learn / Verify paths", () => {
  it("TUTOR_CANVAS_VOICE bans jargon, wrappers, and stage directions", () => {
    expect(TUTOR_CANVAS_VOICE).toMatch(/wise, warm teacher/i);
    expect(TUTOR_CANVAS_VOICE).toMatch(/In one guided conversation/i);
    expect(TUTOR_CANVAS_VOICE).toMatch(/sits in the right place/i);
    expect(TUTOR_CANVAS_VOICE).toMatch(/Check\/ask/i);
    expect(TUTOR_CANVAS_VOICE).toMatch(/Uncertain Systems/i);
    expect(TUTOR_CANVAS_VOICE).toMatch(/Never mention/i);
  });

  it("live system and task strings include tutor voice plus bans", () => {
    const verify = buildTapFacilitatorInstructions({
      assessmentTarget: 'the performance block "Matrix multiplication"',
      listenerStyle: "a warm, wise teacher conducting knowledge verification",
      markers: "Conceptual Clarity",
      minutes: 12,
      workspaceBlock: "Workspace: Linear algebra",
    });
    const learn = buildIleHeliosChatSystemPrompt();
    const calibrate = buildCalibratePoolSystemMessage();
    const scout = buildScoutQuestionsSystemMessage();
    const chapter = composeIleChapterGenerateSystemMessage("learning");
    const canvasText = ileWorkCanvasXaiToolsInstruction();

    for (const [label, text] of [
      ["TUTOR_CANVAS_VOICE", TUTOR_CANVAS_VOICE],
      ["TAP_SURFACE", TAP_SURFACE],
      ["verify facilitator", verify],
      ["ILE_SURFACE", ILE_SURFACE],
      ["learn chat", learn],
      ["calibrate pool", calibrate],
      ["scout questions", scout],
      ["chapter generate", chapter],
      ["opening task", buildTapOpeningQuestionTask()],
      ["opening_probe", getPrompt("opening_probe")],
      ["session_plan_create", getPrompt("session_plan_create")],
      ["session_plan_update", getPrompt("session_plan_update")],
    ] as const) {
      expect(text, label).toMatch(/wise, warm teacher|LEARNER-FACING VOICE|Answer the topic directly/i);
      expect(text, label).toMatch(/In one guided conversation|session-format wrapper/i);
      expect(text, label).toMatch(/out loud/i);
      expect(text, label).toMatch(/Uncertain Systems|PoW|Proof of Work/i);
    }

    expect(canvasText).toMatch(/"text" is what the learner reads/i);
    expect(canvasText).toMatch(/Never mention Check\/ask/i);
    expect(canvasText).toMatch(/Never mention PoW, platform jargon, or Uncertain Systems/i);
    expect(ILE_SURFACE).toMatch(/several turns on (this chapter |one )?topic/);
    expect(ILE_SURFACE).not.toMatch(/a chapter is a topic-horizon conversation/i);
    expect(learn).not.toMatch(/a chapter is a topic-horizon conversation/i);
  });

  it("suggested openings and canvas text do not tell the model to say private jargon", () => {
    const facilitator = buildTapFacilitatorInstructions({
      assessmentTarget: "topic X",
      listenerStyle: "curious facilitator",
      markers: "Conceptual Clarity",
      minutes: 10,
      workspaceBlock: "ctx",
    });
    const opening = suggestedOpeningSpeech(facilitator);
    expect(opening.length).toBeGreaterThan(20);
    expect(opening).not.toMatch(/PoW|Proof of Work|System 1|TIM|Uncertain Systems|Check\/ask|guided conversation/i);
    expect(opening).toMatch(/concrete|topic|try/i);

    const canvasText = ileWorkCanvasXaiToolsInstruction();
    expect(canvasText).toMatch(/"text" is what the learner reads on the board/i);
    expect(canvasText).toMatch(/Answer the topic directly/i);
    expect(canvasText).toMatch(/Never mention PoW, platform jargon, or Uncertain Systems/);
  });

  it("composePrompt still orders ontology → surface → task", () => {
    const text = composePrompt({
      ontology: "full",
      surface: "L1_SURFACE_MARKER",
      task: "L2_TASK_MARKER",
    });
    expect(text.indexOf("WORKSPACE ONTOLOGY")).toBeLessThan(text.indexOf("L1_SURFACE_MARKER"));
    expect(text.indexOf("L1_SURFACE_MARKER")).toBeLessThan(text.indexOf("L2_TASK_MARKER"));
  });

  it("strip functions remove known wrappers and leave the topic sentence", () => {
    expect(
      stripSessionFormatWrapper(
        "In one guided conversation, work the last-resort test on a just-war case.",
      ),
    ).toBe("Work the last-resort test on a just-war case.");
    expect(
      stripLearnerFacingWrappers(
        "Your question sits in the right place (After Check/Ask). Name the two bodies in the inverse-square law.",
      ),
    ).toBe("Name the two bodies in the inverse-square law.");
    expect(
      stripLearnerFacingWrappers(
        "In a topic-horizon conversation, compare two AVL rotations on the same insert.",
      ),
    ).toBe("Compare two AVL rotations on the same insert.");
  });
});

describe("analysis deliverable present", () => {
  it("ships docs/prompt-architecture-and-quality-review.md with four acceptance sections", () => {
    const doc = readFileSync(
      join(ROOT, "docs/prompt-architecture-and-quality-review.md"),
      "utf8",
    );
    expect(doc).toMatch(/End-to-end prompt architecture|composePrompt/i);
    expect(doc).toMatch(/TAP dialog|observation|action/i);
    expect(doc).toMatch(/TAP Learning dialog|Mark as Done|session_plan/i);
    expect(doc).toMatch(/LWM Snapshot scoring|PRIMARY SCORE BANDS|score-derivation/i);
    expect(doc).toMatch(/buildVerticalScoreInstructions/);
    expect(doc).toMatch(/SCORE_POW_CONTEXT_LAYER|SUBMIT \/ STASH/i);
  });
});
