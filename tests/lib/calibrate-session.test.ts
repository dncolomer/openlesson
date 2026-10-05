/**
 * Calibration phase gate. Imports the shipped module from a cold start.
 */
import { describe, expect, it } from "vitest";
import {
  appendIleDictatedTextToWorkCanvas,
  syncIleDictatedTextOnWorkCanvas,
} from "@/lib/ile-canvas-dictate";
import {
  CALIBRATE_DONE_CLASSIFYING_LABEL,
  addCalibrateResponseText,
  buildCalibrateProofMetadata,
  calibrateCanvasTextCounts,
  canFinishClassifying,
  canFinishComfortableAnswer,
  canFinishUncertainty,
  createCalibrateState,
  finishClassifying,
  finishComfortableAnswer,
  finishUncertainty,
  moveCalibrateQuestion,
  moveCalibrateQuestionOnCanvas,
  readCalibratePlacements,
  readCalibrateResponseTexts,
  seedCalibrateWorkCanvas,
  syncCalibratePlacements,
  type CalibrateResponseSource,
} from "@/lib/calibrate-session";

const POOL = [
  "How would you explain a limit to someone who has only seen slopes?",
  "Where does continuity fail if a graph jumps?",
  "What stays true about a derivative when the function flattens?",
  "Why can a series of smaller steps still refuse to settle?",
  "What would you check first if an integral and its area disagreed?",
];

function classifyingState() {
  return createCalibrateState(POOL.map((text, index) => ({ id: `q-${index + 1}`, text })));
}

function placeThreeAndTwo(state: ReturnType<typeof classifyingState>) {
  let next = state;
  next = moveCalibrateQuestion(next, "q-1", "comfortable");
  next = moveCalibrateQuestion(next, "q-2", "comfortable");
  next = moveCalibrateQuestion(next, "q-3", "comfortable");
  next = moveCalibrateQuestion(next, "q-4", "unconfident");
  next = moveCalibrateQuestion(next, "q-5", "unconfident");
  return next;
}

describe("calibration classifying gate", () => {
  it("allows I'm done classifying only at exactly three comfortable and two not confident", () => {
    expect(CALIBRATE_DONE_CLASSIFYING_LABEL).toBe("I'm done classifying");
    const start = classifyingState();
    expect(canFinishClassifying(start)).toBe(false);
    expect(finishClassifying(start).ok).toBe(false);

    const partial = moveCalibrateQuestion(
      moveCalibrateQuestion(start, "q-1", "comfortable"),
      "q-4",
      "unconfident",
    );
    expect(canFinishClassifying(partial)).toBe(false);

    const ready = placeThreeAndTwo(start);
    expect(canFinishClassifying(ready)).toBe(true);
    const broken = moveCalibrateQuestion(ready, "q-3", null);
    expect(canFinishClassifying(broken)).toBe(false);
    expect(broken.events.some((event) => event.type === "region_move" && event.to === null)).toBe(true);
    const restored = moveCalibrateQuestion(broken, "q-3", "comfortable");
    expect(canFinishClassifying(restored)).toBe(true);

    const four = createCalibrateState(POOL.slice(0, 4));
    const forced = ["q-1", "q-2", "q-3"].reduce(
      (current, id) => moveCalibrateQuestion(current, id, "comfortable"),
      moveCalibrateQuestion(moveCalibrateQuestion(four, "q-4", "unconfident"), "q-9", "unconfident"),
    );
    expect(canFinishClassifying(forced)).toBe(false);
    expect(finishClassifying(forced)).toMatchObject({ ok: false, reason: "pool_too_small" });
  });
});

describe("calibration answer and uncertainty", () => {
  it("requires canvas text for one comfortable question, then one not-confident question", () => {
    const classified = finishClassifying(placeThreeAndTwo(classifyingState()));
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    expect(canFinishComfortableAnswer(classified.state, [])).toBe(false);
    expect(finishComfortableAnswer(classified.state, []).ok).toBe(false);

    const blank = finishComfortableAnswer(classified.state, [
      { questionId: "q-1", text: "   ", source: "typed" },
    ]);
    expect(blank.ok).toBe(false);

    const twoComfortable = finishComfortableAnswer(classified.state, [
      { questionId: "q-1", text: "A slope is the first picture.", source: "typed" },
      { questionId: "q-2", text: "Continuity fails at a jump.", source: "pasted" },
    ]);
    expect(twoComfortable.ok).toBe(false);

    const unconfidentTooEarly = finishComfortableAnswer(classified.state, [
      { questionId: "q-4", text: "I do not know where a series stops.", source: "dictated" },
    ]);
    expect(unconfidentTooEarly.ok).toBe(false);

    const answered = finishComfortableAnswer(classified.state, [
      { questionId: "q-1", text: "I would start from a slope and then shrink the run.", source: "typed" },
    ]);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.state.phase).toBe("explain");

    const secondComfortable = finishUncertainty(answered.state, [
      { questionId: "q-2", text: "Another comfortable answer.", source: "typed" },
    ]);
    expect(secondComfortable.ok).toBe(false);
    expect(canFinishUncertainty(answered.state, [])).toBe(false);

    const explained = finishUncertainty(answered.state, [
      {
        questionId: "q-4",
        text: "I cannot tell which step would keep the series from settling.",
        source: "pasted",
      },
    ]);
    expect(explained.ok).toBe(true);
    if (!explained.ok) return;

    const moves = explained.state.events.filter((event) => event.type === "region_move");
    const answer = explained.state.events.find((event) => event.type === "comfortable_answer");
    const uncertainty = explained.state.events.find((event) => event.type === "uncertainty_explanation");
    expect(moves.length).toBeGreaterThan(0);
    expect(answer).toMatchObject({ questionId: "q-1", source: "typed" });
    expect(uncertainty).toMatchObject({ questionId: "q-4", source: "pasted" });
    expect(buildCalibrateProofMetadata(explained.state).verification_run).toBe(false);
    expect(buildCalibrateProofMetadata(explained.state).calibrate_events).toEqual(explained.state.events);
  });

  it("counts typed, pasted, and dictated canvas text", () => {
    const sources: CalibrateResponseSource[] = ["typed", "pasted", "dictated"];
    for (const source of sources) {
      expect(calibrateCanvasTextCounts("A real answer.", source)).toBe(true);
      expect(calibrateCanvasTextCounts("  ", source)).toBe(false);
      const classified = finishClassifying(placeThreeAndTwo(classifyingState()));
      expect(classified.ok).toBe(true);
      if (!classified.ok) return;
      const answered = finishComfortableAnswer(classified.state, [
        { questionId: "q-2", text: `Answer via ${source}`, source },
      ]);
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      const explained = finishUncertainty(answered.state, [
        { questionId: "q-5", text: `Uncertain via ${source}`, source },
      ]);
      expect(explained.ok).toBe(true);
    }
  });
});

describe("calibration canvas regions", () => {
  it("reads region moves and response text from the work canvas", () => {
    const seeded = seedCalibrateWorkCanvas(POOL);
    expect(seeded.questions).toHaveLength(5);
    const roles = seeded.scene.elements.map((el) => el.customData?.calibrateRole);
    expect(roles).toContain("region");
    expect(seeded.scene.elements.filter((el) => el.customData?.calibrateRegion === "comfortable").length).toBeGreaterThan(0);
    expect(seeded.scene.elements.filter((el) => el.customData?.calibrateRegion === "unconfident").length).toBeGreaterThan(0);

    let scene = seeded.scene;
    scene = moveCalibrateQuestionOnCanvas(scene, "q-1", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-2", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-3", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-4", "unconfident");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-5", "unconfident");
    const placed = syncCalibratePlacements(createCalibrateState(seeded.questions), readCalibratePlacements(scene));
    expect(canFinishClassifying(placed)).toBe(true);

    scene = moveCalibrateQuestionOnCanvas(scene, "q-2", "pool");
    const undone = syncCalibratePlacements(placed, readCalibratePlacements(scene));
    expect(canFinishClassifying(undone)).toBe(false);

    scene = moveCalibrateQuestionOnCanvas(scene, "q-2", "comfortable");
    const again = syncCalibratePlacements(undone, readCalibratePlacements(scene));
    const classified = finishClassifying(again);
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    expect(readCalibrateResponseTexts(scene, classified.state)).toEqual([]);
    expect(finishComfortableAnswer(classified.state, readCalibrateResponseTexts(scene, classified.state)).ok).toBe(false);

    const withAnswer = addCalibrateResponseText(scene, {
      questionId: "q-1",
      text: "I would shrink the horizontal change and watch the slope.",
      source: "dictated",
    });
    const answerTexts = readCalibrateResponseTexts(withAnswer, classified.state);
    expect(answerTexts).toEqual([
      expect.objectContaining({ questionId: "q-1", source: "dictated" }),
    ]);
    const answered = finishComfortableAnswer(classified.state, answerTexts);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;

    const wrongCard = addCalibrateResponseText(withAnswer, {
      questionId: "q-3",
      text: "This is still a comfortable question.",
      source: "typed",
    });
    expect(finishUncertainty(answered.state, readCalibrateResponseTexts(wrongCard, answered.state)).ok).toBe(false);

    const withWhy = addCalibrateResponseText(withAnswer, {
      questionId: "q-5",
      text: "I do not know which comparison would show the area and the integral disagree.",
      source: "pasted",
    });
    const done = finishUncertainty(answered.state, readCalibrateResponseTexts(withWhy, answered.state));
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.state.events.some((event) => event.type === "region_move")).toBe(true);
    expect(done.state.events.some((event) => event.type === "comfortable_answer")).toBe(true);
    expect(done.state.events.some((event) => event.type === "uncertainty_explanation")).toBe(true);
  });

  it("stamps live dictate onto one question in the active region", () => {
    const seeded = seedCalibrateWorkCanvas(POOL);
    let scene = seeded.scene;
    scene = moveCalibrateQuestionOnCanvas(scene, "q-1", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-2", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-3", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-4", "unconfident");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-5", "unconfident");
    const classified = finishClassifying(
      syncCalibratePlacements(createCalibrateState(seeded.questions), readCalibratePlacements(scene)),
    );
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    const answer = "I would shrink the change and watch the slope settle.";
    const dictated = appendIleDictatedTextToWorkCanvas(scene, answer);
    const mark = dictated.appended[0];
    expect(mark?.customData).toMatchObject({
      author: "dictate",
      calibrateRole: "response",
      calibrateResponseSource: "dictated",
    });
    const answerQuestionId = String(mark?.customData?.calibrateQuestionId || "");
    expect(["q-1", "q-2", "q-3"]).toContain(answerQuestionId);
    const comfortable = dictated.scene.elements.find(
      (el) => el.type === "rectangle" && el.customData?.calibrateRole === "region" && el.customData?.calibrateRegion === "comfortable",
    );
    expect(comfortable).toBeTruthy();
    const center = {
      x: (mark?.x || 0) + (mark?.width || 0) / 2,
      y: (mark?.y || 0) + (mark?.height || 0) / 2,
    };
    expect(center.x).toBeGreaterThanOrEqual(comfortable!.x);
    expect(center.x).toBeLessThanOrEqual(comfortable!.x + comfortable!.width);
    expect(center.y).toBeGreaterThanOrEqual(comfortable!.y);
    expect(center.y).toBeLessThanOrEqual(comfortable!.y + comfortable!.height);

    const answerTexts = readCalibrateResponseTexts(dictated.scene, classified.state);
    expect(answerTexts).toEqual([
      expect.objectContaining({ questionId: answerQuestionId, text: answer, source: "dictated" }),
    ]);
    expect(canFinishComfortableAnswer(classified.state, answerTexts)).toBe(true);
    const answered = finishComfortableAnswer(classified.state, answerTexts);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;

    const why = "I cannot tell which jump would make the area and the integral disagree.";
    const explained = syncIleDictatedTextOnWorkCanvas(dictated.scene, why, null);
    const explanation = explained.scene.elements.find((el) => el.id === explained.elementId);
    const explainQuestionId = String(explanation?.customData?.calibrateQuestionId || "");
    expect(["q-4", "q-5"]).toContain(explainQuestionId);
    expect(explanation?.customData).toMatchObject({
      calibrateRole: "response",
      calibrateResponseSource: "dictated",
    });
    const explainTexts = readCalibrateResponseTexts(explained.scene, answered.state);
    expect(explainTexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: answerQuestionId, source: "dictated" }),
        expect.objectContaining({ questionId: explainQuestionId, text: why, source: "dictated" }),
      ]),
    );
    expect(canFinishUncertainty(answered.state, explainTexts)).toBe(true);
    const finished = finishUncertainty(answered.state, explainTexts);
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(finished.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "comfortable_answer", questionId: answerQuestionId, source: "dictated" }),
        expect.objectContaining({ type: "uncertainty_explanation", questionId: explainQuestionId, source: "dictated" }),
      ]),
    );
  });
});
