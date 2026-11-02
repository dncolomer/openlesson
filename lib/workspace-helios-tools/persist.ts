/**
 * Helios Learning Map persist: paint the dispatched snapshot, then run
 * Manual host APIs from preview.snapshot. Distinct from pure dispatch.
 */

import {
  parseBlockCreatorEffects,
  type BlockCreatorEffects,
} from "@/lib/block-creator-effects";
import type { AnnotationLayer } from "@/lib/map-annotation-layers";
import type { LearnerMapNote } from "@/lib/learner-map-notes";
import { draftMultiBlockDag, type MultiBlockDagDraft } from "@/lib/multi-block-dag";
import {
  parseMapBlockAttachment,
  authoringMapBlockKindTemplate,
  type MapBlock,
  type MapBlockAttachment,
} from "@/lib/block-kind";
import {
  heliosFlowCreateInput,
  heliosResolvedMapBlock,
  heliosWillCreateFlow,
  type HeliosCreatedFlow,
  type HeliosFlowCreateInput,
} from "@/lib/workspace-helios-flow";
import {
  cellFromArgs,
  cellsFromArgs,
  dispatchHeliosMapTool,
  fail,
  heliosBridgeWidthFromArgs,
  heliosDagBlockIds,
  idList,
  resolveAddCell,
  stringArg,
} from "./dispatch";
import type {
  HeliosMapSnapshot,
  HeliosMapToolCall,
  HeliosMapToolResult,
} from "./snapshot";

export type HeliosMapToolHost = {
  /**
   * Paint the dispatched snapshot on the Learning Map immediately, before
   * Manual persist APIs finish. This is how Helios work shows up atomically.
   */
  applySnapshot?: (snapshot: HeliosMapSnapshot) => void;
  saveNotes?: (notes: LearnerMapNote[]) => void | Promise<void>;
  saveAnnotationLayers?: (
    layers: AnnotationLayer[],
  ) => void | Promise<void>;
  addBlock?: (input: {
    prompt: string;
    cell: { row: number; col: number };
    mapBlock?: MapBlock;
  }) => Promise<void>;
  generateShape?: (input: {
    prompt: string;
    cells: Array<{ row: number; col: number }>;
    mapBlock?: MapBlock;
  }) => Promise<void>;
  splitBlock?: (input: { blockId: string; prompt?: string }) => Promise<void>;
  cloneBlock?: (input: {
    blockId: string;
    cell: { row: number; col: number };
  }) => Promise<void>;
  editBlock?: (input: {
    blockId: string;
    title: string;
    description: string;
    mapBlock?: MapBlock;
  }) => Promise<void>;
  createFlow?: (input: HeliosFlowCreateInput) => Promise<HeliosCreatedFlow>;
  ingestRemoteFile?: (input: {
    url: string;
    name?: string;
    mimeType?: string;
  }) => Promise<MapBlockAttachment>;
  searchWeb?: (query: string) => Promise<string>;
  expandBlock?: (input: {
    blockId: string;
    prompt?: string;
    range: number;
    density: number;
    frozenSlots: Array<{ row: number; col: number }>;
  }) => Promise<void>;
  combineBlocks?: (input: {
    blockIds: string[];
    prompt?: string;
  }) => Promise<void>;
  generateBridge?: (input: {
    blockIds: string[];
    density: number;
    width?: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
    slotMapBlocks?: MapBlock[];
  }) => Promise<void>;
  clusterBlocks?: (input: {
    blockIds: string[];
    placements: Array<{ id: string; position_x: number; position_y: number }>;
    clusterCount: number;
    separation?: number;
    prompt?: string;
  }) => Promise<void>;
  applyDag?: (input: {
    blockIds: string[];
    dagDraft: MultiBlockDagDraft;
  }) => Promise<void>;
  setUnusableCells?: (
    cells: Array<{ row: number; col: number }>,
  ) => Promise<void>;
  saveCreatorEffects?: (input: {
    blockId: string;
    effects: BlockCreatorEffects;
  }) => Promise<void>;
  deleteBlock?: (blockId: string) => Promise<void>;
};

export type HeliosMapAtomicStep = {
  index: number;
  call: HeliosMapToolCall;
  result: HeliosMapToolResult;
  snapshot: HeliosMapSnapshot;
};

/**
 * Apply each tool as its own map mutation: paint the snapshot, then persist.
 * The Learning Map updates per tool instead of waiting for a full chat turn.
 */
export async function applyHeliosMapToolsAtomically(input: {
  snapshot: HeliosMapSnapshot;
  calls: readonly HeliosMapToolCall[];
  host?: HeliosMapToolHost | null;
  onStep?: (step: HeliosMapAtomicStep) => void | Promise<void>;
}): Promise<{ snapshot: HeliosMapSnapshot; steps: HeliosMapAtomicStep[] }> {
  let next = input.snapshot;
  const steps: HeliosMapAtomicStep[] = [];
  for (let index = 0; index < input.calls.length; index += 1) {
    const call = input.calls[index];
    const previous = next;
    const result = input.host
      ? await executeHeliosMapToolCall({
          snapshot: previous,
          call,
          host: input.host,
        })
      : dispatchHeliosMapTool(previous, call);
    if (result.ok) next = result.snapshot;
    const step: HeliosMapAtomicStep = {
      index,
      call,
      result,
      snapshot: next,
    };
    steps.push(step);
    await input.onStep?.(step);
  }
  return { snapshot: next, steps };
}

function addedBlocksFromPreview(
  before: HeliosMapSnapshot,
  after: HeliosMapSnapshot,
) {
  const prevIds = new Set(before.blocks.map((b) => b.id));
  return after.blocks.filter((b) => !prevIds.has(b.id));
}

function addedCellsFromPreview(
  before: HeliosMapSnapshot,
  after: HeliosMapSnapshot,
): Array<{ row: number; col: number }> {
  return addedBlocksFromPreview(before, after).map((b) => ({
    row: b.position_y,
    col: b.position_x,
  }));
}

async function ingestMapBlockAttachments(
  mapBlock: MapBlock | undefined,
  host: HeliosMapToolHost,
): Promise<MapBlock | undefined> {
  if (!mapBlock || mapBlock.kind !== "content") return mapBlock;
  if (!host.ingestRemoteFile) return mapBlock;
  const attachments: MapBlockAttachment[] = [];
  for (const item of mapBlock.attachments) {
    if (item.type === "file" && item.url && !item.xaiFileId) {
      try {
        attachments.push(
          await host.ingestRemoteFile({
            url: item.url,
            name: item.name,
            mimeType: item.mimeType,
          }),
        );
        continue;
      } catch {
        const asLink = parseMapBlockAttachment({
          type: "link",
          name: item.name,
          url: item.url,
        });
        if (asLink) attachments.push(asLink);
        continue;
      }
    }
    attachments.push(item);
  }
  return { ...mapBlock, attachments };
}

/**
 * Validate via dispatch, paint the map immediately, then persist through
 * the same Manual drawer APIs from the dispatched snapshot.
 */
export async function executeHeliosMapToolCall(input: {
  snapshot: HeliosMapSnapshot;
  call: HeliosMapToolCall;
  host?: HeliosMapToolHost | null;
}): Promise<HeliosMapToolResult> {
  const host = input.host;
  let call = input.call;
  const args = { ...(call.args || {}) };
  if (
    (call.name === "add_block" || call.name === "generate_shape") &&
    heliosWillCreateFlow(args)
  ) {
    if (!host?.createFlow) {
      return fail(input.snapshot, "flow_id_required");
    }
    try {
      const created = await host.createFlow(heliosFlowCreateInput(args));
      args.flowId = created.id;
      if (created.publicToken) args.flowPublicToken = created.publicToken;
      if (created.publicPath) args.flowHref = created.publicPath;
      call = { ...call, args };
    } catch (err) {
      return fail(
        input.snapshot,
        err instanceof Error ? err.message : "create_flow_failed",
      );
    }
  }
  const preview = dispatchHeliosMapTool(input.snapshot, call);
  if (!preview.ok) return preview;
  if (!host) return preview;
  host.applySnapshot?.(preview.snapshot);
  const { name } = call;
  try {
    if (name === "add_block" && host.addBlock) {
      const cell = resolveAddCell(input.snapshot, args);
      const mapBlock = await ingestMapBlockAttachments(
        heliosResolvedMapBlock(args),
        host,
      );
      await host.addBlock({
        prompt: stringArg(args, "prompt", "title") || "Untitled",
        cell,
        mapBlock,
      });
    } else if (name === "create_flow" && host.createFlow) {
      const created = await host.createFlow(heliosFlowCreateInput(args));
      return {
        ok: true,
        snapshot: preview.snapshot,
        message: `created-flow:${created.id}`,
      };
    } else if (name === "search_web" && host.searchWeb) {
      const query = stringArg(args, "query", "q", "prompt");
      const message = await host.searchWeb(query);
      return { ok: true, snapshot: preview.snapshot, message };
    } else if (name === "attach_content" && host.editBlock) {
      const blockId = stringArg(args, "blockId", "id");
      const next = preview.snapshot.blocks.find((b) => b.id === blockId);
      const prev = input.snapshot.blocks.find((b) => b.id === blockId);
      const mapBlock = await ingestMapBlockAttachments(
        next?.map_block ?? undefined,
        host,
      );
      await host.editBlock({
        blockId,
        title: prev?.title || next?.title || "Untitled",
        description: prev?.description || next?.description || "",
        mapBlock,
      });
    } else if (name === "generate_shape" && host.generateShape) {
      const mapBlock = await ingestMapBlockAttachments(
        heliosResolvedMapBlock(args),
        host,
      );
      await host.generateShape({
        prompt: stringArg(args, "prompt", "title") || "Untitled",
        cells: cellsFromArgs(args),
        mapBlock,
      });
    } else if (name === "split_block" && host.splitBlock) {
      await host.splitBlock({
        blockId: stringArg(args, "blockId", "id"),
        prompt: stringArg(args, "prompt") || undefined,
      });
    } else if (name === "clone_block" && host.cloneBlock) {
      const cell = cellFromArgs(args);
      if (cell) {
        await host.cloneBlock({
          blockId: stringArg(args, "blockId", "sourceBlockId", "id"),
          cell,
        });
      }
    } else if (name === "edit_block" && host.editBlock) {
      const blockId = stringArg(args, "blockId", "id");
      const prev = input.snapshot.blocks.find((b) => b.id === blockId);
      const next = preview.snapshot.blocks.find((b) => b.id === blockId);
      const mapBlock = await ingestMapBlockAttachments(
        next?.map_block ?? undefined,
        host,
      );
      await host.editBlock({
        blockId,
        title: stringArg(args, "title") || prev?.title || "Untitled",
        description:
          typeof args.description === "string"
            ? args.description
            : prev?.description || "",
        mapBlock,
      });
    } else if (name === "expand_block" && host.expandBlock) {
      const range = Number.isFinite(Number(args.range))
        ? Number(args.range)
        : 2;
      const density = Number.isFinite(Number(args.density))
        ? Number(args.density)
        : 50;
      await host.expandBlock({
        blockId: stringArg(args, "blockId", "id"),
        prompt: stringArg(args, "prompt") || undefined,
        range,
        density,
        frozenSlots: addedCellsFromPreview(input.snapshot, preview.snapshot),
      });
    } else if (name === "combine_blocks" && host.combineBlocks) {
      await host.combineBlocks({
        blockIds: idList(args.blockIds ?? args.ids),
        prompt: stringArg(args, "prompt") || undefined,
      });
    } else if (name === "bridge_blocks" && host.generateBridge) {
      const ids = idList(args.blockIds ?? args.ids);
      const targets = input.snapshot.blocks.filter((b) => ids.includes(b.id));
      const density = Number.isFinite(Number(args.density))
        ? Number(args.density)
        : 100;
      const width = heliosBridgeWidthFromArgs(args);
      await host.generateBridge({
        blockIds: ids,
        density,
        width,
        userPrompt: stringArg(args, "prompt") || undefined,
        frozenSlots: addedCellsFromPreview(input.snapshot, preview.snapshot),
        blockTitles: targets.map((b) => String(b.title || b.id)),
        slotMapBlocks: addedBlocksFromPreview(
          input.snapshot,
          preview.snapshot,
        ).map((b) => authoringMapBlockKindTemplate(b.map_block)),
      });
    } else if (name === "cluster_blocks" && host.clusterBlocks) {
      const ids = idList(args.blockIds ?? args.ids);
      await host.clusterBlocks({
        blockIds: ids,
        placements: preview.snapshot.blocks
          .filter((b) => ids.includes(b.id))
          .map((b) => ({
            id: b.id,
            position_x: b.position_x,
            position_y: b.position_y,
          })),
        clusterCount: Number(args.clusterCount) || ids.length,
        separation:
          args.separation === undefined ? undefined : Number(args.separation),
        prompt: stringArg(args, "prompt") || undefined,
      });
    } else if (name === "apply_dag" && host.applyDag) {
      const blockIds = heliosDagBlockIds(input.snapshot, args);
      const dagDraft = draftMultiBlockDag(blockIds, preview.snapshot.blocks);
      await host.applyDag({
        blockIds: dagDraft.blockIds,
        dagDraft,
      });
    } else if (name === "mark_unusable" && host.setUnusableCells) {
      await host.setUnusableCells(preview.snapshot.unusableCells);
    } else if (
      (name === "set_dynamic_effect" || name === "set_generator_effect") &&
      host.saveCreatorEffects
    ) {
      const blockId = stringArg(args, "blockId", "id");
      const updated = preview.snapshot.blocks.find((b) => b.id === blockId);
      if (updated) {
        await host.saveCreatorEffects({
          blockId,
          effects: parseBlockCreatorEffects(updated.creator_effects, {
            selfBlockId: blockId,
          }),
        });
      }
    } else if (name === "delete_block" && host.deleteBlock) {
      await host.deleteBlock(stringArg(args, "blockId", "id"));
    } else if (
      (name === "add_note" ||
        name === "edit_note" ||
        name === "delete_note") &&
      host.saveNotes
    ) {
      await host.saveNotes(preview.snapshot.notes);
    } else if (
      (name === "add_drawing_layer" ||
        name === "draw_on_layer" ||
        name === "delete_drawing_layer") &&
      host.saveAnnotationLayers
    ) {
      await host.saveAnnotationLayers(preview.snapshot.annotationLayers);
    }
  } catch (err) {
    host.applySnapshot?.(input.snapshot);
    return fail(
      input.snapshot,
      err instanceof Error ? err.message : "host_failed",
    );
  }
  return preview;
}
