import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Structural + wiring checks for Rabbit Hole Expansion from Expand Block drawer.
 * Exercises shipped process helpers for outline/slot mapping (no mock of unit under test).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRabbitHoleExpandSlotPrompt,
  createRabbitHoleExpandState,
  mapCandidatesToFrozenSlots,
  pickQuestion,
  receiveQuestions,
} from "@/lib/rabbit-hole-expand";
import {
  buildExpandFromSourceSlotPrompt,
  resolveExpandFromSourceSelection,
} from "@/lib/expand-block-from-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.RABBIT_HOLE_EXPAND_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6d1a34f215cc/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("Rabbit Hole Expansion Expand-drawer wiring", () => {
  it("button sits next to Randomize Selection; outline = cellsToCreate.length", () => {
    const expandPane = read("components/WorkspaceExpandBlockPane.tsx");
    const modal = read("components/RabbitHoleExpandModal.tsx");
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const view = readWorkspaceViewSurface();
    const api = read("app/api/workspace/rabbit-hole-expand/route.ts");
    const processLib = read("lib/rabbit-hole-expand.ts");

    // Control adjacent to Randomize Selection
    expect(expandPane).toContain("data-expand-block-randomize");
    expect(expandPane).toContain("data-expand-block-rabbit-hole");
    expect(expandPane).toContain("data-rabbit-hole-expansion");
    expect(expandPane).toContain("Rabbit Hole Expansion");
    // Same action row as randomize
    expect(expandPane).toContain("data-expand-block-selection-actions");
    const randomizeIdx = expandPane.indexOf("data-expand-block-randomize");
    const rabbitIdx = expandPane.indexOf("data-expand-block-rabbit-hole");
    const actionsIdx = expandPane.indexOf("data-expand-block-selection-actions");
    expect(actionsIdx).toBeGreaterThan(-1);
    expect(randomizeIdx).toBeGreaterThan(actionsIdx);
    expect(rabbitIdx).toBeGreaterThan(randomizeIdx);

    // Outline from active selection size
    expect(expandPane).toContain("outlineTarget={cellsToCreate.length}");
    expect(expandPane).toContain("RabbitHoleExpandModal");
    expect(expandPane).toContain("candidatePrompts");
    expect(expandPane).toContain("mapCandidatesToFrozenSlots");
    expect(expandPane).toContain("handleRabbitHoleConfirm");

    // Modal markers: sidebar depth/remaining, regenerate, pick, restart, summary
    expect(modal).toContain("data-rabbit-hole-expand-modal");
    expect(modal).toContain("data-rabbit-hole-expand-sidebar");
    expect(modal).toContain("data-rabbit-hole-depth");
    expect(modal).toContain("data-rabbit-hole-remaining");
    expect(modal).toContain("data-rabbit-hole-question");
    expect(modal).toContain("data-rabbit-hole-regenerate");
    expect(modal).toContain("data-rabbit-hole-restart");
    expect(modal).toContain("data-rabbit-hole-finish-early");
    expect(modal).toContain("finishRabbitHoleExpandEarly");
    expect(modal).toContain("data-rabbit-hole-summary");
    expect(modal).toContain("data-rabbit-hole-confirm");
    expect(modal).toContain("/api/workspace/rabbit-hole-expand");
    // Escape map chrome stacking: portal + high z-index; path list scrolls
    expect(modal).toContain("createPortal");
    expect(modal).toContain("document.body");
    expect(modal).toMatch(/z-\[200\]/);
    expect(modal).toMatch(/h-\[min\(90vh,720px\)\]/);
    expect(modal).toMatch(
      /data-rabbit-hole-path-list[\s\S]*?overflow-y-auto|overflow-y-auto[\s\S]*?data-rabbit-hole-path-list/,
    );
    // No step-back control
    expect(modal).not.toMatch(/data-rabbit-hole-back\b/);
    expect(modal).not.toMatch(/step back/i);

    // Seed + workspace passed through detail → expand pane
    expect(detail).toContain("WorkspaceExpandBlockPane");
    expect(detail).toMatch(
      /WorkspaceExpandBlockPane[\s\S]*?workspaceId=\{workspaceId\}/,
    );

    // Confirm re-enters expand multi-create path (not a separate placement system)
    expect(view).toContain("buildRabbitHoleExpandSlotPrompt");
    expect(view).toContain("candidatePrompts");
    expect(view).toContain("handleExpandFromSourceBlock");
    expect(view).toContain("runAddExpandCreateLoop");
    expect(view).toContain("/api/workspace/add-block-at-slot");
    const expandHook = read("components/workspace-view/use-workspace-expand-jobs.ts");
    const expandStart = expandHook.indexOf("const handleExpandFromSourceBlock");
    const expandFn = expandHook.slice(expandStart, expandStart + 4500);
    expect(expandFn).toContain("buildRabbitHoleExpandSlotPrompt");
    expect(expandFn).toContain("candidatePrompts");
    expect(expandFn).toContain("runAddExpandCreateLoop");
    expect(expandFn).toContain("add-block-at-slot");
    expect(expandFn).not.toContain('op: "generate_shape"');

    // API uses pure process helpers
    expect(api).toContain("normalizeRabbitHoleQuestions");
    expect(api).toContain("questionsNeededForRound");
    expect(api).toContain("buildRabbitHoleQuestionsUserPrompt");
    expect(processLib).toContain("createRabbitHoleExpandState");
    expect(processLib).toContain("pickQuestion");
    expect(processLib).toContain("restartRabbitHoleExpand");
    expect(processLib).toContain("finishRabbitHoleExpandEarly");
    expect(processLib).toContain("canFinishRabbitHoleExpandEarly");

    // Outline = selection size on real resolveExpand path
    const sel = resolveExpandFromSourceSelection({
      sourceBlock: {
        id: "src",
        position_x: 0,
        position_y: 0,
        span_w: 1,
        span_h: 1,
      },
      range: 1,
      density: 100,
      seed: 1,
      occupiedKeys: ["0:0"],
    });
    const outline = sel.selected.length;
    expect(outline).toBeGreaterThan(0);

    let process = createRabbitHoleExpandState(outline);
    process = receiveQuestions(process, ["Q1?", "Q2?", "Q3?"]);
    // Dive until complete
    while (process.phase !== "complete") {
      if (process.currentQuestions.length === 0) {
        process = receiveQuestions(
          process,
          process.depth === 0
            ? ["A?", "B?", "C?"]
            : ["Follow1?", "Follow2?"],
        );
      }
      process = pickQuestion(process, 0);
    }
    expect(process.candidates.length).toBeGreaterThanOrEqual(outline);
    const mapped = mapCandidatesToFrozenSlots({
      candidates: process.candidates.slice(0, outline),
      frozenSlots: sel.frozenSlots,
    });
    expect(mapped.length).toBe(Math.min(outline, sel.frozenSlots.length));
    const rhPrompt = buildRabbitHoleExpandSlotPrompt({
      source: { title: "Seed Topic", description: "Desc" },
      candidate: mapped[0]?.candidate || process.candidates[0],
      slot: mapped[0]?.slot || sel.frozenSlots[0],
      slotIndex: 0,
      totalSlots: mapped.length,
    });
    expect(rhPrompt).toContain("Seed Topic");
    expect(rhPrompt).toContain("rabbit-hole");
    // Generic expand still available without candidates
    const generic = buildExpandFromSourceSlotPrompt({
      source: { title: "Seed Topic" },
      slot: sel.frozenSlots[0],
      slotIndex: 0,
      totalSlots: sel.frozenSlots.length,
    });
    expect(generic).toContain("Seed Topic");

    // Optional modifier guidance on rabbit-hole + generic expand paths
    expect(expandPane).toContain("data-expand-block-modifier");
    expect(expandPane).toContain("userGuidance");
    expect(expandFn).toMatch(
      /buildRabbitHoleExpandSlotPrompt\(\{[\s\S]*?userGuidance/,
    );
    const modifier = "prefer visual / geometric intuition";
    const rhWithGuidance = buildRabbitHoleExpandSlotPrompt({
      source: { title: "Seed Topic", description: "Desc" },
      candidate: mapped[0]?.candidate || process.candidates[0],
      slot: mapped[0]?.slot || sel.frozenSlots[0],
      slotIndex: 0,
      totalSlots: mapped.length,
      userGuidance: modifier,
    });
    expect(rhWithGuidance).toContain(modifier);
    expect(rhWithGuidance).toContain("Seed Topic");
    expect(rhWithGuidance).toMatch(/Creator guidance for the expansion/i);
    const rhEmpty = buildRabbitHoleExpandSlotPrompt({
      source: { title: "Seed Topic" },
      candidate: "Why does this matter?",
      slot: sel.frozenSlots[0],
      slotIndex: 0,
      totalSlots: 1,
      userGuidance: "",
    });
    expect(rhEmpty).not.toMatch(/Creator guidance for the expansion/i);

    writeEvidence(
      "rabbit-hole-expand-wiring.log",
      [
        "has_rabbit_hole_button=true",
        "button_after_randomize=" + (rabbitIdx > randomizeIdx),
        "outline_from_cellsToCreate=true",
        "modal_sidebar=true",
        "modal_no_step_back=true",
        "view_uses_candidate_prompts=true",
        "view_multi_create=true",
        "api_route_exists=true",
        "outline_example=" + outline,
        "process_candidates=" + JSON.stringify(process.candidates),
        "mapped_n=" + mapped.length,
        "rh_prompt_snip=" + rhPrompt.slice(0, 180),
        "rh_modifier_included=" + rhWithGuidance.includes(modifier),
        "rh_empty_omits_guidance=" +
          !rhEmpty.includes("Creator guidance for the expansion"),
        "host_forwards_userGuidance_to_rh=true",
      ].join("\n"),
    );
  });

  it("modal UI markers exist for sidebar + questions (static render contract)", () => {
    const modal = read("components/RabbitHoleExpandModal.tsx");
    const markers = [
      "data-rabbit-hole-expand-modal",
      "data-rabbit-hole-expand-sidebar",
      "data-rabbit-hole-depth",
      "data-rabbit-hole-remaining",
      "data-rabbit-hole-collected",
      "data-rabbit-hole-path-list",
      "data-rabbit-hole-questions",
      "data-rabbit-hole-question-list",
      "data-rabbit-hole-summary",
      "data-rabbit-hole-confirm",
      "data-rabbit-hole-restart",
      "data-rabbit-hole-finish-early",
      "data-rabbit-hole-regenerate",
    ];
    for (const m of markers) {
      expect(modal, m).toContain(m);
    }
    writeEvidence(
      "rabbit-hole-expand-ui.log",
      markers.map((m) => `${m}=true`).join("\n") +
        "\nlearner_excluded=" +
        !read("components/WorkspaceLearnerBlockPane.tsx").includes(
          "RabbitHoleExpandModal",
        ),
    );
  });

  it("learner path does not host rabbit-hole expand", () => {
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    expect(learner).not.toContain("RabbitHoleExpandModal");
    expect(learner).not.toContain("data-expand-block-rabbit-hole");
    expect(learner).not.toContain("WorkspaceExpandBlockPane");
  });
});
