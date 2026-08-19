import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlacedBlockRef } from "@/lib/skill-grid-ops";

/** Shared context for per-op grid handlers. */
export type GridOpContext = {
  supabase: SupabaseClient;
  workspaceId: string;
  body: Record<string, unknown>;
  nodes: Array<{
    id: string;
    title?: string | null;
    description?: string | null;
    next_block_ids?: string[] | null;
    lock_until_block_ids?: string[] | null;
    position_x?: number | null;
    position_y?: number | null;
    span_w?: number | null;
    span_h?: number | null;
    shape_cells?: unknown;
    is_start?: boolean | null;
  }>;
  occupancy: Map<string, string>;
  placed: PlacedBlockRef[];
  placedOccupancy: Map<string, string>;
  skillNodes: unknown[];
  userModel?: string;
  locale?: string;
  prompt?: string;
  cells?: Array<{ row: number; col: number }>;
  blockIds?: string[];
  dRow?: number;
  dCol?: number;
  title?: string;
  description?: string;
  blockId?: string;
  stretchHandleBody?: string;
  isStartBody?: boolean;
  weightedNeighbors?: unknown;
  contextSourceKeys?: string[];
  dagDraft?: {
    blockIds?: string[];
    edges?: Array<{ from?: string; to?: string; kind?: string }>;
  };
  dagId?: string;
  placementsBody?: Array<{
    id?: string;
    position_x?: number;
    position_y?: number;
  }>;
};
