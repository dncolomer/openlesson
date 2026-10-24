/**
 * Live canvas commands must mutate the scene or post a visible note.
 * Split used to no-op on labeled rectangles and short captions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleWorkCanvasAskReply,
  buildIleWorkCanvasDefineUserMessage,
  convertToExcalidrawElements,
  expandIleWorkCanvasCommandSelection,
  ILE_WORK_CANVAS_COMMANDS,
  ileWorkCanvasAskFallback,
  ileWorkCanvasSceneVisiblyChanged,
  ileWorkCanvasSplitTextChunks,
  runIleWorkCanvasCommand,
  serializeIleWorkCanvasScene,
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
      "simplify",
      "split",
      "breakdown",
      "concepts",
      "define",
      "answer",
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

  it("splits free text, labeled rectangles, containerId captions, and clause labels", () => {
    const source =
      "First clause names the last-resort test. Second clause names discrimination.";
    const free = convertToExcalidrawElements([{ type: "text", text: source, x: 40, y: 80 }]);
    const freeRun = runIleWorkCanvasCommand({
      action: "split",
      scene: sceneOf(free),
      selectedElements: free,
    });
    expect(freeRun.changed).toBe(true);
    expect(freeRun.parts.length).toBeGreaterThanOrEqual(2);
    expect(freeRun.notice).toBeNull();

    const labeled = convertToExcalidrawElements([
      { type: "rectangle", x: 20, y: 20, width: 200, height: 80, label: { text: source } },
    ]);
    const container = labeled.find((el) => el.type === "rectangle")!;
    const labeledRun = runIleWorkCanvasCommand({
      action: "split",
      scene: sceneOf(labeled),
      selectedElements: [container],
    });
    expect(labeledRun.changed).toBe(true);
    expect(labeledRun.parts.length).toBeGreaterThanOrEqual(2);
    expect(labeledRun.parts.every((el) => !el.containerId)).toBe(true);

    const caption = labeled.find((el) => el.type === "text")!;
    const stripped = labeled.map((el) =>
      el.id === container.id ? { ...el, boundElements: null } : el,
    );
    expect(stripped.find((el) => el.id === container.id)?.boundElements).toBeNull();
    expect(caption.containerId).toBe(container.id);
    const byContainer = runIleWorkCanvasCommand({
      action: "split",
      scene: sceneOf(stripped),
      selectedElements: [stripped.find((el) => el.id === container.id)!],
    });
    expect(byContainer.changed).toBe(true);
    expect(byContainer.parts.length).toBeGreaterThanOrEqual(2);

    expect(ileWorkCanvasSplitTextChunks("Force: Newton's first law").length).toBeGreaterThanOrEqual(2);
    const clause = convertToExcalidrawElements([
      { type: "text", text: "Force: Newton's first law", x: 0, y: 0 },
    ]);
    const clauseRun = runIleWorkCanvasCommand({
      action: "split",
      scene: sceneOf(clause),
      selectedElements: clause,
    });
    expect(clauseRun.changed).toBe(true);
    expect(clauseRun.parts.map((el) => String(el.originalText || el.text || "").trim())).toEqual([
      "Force",
      "Newton's first law",
    ]);
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

  it("posts a board notice when Split cannot run, instead of going silent", () => {
    const word = convertToExcalidrawElements([{ type: "text", text: "Force", x: 0, y: 0 }]);
    const short = runIleWorkCanvasCommand({
      action: "split",
      scene: sceneOf(word),
      selectedElements: word,
    });
    expect(short.changed).toBe(false);
    expect(short.notice).toBe("Need at least two words to split.");

    const rect = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 80, height: 40 },
    ]);
    const unlabeled = runIleWorkCanvasCommand({
      action: "split",
      scene: sceneOf(rect),
      selectedElements: rect,
    });
    expect(unlabeled.changed).toBe(false);
    expect(unlabeled.notice).toBe("Select text, or a labeled shape, to split.");
  });

  it("Breakdown keeps the original mark and fans parts out with arrows", () => {
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
    expect(run.scene.elements.some((el) => el.type === "arrow" && !el.isDeleted)).toBe(true);
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
    expect(fanned.elements.filter((el) => el.customData?.ileConcepts && el.type === "rectangle").length).toBe(3);
    expect(fanned.elements.some((el) => el.type === "arrow" && el.customData?.ileConcepts)).toBe(true);
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
    expect(placed.parts.some((el) => el.strokeStyle === "dashed")).toBe(true);
  });

  it("Define asks XAI and places a definition beside the original", () => {
    const source = "Last resort";
    const free = convertToExcalidrawElements([{ type: "text", text: source, x: 40, y: 80 }]);
    const originalId = free[0]!.id;
    const asked = runIleWorkCanvasCommand({
      action: "define",
      scene: sceneOf(free),
      selectedElements: free,
    });
    expect(asked.changed).toBe(false);
    expect(asked.ask).toEqual({ kind: "define", prompt: "Define" });
    expect(asked.scene.elements.some((el) => el.id === originalId && !el.isDeleted)).toBe(true);
    const placed = applyIleWorkCanvasAskReply({
      kind: "define",
      live: asked.scene,
      selectedElements: asked.selected,
      payload: {
        text: "Last resort is using force only after every peaceful option is exhausted.",
      },
    });
    expect(placed.elements.some((el) => el.id === originalId && !el.isDeleted)).toBe(true);
    expect(
      liveText(placed).some((line) => line.includes("every peaceful option")),
    ).toBe(true);
    const prompt = buildIleWorkCanvasDefineUserMessage({ selectedElements: free });
    expect(prompt).toMatch(/one clean, simple definition/i);
    expect(prompt).toMatch(/Keep the original marks in place/i);
    expect(prompt).toContain("Last resort");
  });

  it("Simplify, Answer, Draw, and Refactor ask XAI, and replies always land on the board", () => {
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

    const answer = runIleWorkCanvasCommand({
      action: "answer",
      scene: board,
      selectedElements: text,
    });
    expect(answer.ask?.kind).toBe("answer");
    const answered = applyIleWorkCanvasAskReply({
      kind: "answer",
      live: board,
      selectedElements: text,
      payload: { text: "The inverse-square claim holds. Name the bodies next." },
    });
    expect(liveText(answered).some((line) => line.includes("inverse-square"))).toBe(true);

    const draw = runIleWorkCanvasCommand({
      action: "draw",
      scene: board,
      selectedElements: text,
    });
    expect(draw.changed).toBe(false);
    expect(draw.ask?.kind).toBe("draw");
    expect(draw.scene.elements.some((el) => el.id === text[0]!.id)).toBe(true);

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
