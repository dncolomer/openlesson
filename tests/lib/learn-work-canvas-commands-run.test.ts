/**
 * Live canvas commands must mutate the scene or post a visible note.
 * Breakdown used to no-op on labeled rectangles and short captions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleWorkCanvasAskReply,
  buildIleWorkCanvasSimplifyUserMessage,
  convertToExcalidrawElements,
  expandIleWorkCanvasCommandSelection,
  ILE_WORK_CANVAS_COMMANDS,
  ileWorkCanvasAskFallback,
  ileWorkCanvasPlacedHarnessNext,
  ileWorkCanvasSceneVisiblyChanged,
  ileWorkCanvasSplitTextChunks,
  runIleWorkCanvasCommand,
  serializeIleWorkCanvasScene,
  BOARD_INSTRUCTION_NOTE_KEY,
  ILE_WORK_CANVAS_END_ARROWHEAD,
  ILE_WORK_CANVAS_FAN_BRACKET_KEY,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";
import { readExcalidrawSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

function sceneOf(elements: IleWorkCanvasElement[]): IleWorkCanvasScene {
  return serializeIleWorkCanvasScene({ elements, appState: {}, files: {} });
}

function liveText(scene: IleWorkCanvasScene): string[] {
  return scene.elements
    .filter((el) => el.type === "text" && !el.isDeleted)
    .map((el) => String(el.originalText || el.text || "").replace(/\s+/g, " ").trim());
}

describe("work-canvas command buttons actually mutate the board", () => {
  it("lists the live commands and wires sidebar clicks through the runner", () => {
    expect(ILE_WORK_CANVAS_COMMANDS.map((command) => command.id)).toEqual([
      "focus",
      "next",
      "simplify",
      "breakdown",
      "concepts",
      "draw",
      "refactor",
    ]);
    const canvas = readExcalidrawSurface();
    expect(canvas).toContain("runIleWorkCanvasCommand");
    expect(canvas).toContain("applyIleWorkCanvasAskReply");
    expect(canvas).toContain("outcome.notice");
    expect(canvas).toContain("outcome.ask.kind");
    expect(canvas.indexOf("if (outcome.ask)")).toBeGreaterThan(canvas.indexOf("if (outcome.changed)"));
    expect(canvas).toContain("applyLocalCanvasEdit(outcome.scene, outcome.parts, !outcome.ask)");
    expect(canvas).toContain("ileWorkCanvasRevealScroll");
    expect(canvas).toContain("ileWorkCanvasCommandShortcutKeyFromEvent");
    expect(canvas).toContain('askInput.kind !== "concepts"');
    const applyLocal = canvas.slice(
      canvas.indexOf("const applyLocalCanvasEdit"),
      canvas.indexOf("if (outcome.changed)"),
    );
    expect(applyLocal).toContain("ileWorkCanvasRevealScroll");
    expect(applyLocal).not.toContain("scrollToContent");
    const guide = readFileSync(join(ROOT, "components/session-view/session-guide-panel.tsx"), "utf8");
    expect(guide).toContain("bridge.run(command.id)");
    for (const command of ILE_WORK_CANVAS_COMMANDS) {
      expect(guide).toContain(`data-session-command={command.id}`);
    }
  });

  it("breaks down labeled rectangles, containerId captions, and clause labels", () => {
    const source =
      "First clause names the last-resort test. Second clause names discrimination.";
    const labeled = convertToExcalidrawElements([
      { type: "rectangle", x: 20, y: 20, width: 200, height: 80, label: { text: source } },
    ]);
    const container = labeled.find((el) => el.type === "rectangle")!;
    const labeledRun = runIleWorkCanvasCommand({
      action: "breakdown",
      scene: sceneOf(labeled),
      selectedElements: [container],
    });
    expect(labeledRun.changed).toBe(true);
    expect(
      labeledRun.scene.elements.filter((el) => el.customData?.ileBreakdown && el.type === "rectangle")
        .length,
    ).toBeGreaterThanOrEqual(2);

    const caption = labeled.find((el) => el.type === "text")!;
    const stripped = labeled.map((el) =>
      el.id === container.id ? { ...el, boundElements: null } : el,
    );
    expect(stripped.find((el) => el.id === container.id)?.boundElements).toBeNull();
    expect(caption.containerId).toBe(container.id);
    const byContainer = runIleWorkCanvasCommand({
      action: "breakdown",
      scene: sceneOf(stripped),
      selectedElements: [stripped.find((el) => el.id === container.id)!],
    });
    expect(byContainer.changed).toBe(true);
    expect(
      byContainer.scene.elements.filter((el) => el.customData?.ileBreakdown && el.type === "rectangle")
        .length,
    ).toBeGreaterThanOrEqual(2);

    expect(ileWorkCanvasSplitTextChunks("Force: Newton's first law").length).toBeGreaterThanOrEqual(2);
    const clause = convertToExcalidrawElements([
      { type: "text", text: "Force: Newton's first law", x: 0, y: 0 },
    ]);
    const clauseRun = runIleWorkCanvasCommand({
      action: "breakdown",
      scene: sceneOf(clause),
      selectedElements: clause,
    });
    expect(clauseRun.changed).toBe(true);
    expect(liveText(clauseRun.scene)).toEqual(expect.arrayContaining(["Force", "Newton's first law"]));
  });

  it("stays quiet when nothing is selected", () => {
    const empty = runIleWorkCanvasCommand({
      action: "simplify",
      scene: sceneOf([]),
      selectedElements: [],
    });
    expect(empty.changed).toBe(false);
    expect(empty.notice).toBeNull();
  });

  it("posts a board notice when Subdivide cannot run, instead of going silent", () => {
    const word = convertToExcalidrawElements([{ type: "text", text: "Force", x: 0, y: 0 }]);
    const short = runIleWorkCanvasCommand({
      action: "breakdown",
      scene: sceneOf(word),
      selectedElements: word,
    });
    expect(short.changed).toBe(false);
    expect(short.notice).toBe("Need at least two words to subdivide.");

    const rect = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 80, height: 40 },
    ]);
    const unlabeled = runIleWorkCanvasCommand({
      action: "breakdown",
      scene: sceneOf(rect),
      selectedElements: rect,
    });
    expect(unlabeled.changed).toBe(false);
    expect(unlabeled.notice).toBe("Select text, or a labeled shape, to subdivide.");
  });

  it("Subdivide keeps the original mark and fans parts out with one stem into a bracket", () => {
    const source =
      "First clause names the last-resort test. Second clause names discrimination.";
    const free = convertToExcalidrawElements([{ type: "text", text: source, x: 40, y: 80 }]);
    const originalId = free[0]!.id;
    const run = runIleWorkCanvasCommand({
      action: "breakdown",
      scene: sceneOf(free),
      selectedElements: free,
    });
    expect(run.changed).toBe(true);
    expect(run.scene.elements.some((el) => el.id === originalId && !el.isDeleted)).toBe(true);
    const arrows = run.scene.elements.filter(
      (el) => el.type === "arrow" && el.customData?.ileBreakdown && !el.isDeleted,
    );
    const brackets = run.scene.elements.filter(
      (el) => el.type === "line" && el.customData?.[ILE_WORK_CANVAS_FAN_BRACKET_KEY] && !el.isDeleted,
    );
    expect(arrows).toHaveLength(1);
    expect(brackets).toHaveLength(1);
    expect(arrows[0]!.endArrowhead).toBe(ILE_WORK_CANVAS_END_ARROWHEAD);
    expect(arrows[0]!.endBinding).toEqual(
      expect.objectContaining({ elementId: brackets[0]!.id }),
    );
    expect(run.scene.elements.filter((el) => el.customData?.ileBreakdown && el.type === "rectangle").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(run.parts.every((el) => !el.customData?.ileBreakdown)).toBe(true);
    expect(run.parts.some((el) => el.id === originalId)).toBe(true);
    const selectedIds = run.scene.appState.selectedElementIds as Record<string, boolean>;
    expect(selectedIds[originalId]).toBe(true);
    for (const el of run.scene.elements) {
      if (el.customData?.ileBreakdown) expect(selectedIds[el.id]).toBeFalsy();
    }
    expect(liveText(run.scene).some((line) => line.includes("First clause"))).toBe(true);
    expect(liveText(run.scene).some((line) => line.includes("Second clause"))).toBe(true);
  });

  it("Concepts asks XAI and fans named concepts without selecting them", () => {
    const source = "Last resort requires every peaceful option before force.";
    const free = convertToExcalidrawElements([{ type: "text", text: source, x: 40, y: 80 }]);
    const originalId = free[0]!.id;
    const asked = runIleWorkCanvasCommand({
      action: "concepts",
      scene: sceneOf(free),
      selectedElements: free,
    });
    expect(asked.changed).toBe(false);
    expect(asked.ask).toEqual({ kind: "concepts", prompt: "Concepts" });
    const fanned = applyIleWorkCanvasAskReply({
      kind: "concepts",
      live: asked.scene,
      selectedElements: asked.selected,
      payload: { text: "Last resort\nPeaceful options\nForce" },
    });
    expect(fanned.elements.some((el) => el.id === originalId && !el.isDeleted)).toBe(true);
    expect(
      fanned.elements.filter(
        (el) =>
          el.customData?.ileConcepts && el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body",
      ).length,
    ).toBe(3);
    const conceptArrows = fanned.elements.filter(
      (el) => el.type === "arrow" && el.customData?.ileConcepts,
    );
    const conceptBrackets = fanned.elements.filter(
      (el) => el.type === "line" && el.customData?.[ILE_WORK_CANVAS_FAN_BRACKET_KEY],
    );
    expect(conceptArrows).toHaveLength(1);
    expect(conceptBrackets).toHaveLength(1);
    expect(conceptArrows[0]!.endArrowhead).toBe(ILE_WORK_CANVAS_END_ARROWHEAD);
    expect(conceptArrows[0]!.endBinding).toEqual(
      expect.objectContaining({ elementId: conceptBrackets[0]!.id }),
    );
    expect(conceptBrackets[0]!.points).toHaveLength(4);
    const conceptBodies = fanned.elements.filter(
      (el) =>
        el.customData?.ileConcepts && el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body",
    );
    const cardGroups = conceptBodies.map((el) => (el.groupIds ?? [])[0]).filter(Boolean);
    expect(new Set(cardGroups).size).toBe(conceptBodies.length);
    const bracketGroups = new Set(conceptBrackets[0]!.groupIds ?? []);
    for (const body of conceptBodies) {
      expect((body.groupIds ?? []).some((id) => bracketGroups.has(id))).toBe(false);
    }
    expect(liveText(fanned).some((line) => line.includes("Peaceful options"))).toBe(true);
    const selectedIds = fanned.appState.selectedElementIds as Record<string, boolean>;
    expect(selectedIds[originalId]).toBe(true);
    for (const el of fanned.elements) {
      if (el.customData?.ileConcepts) expect(selectedIds[el.id]).toBeFalsy();
    }
  });

  it("Focus places the harness line on the board without a selection", () => {
    const board = sceneOf([]);
    const empty = runIleWorkCanvasCommand({
      action: "focus",
      scene: board,
      selectedElements: [],
    });
    expect(empty.changed).toBe(false);
    expect(empty.notice).toBe("The harness has nothing to place yet.");

    const placed = runIleWorkCanvasCommand({
      action: "focus",
      scene: board,
      selectedElements: [],
      focusText: "Stay with the ray and mark the open end.",
    });
    expect(placed.changed).toBe(true);
    expect(liveText(placed.scene).some((line) => line.includes("Stay with the ray"))).toBe(true);
    expect(
      placed.parts.some((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body"),
    ).toBe(true);
    expect(placed.parts.some((el) => el.originalText === "Focus")).toBe(true);
  });

  it("Next places the cheapest other step, and stays quiet when that is the current focus", () => {
    const board = sceneOf([]);
    const empty = runIleWorkCanvasCommand({
      action: "next",
      scene: board,
      selectedElements: [],
    });
    expect(empty.changed).toBe(false);
    expect(empty.notice).toBe("The harness has nothing cheaper to explore yet.");

    const same = runIleWorkCanvasCommand({
      action: "next",
      scene: board,
      selectedElements: [],
      nextSameAsHere: true,
      nextText: "When is force last?",
    });
    expect(same.changed).toBe(false);
    expect(same.notice).toBe("You are already on the cheapest step to explore.");

    const placed = runIleWorkCanvasCommand({
      action: "next",
      scene: board,
      selectedElements: [],
      nextText: "Which peaceful option is still open?",
      nextHiddenStateId: "cheap",
    });
    expect(placed.changed).toBe(true);
    expect(liveText(placed.scene).some((line) => line.includes("peaceful option"))).toBe(true);
    expect(placed.parts.some((el) => el.originalText === "Next")).toBe(true);
    expect(placed.parts.some((el) => el.customData?.ileHarnessNext)).toBe(true);
    expect(placed.parts.some((el) => el.customData?.ileHarnessNextId === "cheap")).toBe(true);

    const again = runIleWorkCanvasCommand({
      action: "next",
      scene: placed.scene,
      selectedElements: [],
      nextText: "Is the means proportional?",
      nextHiddenStateId: "dear",
    });
    expect(again.changed).toBe(true);
    expect(liveText(again.scene).some((line) => line.includes("proportional"))).toBe(true);
    expect(ileWorkCanvasPlacedHarnessNext(again.scene).ids).toEqual(["cheap", "dear"]);
  });

  it("Simplify makes a term plain and replaces the original", () => {
    const source = "Last resort";
    const free = convertToExcalidrawElements([{ type: "text", text: source, x: 40, y: 80 }]);
    const originalId = free[0]!.id;
    const asked = runIleWorkCanvasCommand({
      action: "simplify",
      scene: sceneOf(free),
      selectedElements: free,
    });
    expect(asked.changed).toBe(true);
    expect(asked.ask).toEqual({ kind: "simplify", prompt: "Simplify" });
    expect(asked.scene.elements.some((el) => el.id === originalId && !el.isDeleted)).toBe(false);
    const placed = applyIleWorkCanvasAskReply({
      kind: "simplify",
      live: asked.scene,
      selectedElements: asked.selected,
      payload: {
        text: "Last resort is using force only after every peaceful option is exhausted.",
      },
    });
    expect(placed.elements.some((el) => el.id === originalId && !el.isDeleted)).toBe(false);
    expect(
      liveText(placed).some((line) => line.includes("every peaceful option")),
    ).toBe(true);
    const prompt = buildIleWorkCanvasSimplifyUserMessage({ selectedElements: free });
    expect(prompt).toMatch(/make the meaning plain/i);
    expect(prompt).toMatch(/shorter, plainer/i);
    expect(prompt).toContain("Last resort");
  });

  it("Simplify, Do/run, and Refactor ask XAI, and replies always land on the board", () => {
    const text = convertToExcalidrawElements([
      {
        type: "text",
        text: "The gravitational force is inversely proportional to the square of the distance.",
        x: 12,
        y: 24,
      },
    ]);
    const board = sceneOf(text);

    const simplify = runIleWorkCanvasCommand({
      action: "simplify",
      scene: board,
      selectedElements: text,
    });
    expect(simplify.changed).toBe(true);
    expect(simplify.scene.elements.some((el) => el.id === text[0]!.id)).toBe(false);
    expect(simplify.ask).toEqual({ kind: "simplify", prompt: "Simplify" });
    const simplified = applyIleWorkCanvasAskReply({
      kind: "simplify",
      live: simplify.scene,
      selectedElements: simplify.selected,
      payload: { text: "Gravity gets weaker as distance grows." },
    });
    expect(ileWorkCanvasSceneVisiblyChanged(simplify.scene, simplified)).toBe(true);
    expect(liveText(simplified).some((line) => line.includes("weaker"))).toBe(true);
    expect(simplified.elements.some((el) => el.id === text[0]!.id)).toBe(false);

    const draw = runIleWorkCanvasCommand({
      action: "draw",
      scene: board,
      selectedElements: text,
    });
    expect(draw.changed).toBe(false);
    expect(draw.ask?.kind).toBe("draw");
    expect(draw.scene.elements.some((el) => el.id === text[0]!.id)).toBe(true);
    const drawn = applyIleWorkCanvasAskReply({
      kind: "draw",
      live: board,
      selectedElements: text,
      payload: { text: "The inverse-square claim holds. Name the bodies next." },
    });
    expect(liveText(drawn).some((line) => line.includes("inverse-square"))).toBe(true);
    expect(drawn.elements.some((el) => el.id === text[0]!.id && !el.isDeleted)).toBe(true);

    const refactor = runIleWorkCanvasCommand({
      action: "refactor",
      scene: board,
      selectedElements: text,
    });
    expect(refactor.changed).toBe(true);
    expect(refactor.scene.elements.some((el) => el.id === text[0]!.id)).toBe(false);
    expect(refactor.ask).toEqual({ kind: "refactor", prompt: "Refactor" });

    const refactored = applyIleWorkCanvasAskReply({
      kind: "refactor",
      live: refactor.scene,
      selectedElements: refactor.selected,
      payload: {
        text: "Gravity falls with distance squared.",
      },
    });
    expect(refactored.elements.some((el) => el.id === text[0]!.id)).toBe(false);
    expect(liveText(refactored).some((line) => line.includes("falls with distance"))).toBe(true);

    const refactorProse = applyIleWorkCanvasAskReply({
      kind: "refactor",
      live: refactor.scene,
      selectedElements: refactor.selected,
      payload: { text: "Keep the inverse-square relation, then name the two bodies." },
    });
    expect(liveText(refactorProse).some((line) => line.includes("two bodies"))).toBe(true);
    expect(refactorProse.elements.some((el) => el.id === text[0]!.id)).toBe(false);

    const failed = applyIleWorkCanvasAskReply({
      kind: "refactor",
      live: refactor.scene,
      selectedElements: refactor.selected,
      payload: { text: "" },
    });
    expect(liveText(failed).some((line) => line.includes(ileWorkCanvasAskFallback("refactor")))).toBe(
      true,
    );
  });

  it("expands a labeled rectangle so Simplify sees the caption text", () => {
    const labeled = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: 0,
        y: 0,
        width: 180,
        height: 70,
        label: { text: "Last resort requires every peaceful option first." },
      },
    ]);
    const container = labeled.find((el) => el.type === "rectangle")!;
    const expanded = expandIleWorkCanvasCommandSelection(sceneOf(labeled), [container]);
    expect(expanded.some((el) => el.type === "text")).toBe(true);
    const simplify = runIleWorkCanvasCommand({
      action: "simplify",
      scene: sceneOf(labeled),
      selectedElements: [container],
    });
    expect(simplify.selected.some((el) => el.type === "text")).toBe(true);
    expect(simplify.changed).toBe(true);
    expect(simplify.scene.elements.some((el) => el.id === container.id)).toBe(false);
  });
});
