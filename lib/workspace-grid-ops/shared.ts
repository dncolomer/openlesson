import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { buildSkillGridLayout, type WeightedGridNeighbor } from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";
import {
  buildOccupancyFromPlaced,
  canPlaceAbsoluteCells,
  canPlaceFootprint,
  freeformShapeFromCells,
  isStretchHandle,
  mergeBlocksToFreeform,
  normalizeSpan,
  parseShapeCells,
  placedBlockCells,
  selectionIsFreeformLectureShape,
  splitBlocksToSingles,
  stretchBlockFromHandle,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import { validateRelocatePlacements } from "@/lib/cluster-blocks";
import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";
import {
  composeGenerateShapeBlockSystemMessage,
  composeGenerateShapeBlockUserPrompt,
  composeMergeBlockSystemMessage,
  composeMergeBlockUserPrompt,
  composeSplitBlockSystemMessage,
  composeSplitBlockUserPrompt,
} from "@/lib/block-footprint-prompt";
import { composeJourneyGraphPromptSnippet } from "@/lib/workspace-authoring-prompt-context";
import { canPlaceOnMapGround, normalizeUnusableCells } from "@/lib/map-ground-rules";
import {
  buildShapeContextSourceOptions,
  composeShapeGenerationContext,
  enrichSelectedOptionsWithFetchedLinkBodies,
  shapeSelectionToGenerationSnippet,
  shapeSelectionToLocalContext,
} from "@/lib/shape-context-select";
import { fetchLinkBodyText } from "@/lib/fetch-link-body";
import { normalizeBlockLocalContext } from "@/lib/prompt-workspace-context";
import { resolveCreateBlockIsStart } from "@/lib/block-starter-flag";
import {
  buildMultiBlockDagApplyUpdates,
  type MultiBlockDagDraft,
} from "@/lib/multi-block-dag";
import { normalizeLockUntilBlockIds } from "@/lib/map-ground-rules";
import {
  buildWorkspaceDagDeleteUpdates,
  normalizeWorkspaceDags,
  registerWorkspaceDagOnApply,
  removeWorkspaceDag,
  resolveWorkspaceDagForMutation,
} from "@/lib/workspace-dags";
import { buildCloneInsertPayload } from "@/lib/clone-block";
import { isCellOccupied } from "@/lib/block-skill-grid";
import {
  normalizeBlockPracticeOptions,
  serializeBlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  normalizeBlockCreatorEffects,
  serializeBlockCreatorEffects,
  validateBlockCreatorEffects,
} from "@/lib/block-creator-effects";

export type GridOp =
  | "generate_shape"
  | "merge"
  | "split"
  | "move"
  | "relocate"
  | "resize"
  | "update_block"
  | "delete_block"
  | "delete_blocks"
  | "apply_dag"
  | "delete_dag"
  | "clone_block";

export interface AiBlockPayload {
  title: string;
  description: string;
  keyword?: string;
  icon?: string;
}

export interface AiSplitPayload {
  parts?: Array<{
    index?: number;
    title?: string;
    description?: string;
    keyword?: string;
    icon?: string;
  }>;
}

export async function loadWorkspaceContext(supabase: SupabaseClient, workspaceId: string) {
  const { data: plan } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, description, notes, workspace_goal, unusable_cells")
    .eq("id", workspaceId)
    .single();

  const { data: files } = await supabase
    .from("workspace_files")
    .select("id, file_name")
    .eq("workspace_id", workspaceId);

  // External resources table may not be migrated yet — degrade gracefully.
  let externalRows: Array<{
    id: string;
    title?: string | null;
    url?: string | null;
    description?: string | null;
  }> = [];
  const externalQuery = await supabase
    .from("workspace_external_resources")
    .select("id, title, url, description")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true });
  if (externalQuery.error) {
    const msg = externalQuery.error.message || "";
    if (!/schema cache|does not exist|workspace_external_resources/i.test(msg)) {
      console.error("[grid-ops] external resources load:", externalQuery.error);
    }
  } else {
    externalRows = (externalQuery.data || []) as typeof externalRows;
  }

  const fileRows = (files || []) as Array<{ id?: string; file_name?: string }>;
  return {
    plan,
    fileNames: fileRows.map((f) => f.file_name).filter(Boolean) as string[],
    fileRows,
    externalResources: externalRows,
    unusableCells: normalizeUnusableCells(
      (plan as { unusable_cells?: unknown } | null)?.unusable_cells,
    ),
  };
}

export function placedFromNodes(nodes: Array<{
  id: string;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: unknown;
}>): PlacedBlockRef[] {
  return nodes
    .filter((n) => n.position_x != null && n.position_y != null)
    .map((n) => ({
      id: n.id,
      position_x: n.position_x!,
      position_y: n.position_y!,
      span_w: normalizeSpan(n.span_w),
      span_h: normalizeSpan(n.span_h),
      shape_cells: parseShapeCells(n.shape_cells ?? null),
    }));
}
