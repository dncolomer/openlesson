import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSkillGridLayout, type SkillGridNode } from "@/lib/block-skill-grid";

export interface SkillGridPosition {
  position_x: number;
  position_y: number;
}

interface BlockRef {
  id: string;
  title: string;
  is_start?: boolean;
  next?: string[];
  position_x?: number | null;
  position_y?: number | null;
}

interface DbBlock {
  id: string;
  title: string;
  status?: string;
  is_start?: boolean;
  next_block_ids?: string[];
  position_x?: number | null;
  position_y?: number | null;
}

/** Grid column/row for every node using the same rules as the skill grid UI. */
export function getSkillGridPositions(nodes: SkillGridNode[]): Map<string, SkillGridPosition> {
  const { placements } = buildSkillGridLayout(nodes);
  const result = new Map<string, SkillGridPosition>();

  for (const [id, cell] of placements) {
    result.set(id, { position_x: cell.col, position_y: cell.row });
  }

  return result;
}

export function toSkillGridNodes(nodes: DbBlock[]): SkillGridNode[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    status: node.status || "available",
    is_start: node.is_start || false,
    next_block_ids: node.next_block_ids || [],
    position_x: node.position_x ?? undefined,
    position_y: node.position_y ?? undefined,
  }));
}

export function skillGridNodesFromRefs(
  refs: BlockRef[],
  idMap: Map<string, string>,
  status = "available",
): SkillGridNode[] {
  return refs.flatMap((ref) => {
    const dbId = idMap.get(ref.id);
    if (!dbId) return [];

    return [
      {
        id: dbId,
        title: ref.title,
        status,
        is_start: ref.is_start || false,
        next_block_ids: (ref.next || [])
          .map((nextId) => idMap.get(nextId))
          .filter((id): id is string => Boolean(id)),
        position_x: ref.position_x ?? undefined,
        position_y: ref.position_y ?? undefined,
      },
    ];
  });
}

export function withSkillGridPositions<T extends { id: string }>(
  nodes: T[],
  skillNodes: SkillGridNode[],
): T[] {
  const positions = getSkillGridPositions(skillNodes);

  return nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, ...position } : node;
  });
}

/** Backfill missing coordinates in-memory using the same radial rules as the grid UI. */
export function ensureSkillGridNodePositions(nodes: SkillGridNode[]): {
  nodes: SkillGridNode[];
  changed: boolean;
} {
  const positions = getSkillGridPositions(nodes);
  let changed = false;

  const nextNodes = nodes.map((node) => {
    if (node.position_x != null && node.position_y != null) return node;
    const position = positions.get(node.id);
    if (!position) return node;
    changed = true;
    return { ...node, ...position };
  });

  return { nodes: nextNodes, changed };
}

export async function persistSkillGridPositions(
  supabase: SupabaseClient,
  nodes: SkillGridNode[],
  options?: {
    onlyNodeIds?: Iterable<string>;
    onlyWithoutSavedPosition?: boolean;
  },
) {
  const positions = getSkillGridPositions(nodes);
  const onlyIds = options?.onlyNodeIds ? new Set(options.onlyNodeIds) : null;

  for (const [id, position] of positions) {
    if (onlyIds && !onlyIds.has(id)) continue;

    if (options?.onlyWithoutSavedPosition) {
      const node = nodes.find((entry) => entry.id === id);
      if (node?.position_x != null && node.position_y != null) continue;
    }

    await supabase.from("blocks").update(position).eq("id", id);
  }
}