import type { SkillGridNode } from "@/lib/block-skill-grid";
import type { MultiBlockDagDraft } from "@/lib/multi-block-dag";

export type CombineBlockRef = {
  id: string;
  title: string;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: SkillGridNode["shape_cells"];
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
  is_start?: boolean | null;
};

export type WorkspaceCombineBlocksPaneProps = {
  blockIds: string[];
  nodes: CombineBlockRef[];
  busy?: boolean;
  unusableCells?: Array<{ row: number; col: number }> | null;
  workspaceId?: string;
  ayclToken?: string;
  onCombine: (input: {
    blockIds: string[];
    prompt?: string;
  }) => Promise<void> | void;
  /**
   * Enqueue background multi-create along a straight knowledge-bridge corridor.
   * Host freezes slots into the same expand-job path as range/density create.
   */
  onGenerateBridge?: (input: {
    blockIds: string[];
    density: number;
    width: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
  }) => Promise<void> | void;
  /** Persist multi-select dependency DAG (next + lock_until among selection). */
  onApplyDag?: (input: {
    blockIds: string[];
    dagDraft: MultiBlockDagDraft;
  }) => Promise<void> | void;
  /**
   * Relocate selected blocks into physical clusters (positions only).
   * Host persists via grid-ops relocate.
   */
  onClusterBlocks?: (input: {
    blockIds: string[];
    placements: Array<{
      id: string;
      position_x: number;
      position_y: number;
    }>;
    clusterCount: number;
    /** Extra empty cells between clusters (0–10). */
    separation?: number;
    prompt?: string;
  }) => Promise<void> | void;
  /**
   * Progress under the minimap while clustering runs
   * (compute + persist). Host shows a progress bar.
   */
  onClusterProgress?: (
    job: {
      active: boolean;
      progress: number;
      label: string;
    } | null,
  ) => void;
  /** Batch-delete all multi-selected blocks. */
  onDeleteBlocks?: (input: { blockIds: string[] }) => Promise<void> | void;
  /** Lift bridge corridor preview onto the map. */
  onBridgePreviewChange?: (
    cells: Array<{ row: number; col: number }> | null,
  ) => void;
  onCancel: () => void;
  labels?: {
    combine?: string;
    cancel?: string;
    promptPlaceholder?: string;
  };
};
