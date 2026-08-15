/**
 * Dialog vs Project ILE chapter grain, Mark-as-Done policy, expansion, and PoW.
 * Drives shipped compose / Helios / persist-payload helpers — not a reimplementation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import { composeSessionPlanCreatePrompt } from "@/lib/session-plan-create";
import { composeSessionPlanUpdatePrompt } from "@/lib/session-plan-update";
import {
  applyIleChapterModeInstructions,
  buildIleChapterAddPowToolData,
  buildIleChapterLoadPowToolData,
  buildIleChapterSuggestPowToolData,
  ILE_CHAPTER_LOAD_TOOL_ACTION,
  ILE_CHAPTER_RELOAD_TOOL_ACTION,
  extractIleChapterSuggestionFromCoachText,
  ILE_CHAPTER_ADD_TOOL_ACTION,
  ILE_CHAPTER_SUGGEST_TOOL_ACTION,
  ILE_DIALOG_MIN_SUBSTANTIVE_TURNS_BEFORE_DONE,
  ileChapterSuggestionPowFromCoachText,
  normalizeIleChapterSuggestion,
  shouldOfferIleChapterDone,
} from "@/lib/ile-chapter-depth";
import {
  buildIleHeliosChatSystemPrompt,
  ILE_CONTEXT_BODY,
  ILE_SURFACE,
} from "@/lib/prompt-kernel";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-29d5d0c5afa4/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const createVars = {
  problem: "Binary search trees",
  objectives: ["Insert nodes", "Balance a tree"],
  calibration: "2 prior sessions",
  initialChapters: "mid" as const,
};

const updateVars = {
  goal: "Explain BST insert",
  strategy: "Practice then check",
  steps: [
    {
      id: "s1",
      type: "task" as const,
      description: "Work the insert path as a topic-horizon conversation",
      status: "in_progress" as const,
      order: 1,
    },
  ],
  currentStepIndex: 0,
  previousProbes: ["What happens when the key is less than the node?"],
  contextDescription: "Learner just answered the first probe.",
};

function writeScratch(name: string, text: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), text, "utf8");
}

describe("composeSessionPlanCreatePrompt is mode-aware (shipped fill path)", () => {
  it("Dialog vs Project filled prompts differ on grain and Dialog includes expansion/PoW", () => {
    const learning = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      ...createVars,
      sessionMode: "learning",
    });
    const project = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      ...createVars,
      sessionMode: "project",
    });

    writeScratch("session-plan-create-learning.txt", learning);
    writeScratch("session-plan-create-project.txt", project);

    expect(learning).not.toBe(project);
    expect(learning).toContain("Binary search trees");
    expect(project).toContain("Binary search trees");

    // Dialog: topic-horizon conversation, not single-interaction micro-chapters
    expect(learning).toMatch(/topic-horizon conversation/i);
    expect(learning).toMatch(/Summarize what you understand as X/i);
    expect(learning).toMatch(/Draw X on a notebook/i);
    expect(learning).toMatch(/Make a list/i);
    expect(learning).toMatch(/Finish the list from chapter 1/i);
    expect(learning).toMatch(/MUST be one chapter, not four/i);
    expect(learning).toMatch(/question \| task \| suggestion \| checkpoint/);
    expect(learning).toMatch(/mix inside a chapter/i);
    expect(learning).toMatch(/MUST NOT each become their own chapter/i);
    expect(learning).toMatch(/Notebook \/ Canvas/i);
    expect(learning).toMatch(/stays in that one chapter/i);

    // Dialog expansion + PoW
    expect(learning).toMatch(/chapter map can be expanded/i);
    expect(learning).toMatch(/suggest \/ propose new chapters/i);
    expect(learning).toMatch(/topic they are actually working on/i);
    expect(learning).toMatch(/Proof of Work/i);

    // Project: standalone longer-horizon exercises
    expect(project).toMatch(/standalone longer-horizon exercise/i);
    expect(project).toMatch(/one completable task per chapter/i);
    expect(project).toMatch(/not a Dialog multi-turn script/i);
    expect(project).toMatch(/follow-up-after-Done|after Mark as Done/i);
    expect(project).not.toMatch(/MUST be one chapter, not four/);
    expect(learning).not.toMatch(/standalone longer-horizon exercise/i);
  });

  it("default template still exposes activity-type vocabulary and spatial placeholders", () => {
    expect(DEFAULT_PROMPTS.session_plan_create).toMatch(/"question" \| "task" \| "suggestion" \| "checkpoint"/);
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{chapter_grain_rules}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{learning_harness_rules}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{chapter_expansion_rules}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{session_mode}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{spatial_map_layout_rules}");
  });
});

describe("composeSessionPlanUpdatePrompt + Helios (shipped fill path)", () => {
  it("Dialog forbids first-interaction Mark as Done; Project keeps exercise closure", () => {
    const learning = composeSessionPlanUpdatePrompt(DEFAULT_PROMPTS.session_plan_update, {
      ...updateVars,
      sessionMode: "learning",
    });
    const project = composeSessionPlanUpdatePrompt(DEFAULT_PROMPTS.session_plan_update, {
      ...updateVars,
      sessionMode: "project",
    });

    expect(learning).not.toBe(project);
    expect(learning).toContain("Explain BST insert");
    expect(learning).toMatch(/First-interaction closure is forbidden/i);
    expect(learning).toMatch(/Do NOT invite "Mark as Done" after the first/i);
    expect(learning).toMatch(/multi-turn guided conversation/i);
    expect(learning).toMatch(/chapter map can be expanded/i);
    expect(learning).toMatch(/Proof of Work/i);

    expect(project).toMatch(/standalone exercise/i);
    expect(project).toMatch(/follow-up-after-Done|after Done/i);
    expect(project).not.toMatch(/First-interaction closure is forbidden/);
  });

  it("shouldOfferIleChapterDone gates Dialog first-turn closure and leaves Project intact", () => {
    expect(
      shouldOfferIleChapterDone({
        sessionMode: "learning",
        canAutoAdvance: true,
        substantiveLearnerTurns: 1,
      }),
    ).toBe(false);
    expect(
      shouldOfferIleChapterDone({
        sessionMode: "learning",
        canAutoAdvance: true,
        substantiveLearnerTurns: ILE_DIALOG_MIN_SUBSTANTIVE_TURNS_BEFORE_DONE,
      }),
    ).toBe(true);
    expect(
      shouldOfferIleChapterDone({
        sessionMode: "project",
        canAutoAdvance: true,
        substantiveLearnerTurns: 1,
      }),
    ).toBe(true);
    expect(
      shouldOfferIleChapterDone({
        sessionMode: "learning",
        canAutoAdvance: false,
        substantiveLearnerTurns: 9,
      }),
    ).toBe(false);
  });

  it("Helios chat builder is mode-aware: Dialog depth + expansion; Project exercise grain", () => {
    const dialog = buildIleHeliosChatSystemPrompt("learning");
    const project = buildIleHeliosChatSystemPrompt("project");
    expect(dialog).not.toBe(project);
    expect(dialog).toMatch(/topic-horizon conversation/i);
    expect(dialog).toMatch(/Do NOT invite "Mark as Done" after the first/i);
    expect(dialog).toMatch(/chapter map can be expanded/i);
    expect(dialog).toMatch(/ile-chapter-suggest/i);
    expect(dialog).toMatch(/Mark as Done/i);
    expect(dialog).toMatch(/next (or adjacent )?chapter|adjacent chapter|next chapter/i);
    expect(project).toMatch(/standalone longer-horizon exercise/i);
    expect(project).toMatch(/After Mark as Done/i);
  });
});

describe("chapter_suggest + chapter_add PoW persist payloads (shipped builders)", () => {
  it("builds a real suggestion record with chapter/topic text, not an empty stub", () => {
    const payload = buildIleChapterSuggestPowToolData({
      topic: "AVL rotations after insert",
      title: "AVL rotations",
      description: "A chapter on rotating after BST insert.",
      currentChapterId: "step-1",
      currentChapterDescription: "BST insert path",
      sessionMode: "learning",
      via: "helios_dialog",
    });
    expect(payload.tool_action).toBe(ILE_CHAPTER_SUGGEST_TOOL_ACTION);
    expect(payload.event).toBe("chapter_suggest");
    expect(payload.topic).toBe("AVL rotations after insert");
    expect(String(payload.topic).length).toBeGreaterThan(8);
    expect(payload.title).toMatch(/AVL/);
    expect(payload.description).toMatch(/rotating/i);
    expect(payload.accepted).toBe(false);
    expect(payload.session_mode).toBe("learning");
    expect(payload.current_chapter_id).toBe("step-1");
  });

  it("rejects empty suggestion stubs", () => {
    expect(() => buildIleChapterSuggestPowToolData({ topic: "  " })).toThrow(/topic text/i);
    expect(normalizeIleChapterSuggestion("")).toBeNull();
    expect(normalizeIleChapterSuggestion({ title: "" })).toBeNull();
  });

  it("builds chapter_load / chapter_reload PoW (same helper SessionView uses)", () => {
    const load = buildIleChapterLoadPowToolData({
      stepIndex: 2,
      stepId: "step-3",
      stepDescription: "AVL rotate-left after insert",
      sessionMode: "learning",
    });
    expect(load.tool_action).toBe(ILE_CHAPTER_LOAD_TOOL_ACTION);
    expect(load.reload).toBe(false);
    expect(load.generate_pow).toBe(true);
    expect(String(load.stepDescription)).toMatch(/AVL rotate-left/);

    const reload = buildIleChapterLoadPowToolData({
      stepIndex: 2,
      stepId: "step-3",
      stepDescription: "AVL rotate-left after insert",
      sessionMode: "learning",
      reload: true,
    });
    expect(reload.tool_action).toBe(ILE_CHAPTER_RELOAD_TOOL_ACTION);
    expect(reload.event).toBe("chapter_reload");
    expect(reload.reload).toBe(true);
    expect(reload.generate_pow).toBe(true);
    expect(reload.via).toBe("chapter_map_reload");
  });

  it("builds accepted chapter_add PoW with chapter text (same helper SessionView uses)", () => {
    const payload = buildIleChapterAddPowToolData({
      stepId: "step-new",
      description: "Exercise: implement AVL rotate-left on a failing insert.",
      position_x: 1,
      position_y: 0,
      sessionMode: "learning",
      sourceTopic: "AVL rotations after insert",
    });
    expect(payload.tool_action).toBe(ILE_CHAPTER_ADD_TOOL_ACTION);
    expect(payload.event).toBe("chapter_add");
    expect(payload.accepted).toBe(true);
    expect(String(payload.description)).toMatch(/AVL rotate-left/);
    expect(payload.topic).toMatch(/AVL/);
    expect(payload.stepId).toBe("step-new");
    expect(payload.position_x).toBe(1);
    expect(() =>
      buildIleChapterAddPowToolData({
        stepId: "x",
        description: "   ",
        position_x: 0,
        position_y: 0,
      }),
    ).toThrow(/chapter\/topic text/i);
  });

  it("extracts Helios marker + phrase and drives the persist-payload helper", () => {
    const marked =
      'This thread could be its own chapter — want to add one about AVL rotations?\n<!--ile-chapter-suggest:{"topic":"AVL rotations after insert","title":"AVL rotations"}-->';
    const extracted = extractIleChapterSuggestionFromCoachText(marked);
    expect(extracted.visibleText).toMatch(/want to add one about AVL/);
    expect(extracted.visibleText).not.toMatch(/ile-chapter-suggest/);
    expect(extracted.suggestion?.topic).toMatch(/AVL rotations after insert/);

    const driven = ileChapterSuggestionPowFromCoachText({
      coachText: marked,
      sessionMode: "learning",
      currentChapterId: "s1",
      currentChapterDescription: "BST insert",
    });
    expect(driven.visibleText).not.toMatch(/ile-chapter-suggest/);
    expect(driven.toolData).not.toBeNull();
    expect(driven.toolData?.tool_action).toBe("chapter_suggest");
    expect(driven.toolData?.topic).toBe("AVL rotations after insert");
    expect(String(driven.toolData?.topic).length).toBeGreaterThan(8);
    expect(driven.toolData?.accepted).toBe(false);

    const fromLearner = ileChapterSuggestionPowFromCoachText({
      coachText: "Makes sense — keep going on insert.",
      learnerText: "Can we add a chapter about deleting from a BST?",
      sessionMode: "learning",
    });
    expect(fromLearner.toolData?.topic).toMatch(/deleting from a BST/i);
  });
});

describe("shipped ILE planner / Helios text names the user's anti-patterns", () => {
  it("static read of planner + Helios + surface", () => {
    const create = DEFAULT_PROMPTS.session_plan_create;
    const update = DEFAULT_PROMPTS.session_plan_update;
    const grain = applyIleChapterModeInstructions("{chapter_grain_rules}", "learning");
    const excerpts = [
      "=== session_plan_create (template) ===",
      create,
      "=== session_plan_update (template) ===",
      update,
      "=== filled Dialog grain ===",
      grain,
      "=== ILE_SURFACE excerpt ===",
      ILE_SURFACE,
      "=== ILE_CONTEXT_BODY excerpt ===",
      ILE_CONTEXT_BODY,
    ].join("\n\n");
    writeScratch("ile-chapter-prompt-excerpts.txt", excerpts);

    expect(grain).toMatch(/Summarize what you understand as X/);
    expect(grain).toMatch(/Draw X on a notebook/);
    expect(grain).toMatch(/Make a list/);
    expect(grain).toMatch(/Finish the list from chapter 1/);
    expect(create).toMatch(/question" \| "task" \| "suggestion" \| "checkpoint/);
    expect(update).toMatch(/CHAPTER CLOSURE POLICY|chapter_closure_rules/);
    expect(update).toMatch(/NO-ENDLESS-DRILLING/);
    expect(ILE_SURFACE).toMatch(/topic-horizon conversation/);
    expect(ILE_SURFACE).toMatch(/Mark as Done/);
    expect(ILE_CONTEXT_BODY).toMatch(/Do not invite Mark as Done after the first interaction/);
  });

  it("wires mode into plan-create, session-chat, and SessionView persist paths", () => {
    const createRoute = read("app/api/session-plan/create/route.ts");
    expect(createRoute).toContain("sessionMode");
    expect(createRoute).toContain("createSessionPlanLLM");
    expect(createRoute).toContain("resolveIleSessionModeFromBody");

    const chatRoute = read("app/api/session-chat/route.ts");
    expect(chatRoute).toContain("buildIleHeliosChatSystemPrompt(sessionMode)");
    expect(chatRoute).toContain("ileChapterSuggestionPowFromCoachText");
    expect(chatRoute).toContain("chapterSuggestion");

    const xai = read("lib/xai.ts");
    expect(xai).toContain("composeSessionPlanUpdatePrompt");
    expect(xai).toContain("shouldOfferIleChapterDone");
    expect(xai).toContain("sessionMode");

    const view = read("components/SessionView.tsx");
    expect(view).toContain("buildIleChapterAddPowToolData");
    expect(chatRoute).toContain("chapter_suggest");
    expect(view).toContain("postIleSessionChat");

    const types = read("lib/domain/types.ts");
    expect(types).toContain("chapter_suggest");
  });
});
