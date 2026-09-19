/**
 * Shared Work-canvas PoW: scene-diff classifier + ILE/TAP upload builders.
 * Drives shipped classify / ask / collector / builder functions — no reimplementation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  convertToExcalidrawElements,
  emptyIleWorkCanvasScene,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import {
  buildIleWorkCanvasActionUploadItem,
  buildIleWorkCanvasAskPowEvent,
  classifyIleWorkCanvasSceneDiff,
  IleWorkCanvasPowCollector,
  ileWorkCanvasElementContentFingerprint,
  ILE_WORK_CANVAS_POW_ACTIONS,
  ILE_WORK_CANVAS_POW_TOOL_NAME,
  shouldLogIleSidebarToolSwitch,
  type IleWorkCanvasPowEvent,
} from "@/lib/ile-work-canvas-pow";
import {
  buildIleExcalidrawToolUploadItem,
  buildIleNotebookUploadItem,
} from "@/lib/ile-realtime-pow";
import {
  buildTapExcalidrawToolUploadItem,
  buildTapWorkCanvasActionUploadItem,
  classifyTapWorkCanvasSceneDiff,
} from "@/lib/tap-work-canvas";
import { ILE_SPEECH_TOOL_NAME } from "@/lib/ile-thought-traces";
import { TAP_SPEECH_TOOL_NAME } from "@/lib/tap-speech-proof-of-work";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-20488ef5b34b/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function el(
  type: string,
  id: string,
  extra: Record<string, unknown> = {},
): IleWorkCanvasElement {
  const [converted] = convertToExcalidrawElements(
    [{ type, id, x: 40, y: 40, width: 80, height: 60, text: String(extra.text || id), ...extra }],
    { regenerateIds: false },
  );
  expect(converted, `missing converted ${type}:${id}`).toBeTruthy();
  return { ...converted, ...extra, id, type } as IleWorkCanvasElement;
}

function scene(
  elements: IleWorkCanvasElement[],
  appState: Record<string, unknown> = {},
): IleWorkCanvasScene {
  return {
    elements,
    appState: { zoom: { value: 1 }, scrollX: 0, scrollY: 0, ...appState },
    files: {},
  };
}

function actionsOf(events: IleWorkCanvasPowEvent[]): string[] {
  return events.map((event) => `${event.toolName}/${event.toolAction}`);
}

describe("Work-canvas scene-diff PoW (shipped classifier)", () => {
  it("emits distinct actions for draw tools, delete, move, rotate, multi-select, asks, and repeats", () => {
    const empty = emptyIleWorkCanvasScene();
    const drawTypes = [
      "text",
      "freedraw",
      "rectangle",
      "diamond",
      "ellipse",
      "arrow",
      "line",
      "image",
      "frame",
    ] as const;
    const createdActions: string[] = [];
    for (const type of drawTypes) {
      const drawn = classifyIleWorkCanvasSceneDiff(empty, scene([el(type, `new-${type}`)]));
      expect(drawn).toHaveLength(1);
      expect(drawn[0].toolName).toBe(ILE_WORK_CANVAS_POW_TOOL_NAME);
      expect(drawn[0].toolAction).toBe(`draw_${type}`);
      createdActions.push(drawn[0].toolAction);
    }
    expect(new Set(createdActions).size).toBe(drawTypes.length);

    const rect = el("rectangle", "r1", { x: 10, y: 10 });
    const before = scene([rect]);
    const deleted = classifyIleWorkCanvasSceneDiff(before, scene([]));
    expect(actionsOf(deleted)).toEqual(["canvas/delete"]);

    const erased = classifyIleWorkCanvasSceneDiff(
      before,
      scene([], { activeTool: { type: "eraser" } }),
    );
    expect(actionsOf(erased)).toEqual(["canvas/erase"]);
    expect(erased[0].toolAction).not.toBe(deleted[0].toolAction);

    const moved = classifyIleWorkCanvasSceneDiff(
      before,
      scene([{ ...rect, x: 120, y: 80 }]),
    );
    expect(actionsOf(moved)).toEqual(["canvas/move"]);
    expect(moved[0].metadata.element_ids).toEqual(["r1"]);

    const rotated = classifyIleWorkCanvasSceneDiff(
      before,
      scene([{ ...rect, angle: 1.2 }]),
    );
    expect(actionsOf(rotated)).toEqual(["canvas/rotate"]);

    const two = scene([el("rectangle", "a"), el("ellipse", "b")], {
      selectedElementIds: { a: true, b: true },
    });
    const multi = classifyIleWorkCanvasSceneDiff(
      scene([el("rectangle", "a"), el("ellipse", "b")]),
      two,
    );
    expect(actionsOf(multi)).toEqual(["canvas/multi_select"]);
    expect(multi[0].metadata.count).toBe(2);

    const movedSet = classifyIleWorkCanvasSceneDiff(
      two,
      scene(
        [
          { ...el("rectangle", "a"), x: 200 },
          { ...el("ellipse", "b"), x: 260 },
        ],
        { selectedElementIds: { a: true, b: true } },
      ),
    );
    expect(actionsOf(movedSet)).toEqual(["canvas/move"]);
    expect(movedSet[0].metadata.multi).toBe(true);
    expect(movedSet[0].metadata.count).toBe(2);

    const expand = buildIleWorkCanvasAskPowEvent("expand_more", {
      prompt: "Why this node?",
      selectedElements: [el("text", "sel", { text: "heap parent" })],
    });
    expect(expand?.toolName).toBe("canvas");
    expect(expand?.toolAction).toBe("expand_more");
    expect(expand?.metadata.prompt).toBe("Why this node?");

    const board = buildIleWorkCanvasAskPowEvent("board_prompt", {
      prompt: "Put the first swap on the canvas",
    });
    expect(board?.toolAction).toBe("board_prompt");
    expect(board?.metadata.prompt).toContain("first swap");

    const compress = buildIleWorkCanvasAskPowEvent("compress_work", {
      prompt: "Compress work",
      selectedElements: [el("text", "sel", { text: "heap parent" })],
    });
    expect(compress?.toolAction).toBe("compress_work");
    expect(compress?.metadata.prompt).toBe("Compress work");

    const secondDelete = classifyIleWorkCanvasSceneDiff(
      scene([el("rectangle", "gone")]),
      scene([]),
    );
    expect(actionsOf(deleted)).toEqual(actionsOf(secondDelete));
    expect(secondDelete).toHaveLength(1);

    const collector = new IleWorkCanvasPowCollector();
    collector.reset(before);
    expect(
      collector.observeScene(scene([{ ...rect, x: 50, y: 10 }]), { gestureBusy: true }),
    ).toEqual([]);
    const gesture = collector.observeScene(scene([{ ...rect, x: 180, y: 90 }]), {
      gestureBusy: false,
    });
    expect(actionsOf(gesture)).toEqual(["canvas/move"]);
    const again = collector.observeScene(scene([{ ...rect, x: 10, y: 220 }]), {
      gestureBusy: false,
    });
    expect(actionsOf(again)).toEqual(["canvas/move"]);

    const distinct = new Set([
      ...createdActions,
      "erase",
      "delete",
      "move",
      "rotate",
      "multi_select",
      "expand_more",
      "board_prompt",
      "compress_work",
    ]);
    expect(distinct.size).toBe(ILE_WORK_CANVAS_POW_ACTIONS.length);

    writeScratch(
      "canvas-pow-actions.log",
      [
        `draws=${createdActions.join(",")}`,
        `delete=${deleted[0].toolAction}`,
        `erase=${erased[0].toolAction}`,
        `move=${moved[0].toolAction}`,
        `rotate=${rotated[0].toolAction}`,
        `multi=${multi[0].toolAction}`,
        `expand=${expand?.toolAction}`,
        `board=${board?.toolAction}`,
        `gestureMoves=${actionsOf(gesture).concat(actionsOf(again)).join(",")}`,
      ].join("\n") + "\n",
    );
  });

  it("ignores pan/zoom/scroll, retired tools, and empty mount wipes", () => {
    const rect = el("rectangle", "keep");
    const base = scene([rect], { zoom: { value: 1 }, scrollX: 0, scrollY: 0 });
    const panned = classifyIleWorkCanvasSceneDiff(
      base,
      scene([rect], { zoom: { value: 2.4 }, scrollX: 80, scrollY: -40 }),
    );
    expect(panned).toEqual([]);
    expect(ileWorkCanvasElementContentFingerprint(base)).toBe(
      ileWorkCanvasElementContentFingerprint(
        scene([rect], { zoom: { value: 8 }, scrollX: 999, scrollY: 999 }),
      ),
    );

    expect(classifyIleWorkCanvasSceneDiff(base, scene([rect], { activeTool: "notebook" }))).toEqual([]);
    expect(buildIleWorkCanvasActionUploadItem("s", { toolName: "notebook", toolAction: "notebook_edit" })).toBeNull();
    expect(buildIleWorkCanvasActionUploadItem("s", { toolName: "grokipedia", toolAction: "open" })).toBeNull();
    expect(buildIleWorkCanvasActionUploadItem("s", { toolName: "dantes", toolAction: "open" })).toBeNull();
    expect(buildIleExcalidrawToolUploadItem("s", { activeTool: "notebook" })).toBeNull();
    expect(buildIleNotebookUploadItem("s", "notes").toolName).toBe("notebook");

    const collector = new IleWorkCanvasPowCollector();
    collector.reset(base);
    expect(collector.observeScene(emptyIleWorkCanvasScene())).toEqual([]);

    expect(shouldLogIleSidebarToolSwitch("canvas")).toBe(false);
    expect(shouldLogIleSidebarToolSwitch("notebook")).toBe(false);
    expect(shouldLogIleSidebarToolSwitch("grokipedia")).toBe(false);
    expect(shouldLogIleSidebarToolSwitch("dantes")).toBe(false);
    expect(shouldLogIleSidebarToolSwitch("chapters")).toBe(true);
  });

  it("collector emits last-element delete and eraser-clear, not only mount-empty", () => {
    const liveRect = el("rectangle", "last");
    const liveBoard = scene([liveRect]);
    const collector = new IleWorkCanvasPowCollector();

    collector.reset(liveBoard);
    expect(collector.observeScene(emptyIleWorkCanvasScene())).toEqual([]);

    collector.reset(liveBoard);
    const lastDeleted = collector.observeScene(scene([{ ...liveRect, isDeleted: true }]));
    expect(actionsOf(lastDeleted)).toEqual(["canvas/delete"]);
    expect(lastDeleted[0].metadata.element_ids).toEqual(["last"]);
    const deleteUpload = buildIleWorkCanvasActionUploadItem("session-1", lastDeleted[0], 11);
    const tapDeleteUpload = buildTapWorkCanvasActionUploadItem("session-1", lastDeleted[0], 11);
    expect(deleteUpload?.toolName).toBe("canvas");
    expect(deleteUpload?.toolAction).toBe("delete");
    expect(JSON.parse(deleteUpload!.payload).action).toBe("delete");
    expect(tapDeleteUpload?.toolName).toBe(deleteUpload?.toolName);
    expect(tapDeleteUpload?.toolAction).toBe(deleteUpload?.toolAction);

    collector.reset(liveBoard);
    const lastErased = collector.observeScene(
      scene([{ ...liveRect, isDeleted: true }], { activeTool: { type: "eraser" } }),
    );
    expect(actionsOf(lastErased)).toEqual(["canvas/erase"]);
    const eraseUpload = buildIleWorkCanvasActionUploadItem("session-1", lastErased[0], 12);
    expect(eraseUpload?.toolAction).toBe("erase");
    expect(JSON.parse(eraseUpload!.payload).action).toBe("erase");
    expect(buildTapWorkCanvasActionUploadItem("session-1", lastErased[0], 12)?.toolAction).toBe(
      eraseUpload?.toolAction,
    );
  });

  it("ILE and TAP builders agree on the same classified events", () => {
    const rect = el("rectangle", "shared");
    const events = classifyIleWorkCanvasSceneDiff(emptyIleWorkCanvasScene(), scene([rect]));
    expect(events).toHaveLength(1);
    const tapEvents = classifyTapWorkCanvasSceneDiff(emptyIleWorkCanvasScene(), scene([rect]));
    expect(tapEvents).toEqual(events);

    const ile = buildIleWorkCanvasActionUploadItem("session-1", events[0], 99);
    const tap = buildTapWorkCanvasActionUploadItem("session-1", events[0], 99);
    expect(ile).not.toBeNull();
    expect(tap).not.toBeNull();
    expect(ile?.toolName).toBe(tap?.toolName);
    expect(ile?.toolAction).toBe(tap?.toolAction);
    expect(ile?.toolName).toBe("canvas");
    expect(ile?.toolAction).toBe("draw_rectangle");
    expect(JSON.parse(ile!.payload).action).toBe("draw_rectangle");
    expect(JSON.parse(tap!.payload).action).toBe("draw_rectangle");

    const ileAsk = buildIleWorkCanvasActionUploadItem(
      "session-1",
      buildIleWorkCanvasAskPowEvent("expand_more", { prompt: "Explain", selectedIds: ["shared"] })!,
      100,
    );
    const tapAsk = buildTapWorkCanvasActionUploadItem(
      "session-1",
      buildIleWorkCanvasAskPowEvent("expand_more", { prompt: "Explain", selectedIds: ["shared"] })!,
      100,
    );
    expect(ileAsk?.toolAction).toBe("expand_more");
    expect(tapAsk?.toolAction).toBe(ileAsk?.toolAction);
    expect(ileAsk?.toolName).toBe(tapAsk?.toolName);

    const mapped = buildTapExcalidrawToolUploadItem("session-1", { activeTool: "text", timestampMs: 1 });
    expect(mapped?.toolName).toBe("canvas");
    expect(mapped?.toolAction).toBe("draw_text");
  });
});

describe("Work-canvas PoW host wiring (shipped)", () => {
  it("ILE and TAP live canvases forward classified actions, not last-tool-type, and keep speech", () => {
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("onCanvasPowActions");
    expect(canvas).toContain("IleWorkCanvasPowCollector");
    expect(canvas).toContain("expandMore");
    expect(canvas).toContain("boardPrompt");
    expect(canvas).toContain("compressWork");
    expect(canvas).toContain("ileWorkCanvasGestureBusy");
    expect(canvas).not.toContain("lastEl && typeof lastEl.type");

    const ile = read("components/SessionView.tsx");
    expect(ile).toContain("handleCanvasPowActions");
    expect(ile).toContain("onCanvasPowActions={handleCanvasPowActions}");
    expect(ile).toContain("shouldLogIleSidebarToolSwitch");
    expect(ile).not.toContain("lastExcalidrawPowKeyRef");
    expect(ile).not.toContain("mapExcalidrawToolToIlePow");

    const tap = read("components/tap-score/tap-score-phases.tsx");
    expect(tap).toContain("handleCanvasPowActions");
    expect(tap).toContain("buildTapWorkCanvasActionUploadItem");
    expect(tap).toContain("tapWorkCanvasElementContentFingerprint");
    expect(tap).not.toContain("lastExcalidrawPowKeyRef");
    expect(tap).not.toContain("buildTapExcalidrawToolUploadItem");

    const runtime = read("components/session-view/use-session-runtime.ts");
    expect(runtime).not.toContain("buildIleNotebookUploadItem");
    expect(runtime).not.toContain("lastUploadedNotebookHashRef");
    expect(runtime).not.toContain("notebookPowDebounceRef");

    const ileSpeech = read("app/api/workspace-ile/speech/route.ts");
    const tapSpeech = read("app/api/workspace-tap-score/speech/route.ts");
    const ileSpeechClient = read("lib/ile-thought-traces.ts");
    const tapSpeechClient = read("lib/tap-speech-proof-of-work.ts");
    const tapSpeechHook = read("lib/useTapSpeechProofOfWork.ts");
    expect(ileSpeech).toContain("ILE_SPEECH_TOOL_NAME");
    expect(tapSpeech).toContain("TAP_SPEECH_TOOL_NAME");
    expect(ileSpeechClient).toContain(`"${ILE_SPEECH_TOOL_NAME}"`);
    expect(tapSpeechClient).toContain(`"${TAP_SPEECH_TOOL_NAME}"`);
    expect(tapSpeechHook).toContain("TAP_POW_API_PATHS.speech");
    expect(ileSpeech).toContain('event must be start or stop');
    expect(tapSpeech).toContain('event must be start or stop');

    writeScratch(
      "canvas-pow-wiring.log",
      [
        "ile=handleCanvasPowActions",
        "tap=buildTapWorkCanvasActionUploadItem",
        "no lastExcalidrawPowKeyRef",
        `ileSpeech=${ILE_SPEECH_TOOL_NAME}`,
        `tapSpeech=${TAP_SPEECH_TOOL_NAME}`,
      ].join("\n") + "\n",
    );
  });
});
