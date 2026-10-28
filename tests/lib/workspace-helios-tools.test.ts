import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HELIOS_MAP_TOOL_CATALOG,
  HELIOS_MAP_TOOL_IDS,
  applyHeliosMapToolsAtomically,
  dispatchHeliosMapTool,
  executeHeliosMapToolCall,
  formatHeliosMapSnapshotForPrompt,
  heliosMapSnapshotFromBlocks,
  heliosMapSnapshotFromUnknown,
  heliosMapSnapshotToAuthoringNodes,
  isHeliosMapToolId,
  nextOpenHeliosCell,
  parseHeliosMapChatModelTurn,
  parseHeliosMapToolCall,
  heliosBridgeWidthFromArgs,
  type HeliosMapSnapshot,
  type HeliosMapToolHost,
} from "@/lib/workspace-helios-tools";
import { isUnusableCell } from "@/lib/map-ground-rules";
import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";
import { parseBlockCreatorEffects } from "@/lib/block-creator-effects";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-630c02a0abfd/implementer";

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function emptySnap(): HeliosMapSnapshot {
  return heliosMapSnapshotFromBlocks({ blocks: [], unusableCells: [] });
}

function block(
  id: string,
  x: number,
  y: number,
  extra?: Partial<HeliosMapSnapshot["blocks"][number]>,
): HeliosMapSnapshot["blocks"][number] {
  return {
    id,
    title: extra?.title ?? id,
    description: extra?.description ?? "",
    position_x: x,
    position_y: y,
    span_w: extra?.span_w ?? 1,
    span_h: extra?.span_h ?? 1,
    shape_cells: extra?.shape_cells ?? null,
    next_block_ids: extra?.next_block_ids ?? [],
    lock_until_block_ids: extra?.lock_until_block_ids ?? [],
    creator_effects: extra?.creator_effects,
  };
}

describe("Helios map tool catalog + dispatch", () => {
  it("splits catalog, snapshot, dispatch, and persist under the barrel", () => {
    const root = join(__dirname, "../..");
    const barrel = readFileSync(join(root, "lib/workspace-helios-tools.ts"), "utf8");
    const catalog = readFileSync(
      join(root, "lib/workspace-helios-tools/catalog.ts"),
      "utf8",
    );
    const snapshot = readFileSync(
      join(root, "lib/workspace-helios-tools/snapshot.ts"),
      "utf8",
    );
    const dispatch = readFileSync(
      join(root, "lib/workspace-helios-tools/dispatch.ts"),
      "utf8",
    );
    const persist = readFileSync(
      join(root, "lib/workspace-helios-tools/persist.ts"),
      "utf8",
    );
    for (const src of [barrel, catalog, snapshot, dispatch, persist]) {
      expect(src.split("\n").length).toBeLessThanOrEqual(1100);
    }
    expect(barrel).toContain('from "./workspace-helios-tools/catalog"');
    expect(barrel).toContain('from "./workspace-helios-tools/snapshot"');
    expect(barrel).toContain('from "./workspace-helios-tools/dispatch"');
    expect(barrel).toContain('from "./workspace-helios-tools/persist"');
    expect(catalog).toContain("export const HELIOS_MAP_TOOL_CATALOG");
    expect(snapshot).toContain("export function heliosMapSnapshotFromUnknown");
    expect(dispatch).toContain("export function dispatchHeliosMapTool");
    expect(dispatch).not.toContain("export async function executeHeliosMapToolCall");
    expect(persist).toContain("export async function executeHeliosMapToolCall");
    expect(persist).toContain("export async function applyHeliosMapToolsAtomically");
    expect(persist).toContain(
      "const preview = dispatchHeliosMapTool(input.snapshot, input.call)",
    );
    expect(persist).toContain("host.applySnapshot?.(preview.snapshot)");
    expect(persist).toContain("preview.snapshot");
    expect(persist).not.toContain("export function dispatchHeliosMapTool");
  });

  it("catalog covers Manual authoring families and every id dispatches", () => {
    const families = new Set(HELIOS_MAP_TOOL_CATALOG.map((t) => t.family));
    expect(families.has("topologies")).toBe(true);
    expect(families.has("unusable")).toBe(true);
    expect(families.has("generative")).toBe(true);
    expect(families.has("dag")).toBe(true);
    expect(families.has("overlay")).toBe(true);
    for (const id of HELIOS_MAP_TOOL_IDS) {
      expect(isHeliosMapToolId(id)).toBe(true);
      expect(HELIOS_MAP_TOOL_CATALOG.some((t) => t.id === id)).toBe(true);
    }
    expect(parseHeliosMapToolCall({ name: "add_block", arguments: { row: 0, col: 1 } })).toEqual({
      name: "add_block",
      args: { row: 0, col: 1 },
    });
    expect(
      parseHeliosMapToolCall({
        name: "add_block",
        arguments: JSON.stringify({ title: "Alpha", row: 2, col: 3 }),
      }),
    ).toEqual({
      name: "add_block",
      args: { title: "Alpha", row: 2, col: 3 },
    });
    expect(
      parseHeliosMapToolCall({
        name: "add_block",
        title: "From top level",
      })?.args,
    ).toMatchObject({ title: "From top level" });
  });

  it("add_block without a cell uses the next open tile; apply_dag chains current blocks", () => {
    const first = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { title: "Start", id: "a" },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.snapshot.blocks[0]).toMatchObject({
      id: "a",
      title: "Start",
      position_x: 0,
      position_y: 0,
    });

    const second = dispatchHeliosMapTool(first.snapshot, {
      name: "add_block",
      args: { title: "Next", id: "b" },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.snapshot.blocks).toHaveLength(2);
    expect(second.snapshot.blocks[1]).toMatchObject({
      id: "b",
      title: "Next",
    });
    expect(
      `${second.snapshot.blocks[1].position_y}:${second.snapshot.blocks[1].position_x}`,
    ).not.toBe("0:0");

    const xy = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { title: "XY", id: "xy", x: 4, y: 5 },
    });
    expect(xy.ok).toBe(true);
    if (!xy.ok) return;
    expect(xy.snapshot.blocks[0]).toMatchObject({
      position_x: 4,
      position_y: 5,
    });

    const dag = dispatchHeliosMapTool(second.snapshot, {
      name: "apply_dag",
      args: {},
    });
    expect(dag.ok).toBe(true);
    if (!dag.ok) return;
    const start = dag.snapshot.blocks.find((b) => b.id === "a");
    expect(start?.next_block_ids).toEqual(["b"]);

    const offset = heliosMapSnapshotFromBlocks({
      blocks: [block("away", 3, 2)],
    });
    expect(nextOpenHeliosCell(offset)).toEqual({ row: 0, col: 0 });
    const filledOrigin = dispatchHeliosMapTool(offset, {
      name: "add_block",
      args: { title: "Home", id: "home" },
    });
    expect(filledOrigin.ok).toBe(true);
    if (!filledOrigin.ok) return;
    expect(filledOrigin.snapshot.blocks.find((b) => b.id === "home")).toMatchObject(
      {
        position_x: 0,
        position_y: 0,
      },
    );

    const board = formatHeliosMapSnapshotForPrompt(second.snapshot);
    expect(board).toMatch(/CURRENT MAP/);
    expect(board).toMatch(/ORIGIN: row 0, col 0/);
    expect(board).toMatch(/OCCUPIED CELLS:/);
    expect(board).toMatch(/NEXT OPEN CELL:/);
    expect(board).toContain('"Start"');
    expect(heliosMapSnapshotFromUnknown({
      blocks: [{ id: "live", title: "Live", position_x: 1, position_y: 2 }],
      unusableCells: [{ row: 9, col: 9 }],
    })?.blocks[0]).toMatchObject({
      id: "live",
      position_x: 1,
      position_y: 2,
    });
  });

  it("add_block and generate_shape place topologies; unusable, generative, and DAG mutate", () => {
    const added = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { row: 0, col: 0, title: "Alpha", id: "a" },
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.snapshot.blocks).toHaveLength(1);
    expect(added.snapshot.blocks[0]).toMatchObject({
      id: "a",
      title: "Alpha",
      position_x: 0,
      position_y: 0,
    });

    const shaped = dispatchHeliosMapTool(emptySnap(), {
      name: "generate_shape",
      args: {
        cells: [
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
        title: "Shape",
        id: "shape-1",
      },
    });
    expect(shaped.ok).toBe(true);
    if (!shaped.ok) return;
    expect(shaped.snapshot.blocks).toHaveLength(1);
    expect(shaped.snapshot.blocks[0].id).toBe("shape-1");
    expect(shaped.snapshot.blocks[0].span_w).toBe(2);
    expect(shaped.snapshot.blocks[0].span_h).toBe(1);

    const occupied = dispatchHeliosMapTool(added.snapshot, {
      name: "add_block",
      args: { row: 0, col: 0, title: "Nope" },
    });
    expect(occupied.ok).toBe(false);

    const unusable = dispatchHeliosMapTool(emptySnap(), {
      name: "mark_unusable",
      args: { cells: [{ row: 4, col: 5 }] },
    });
    expect(unusable.ok).toBe(true);
    if (!unusable.ok) return;
    expect(isUnusableCell(unusable.snapshot.unusableCells, 4, 5)).toBe(true);
    const blocked = dispatchHeliosMapTool(unusable.snapshot, {
      name: "add_block",
      args: { row: 4, col: 5, title: "Blocked" },
    });
    expect(blocked.ok).toBe(false);

    const pair = heliosMapSnapshotFromBlocks({
      blocks: [block("src", 0, 0), block("dep", 2, 0)],
    });
    const dynamic = dispatchHeliosMapTool(pair, {
      name: "set_dynamic_effect",
      args: {
        blockId: "src",
        enabled: true,
        unlockAfterBlockIds: ["dep"],
      },
    });
    expect(dynamic.ok).toBe(true);
    if (!dynamic.ok) return;
    const dynFx = parseBlockCreatorEffects(
      dynamic.snapshot.blocks.find((b) => b.id === "src")?.creator_effects,
      { selfBlockId: "src" },
    );
    expect(dynFx.dynamic.enabled).toBe(true);
    expect(dynFx.dynamic.unlockAfterBlockIds).toEqual(["dep"]);

    const generator = dispatchHeliosMapTool(pair, {
      name: "set_generator_effect",
      args: {
        blockId: "src",
        enabled: true,
        targetCells: [{ row: 8, col: 8 }],
      },
    });
    expect(generator.ok).toBe(true);
    if (!generator.ok) return;
    const genFx = parseBlockCreatorEffects(
      generator.snapshot.blocks.find((b) => b.id === "src")?.creator_effects,
      { selfBlockId: "src" },
    );
    expect(genFx.generator.enabled).toBe(true);
    expect(genFx.generator.targetCells).toEqual([{ row: 8, col: 8 }]);

    const dag = dispatchHeliosMapTool(pair, {
      name: "apply_dag",
      args: {
        blockIds: ["src", "dep"],
        edges: [{ from: "src", to: "dep", kind: "next" }],
      },
    });
    expect(dag.ok).toBe(true);
    if (!dag.ok) return;
    const src = dag.snapshot.blocks.find((b) => b.id === "src");
    const dep = dag.snapshot.blocks.find((b) => b.id === "dep");
    expect(src?.next_block_ids).toEqual(["dep"]);
    expect(dep?.lock_until_block_ids).toEqual(["src"]);

    writeEvidence(
      "helios-map-tools.log",
      [
        "add=" + added.snapshot.blocks.map((b) => b.id).join(","),
        "shape=" +
          JSON.stringify({
            id: shaped.snapshot.blocks[0].id,
            span_w: shaped.snapshot.blocks[0].span_w,
            span_h: shaped.snapshot.blocks[0].span_h,
          }),
        "unusable=" +
          JSON.stringify(unusable.snapshot.unusableCells),
        "dynamic=" + JSON.stringify(dynFx.dynamic),
        "generator=" + JSON.stringify(genFx.generator),
        "dagNext=" + JSON.stringify(src?.next_block_ids),
        "dagLock=" + JSON.stringify(dep?.lock_until_block_ids),
        "atomicApply=applyHeliosMapToolsAtomically",
      ].join("\n"),
    );
  });

  it("combine, split, clone, expand, bridge, cluster, edit, and delete apply", () => {
    const two = heliosMapSnapshotFromBlocks({
      blocks: [block("a", 0, 0, { title: "A" }), block("b", 1, 0, { title: "B" })],
    });
    const combined = dispatchHeliosMapTool(two, {
      name: "combine_blocks",
      args: { blockIds: ["a", "b"], title: "AB" },
    });
    expect(combined.ok).toBe(true);
    if (!combined.ok) return;
    expect(combined.snapshot.blocks).toHaveLength(1);
    expect(combined.snapshot.blocks[0].id).toBe("a");
    expect(combined.snapshot.blocks[0].span_w).toBe(2);

    const wide = heliosMapSnapshotFromBlocks({
      blocks: [block("wide", 0, 0, { span_w: 2, span_h: 1, title: "Wide" })],
    });
    const split = dispatchHeliosMapTool(wide, {
      name: "split_block",
      args: { blockId: "wide" },
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(split.snapshot.blocks.length).toBe(2);
    expect(split.snapshot.blocks.every((b) => (b.span_w ?? 1) === 1)).toBe(true);

    const cloned = dispatchHeliosMapTool(two, {
      name: "clone_block",
      args: { blockId: "a", row: 3, col: 3 },
    });
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;
    expect(cloned.snapshot.blocks).toHaveLength(3);
    expect(cloned.snapshot.blocks.some((b) => b.position_x === 3 && b.position_y === 3)).toBe(
      true,
    );

    const expanded = dispatchHeliosMapTool(
      heliosMapSnapshotFromBlocks({ blocks: [block("src", 10, 10)] }),
      {
        name: "expand_block",
        args: { blockId: "src", range: 1, density: 100, seed: 1 },
      },
    );
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    expect(expanded.snapshot.blocks.length).toBeGreaterThan(1);

    expect(heliosBridgeWidthFromArgs({})).toBe(0);
    expect(heliosBridgeWidthFromArgs({ thickness: 1 })).toBe(0);
    expect(heliosBridgeWidthFromArgs({ density: 100 })).toBe(0);
    expect(heliosBridgeWidthFromArgs({ width: 2 })).toBe(2);

    const pair = heliosMapSnapshotFromBlocks({
      blocks: [block("left", 0, 0), block("right", 0, 4)],
    });
    const bridged = dispatchHeliosMapTool(pair, {
      name: "bridge_blocks",
      args: { blockIds: ["left", "right"], density: 100 },
    });
    expect(bridged.ok).toBe(true);
    if (!bridged.ok) return;
    const added = bridged.snapshot.blocks.filter(
      (b) => b.id !== "left" && b.id !== "right",
    );
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((b) => b.position_x === 0)).toBe(true);

    const thick = dispatchHeliosMapTool(pair, {
      name: "bridge_blocks",
      args: { blockIds: ["left", "right"], density: 100, width: 2 },
    });
    expect(thick.ok).toBe(true);
    if (!thick.ok) return;
    expect(thick.snapshot.blocks.length).toBeGreaterThan(
      bridged.snapshot.blocks.length,
    );

    const clustered = dispatchHeliosMapTool(
      heliosMapSnapshotFromBlocks({
        blocks: [
          block("c1", 0, 0, { title: "Alpha theory" }),
          block("c2", 1, 0, { title: "Alpha practice" }),
          block("c3", 0, 1, { title: "Beta theory" }),
          block("c4", 1, 1, { title: "Beta practice" }),
        ],
      }),
      {
        name: "cluster_blocks",
        args: { blockIds: ["c1", "c2", "c3", "c4"], clusterCount: 2 },
      },
    );
    expect(clustered.ok).toBe(true);
    if (!clustered.ok) return;
    expect(clustered.snapshot.blocks).toHaveLength(4);

    const edited = dispatchHeliosMapTool(two, {
      name: "edit_block",
      args: { blockId: "a", title: "Renamed", description: "new" },
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.snapshot.blocks.find((b) => b.id === "a")?.title).toBe("Renamed");

    const deleted = dispatchHeliosMapTool(two, {
      name: "delete_block",
      args: { blockId: "b" },
    });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.snapshot.blocks.map((b) => b.id)).toEqual(["a"]);
  });

  it("executeHeliosMapToolCall runs dispatch then the Manual host persist path", async () => {
    const calls: string[] = [];
    const snap = emptySnap();
    const result = await executeHeliosMapToolCall({
      snapshot: snap,
      call: { name: "add_block", args: { row: 2, col: 2, title: "Hosted" } },
      host: {
        applySnapshot: (painted) => {
          calls.push(`paint:${painted.blocks.length}`);
        },
        addBlock: async ({ prompt, cell }) => {
          calls.push(`${prompt}@${cell.row}:${cell.col}`);
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["paint:1", "Hosted@2:2"]);
    const parsed = parseHeliosMapChatModelTurn({
      reply: "Placed it.",
      toolCalls: [{ name: "mark_unusable", arguments: { cells: [{ row: 1, col: 1 }] } }],
    });
    expect(parsed.reply).toBe("Placed it.");
    expect(parsed.toolCalls[0]?.name).toBe("mark_unusable");
  });

  it("executeHeliosMapToolCall persists apply_dag from the dispatch preview chain", async () => {
    const first = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { title: "Start", id: "a" },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = dispatchHeliosMapTool(first.snapshot, {
      name: "add_block",
      args: { title: "Next", id: "b" },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const preview = dispatchHeliosMapTool(second.snapshot, {
      name: "apply_dag",
      args: {},
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.snapshot.blocks.find((b) => b.id === "a")?.next_block_ids).toEqual(
      ["b"],
    );

    const dagDrafts: Array<{
      blockIds: string[];
      edges: Array<{ from: string; to: string; kind: "next" | "lock" }>;
    }> = [];
    const result = await executeHeliosMapToolCall({
      snapshot: second.snapshot,
      call: { name: "apply_dag", args: {} },
      host: {
        applySnapshot: () => {},
        applyDag: async ({ dagDraft }) => {
          dagDrafts.push(dagDraft);
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(dagDrafts).toHaveLength(1);
    expect(dagDrafts[0].blockIds).toEqual(["a", "b"]);
    expect(dagDrafts[0].edges).toEqual(
      expect.arrayContaining([{ from: "a", to: "b", kind: "next" }]),
    );
    const persistedNext = dagDrafts[0].edges
      .filter((e) => e.kind === "next" && e.from === "a")
      .map((e) => e.to);
    expect(persistedNext).toEqual(
      preview.snapshot.blocks.find((b) => b.id === "a")?.next_block_ids,
    );
  });

  it("executeHeliosMapToolCall apply_dag persist keeps the dispatch subset, not the full map", async () => {
    const snap = heliosMapSnapshotFromBlocks({
      blocks: [
        block("a", 0, 0),
        block("b", 1, 0),
        block("out", 5, 5, { lock_until_block_ids: ["a"] }),
      ],
    });
    const call = {
      name: "apply_dag" as const,
      args: { blockIds: ["a", "b"] },
    };
    const preview = dispatchHeliosMapTool(snap, call);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.snapshot.blocks.find((b) => b.id === "a")?.next_block_ids).toEqual(
      ["b"],
    );
    expect(
      preview.snapshot.blocks.find((b) => b.id === "out")?.lock_until_block_ids,
    ).toEqual(["a"]);

    const dagDrafts: Array<{
      blockIds: string[];
      edges: Array<{ from: string; to: string; kind: "next" | "lock" }>;
    }> = [];
    const result = await executeHeliosMapToolCall({
      snapshot: snap,
      call,
      host: {
        applySnapshot: () => {},
        applyDag: async ({ dagDraft }) => {
          dagDrafts.push(dagDraft);
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(dagDrafts).toHaveLength(1);
    expect(dagDrafts[0].blockIds).toEqual(["a", "b"]);
    expect(dagDrafts[0].blockIds).not.toContain("out");
    expect(dagDrafts[0].edges.every((e) => e.kind === "next")).toBe(true);
    expect(dagDrafts[0].edges).toEqual(
      expect.arrayContaining([{ from: "a", to: "b", kind: "next" }]),
    );
  });

  it("executeHeliosMapToolCall repaints the pre-call snapshot when host persist throws", async () => {
    const snap = emptySnap();
    const paints: HeliosMapSnapshot[] = [];
    const result = await executeHeliosMapToolCall({
      snapshot: snap,
      call: { name: "add_block", args: { row: 2, col: 2, title: "Hosted" } },
      host: {
        applySnapshot: (painted) => {
          paints.push(painted);
        },
        addBlock: async () => {
          throw new Error("persist_failed");
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("persist_failed");
    expect(result.snapshot).toBe(snap);
    expect(paints).toHaveLength(2);
    expect(paints[0].blocks).toHaveLength(1);
    expect(paints[1]).toBe(snap);
  });

  it("executeHeliosMapToolCall expand/bridge frozen slots match the dispatch preview", async () => {
    const expandSource = heliosMapSnapshotFromBlocks({
      blocks: [block("src", 10, 10)],
    });
    const expandCall = {
      name: "expand_block" as const,
      args: { blockId: "src", range: 1, density: 100, seed: 1 },
    };
    const expandPreview = dispatchHeliosMapTool(expandSource, expandCall);
    expect(expandPreview.ok).toBe(true);
    if (!expandPreview.ok) return;
    const expandSlots: Array<Array<{ row: number; col: number }>> = [];
    const expanded = await executeHeliosMapToolCall({
      snapshot: expandSource,
      call: expandCall,
      host: {
        applySnapshot: () => {},
        expandBlock: async ({ frozenSlots }) => {
          expandSlots.push(frozenSlots);
        },
      },
    });
    expect(expanded.ok).toBe(true);
    const expandPrevIds = new Set(expandSource.blocks.map((b) => b.id));
    expect(expandSlots[0]).toEqual(
      expandPreview.snapshot.blocks
        .filter((b) => !expandPrevIds.has(b.id))
        .map((b) => ({ row: b.position_y, col: b.position_x })),
    );

    const pair = heliosMapSnapshotFromBlocks({
      blocks: [block("left", 0, 0), block("right", 0, 4)],
    });
    const bridgeCall = {
      name: "bridge_blocks" as const,
      args: { blockIds: ["left", "right"], density: 100 },
    };
    const bridgePreview = dispatchHeliosMapTool(pair, bridgeCall);
    expect(bridgePreview.ok).toBe(true);
    if (!bridgePreview.ok) return;
    const bridgeSlots: Array<Array<{ row: number; col: number }>> = [];
    const bridged = await executeHeliosMapToolCall({
      snapshot: pair,
      call: bridgeCall,
      host: {
        applySnapshot: () => {},
        generateBridge: async ({ frozenSlots }) => {
          bridgeSlots.push(frozenSlots);
        },
      },
    });
    expect(bridged.ok).toBe(true);
    const bridgePrevIds = new Set(pair.blocks.map((b) => b.id));
    expect(bridgeSlots[0]).toEqual(
      bridgePreview.snapshot.blocks
        .filter((b) => !bridgePrevIds.has(b.id))
        .map((b) => ({ row: b.position_y, col: b.position_x })),
    );
  });

  it("overlay persist uses host save methods when present and stays paint-only otherwise", async () => {
    const savedNotes: HeliosMapSnapshot["notes"][] = [];
    const savedLayers: HeliosMapSnapshot["annotationLayers"][] = [];
    const paints: number[] = [];
    const withSave = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: { name: "add_note", args: { body: "Remember the fork", row: 1, col: 2, id: "fork" } },
      host: {
        applySnapshot: (snap) => {
          paints.push(snap.notes.length);
        },
        saveNotes: (notes) => {
          savedNotes.push(notes);
        },
      },
    });
    expect(withSave.ok).toBe(true);
    expect(savedNotes).toHaveLength(1);
    expect(savedNotes[0][0]?.body).toBe("Remember the fork");
    expect(paints).toEqual([1]);

    const layerPaints: number[] = [];
    const withLayerSave = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: { name: "add_drawing_layer", args: { name: "Routes", id: "routes" } },
      host: {
        applySnapshot: (snap) => {
          layerPaints.push(snap.annotationLayers.length);
        },
        saveAnnotationLayers: (layers) => {
          savedLayers.push(layers);
        },
      },
    });
    expect(withLayerSave.ok).toBe(true);
    expect(savedLayers).toHaveLength(1);
    expect(savedLayers[0][0]?.name).toBe("Routes");
    expect(layerPaints).toEqual([1]);

    const paintOnly: string[] = [];
    const omitted = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: { name: "add_note", args: { body: "Local only", row: 0, col: 0, id: "local" } },
      host: {
        applySnapshot: () => {
          paintOnly.push("paint");
        },
      } satisfies HeliosMapToolHost,
    });
    expect(omitted.ok).toBe(true);
    expect(paintOnly).toEqual(["paint"]);
    expect(savedNotes).toHaveLength(1);
  });

  it("applyHeliosMapToolsAtomically paints each tool on the map before the next", async () => {
    const paints: Array<{ blocks: number; unusable: number }> = [];
    const steps: string[] = [];
    const applied = await applyHeliosMapToolsAtomically({
      snapshot: emptySnap(),
      calls: [
        { name: "add_block", args: { row: 0, col: 0, id: "a", title: "A" } },
        { name: "add_block", args: { row: 0, col: 1, id: "b", title: "B" } },
        { name: "mark_unusable", args: { cells: [{ row: 2, col: 2 }] } },
      ],
      host: {
        applySnapshot: (snap) => {
          paints.push({
            blocks: snap.blocks.length,
            unusable: snap.unusableCells.length,
          });
        },
      },
      onStep: (step) => {
        steps.push(
          step.result.ok ? step.result.message : step.result.error,
        );
      },
    });
    expect(applied.snapshot.blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(applied.snapshot.unusableCells).toEqual([{ row: 2, col: 2 }]);
    expect(paints).toEqual([
      { blocks: 1, unusable: 0 },
      { blocks: 2, unusable: 0 },
      { blocks: 2, unusable: 1 },
    ]);
    expect(steps).toEqual(["placed:a", "placed:b", "unusable:1"]);
    const nodes = heliosMapSnapshotToAuthoringNodes(applied.snapshot, [
      { id: "a", is_start: true, status: "ready" },
    ]);
    expect(nodes[0]).toMatchObject({
      id: "a",
      is_start: true,
      status: "ready",
      position_x: 0,
      position_y: 0,
    });
    expect(nodes[1]).toMatchObject({ id: "b", title: "B", is_start: false });
  });

  it("add_note and drawing-layer tools mutate overlay atomically", async () => {
    const note = dispatchHeliosMapTool(emptySnap(), {
      name: "add_note",
      args: { body: "Remember the fork", row: 1, col: 2, id: "fork" },
    });
    expect(note.ok).toBe(true);
    if (!note.ok) return;
    expect(note.snapshot.notes).toHaveLength(1);
    expect(note.snapshot.notes[0].body).toBe("Remember the fork");
    expect(note.snapshot.notes[0].source).toBe("creator");
    expect(note.snapshot.notes[0].x).toBe(2 * SKILL_GRID_PITCH);
    expect(note.snapshot.notes[0].y).toBe(1 * SKILL_GRID_PITCH);

    const edited = dispatchHeliosMapTool(note.snapshot, {
      name: "edit_note",
      args: { noteId: note.snapshot.notes[0].id, body: "Fork first" },
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.snapshot.notes[0].body).toBe("Fork first");

    const layer = dispatchHeliosMapTool(edited.snapshot, {
      name: "add_drawing_layer",
      args: { name: "Routes", id: "routes" },
    });
    expect(layer.ok).toBe(true);
    if (!layer.ok) return;
    expect(layer.snapshot.annotationLayers).toHaveLength(1);
    expect(layer.snapshot.annotationLayers[0].name).toBe("Routes");

    const layerId = layer.snapshot.annotationLayers[0].id;
    const drew = dispatchHeliosMapTool(layer.snapshot, {
      name: "draw_on_layer",
      args: {
        layerId,
        kind: "circle",
        row: 1,
        col: 2,
      },
    });
    expect(drew.ok).toBe(true);
    if (!drew.ok) return;
    expect(drew.snapshot.annotationLayers[0].strokes).toHaveLength(1);
    expect(drew.snapshot.annotationLayers[0].strokes[0].kind).toBe("circle");

    const square = dispatchHeliosMapTool(drew.snapshot, {
      name: "draw_on_layer",
      args: {
        layerId,
        kind: "square",
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
      },
    });
    expect(square.ok).toBe(true);
    if (!square.ok) return;
    expect(square.snapshot.annotationLayers[0].strokes).toHaveLength(2);

    const paints: number[] = [];
    const applied = await applyHeliosMapToolsAtomically({
      snapshot: emptySnap(),
      calls: [
        { name: "add_note", args: { body: "A", row: 0, col: 0, id: "a" } },
        { name: "add_drawing_layer", args: { name: "Ink", id: "ink" } },
      ],
      host: {
        applySnapshot: (snap) => {
          paints.push(snap.notes.length + snap.annotationLayers.length);
        },
      },
    });
    expect(applied.snapshot.notes).toHaveLength(1);
    expect(applied.snapshot.annotationLayers).toHaveLength(1);
    expect(paints).toEqual([1, 2]);

    const goneNote = dispatchHeliosMapTool(edited.snapshot, {
      name: "delete_note",
      args: { noteId: edited.snapshot.notes[0].id },
    });
    expect(goneNote.ok).toBe(true);
    if (!goneNote.ok) return;
    expect(goneNote.snapshot.notes).toHaveLength(0);

    const goneLayer = dispatchHeliosMapTool(layer.snapshot, {
      name: "delete_drawing_layer",
      args: { layerId },
    });
    expect(goneLayer.ok).toBe(true);
    if (!goneLayer.ok) return;
    expect(goneLayer.snapshot.annotationLayers).toHaveLength(0);
  });
});
