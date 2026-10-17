/**
 * Live canvas commands must mutate the scene or post a visible note.
 * Split used to no-op on labeled rectangles and short captions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleWorkCanvasAskReply,
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
} from "@/lib/ile-work-canvas";
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
  it("lists the five live commands and wires sidebar clicks through the runner", () => {
    expect(ILE_WORK_CANVAS_COMMANDS.map((command) => command.id)).toEqual([
      "simplify",
      "split",
      "check",
      "refactor",
      "declutter",
    ]);
    const canvas = readExcalidrawSurface();
    expect(canvas).toContain("runIleWorkCanvasCommand");
    expect(canvas).toContain("applyIleWorkCanvasAskReply");
    expect(canvas).toContain("outcome.notice");
    expect(canvas).toContain("outcome.ask.kind");
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

  it("declutter separates overlapping boxes and asks when a single mark is selected", () => {
    const overlapping = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 80, height: 40 },
      { type: "rectangle", x: 10, y: 8, width: 80, height: 40 },
    ]);
    const moved = runIleWorkCanvasCommand({
      action: "declutter",
      scene: sceneOf(overlapping),
      selectedElements: overlapping,
    });
    expect(moved.changed).toBe(true);
    expect(moved.ask).toBeNull();
    expect(ileWorkCanvasSceneVisiblyChanged(sceneOf(overlapping), moved.scene)).toBe(true);

    const one = overlapping.slice(0, 1);
    const notice = runIleWorkCanvasCommand({
      action: "declutter",
      scene: sceneOf(overlapping),
      selectedElements: one,
    });
    expect(notice.changed).toBe(false);
    expect(notice.notice).toBe("Select two or more overlapping marks to declutter.");
  });

  it("Simplify, Check, and Refactor ask XAI, and replies always land on the board", () => {
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
    expect(simplify.changed).toBe(false);
    expect(simplify.ask).toEqual({ kind: "simplify", prompt: "Simplify" });
    const simplified = applyIleWorkCanvasAskReply({
      kind: "simplify",
      live: board,
      selectedElements: text,
      payload: { text: "Gravity gets weaker as distance grows." },
    });
    expect(ileWorkCanvasSceneVisiblyChanged(board, simplified)).toBe(true);
    expect(liveText(simplified).some((line) => line.includes("weaker"))).toBe(true);

    const check = runIleWorkCanvasCommand({
      action: "check",
      scene: board,
      selectedElements: text,
    });
    expect(check.ask?.kind).toBe("check");
    expect(check.ask?.prompt.toLowerCase()).toMatch(/what holds and what to fix/);
    const checked = applyIleWorkCanvasAskReply({
      kind: "check",
      live: board,
      selectedElements: text,
      payload: { text: "The inverse-square claim holds. Name the bodies next." },
    });
    expect(liveText(checked).some((line) => line.includes("inverse-square"))).toBe(true);

    const refactored = applyIleWorkCanvasAskReply({
      kind: "refactor",
      live: board,
      selectedElements: text,
      payload: {
        text: "",
        raw: JSON.stringify({
          elements: [{ id: text[0]!.id, text: "Gravity falls with distance squared.", x: 40, y: 90 }],
        }),
      },
    });
    const rewritten = refactored.elements.find((el) => el.id === text[0]!.id);
    expect(String(rewritten?.originalText || rewritten?.text || "")).toContain("falls with distance");
    expect(rewritten?.x).toBe(40);

    const refactorProse = applyIleWorkCanvasAskReply({
      kind: "refactor",
      live: board,
      selectedElements: text,
      payload: { text: "Keep the inverse-square relation, then name the two bodies." },
    });
    expect(liveText(refactorProse).some((line) => line.includes("two bodies"))).toBe(true);

    const failed = applyIleWorkCanvasAskReply({
      kind: "refactor",
      live: board,
      selectedElements: text,
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
  });
});
