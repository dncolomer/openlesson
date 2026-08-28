import type { AddExpandJob } from "@/lib/add-block-range-density";
import type { GridCell, SkillGridNode } from "@/lib/block-skill-grid";
import type { UnusableCell } from "@/lib/map-ground-rules";
import type { StretchHandle } from "@/lib/skill-grid-ops";
import type { WorkspaceMapSelection } from "@/lib/workspace-map-selection";

export const MODEL_STORAGE_KEY = "planner-model";
export const APPEAR_STAGGER_MS = 140;
export const EMPTY_APPEARING_NODE_IDS: string[] = [];
export const PAN_CLICK_THRESHOLD = 6;

export function cellKey(cell: GridCell) {
  return `${cell.row}:${cell.col}`;
}

export interface BlockSkillGridProps {
  nodes: SkillGridNode[];
  selectedNodeId: string | null;
  focusedNodeId?: string | null;
  onSelectNode: (blockId: string | null) => void;
  mapSelection?: WorkspaceMapSelection;
  onMapSelectionChange?: (selection: WorkspaceMapSelection) => void;
  previewEmptyCells?: Array<{ row: number; col: number }> | null;
  generatorTargetPreviewCells?: ReadonlyArray<{ row: number; col: number }> | null;
  generatorPickActive?: boolean;
  onGeneratorEmptyToggle?: (cell: { row: number; col: number }) => void;
  dynamicPickActive?: boolean;
  onDynamicBlockToggle?: (blockId: string) => void;
  dynamicUnlockPreviewIds?: readonly string[] | null;
  dynamicContentGeneratedIds?: ReadonlySet<string> | readonly string[] | null;
  expandJobs?: readonly AddExpandJob[] | null;
  onAbortExpandJob?: (jobId: string) => void;
  clusterMapJob?: {
    active: boolean;
    progress: number;
    label: string;
  } | null;
  selectiveExplanationActive?: boolean;
  selectiveExplanationPolygon?: Array<{ x: number; y: number }> | null;
  onSelectiveExplanationComplete?: (
    polygon: Array<{ x: number; y: number }>,
  ) => void;
  injectMapNote?: {
    token: number;
    body: string;
    x: number;
    y: number;
    source?: "creator" | "learner";
  } | null;
  mapExploreOpen?: boolean;
  onMapExploreToggle?: () => void;
  onMapToggle?: (id: "creator" | "learner" | "explore") => void;
  mapToggleIds?: readonly ("creator" | "learner" | "explore")[];
  interactionMode?: "creator" | "learner";
  onInteractionModeChange?: (mode: "creator" | "learner") => void;
  canEdit: boolean;
  learnerMode?: boolean;
  viewOnly?: boolean;
  /** When false, hide the overlay minimap and keep the live map. Default true. */
  showMinimap?: boolean;
  learnerScopeId?: string | null;
  cloneArmed?: boolean;
  cloneSourceBlockId?: string | null;
  onCloneArm?: (blockId: string) => void;
  onCloneCancel?: () => void;
  onClonePaste?: (sourceBlockId: string, target: GridCell) => void;
  showProgress?: boolean;
  isAdding?: boolean;
  workspaceId?: string;
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
  suggestMode?: "block" | "chapter";
  locale?: string;
  recenterCell?: GridCell | null;
  followCell?: GridCell | null;
  onAddBlock: (prompt: string, position: { row: number; col: number }) => Promise<void>;
  onGridOp?: (payload: {
    op: "generate_shape" | "merge" | "split" | "move" | "resize" | "update_block" | "delete_block";
    prompt?: string;
    cells?: Array<{ row: number; col: number }>;
    blockIds?: string[];
    dRow?: number;
    dCol?: number;
    blockId?: string;
    handle?: StretchHandle;
    title?: string;
    description?: string;
    contextSourceKeys?: string[];
  }) => Promise<{ updatedNodes?: SkillGridNode[]; placedNodeId?: string; appearSequentially?: boolean } | void>;
  workspaceNotes?: string | null;
  unusableCells?: UnusableCell[] | null;
  onMapGround?: (payload: {
    op: "set_lock_until" | "set_unusable_cells";
    blockId?: string;
    prerequisiteIds?: string[];
    unusableCells?: UnusableCell[];
  }) => Promise<void> | void;
  appearingNodeIds?: string[];
  onAppearingComplete?: (nodeIds: string[]) => void;
  labels: {
    emptyCell: string;
    addTitle: string;
    addPlaceholder: string;
    addSubmit: string;
    addCancel: string;
    suggestTopics: string;
    suggesting: string;
    suggestError: string;
    recenter: string;
    zoomIn: string;
    zoomOut: string;
    select?: string;
    merge?: string;
    split?: string;
    move?: string;
    generateShape?: string;
    clearSelection?: string;
    multiSelectHint?: string;
    lockUntil?: string;
    markUnusable?: string;
  };
}
