/**
 * CRUD + load helpers for workspace_goals and block_goals tables.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeGoalText,
  type GoalCatalogEntry,
  type EvaluatedGoal,
} from "./goals";

export type WorkspaceGoalRow = {
  id: string;
  workspace_id: string;
  text: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BlockGoalRow = {
  id: string;
  workspace_id: string;
  block_id: string;
  text: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listWorkspaceGoals(
  _supabase: SupabaseClient,
  _workspaceId: string,
): Promise<WorkspaceGoalRow[]> {
  return [];
}

export async function listBlockGoals(
  _supabase: SupabaseClient,
  _options: { workspaceId: string; blockId?: string | null },
): Promise<BlockGoalRow[]> {
  return [];
}

/** Load full catalogs for snapshot resolution. */
export async function loadGoalCatalogs(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{
  workspaceGoals: GoalCatalogEntry[];
  blockGoals: GoalCatalogEntry[];
}> {
  const [ws, blocks] = await Promise.all([
    listWorkspaceGoals(supabase, workspaceId),
    listBlockGoals(supabase, { workspaceId }),
  ]);

  return {
    workspaceGoals: ws.map((g) => ({
      id: g.id,
      text: g.text,
      scope: "workspace" as const,
      block_id: null,
      sort_order: g.sort_order,
    })),
    blockGoals: blocks.map((g) => ({
      id: g.id,
      text: g.text,
      scope: "block" as const,
      block_id: g.block_id,
      sort_order: g.sort_order,
    })),
  };
}

export async function createWorkspaceGoal(
  _supabase: SupabaseClient,
  options: { workspaceId: string; text: string; sortOrder?: number },
): Promise<{ row: WorkspaceGoalRow | null; error?: string }> {
  const text = normalizeGoalText(options.text);
  if (!text) return { row: null, error: "Goal text is required" };
  return { row: null, error: "Goals were removed" };
}

export async function updateWorkspaceGoal(
  _supabase: SupabaseClient,
  options: { workspaceId: string; goalId: string; text?: string; sortOrder?: number },
): Promise<{ row: WorkspaceGoalRow | null; error?: string }> {
  if (options.text !== undefined && !normalizeGoalText(options.text)) {
    return { row: null, error: "Goal text is required" };
  }
  return { row: null, error: "Goals were removed" };
}

export async function deleteWorkspaceGoal(
  _supabase: SupabaseClient,
  _options: { workspaceId: string; goalId: string },
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function createBlockGoal(
  _supabase: SupabaseClient,
  options: {
    workspaceId: string;
    blockId: string;
    text: string;
    sortOrder?: number;
  },
): Promise<{ row: BlockGoalRow | null; error?: string }> {
  const text = normalizeGoalText(options.text);
  if (!text) return { row: null, error: "Goal text is required" };
  return { row: null, error: "Goals were removed" };
}

export async function updateBlockGoal(
  _supabase: SupabaseClient,
  options: {
    workspaceId: string;
    goalId: string;
    text?: string;
    sortOrder?: number;
  },
): Promise<{ row: BlockGoalRow | null; error?: string }> {
  if (options.text !== undefined && !normalizeGoalText(options.text)) {
    return { row: null, error: "Goal text is required" };
  }
  return { row: null, error: "Goals were removed" };
}

export async function deleteBlockGoal(
  _supabase: SupabaseClient,
  _options: { workspaceId: string; goalId: string },
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

/** Summary string from evaluated goals for interim single-field consumers. */
export function evaluatedGoalsSummary(goals: readonly EvaluatedGoal[]): string | null {
  const parts = goals.map((g) => g.text.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join("; ").slice(0, 500);
}
