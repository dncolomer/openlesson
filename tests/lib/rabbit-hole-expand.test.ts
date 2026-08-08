/**
 * Unit tests for pure rabbit-hole expansion process (shipped lib/rabbit-hole-expand.ts).
 * No mocking of the unit under test; AI boundary is pure normalize/prompt helpers.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  RABBIT_HOLE_FOLLOWUP_QUESTION_COUNT,
  RABBIT_HOLE_INITIAL_QUESTION_COUNT,
  buildRabbitHoleExpandSlotPrompt,
  buildRabbitHoleQuestionsSystemMessage,
  buildRabbitHoleQuestionsUserPrompt,
  createRabbitHoleExpandState,
  createSummaryState,
  getConfirmedCandidates,
  mapCandidatesToFrozenSlots,
  normalizeRabbitHoleQuestions,
  pickQuestion,
  questionsNeededForRound,
  receiveQuestions,
  canFinishRabbitHoleExpandEarly,
  finishRabbitHoleExpandEarly,
  restartRabbitHoleExpand,
  toggleSummaryCandidate,
} from "@/lib/rabbit-hole-expand";

const SCRATCH =
  process.env.RABBIT_HOLE_EXPAND_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6d1a34f215cc/implementer";

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("rabbit-hole expansion process", () => {
  it("questionsNeededForRound: 3 initial then 2 follow-ups", () => {
    expect(questionsNeededForRound(0)).toBe(RABBIT_HOLE_INITIAL_QUESTION_COUNT);
    expect(questionsNeededForRound(0)).toBe(3);
    expect(questionsNeededForRound(1)).toBe(RABBIT_HOLE_FOLLOWUP_QUESTION_COUNT);
    expect(questionsNeededForRound(1)).toBe(2);
    expect(questionsNeededForRound(5)).toBe(2);
  });

  it("create state from outline target; remaining tracks outline", () => {
    const s = createRabbitHoleExpandState(4);
    expect(s.outlineTarget).toBe(4);
    expect(s.depth).toBe(0);
    expect(s.candidates).toEqual([]);
    expect(s.phase).toBe("choosing");
    expect(s.canRegenerate).toBe(true);
    expect(s.remaining).toBe(4);
    expect(s.currentQuestions).toEqual([]);
  });

  it("receiveQuestions clamps to round size and allows regenerate only at depth 0", () => {
    let s = createRabbitHoleExpandState(3);
    s = receiveQuestions(s, [
      "Q1 about A?",
      "Q2 about B?",
      "Q3 about C?",
      "Q4 extra?",
    ]);
    expect(s.currentQuestions).toEqual([
      "Q1 about A?",
      "Q2 about B?",
      "Q3 about C?",
    ]);
    expect(s.canRegenerate).toBe(true);
    expect(s.depth).toBe(0);
  });

  it("pick accumulates candidates, advances depth, clears questions, no step-back", () => {
    let s = createRabbitHoleExpandState(3);
    s = receiveQuestions(s, ["Alpha?", "Beta?", "Gamma?"]);
    s = pickQuestion(s, 1);
    expect(s.candidates).toEqual(["Beta?"]);
    expect(s.depth).toBe(1);
    expect(s.remaining).toBe(2);
    expect(s.currentQuestions).toEqual([]);
    expect(s.canRegenerate).toBe(false);
    expect(s.phase).toBe("choosing");

    // Invalid index / empty questions do not step back
    const before = s;
    s = pickQuestion(s, 0);
    expect(s).toEqual(before);
    s = pickQuestion(s, -1);
    expect(s).toEqual(before);
  });

  it("full dive: initial 3 → pick → 2 follow-ups repeatedly → complete at outline", () => {
    const outline = 3;
    let s = createRabbitHoleExpandState(outline);
    s = receiveQuestions(s, ["Seed Q1?", "Seed Q2?", "Seed Q3?"]);
    expect(s.canRegenerate).toBe(true);

    // Regenerate replaces initial set only (same depth)
    s = receiveQuestions(s, ["New1?", "New2?", "New3?"]);
    expect(s.currentQuestions).toEqual(["New1?", "New2?", "New3?"]);
    expect(s.depth).toBe(0);
    expect(s.candidates).toEqual([]);

    s = pickQuestion(s, 0);
    expect(s.candidates).toEqual(["New1?"]);
    expect(s.remaining).toBe(2);
    expect(s.phase).toBe("choosing");

    s = receiveQuestions(s, ["Follow A?", "Follow B?"]);
    expect(s.currentQuestions).toHaveLength(2);
    expect(s.canRegenerate).toBe(false);
    s = pickQuestion(s, 1);
    expect(s.candidates).toEqual(["New1?", "Follow B?"]);
    expect(s.depth).toBe(2);
    expect(s.remaining).toBe(1);

    s = receiveQuestions(s, ["Deep A?", "Deep B?"]);
    s = pickQuestion(s, 0);
    expect(s.candidates).toEqual(["New1?", "Follow B?", "Deep A?"]);
    expect(s.depth).toBe(3);
    expect(s.remaining).toBe(0);
    expect(s.phase).toBe("complete");

    // No further picks / receive after complete
    const done = s;
    s = pickQuestion(s, 0);
    expect(s).toEqual(done);
    s = receiveQuestions(s, ["Ignored?"]);
    expect(s.currentQuestions).toEqual(done.currentQuestions);
  });

  it("outline of 1 completes after first pick", () => {
    let s = createRabbitHoleExpandState(1);
    s = receiveQuestions(s, ["Only?", "Alt?", "Other?"]);
    s = pickQuestion(s, 2);
    expect(s.phase).toBe("complete");
    expect(s.candidates).toEqual(["Other?"]);
    expect(s.remaining).toBe(0);
    expect(s.depth).toBe(1);
  });

  it("restart clears to top but keeps outline target", () => {
    let s = createRabbitHoleExpandState(4);
    s = receiveQuestions(s, ["A?", "B?", "C?"]);
    s = pickQuestion(s, 0);
    s = receiveQuestions(s, ["D?", "E?"]);
    s = pickQuestion(s, 0);
    expect(s.depth).toBe(2);
    expect(s.candidates).toHaveLength(2);

    s = restartRabbitHoleExpand(s);
    expect(s.outlineTarget).toBe(4);
    expect(s.depth).toBe(0);
    expect(s.candidates).toEqual([]);
    expect(s.currentQuestions).toEqual([]);
    expect(s.phase).toBe("choosing");
    expect(s.canRegenerate).toBe(true);
    expect(s.remaining).toBe(4);
  });

  it("finish early skips to complete/review with collected candidates", () => {
    let s = createRabbitHoleExpandState(5);
    expect(canFinishRabbitHoleExpandEarly(s)).toBe(false);
    s = receiveQuestions(s, ["A?", "B?", "C?"]);
    // No picks yet — cannot finish
    expect(canFinishRabbitHoleExpandEarly(s)).toBe(false);
    expect(finishRabbitHoleExpandEarly(s).phase).toBe("choosing");

    s = pickQuestion(s, 0);
    s = receiveQuestions(s, ["D?", "E?"]);
    expect(canFinishRabbitHoleExpandEarly(s)).toBe(true);
    expect(s.phase).toBe("choosing");
    expect(s.candidates).toEqual(["A?"]);
    expect(s.remaining).toBe(4);

    s = finishRabbitHoleExpandEarly(s);
    expect(s.phase).toBe("complete");
    expect(s.candidates).toEqual(["A?"]);
    expect(s.currentQuestions).toEqual([]);
    expect(s.depth).toBe(1);
    expect(s.remaining).toBe(4); // short of outline, still reviewable
    expect(canFinishRabbitHoleExpandEarly(s)).toBe(false);
    // Idempotent once complete
    expect(finishRabbitHoleExpandEarly(s)).toEqual(s);

    const summary = createSummaryState(s.candidates);
    expect(getConfirmedCandidates(summary)).toEqual(["A?"]);
  });

  it("summary modify-selection and confirmed list order", () => {
    const summary = createSummaryState(["C1", "C2", "C3"]);
    expect(summary.selected).toEqual([true, true, true]);
    expect(getConfirmedCandidates(summary)).toEqual(["C1", "C2", "C3"]);

    let next = toggleSummaryCandidate(summary, 1);
    expect(getConfirmedCandidates(next)).toEqual(["C1", "C3"]);
    next = toggleSummaryCandidate(next, 0);
    expect(getConfirmedCandidates(next)).toEqual(["C3"]);
    // invalid index is no-op
    const same = toggleSummaryCandidate(next, 99);
    expect(same).toEqual(next);
  });

  it("mapCandidatesToFrozenSlots is 1:1 ordered onto slots", () => {
    const mapped = mapCandidatesToFrozenSlots({
      candidates: ["Q1", "Q2", "Q3"],
      frozenSlots: [
        { row: 1, col: 2 },
        { row: 3, col: 4 },
      ],
    });
    expect(mapped).toEqual([
      { slot: { row: 1, col: 2 }, candidate: "Q1" },
      { slot: { row: 3, col: 4 }, candidate: "Q2" },
    ]);
  });

  it("buildRabbitHoleExpandSlotPrompt embeds candidate and source", () => {
    const prompt = buildRabbitHoleExpandSlotPrompt({
      source: {
        title: "Linear Algebra",
        description: "Vectors and matrices",
      },
      candidate: "What is a basis?",
      slot: { row: 2, col: 5 },
      slotIndex: 0,
      totalSlots: 2,
    });
    expect(prompt).toContain("Linear Algebra");
    expect(prompt).toContain("What is a basis?");
    expect(prompt).toContain("row 2, col 5");
    expect(prompt).toContain("1 of 2");
  });

  it("normalizeRabbitHoleQuestions and prompt builders are pure", () => {
    expect(
      normalizeRabbitHoleQuestions(
        { questions: [" One? ", "Two?", "One?", "Three?"] },
        3,
      ),
    ).toEqual(["One?", "Two?", "Three?"]);
    expect(normalizeRabbitHoleQuestions(["A?", "B?"], 3)).toHaveLength(3);
    expect(buildRabbitHoleQuestionsSystemMessage(2)).toContain("exactly 2");
    const user = buildRabbitHoleQuestionsUserPrompt({
      seedTitle: "Calculus",
      seedDescription: "Limits",
      path: ["What is a limit?"],
      count: 2,
    });
    expect(user).toContain("Calculus");
    expect(user).toContain("What is a limit?");
    expect(user).toContain("exactly 2");
  });

  it("writes unit evidence log", () => {
    let s = createRabbitHoleExpandState(2);
    s = receiveQuestions(s, ["A?", "B?", "C?"]);
    s = pickQuestion(s, 0);
    s = receiveQuestions(s, ["D?", "E?"]);
    s = pickQuestion(s, 1);
    const summary = createSummaryState(s.candidates);
    const confirmed = getConfirmedCandidates(
      toggleSummaryCandidate(summary, 0),
    );
    const body = [
      "outline=2",
      "phase=" + s.phase,
      "depth=" + s.depth,
      "remaining=" + s.remaining,
      "candidates=" + JSON.stringify(s.candidates),
      "confirmed_after_deselect_first=" + JSON.stringify(confirmed),
      "mapped=" +
        JSON.stringify(
          mapCandidatesToFrozenSlots({
            candidates: s.candidates,
            frozenSlots: [
              { row: 0, col: 1 },
              { row: 0, col: 2 },
            ],
          }),
        ),
      "src_exists=" +
        existsSync(join(__dirname, "../../lib/rabbit-hole-expand.ts")),
    ].join("\n");
    writeEvidence("rabbit-hole-expand-unit.log", body);
    expect(s.phase).toBe("complete");
    expect(s.candidates).toEqual(["A?", "E?"]);
    expect(confirmed).toEqual(["E?"]);
  });
});
