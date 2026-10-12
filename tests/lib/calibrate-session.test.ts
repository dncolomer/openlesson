/**
 * Calibration phase gate. Imports the shipped module from a cold start.
 */
import { describe, expect, it } from "vitest";
import {
  appendIleDictatedTextToWorkCanvas,
  syncIleDictatedTextOnWorkCanvas,
} from "@/lib/ile-canvas-dictate";
import {
  BOARD_INSTRUCTION_NOTE_BODY_FILL,
  BOARD_INSTRUCTION_NOTE_LABEL,
  ileWorkCanvasContentBounds,
  ileWorkCanvasFitScroll,
  ILE_WORK_CANVAS_STROKE_COLOR,
} from "@/lib/ile-work-canvas";
import {
  CALIBRATE_ANSWER_WELL_LABEL,
  CALIBRATE_EXPLAIN_WELL_LABEL,
  CALIBRATE_OPENING_INSTRUCTION,
  CALIBRATE_QUESTION_FILL,
  CALIBRATE_WELL_FILL,
  CALIBRATE_REGION_HEIGHT,
  CALIBRATE_REGION_WIDTH,
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
  restoreCalibrateChrome,
  calibrateBoardHasOverlap,
  calibrateTextCollides,
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
  it("keeps the instruction, locks the plates, and fits both areas beside the questions", () => {
    const seeded = seedCalibrateWorkCanvas([
      "A long question that wraps across several lines so the card grows taller than a single row of type and still has to clear the region titles.",
      "Second question with enough words to wrap inside the card without touching the first.",
      "Third question stays in the column to the right of the opening instructions.",
      "Fourth question remains clear of both regions and their titles.",
      "Fifth question ends the pool without crossing another mark.",
    ]);
    const wider = seedCalibrateWorkCanvas([
      ...POOL,
      "Sixth question must not stretch the areas.",
      "Seventh question stacks in the column.",
      "Eighth question still leaves the areas the same size.",
    ]);
    expect(calibrateBoardHasOverlap(seeded.scene.elements)).toBe(false);
    expect(calibrateTextCollides(seeded.scene.elements)).toBe(false);
    const instruction = seeded.scene.elements.find(
      (el) => el.type === "text" && el.customData?.calibrateRole === "instruction",
    );
    expect(instruction?.originalText).toBe(CALIBRATE_OPENING_INSTRUCTION);
    expect(instruction?.locked).toBe(true);
    const note = seeded.scene.elements.find(
      (el) => el.type === "rectangle" && el.customData?.calibrateRole === "instruction",
    );
    const noteLabel = seeded.scene.elements.find(
      (el) => el.customData?.boardInstructionNote === "label",
    );
    expect(note?.locked).toBe(true);
    expect(note?.backgroundColor).toBe(BOARD_INSTRUCTION_NOTE_BODY_FILL);
    expect(noteLabel?.originalText).toBe(BOARD_INSTRUCTION_NOTE_LABEL);
    expect(noteLabel?.locked).toBe(true);
    const regions = seeded.scene.elements.filter(
      (el) => el.type === "rectangle" && el.customData?.calibrateRole === "region",
    );
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      expect(region.locked).toBe(true);
      expect(region.width).toBe(CALIBRATE_REGION_WIDTH);
      expect(region.height).toBe(CALIBRATE_REGION_HEIGHT);
      expect(region.strokeColor).toBe(ILE_WORK_CANVAS_STROKE_COLOR);
    }
    expect(CALIBRATE_REGION_WIDTH).toBeLessThanOrEqual(320);
    expect(CALIBRATE_REGION_HEIGHT).toBeLessThanOrEqual(260);
    expect(instruction?.strokeColor).toBe(ILE_WORK_CANVAS_STROKE_COLOR);
    const fitted = ileWorkCanvasFitScroll(ileWorkCanvasContentBounds(seeded.scene.elements), {
      width: 960,
      height: 640,
    });
    expect(fitted?.zoom).toBe(1);
    const widerRegions = wider.scene.elements.filter(
      (el) => el.type === "rectangle" && el.customData?.calibrateRole === "region",
    );
    expect(widerRegions.map((el) => el.height)).toEqual(regions.map((el) => el.height));
    const wells = seeded.scene.elements.filter((el) => el.customData?.calibrateRole === "well-label");
    expect(wells.map((el) => el.originalText).sort()).toEqual(
      [CALIBRATE_ANSWER_WELL_LABEL, CALIBRATE_EXPLAIN_WELL_LABEL].sort(),
    );
    expect(wells.every((el) => el.locked)).toBe(true);
    const cards = seeded.scene.elements.filter((el) => el.customData?.calibrateRole === "question");
    expect(cards.every((el) => !el.locked)).toBe(true);
    expect(cards.every((card) => card.backgroundColor === CALIBRATE_QUESTION_FILL)).toBe(true);
    expect(cards.every((card) => card.fillStyle === "solid")).toBe(true);
    expect(cards.every((card) => card.y >= (instruction?.y || 0) + (instruction?.height || 0))).toBe(true);
    const wellsStay = seeded.scene.elements.filter((el) => el.customData?.calibrateRole === "well");
    expect(wellsStay).toHaveLength(2);
    expect(wellsStay.every((el) => el.locked && el.strokeStyle === "dashed")).toBe(true);
    expect(wellsStay.every((el) => el.backgroundColor === CALIBRATE_WELL_FILL && el.fillStyle === "solid")).toBe(true);
    expect(wellsStay.every((el) => el.width > CALIBRATE_REGION_WIDTH / 2)).toBe(true);
    for (const well of wellsStay) {
      const region = regions.find((frame) => frame.customData?.calibrateRegion === well.customData?.calibrateRegion);
      expect(region).toBeTruthy();
      expect(well.y).toBeGreaterThan((region?.y || 0) + 24);
      expect(well.y + well.height).toBeLessThanOrEqual((region?.y || 0) + (region?.height || 0));
    }
  });

  it("puts the instruction and the areas back when they are moved or rewritten", () => {
    const seeded = seedCalibrateWorkCanvas(POOL);
    const region = seeded.scene.elements.find((el) => el.customData?.calibrateRole === "region");
    const instruction = seeded.scene.elements.find(
      (el) => el.type === "text" && el.customData?.calibrateRole === "instruction",
    );
    const card = seeded.scene.elements.find((el) => el.customData?.calibrateRole === "question");
    expect(region && instruction && card).toBeTruthy();
    const disturbed = seeded.scene.elements.map((el) => {
      if (el.id === region?.id) return { ...el, x: el.x + 120, y: el.y + 80, locked: false };
      if (el.id === instruction?.id) return { ...el, text: "gone", originalText: "gone", locked: false, isDeleted: true };
      if (el.id === card?.id) return { ...el, x: el.x + 30 };
      return el;
    });
    const restored = restoreCalibrateChrome(disturbed);
    const regionAgain = restored.find((el) => el.id === region?.id);
    const instructionAgain = restored.find((el) => el.id === instruction?.id);
    const cardAgain = restored.find((el) => el.id === card?.id);
    expect(regionAgain).toMatchObject({ x: region?.x, y: region?.y, locked: true });
    expect(instructionAgain?.originalText).toBe(CALIBRATE_OPENING_INSTRUCTION);
    expect(instructionAgain?.locked).toBe(true);
    expect(instructionAgain?.isDeleted).toBe(false);
    expect(cardAgain?.x).toBe((card?.x || 0) + 30);
    expect(restoreCalibrateChrome(restored)).toBe(restored);
  });

  it("keeps a long answer off the next card and inside its region", () => {
    const seeded = seedCalibrateWorkCanvas(POOL);
    let scene = seeded.scene;
    scene = moveCalibrateQuestionOnCanvas(scene, "q-1", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-2", "comfortable");
    scene = moveCalibrateQuestionOnCanvas(scene, "q-3", "comfortable");
    const long =
      "I would name the slope, then the smaller and smaller runs, then the value those slopes approach, and I would say which picture still fails when the graph breaks.";
    scene = addCalibrateResponseText(scene, { questionId: "q-1", text: long, source: "typed" });
    expect(calibrateTextCollides(scene.elements)).toBe(false);
    const placed = readCalibratePlacements(scene);
    expect(placed["q-1"]).toBe("comfortable");
    expect(placed["q-2"]).toBe("comfortable");
    expect(placed["q-3"]).toBe("comfortable");
    const dictated = appendIleDictatedTextToWorkCanvas(
      scene,
      "The uncertain part is which comparison would show the area and the integral disagree, and how many smaller steps still refuse to settle on one picture.",
    );
    expect(calibrateTextCollides(dictated.scene.elements)).toBe(false);
  });

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
