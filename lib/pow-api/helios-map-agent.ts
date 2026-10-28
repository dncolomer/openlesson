/**
 * Helios Learning Map builder capabilities on the public workspace API / MCP.
 * Same catalog as in-app Helios; persist through workspace rows (blocks,
 * unusable ground, map overlay).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";
import {
  applyHeliosMapToolsAtomically,
  heliosMapSnapshotFromBlocks,
  heliosMapToolAwarenessText,
  isHeliosMapToolId,
  parseHeliosMapToolCall,
  HELIOS_MAP_TOOL_CATALOG,
  HELIOS_MAP_TOOL_IDS,
  type HeliosMapBlock,
  type HeliosMapSnapshot,
  type HeliosMapToolCall,
} from "@/lib/workspace-helios-tools";
import { parseLearnerMapNotes } from "@/lib/learner-map-notes";
import { parseAnnotationLayers } from "@/lib/map-annotation-layers";
import {
  MAP_BLOCK_STORE_UNAVAILABLE,
  serializeMapBlock,
  normalizeMapBlock,
} from "@/lib/block-kind";
import { mapBlockKindIconName } from "@/lib/block-map-glyph";
import {
  workspaceFeatureDeniedMessage,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";

export const HELIOS_MAP_AGENT_APPLY_TOOL = "apply_map_tool" as const;
export const HELIOS_MAP_AGENT_LIST_TOOL = "list_map_tools" as const;

const BLOCK_SELECT =
  "id,title,description,is_start,next_block_ids,lock_until_block_ids,status,position_x,position_y,span_w,span_h,shape_cells,creator_effects,planning_prompt,map_block";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export function heliosMapAgentCatalog() {
  return HELIOS_MAP_TOOL_CATALOG.map((tool) => ({
    id: tool.id,
    family: tool.family,
    title: tool.title,
    description: tool.description,
  }));
}

export function parseHeliosMapAgentCalls(
  body: Record<string, unknown>,
): HeliosMapToolCall[] {
  const list = body.tool_calls ?? body.toolCalls ?? body.calls;
  if (Array.isArray(list)) {
    const out: HeliosMapToolCall[] = [];
    for (const item of list) {
      const parsed = parseHeliosMapToolCall(item);
      if (parsed) out.push(parsed);
    }
    return out;
  }
  const parsed = parseHeliosMapToolCall({
    name: body.tool ?? body.name ?? body.id,
    arguments: body.arguments ?? body.args ?? body.payload,
  });
  return parsed ? [parsed] : [];
}

export function presentHeliosMapAgentSnapshot(snapshot: HeliosMapSnapshot) {
  return {
    blocks: snapshot.blocks,
    unusable_cells: snapshot.unusableCells,
    notes: snapshot.notes,
    annotation_layers: snapshot.annotationLayers,
  };
}

export function heliosMapAgentFeatureDenied(kind: unknown): string | null {
  if (workspaceSupportsFeature(kind, "map")) return null;
  return workspaceFeatureDeniedMessage(kind, "map");
}

async function loadWorkspaceMapGround(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{ unusable_cells?: unknown; map_overlay?: unknown } | null> {
  const withOverlay = await supabase
    .from("workspaces")
    .select("unusable_cells,map_overlay")
    .eq("id", workspaceId)
    .maybeSingle();
  if (withOverlay.error && /map_overlay/i.test(withOverlay.error.message || "")) {
    const fallback = await supabase
      .from("workspaces")
      .select("unusable_cells")
      .eq("id", workspaceId)
      .maybeSingle();
    return (fallback.data as { unusable_cells?: unknown } | null) ?? null;
  }
  return (withOverlay.data as {
    unusable_cells?: unknown;
    map_overlay?: unknown;
  } | null) ?? null;
}

export async function loadHeliosMapSnapshotForAgent(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<HeliosMapSnapshot> {
  let { data: nodes, error: nodesError } = await supabase
    .from("blocks")
    .select(BLOCK_SELECT)
    .eq("workspace_id", workspaceId);
  if (nodesError && /map_block/i.test(nodesError.message || "")) {
    const retry = await supabase
      .from("blocks")
      .select(
        "id,title,description,is_start,next_block_ids,lock_until_block_ids,status,position_x,position_y,span_w,span_h,shape_cells,creator_effects,planning_prompt",
      )
      .eq("workspace_id", workspaceId);
    nodes = retry.data as typeof nodes;
  }

  const plan = await loadWorkspaceMapGround(supabase, workspaceId);

  const overlay =
    plan && typeof plan === "object"
      ? ((plan as { map_overlay?: unknown }).map_overlay as
          | Record<string, unknown>
          | null
          | undefined)
      : null;

  return heliosMapSnapshotFromBlocks({
    blocks: ((nodes || []) as HeliosMapBlock[]).filter(
      (n) => n && n.id && n.position_x != null && n.position_y != null,
    ),
    unusableCells: normalizeUnusableCells(
      (plan as { unusable_cells?: unknown } | null)?.unusable_cells,
    ),
    notes: parseLearnerMapNotes(
      overlay?.notes ?? (Array.isArray(overlay) ? null : overlay),
    ),
    annotationLayers: parseAnnotationLayers(
      overlay?.annotationLayers ?? overlay?.annotation_layers,
    ),
  });
}

export function remapHeliosSnapshotIds(
  snapshot: HeliosMapSnapshot,
  idMap: Map<string, string>,
): HeliosMapSnapshot {
  if (idMap.size === 0) return snapshot;
  const mapId = (id: string) => idMap.get(id) || id;
  return {
    ...snapshot,
    blocks: snapshot.blocks.map((block) => ({
      ...block,
      id: mapId(block.id),
      next_block_ids: (block.next_block_ids || []).map(mapId),
      lock_until_block_ids: (block.lock_until_block_ids || []).map(mapId),
    })),
  };
}

async function insertAgentBlock(
  supabase: SupabaseClient,
  workspaceId: string,
  block: HeliosMapBlock,
): Promise<string> {
  const payload: Record<string, unknown> = {
    workspace_id: workspaceId,
    title: block.title || "Untitled",
    description: block.description || "",
    is_start: false,
    status: "available",
    position_x: block.position_x,
    position_y: block.position_y,
    span_w: block.span_w ?? 1,
    span_h: block.span_h ?? 1,
    shape_cells: block.shape_cells ?? null,
    next_block_ids: [],
    lock_until_block_ids: [],
    creator_effects: block.creator_effects ?? null,
    planning_prompt: block.planning_prompt ?? null,
    ...(serializeMapBlock(normalizeMapBlock(block.map_block))
      ? { map_block: serializeMapBlock(normalizeMapBlock(block.map_block)) }
      : {}),
    ...(mapBlockKindIconName(normalizeMapBlock(block.map_block).kind)
      ? {
          map_icon: mapBlockKindIconName(
            normalizeMapBlock(block.map_block).kind,
          ),
        }
      : {}),
  };
  const optional = [
    "shape_cells",
    "span_w",
    "span_h",
    "creator_effects",
    "planning_prompt",
    "lock_until_block_ids",
    "map_block",
    "map_icon",
  ];
  let current = { ...payload };
  for (let i = 0; i < optional.length + 1; i += 1) {
    const { data, error } = await supabase
      .from("blocks")
      .insert(current)
      .select("id")
      .single();
    if (!error && data?.id) return String(data.id);
    const msg = error?.message || "";
    const drop = optional.find((col) => msg.toLowerCase().includes(col));
    if (!drop) {
      throw new Error(msg || "Failed to insert map block");
    }
    if (drop === "map_block" && current.map_block != null) {
      throw new Error(MAP_BLOCK_STORE_UNAVAILABLE);
    }
    const next = { ...current };
    delete next[drop];
    current = next;
  }
  throw new Error("Failed to insert map block");
}

export async function persistHeliosMapSnapshotForAgent(
  supabase: SupabaseClient,
  workspaceId: string,
  snapshot: HeliosMapSnapshot,
): Promise<HeliosMapSnapshot> {
  const { data: existing } = await supabase
    .from("blocks")
    .select("id")
    .eq("workspace_id", workspaceId);
  const existingIds = new Set(
    (existing || [])
      .map((row) => String((row as { id?: string }).id || ""))
      .filter(Boolean),
  );

  const idMap = new Map<string, string>();
  const keep = new Set<string>();

  for (const block of snapshot.blocks) {
    if (isUuid(block.id) && existingIds.has(block.id)) {
      keep.add(block.id);
      await supabase
        .from("blocks")
        .update({
          title: block.title || "Untitled",
          description: block.description || "",
          position_x: block.position_x,
          position_y: block.position_y,
          span_w: block.span_w ?? 1,
          span_h: block.span_h ?? 1,
          shape_cells: block.shape_cells ?? null,
          next_block_ids: block.next_block_ids || [],
          lock_until_block_ids: block.lock_until_block_ids || [],
          creator_effects: block.creator_effects ?? null,
          planning_prompt: block.planning_prompt ?? null,
          ...(serializeMapBlock(normalizeMapBlock(block.map_block))
            ? {
                map_block: serializeMapBlock(
                  normalizeMapBlock(block.map_block),
                ),
              }
            : {}),
        })
        .eq("id", block.id)
        .eq("workspace_id", workspaceId);
      continue;
    }
    const inserted = await insertAgentBlock(supabase, workspaceId, block);
    idMap.set(block.id, inserted);
    keep.add(inserted);
  }

  for (const id of existingIds) {
    if (!keep.has(id)) {
      await supabase.from("blocks").delete().eq("id", id).eq("workspace_id", workspaceId);
    }
  }

  const remapped = remapHeliosSnapshotIds(snapshot, idMap);
  for (const block of remapped.blocks) {
    await supabase
      .from("blocks")
      .update({
        next_block_ids: block.next_block_ids || [],
        lock_until_block_ids: block.lock_until_block_ids || [],
      })
      .eq("id", block.id)
      .eq("workspace_id", workspaceId);
  }

  const ground: Record<string, unknown> = {
    unusable_cells: remapped.unusableCells,
    map_overlay: {
      notes: remapped.notes,
      annotationLayers: remapped.annotationLayers,
    },
  };
  const groundResult = await supabase
    .from("workspaces")
    .update(ground)
    .eq("id", workspaceId);
  if (
    groundResult.error &&
    /map_overlay/i.test(groundResult.error.message || "")
  ) {
    await supabase
      .from("workspaces")
      .update({ unusable_cells: remapped.unusableCells })
      .eq("id", workspaceId);
  }

  return remapped;
}

export async function listHeliosMapToolsForAgent(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const snapshot = await loadHeliosMapSnapshotForAgent(supabase, workspaceId);
  return {
    catalog: heliosMapAgentCatalog(),
    awareness: heliosMapAgentAwareness(),
    snapshot: presentHeliosMapAgentSnapshot(snapshot),
  };
}

export async function applyHeliosMapToolsForAgent(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  body: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  catalog: ReturnType<typeof heliosMapAgentCatalog>;
  applied: HeliosMapToolCall[];
  steps: Array<{ tool: string; ok: boolean; message?: string; error?: string }>;
  snapshot: ReturnType<typeof presentHeliosMapAgentSnapshot>;
  error?: string;
}> {
  const calls = parseHeliosMapAgentCalls(input.body);
  if (calls.length === 0) {
    const unknown = String(
      input.body.tool ?? input.body.name ?? "",
    ).trim();
    return {
      ok: false,
      catalog: heliosMapAgentCatalog(),
      applied: [],
      steps: [],
      snapshot: presentHeliosMapAgentSnapshot(
        await loadHeliosMapSnapshotForAgent(input.supabase, input.workspaceId),
      ),
      error: unknown && !isHeliosMapToolId(unknown)
        ? `unknown_tool:${unknown}`
        : "tool is required (Helios map catalog)",
    };
  }

  const start = await loadHeliosMapSnapshotForAgent(
    input.supabase,
    input.workspaceId,
  );
  const applied = await applyHeliosMapToolsAtomically({
    snapshot: start,
    calls,
  });
  const failed = applied.steps.find((step) => !step.result.ok);
  if (failed && !failed.result.ok) {
    return {
      ok: false,
      catalog: heliosMapAgentCatalog(),
      applied: calls,
      steps: applied.steps.map((step) =>
        step.result.ok
          ? { tool: step.call.name, ok: true, message: step.result.message }
          : { tool: step.call.name, ok: false, error: step.result.error },
      ),
      snapshot: presentHeliosMapAgentSnapshot(applied.snapshot),
      error: failed.result.error,
    };
  }

  const persisted = await persistHeliosMapSnapshotForAgent(
    input.supabase,
    input.workspaceId,
    applied.snapshot,
  );
  return {
    ok: true,
    catalog: heliosMapAgentCatalog(),
    applied: calls,
    steps: applied.steps.map((step) =>
      step.result.ok
        ? { tool: step.call.name, ok: true, message: step.result.message }
        : { tool: step.call.name, ok: false, error: step.result.error },
    ),
    snapshot: presentHeliosMapAgentSnapshot(persisted),
  };
}

export function heliosMapAgentAwareness(): string {
  return heliosMapToolAwarenessText();
}

export { HELIOS_MAP_TOOL_IDS };
