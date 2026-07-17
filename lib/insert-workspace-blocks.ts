/**
 * Insert generated workspace blocks with graph links and optional grid positions.
 * Retries without position columns if the DB schema is missing them (legacy).
 * Throws if zero blocks are persisted so callers never leave empty workspaces.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import type {
  RawWorkspaceBlock,
  WorkspaceBlockRef,
} from "@/lib/workspace-spatial-create";

function isMissingPositionColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("position_x") ||
    msg.includes("position_y") ||
    (msg.includes("schema cache") && msg.includes("position"))
  );
}

export async function insertGeneratedWorkspaceBlocks(
  supabase: SupabaseClient,
  workspaceId: string,
  blocks: WorkspaceBlockRef[],
): Promise<{ blockIdMap: Map<string, string>; insertedCount: number }> {
  if (!blocks.length) {
    throw new Error("No valid blocks to insert");
  }

  const blockIdMap = new Map<string, string>();
  let omitPositions = false;
  const insertErrors: string[] = [];

  for (const block of blocks) {
    const baseRow = {
      workspace_id: workspaceId,
      title: block.title,
      description: block.description || "",
      is_start: block.is_start === true,
      next_block_ids: [] as string[],
      status: "available",
    };

    const withPositions = {
      ...baseRow,
      position_x: block.position_x ?? null,
      position_y: block.position_y ?? null,
    };

    let data: { id: string } | null = null;
    let error: { message?: string; code?: string } | null = null;

    if (!omitPositions) {
      const result = await supabase.from("blocks").insert(withPositions).select("id").single();
      data = result.data;
      error = result.error;
      if (error && isMissingPositionColumnError(error)) {
        omitPositions = true;
        console.warn(
          "[insert-workspace-blocks] position columns missing; inserting without grid coords",
          error.message,
        );
        const retry = await supabase.from("blocks").insert(baseRow).select("id").single();
        data = retry.data;
        error = retry.error;
      }
    } else {
      const result = await supabase.from("blocks").insert(baseRow).select("id").single();
      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      const msg = error?.message || "unknown insert error";
      insertErrors.push(`${block.id}: ${msg}`);
      console.error("[insert-workspace-blocks] Failed to create block:", msg, block);
      continue;
    }

    blockIdMap.set(block.id, data.id);
  }

  if (blockIdMap.size === 0) {
    throw new Error(
      `Failed to create any blocks${insertErrors.length ? `: ${insertErrors.slice(0, 3).join("; ")}` : ""}`,
    );
  }

  for (const block of blocks) {
    const dbId = blockIdMap.get(block.id);
    if (!dbId || !Array.isArray(block.next) || block.next.length === 0) continue;
    const nextIds = block.next
      .map((id) => blockIdMap.get(id))
      .filter((id): id is string => Boolean(id));
    if (nextIds.length) {
      await supabase.from("blocks").update({ next_block_ids: nextIds }).eq("id", dbId);
    }
  }

  // Only write coords when the schema supports them (omitPositions false).
  if (!omitPositions) {
    await persistSkillGridPositions(
      supabase,
      skillGridNodesFromRefs(blocks, blockIdMap),
      { onlyWithoutSavedPosition: true },
    );
  }

  return { blockIdMap, insertedCount: blockIdMap.size };
}

/** Extract node/block array from LLM plan JSON (supports both shapes). */
export function extractGeneratedPlanNodes(planData: unknown): RawWorkspaceBlock[] {
  if (!planData || typeof planData !== "object") return [];
  const data = planData as Record<string, unknown>;
  if (Array.isArray(data.nodes)) return data.nodes as RawWorkspaceBlock[];
  if (Array.isArray(data.blocks)) return data.blocks as RawWorkspaceBlock[];
  return [];
}
