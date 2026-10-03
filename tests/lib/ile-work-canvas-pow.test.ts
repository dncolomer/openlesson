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
  ILE_SELECTIVE_COMPRESSION_LABEL,
  ILE_WORK_CANVAS_COMMANDS,
  ileWorkCanvasQuickActionPrompt,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import {
  buildIleWorkCanvasActionUploadItem,
  buildIleWorkCanvasAskPowEvent,
  buildIleWorkCanvasCommandPowEvent,
  classifyIleWorkCanvasSceneDiff,
  IleWorkCanvasPowCollector,
  ileWorkCanvasElementContentFingerprint,
  ILE_WORK_CANVAS_COMMAND_POW_IDS,
  ILE_WORK_CANVAS_POW_ACTIONS,
  ILE_WORK_CANVAS_POW_TOOL_NAME,
  mapExcalidrawToolToCanvasPow,
  shouldLogIleSidebarToolSwitch,
  type IleWorkCanvasPowEvent,
} from "@/lib/ile-work-canvas-pow";
import {
  buildIleCanvasUploadItem,
  buildIleExcalidrawToolUploadItem,
  buildIleNotebookUploadItem,
  buildIleToolEventUploadItem,
} from "@/lib/ile-realtime-pow";
import {
  buildTapCanvasSnapshotUploadItem,
  buildTapExcalidrawToolUploadItem,
  buildTapWorkCanvasActionUploadItem,
  buildTapWorkCanvasCommandPowEvent,
  buildTapWorkCanvasPowPostBody,
  classifyTapWorkCanvasSceneDiff,
} from "@/lib/tap-work-canvas";
import { ILE_SPEECH_TOOL_NAME, ILE_TRACE_TOOL_NAME } from "@/lib/ile-thought-traces";
import { TAP_SPEECH_TOOL_NAME } from "@/lib/tap-speech-proof-of-work";
import { TAP_TRACE_TOOL_NAME } from "@/lib/tap-score-traces";
import { POW_MODEL_VERSION } from "@/lib/pow-api/workspace-proof-of-work";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-3133c6a14ea7/implementer";

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
      "dictate",
      ...ILE_WORK_CANVAS_COMMAND_POW_IDS,
    ]);
    expect(distinct.size).toBe(ILE_WORK_CANVAS_POW_ACTIONS.length);
    expect([...ILE_WORK_CANVAS_COMMAND_POW_IDS]).toEqual(
      ILE_WORK_CANVAS_COMMANDS.map((command) => command.id),
    );

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

  it("keeps full prompt text on prompt rows and names each canvas command", () => {
    const longPrompt = `Keep every character of this canvas prompt. ${"detail ".repeat(40)}end.`;
    expect(longPrompt.length).toBeGreaterThan(160);
    expect(longPrompt.includes("…")).toBe(false);

    const selected = [el("text", "sel-1", { text: "heap parent" }), el("ellipse", "sel-2")];
    const collector = new IleWorkCanvasPowCollector();

    const board = collector.boardPrompt({ prompt: longPrompt });
    expect(board).toHaveLength(1);
    expect(board[0].toolName).toBe("canvas");
    expect(board[0].toolAction).toBe("board_prompt");
    expect(board[0].metadata.prompt).toBe(longPrompt);
    expect(board[0].metadata.command_id).toBeUndefined();
    const boardUpload = buildIleWorkCanvasActionUploadItem("session-1", board[0], 21);
    const boardPayload = JSON.parse(boardUpload!.payload) as {
      prompt?: string;
      action?: string;
      metadata?: { prompt?: string };
    };
    expect(boardUpload?.kind).toBe("tool");
    expect(boardPayload.action).toBe("board_prompt");
    expect(boardPayload.prompt).toBe(longPrompt);
    expect(boardPayload.metadata?.prompt).toBe(longPrompt);
    expect(boardUpload?.metadata?.prompt).toBe(longPrompt);

    const selection = collector.expandMore({
      prompt: longPrompt,
      selectedElements: selected,
    });
    expect(selection[0].toolAction).toBe("expand_more");
    expect(selection[0].metadata.prompt).toBe(longPrompt);
    expect(selection[0].metadata.element_ids).toEqual(["sel-1", "sel-2"]);
    expect(selection[0].metadata.element_types).toEqual(["text", "ellipse"]);
    expect(selection[0].metadata.count).toBe(2);
    expect(selection[0].metadata.command_id).toBeUndefined();
    const selectionUpload = buildIleWorkCanvasActionUploadItem("session-1", selection[0], 22);
    const selectionPayload = JSON.parse(selectionUpload!.payload) as {
      prompt?: string;
      element_ids?: string[];
      metadata?: { prompt?: string; element_ids?: string[] };
    };
    expect(selectionPayload.prompt).toBe(longPrompt);
    expect(selectionPayload.metadata?.prompt).toBe(longPrompt);
    expect(selectionPayload.element_ids).toEqual(["sel-1", "sel-2"]);
    const ileSelection = buildIleToolEventUploadItem("session-1", {
      toolName: selection[0].toolName,
      action: selection[0].toolAction,
      timestampMs: 22,
      metadata: selection[0].metadata,
    });
    expect(ileSelection.kind).toBe("tool");
    expect(ileSelection.toolName).toBe("canvas");
    expect(ileSelection.toolAction).toBe("expand_more");
    expect(ileSelection.metadata?.prompt).toBe(longPrompt);
    expect(JSON.parse(ileSelection.payload).metadata.prompt).toBe(longPrompt);

    const commandPrompts: Record<(typeof ILE_WORK_CANVAS_COMMAND_POW_IDS)[number], string> = {
      rephrase: ileWorkCanvasQuickActionPrompt("rephrase"),
      split: "split",
      join: "Join",
      elaborate: ileWorkCanvasQuickActionPrompt("elaborate more pls"),
      "selective-compression": ILE_SELECTIVE_COMPRESSION_LABEL,
      refactor: "Refactor",
      "suggest-insight": "Suggest Insight",
      "clear-overlaps": "Clear overlaps",
    };

    const catalogRows: string[] = [
      `stored_type=tool`,
      `pow_model=${POW_MODEL_VERSION}`,
    ];
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
    for (const type of drawTypes) {
      const drawn = classifyIleWorkCanvasSceneDiff(
        emptyIleWorkCanvasScene(),
        scene([el(type, `cat-${type}`)]),
      );
      expect(drawn[0].metadata.element_ids).toEqual([`cat-${type}`]);
      expect(drawn[0].metadata.element_types).toEqual([type]);
      expect(drawn[0].metadata.count).toBe(1);
      catalogRows.push(
        `${drawn[0].toolName}/${drawn[0].toolAction} element_ids=${drawn[0].metadata.element_ids} element_types=${drawn[0].metadata.element_types} count=${drawn[0].metadata.count}`,
      );
    }
    const rect = el("rectangle", "cat-rect", { x: 10, y: 10 });
    const before = scene([rect]);
    const deleted = classifyIleWorkCanvasSceneDiff(before, scene([]));
    const erased = classifyIleWorkCanvasSceneDiff(
      before,
      scene([], { activeTool: { type: "eraser" } }),
    );
    const moved = classifyIleWorkCanvasSceneDiff(before, scene([{ ...rect, x: 180, y: 40 }]));
    const rotated = classifyIleWorkCanvasSceneDiff(before, scene([{ ...rect, angle: 0.8 }]));
    const multi = classifyIleWorkCanvasSceneDiff(
      scene([el("rectangle", "a"), el("ellipse", "b")]),
      scene([el("rectangle", "a"), el("ellipse", "b")], {
        selectedElementIds: { a: true, b: true },
      }),
    );
    for (const event of [erased[0], deleted[0], moved[0], rotated[0], multi[0]]) {
      expect(event.toolName).toBe("canvas");
      expect(event.metadata.element_ids).toBeTruthy();
      expect(event.metadata.count).toBeGreaterThan(0);
      catalogRows.push(`${event.toolName}/${event.toolAction}`);
    }
    expect(
      classifyIleWorkCanvasSceneDiff(
        before,
        scene([rect], { zoom: { value: 3 }, scrollX: 40, scrollY: -12 }),
      ),
    ).toEqual([]);
    catalogRows.push("pan_zoom_scroll=");
    catalogRows.push(`canvas/board_prompt prompt=${longPrompt}`);
    catalogRows.push(`canvas/expand_more prompt=${longPrompt} element_ids=sel-1,sel-2`);

    for (const commandId of ILE_WORK_CANVAS_COMMAND_POW_IDS) {
      const prompt = commandPrompts[commandId];
      const events = collector.command(commandId, {
        prompt,
        selectedElements: selected,
      });
      expect(events).toHaveLength(1);
      expect(events[0].toolName).toBe("canvas");
      expect(events[0].toolAction).toBe(commandId);
      expect(events[0].toolAction).not.toBe("expand_more");
      expect(events[0].metadata.command_id).toBe(commandId);
      expect(events[0].metadata.prompt).toBe(prompt);
      expect(events[0].metadata.element_ids).toEqual(["sel-1", "sel-2"]);
      const ileItem = buildIleWorkCanvasActionUploadItem("session-1", events[0], 30);
      const tapItem = buildTapWorkCanvasActionUploadItem("session-1", events[0], 30);
      const tapEvent = buildTapWorkCanvasCommandPowEvent(commandId, {
        prompt,
        selectedIds: ["sel-1", "sel-2"],
      });
      expect(tapEvent?.toolAction).toBe(commandId);
      expect(ileItem?.toolAction).toBe(commandId);
      expect(tapItem?.toolAction).toBe(commandId);
      expect(ileItem?.kind).toBe("tool");
      const ileParsed = JSON.parse(ileItem!.payload) as {
        prompt?: string;
        command_id?: string;
        element_ids?: string[];
        action?: string;
        metadata?: { prompt?: string; command_id?: string; element_ids?: string[] };
      };
      expect(ileParsed.action).toBe(commandId);
      expect(ileParsed.prompt).toBe(prompt);
      expect(ileParsed.command_id).toBe(commandId);
      expect(ileParsed.element_ids).toEqual(["sel-1", "sel-2"]);
      expect(ileParsed.metadata?.prompt).toBe(prompt);
      expect(ileItem?.metadata?.prompt).toBe(prompt);
      const tapParsed = JSON.parse(tapItem!.payload) as { prompt?: string; command_id?: string };
      expect(tapParsed.prompt).toBe(prompt);
      expect(tapParsed.command_id).toBe(commandId);
      const post = buildTapWorkCanvasPowPostBody({
        workspaceId: "ws",
        tapSessionId: "session-1",
        item: tapItem!,
      });
      expect(post.tool_name).toBe("canvas");
      expect(post.tool_action).toBe(commandId);
      expect(post.metadata?.prompt).toBe(prompt);
      expect(post.metadata?.element_ids).toEqual(["sel-1", "sel-2"]);
      expect(post.metadata?.command_id).toBe(commandId);
      const posted = JSON.parse(Buffer.from(post.payload, "base64").toString("utf8")) as {
        prompt?: string;
        metadata?: { prompt?: string };
      };
      expect(posted.prompt).toBe(prompt);
      expect(posted.metadata?.prompt).toBe(prompt);
      const ileEvidence = buildIleToolEventUploadItem("session-1", {
        toolName: events[0].toolName,
        action: events[0].toolAction,
        timestampMs: 30,
        metadata: events[0].metadata,
      });
      expect(ileEvidence.toolAction).toBe(commandId);
      expect(ileEvidence.metadata?.prompt).toBe(prompt);
      expect(ileEvidence.metadata?.command_id).toBe(commandId);
      expect(JSON.parse(ileEvidence.payload).metadata.prompt).toBe(prompt);
      catalogRows.push(
        `canvas/${commandId} command_id=${commandId} prompt=${prompt} element_ids=sel-1,sel-2`,
      );
    }

    const longCommand = buildIleWorkCanvasCommandPowEvent("selective-compression", {
      prompt: longPrompt,
      selectedIds: ["sel-1", "sel-2"],
    });
    expect(longCommand?.metadata.prompt).toBe(longPrompt);
    const longCommandUpload = buildIleWorkCanvasActionUploadItem("session-1", longCommand!, 31);
    expect(JSON.parse(longCommandUpload!.payload).prompt).toBe(longPrompt);
    expect(longCommandUpload?.metadata?.prompt).toBe(longPrompt);
    expect(JSON.parse(longCommandUpload!.payload).metadata.prompt).toBe(longPrompt);

    const freeAsk = buildIleWorkCanvasAskPowEvent("expand_more", {
      prompt: ILE_SELECTIVE_COMPRESSION_LABEL,
      selectedIds: ["sel-1"],
    });
    const compress = buildIleWorkCanvasCommandPowEvent("selective-compression", {
      prompt: ILE_SELECTIVE_COMPRESSION_LABEL,
      selectedIds: ["sel-1"],
    });
    expect(freeAsk?.toolAction).toBe("expand_more");
    expect(compress?.toolAction).toBe("selective-compression");
    expect(compress?.toolAction).not.toBe(freeAsk?.toolAction);
    expect(compress?.metadata.command_id).toBe("selective-compression");
    expect(freeAsk?.metadata.command_id).toBeUndefined();
    expect(buildIleWorkCanvasCommandPowEvent("not-a-command", { prompt: "x" })).toBeNull();

    const voiceAndSpeech = [
      ILE_TRACE_TOOL_NAME,
      TAP_TRACE_TOOL_NAME,
      ILE_SPEECH_TOOL_NAME,
      TAP_SPEECH_TOOL_NAME,
      "thought_send",
    ];
    for (const name of voiceAndSpeech) {
      expect(ILE_WORK_CANVAS_POW_ACTIONS).not.toContain(name);
      expect(ILE_WORK_CANVAS_POW_TOOL_NAME).not.toBe(name);
      expect(mapExcalidrawToolToCanvasPow({ action: name })).toBeNull();
      expect(mapExcalidrawToolToCanvasPow({ activeTool: name })).toBeNull();
    }
    catalogRows.push(`voice=${ILE_TRACE_TOOL_NAME}`);
    catalogRows.push(`voice=${TAP_TRACE_TOOL_NAME}`);
    catalogRows.push(`speech=${ILE_SPEECH_TOOL_NAME}`);
    catalogRows.push(`speech=${TAP_SPEECH_TOOL_NAME}`);
    catalogRows.push("thought_action=thought_send");
    catalogRows.push(`canvas_action_set_excludes=${voiceAndSpeech.join(",")}`);
    const snapshot = buildTapCanvasSnapshotUploadItem("session-1", "{}", 1);
    const ileSnapshot = buildIleCanvasUploadItem("session-1", "{}", 1);
    expect(snapshot.toolName).toBe(ileSnapshot.toolName);
    expect(snapshot.toolAction).toBe(ileSnapshot.toolAction);
    expect(snapshot.kind).toBe("tool");
    catalogRows.push(`snapshot=${snapshot.toolName}/${snapshot.toolAction}`);

    writeScratch("canvas-pow-report.log", catalogRows.join("\n") + "\n");
  });
});

describe("Work-canvas PoW host wiring (shipped)", () => {
  it("ILE and TAP live canvases forward classified actions, not last-tool-type, and keep speech", () => {
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("onCanvasPowActions");
    expect(canvas).toContain("IleWorkCanvasPowCollector");
    expect(canvas).toContain("expandMore");
    expect(canvas).toContain("boardPrompt");
    expect(canvas).toContain(".command(");
    expect(canvas).not.toContain("compressWork");
    expect(canvas).not.toContain("emitExpand");
    expect(canvas).toContain("ileWorkCanvasGestureBusy");
    expect(canvas).not.toContain("lastEl && typeof lastEl.type");

    const quick = canvas.slice(
      canvas.indexOf("const handleQuickAction"),
      canvas.indexOf("const handleBoardAsk"),
    );
    expect(quick).toContain(".command(");
    expect(quick).not.toContain("expandMore");
    for (const commandId of ILE_WORK_CANVAS_COMMAND_POW_IDS) {
      expect(quick).toContain(`"${commandId}"`);
      expect(canvas).toContain(`handleQuickAction("${commandId}")`);
    }
    const boardAsk = canvas.slice(
      canvas.indexOf("const handleBoardAsk"),
      canvas.indexOf("const handleLearnMorePointerDown"),
    );
    expect(boardAsk).toContain("boardPrompt");
    expect(boardAsk).not.toContain(".slice(");

    const ile = read("components/SessionView.tsx");
    expect(ile).toContain("handleCanvasPowActions");
    expect(ile).toContain("onCanvasPowActions={handleCanvasPowActions}");
    expect(ile).toContain('logTool("canvas", event.toolAction as ToolAction, event.metadata)');
    expect(ile).toContain("shouldLogIleSidebarToolSwitch");
    expect(ile).not.toContain("lastExcalidrawPowKeyRef");
    expect(ile).not.toContain("mapExcalidrawToolToIlePow");

    const tap = read("components/tap-score/tap-score-phases.tsx");
    expect(tap).toContain("handleCanvasPowActions");
    expect(tap).toContain("buildTapWorkCanvasActionUploadItem");
    expect(tap).toContain("uploadTapWorkCanvasPow");
    expect(tap).toContain("onCanvasPowActions={handleCanvasPowActions}");
    expect(tap).toContain("tapWorkCanvasElementContentFingerprint");
    expect(tap).not.toContain("lastExcalidrawPowKeyRef");
    expect(tap).not.toContain("buildTapExcalidrawToolUploadItem");

    const preparePhases = read("components/scout-tap/scout-tap-phases.tsx");
    const prepareClient = read("components/scout-tap/ScoutTapClient.tsx");
    expect(preparePhases).not.toContain("onCanvasPowActions={() => {}}");
    expect(preparePhases).toContain("onCanvasPowActions={onCanvasPowActions}");
    expect(prepareClient).toContain("buildTapWorkCanvasActionUploadItem");
    expect(prepareClient).toContain("uploadTapWorkCanvasPow");
    expect(prepareClient).toContain("onCanvasPowActions={handleCanvasPowActions}");

    const tapUploader = read("lib/tap-work-canvas.ts");
    const tapRuntime = read("lib/tap-session-runtime.ts");
    expect(tapUploader).toContain("TAP_SESSION_RUNTIME_PATHS.canvas");
    expect(tapUploader).toContain("buildTapWorkCanvasPowPostBody");
    expect(tapRuntime).toContain('canvas: "/api/workspace-tap-score/canvas"');

    const tapCanvasRoute = read("app/api/workspace-tap-score/canvas/route.ts");
    const ilePowRoute = read("app/api/workspace/proof-of-work/route.ts");
    expect(tapCanvasRoute).toContain('type: "tool"');
    expect(tapCanvasRoute).toContain("tool_action: toolAction");
    expect(tapCanvasRoute).not.toContain("pow-model-v2");
    expect(tapCanvasRoute).not.toMatch(/prompt\.slice\(/);
    expect(ilePowRoute).toContain("tool_action: toolAction");
    expect(ilePowRoute).not.toContain("pow-model-v2");
    expect(POW_MODEL_VERSION).toBe("pow-model-v1");

    const runtime = read("components/session-view/use-session-runtime.ts");
    expect(runtime).toContain("powSessionEnabledRef.current");
    expect(runtime).toContain("buildIleToolEventUploadItem");
    expect(runtime).toContain("uploadPowItem");
    expect(runtime).not.toContain("buildIleNotebookUploadItem");
    expect(runtime).not.toContain("lastUploadedNotebookHashRef");
    expect(runtime).not.toContain("notebookPowDebounceRef");

    const ileSpeech = read("app/api/workspace-ile/speech/route.ts");
    const tapSpeech = read("app/api/workspace-tap-score/speech/route.ts");
    const ileTraceClient = read("components/session-view/use-session-speech.ts");
    const tapTrace = read("app/api/workspace-tap-score/trace/route.ts");
    const ileSpeechClient = read("lib/ile-thought-traces.ts");
    const tapSpeechClient = read("lib/tap-speech-proof-of-work.ts");
    const tapTraceClient = read("lib/tap-score-traces.ts");
    const tapSpeechHook = read("lib/useTapSpeechProofOfWork.ts");
    expect(ileSpeech).toContain("ILE_SPEECH_TOOL_NAME");
    expect(tapSpeech).toContain("TAP_SPEECH_TOOL_NAME");
    expect(ileSpeechClient).toContain(`"${ILE_SPEECH_TOOL_NAME}"`);
    expect(ileSpeechClient).toContain(`"${ILE_TRACE_TOOL_NAME}"`);
    expect(tapSpeechClient).toContain(`"${TAP_SPEECH_TOOL_NAME}"`);
    expect(tapTraceClient).toContain(`"${TAP_TRACE_TOOL_NAME}"`);
    expect(ileTraceClient).toContain("ILE_TRACE_TOOL_NAME");
    expect(tapTrace).toContain("TAP_TRACE_TOOL_NAME");
    expect(tapSpeechHook).toContain("TAP_POW_API_PATHS.speech");
    expect(ileSpeech).toContain('event must be start or stop');
    expect(tapSpeech).toContain('event must be start or stop');

    writeScratch(
      "canvas-pow-wiring.log",
      [
        "ile=handleCanvasPowActions->logTool->buildIleToolEventUploadItem",
        "tap=buildTapWorkCanvasActionUploadItem->POST /api/workspace-tap-score/canvas",
        "prepare=ScoutTapClient handleCanvasPowActions->uploadTapWorkCanvasPow",
        "no empty onCanvasPowActions",
        `voice=${ILE_TRACE_TOOL_NAME},${TAP_TRACE_TOOL_NAME}`,
        `speech=${ILE_SPEECH_TOOL_NAME},${TAP_SPEECH_TOOL_NAME}`,
        `pow_model=${POW_MODEL_VERSION}`,
      ].join("\n") + "\n",
    );
  });
});
