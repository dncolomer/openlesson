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

function mapWorkspaceRow(data: Record<string, unknown>): WorkspaceGoalRow {
  return {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    text: String(data.text || ""),
    sort_order: Number(data.sort_order) || 0,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

function mapBlockRow(data: Record<string, unknown>): BlockGoalRow {
  return {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    block_id: data.block_id as string,
    text: String(data.text || ""),
    sort_order: Number(data.sort_order) || 0,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

export async function listWorkspaceGoals(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceGoalRow[]> {
  const { data, error } = await supabase
    .from("workspace_goals")
    .select("id, workspace_id, text, sort_order, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[goals-store] listWorkspaceGoals failed:", error.message);
    return [];
  }
  return (data || []).map((row) => mapWorkspaceRow(row as Record<string, unknown>));
}

export async function listBlockGoals(
  supabase: SupabaseClient,
  options: { workspaceId: string; blockId?: string | null },
): Promise<BlockGoalRow[]> {
  let query = supabase
    .from("block_goals")
    .select("id, workspace_id, block_id, text, sort_order, created_at, updated_at")
    .eq("workspace_id", options.workspaceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (options.blockId) {
    query = query.eq("block_id", options.blockId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[goals-store] listBlockGoals failed:", error.message);
    return [];
  }
  return (data || []).map((row) => mapBlockRow(row as Record<string, unknown>));
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
  supabase: SupabaseClient,
  options: { workspaceId: string; text: string; sortOrder?: number },
): Promise<{ row: WorkspaceGoalRow | null; error?: string }> {
  const text = normalizeGoalText(options.text);
  if (!text) return { row: null, error: "Goal text is required" };

  const { data, error } = await supabase
    .from("workspace_goals")
    .insert({
      workspace_id: options.workspaceId,
      text,
      sort_order: options.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select("id, workspace_id, text, sort_order, created_at, updated_at")
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "Insert returned no row" };
  return { row: mapWorkspaceRow(data as Record<string, unknown>) };
}

export async function updateWorkspaceGoal(
  supabase: SupabaseClient,
  options: { workspaceId: string; goalId: string; text?: string; sortOrder?: number },
): Promise<{ row: WorkspaceGoalRow | null; error?: string }> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (options.text !== undefined) {
    const text = normalizeGoalText(options.text);
    if (!text) return { row: null, error: "Goal text is required" };
    updates.text = text;
  }
  if (options.sortOrder !== undefined) {
    updates.sort_order = options.sortOrder;
  }

  const { data, error } = await supabase
    .from("workspace_goals")
    .update(updates)
    .eq("id", options.goalId)
    .eq("workspace_id", options.workspaceId)
    .select("id, workspace_id, text, sort_order, created_at, updated_at")
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "Goal not found" };
  return { row: mapWorkspaceRow(data as Record<string, unknown>) };
}

export async function deleteWorkspaceGoal(
  supabase: SupabaseClient,
  options: { workspaceId: string; goalId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("workspace_goals")
    .delete()
    .eq("id", options.goalId)
    .eq("workspace_id", options.workspaceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createBlockGoal(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    blockId: string;
    text: string;
    sortOrder?: number;
  },
): Promise<{ row: BlockGoalRow | null; error?: string }> {
  const text = normalizeGoalText(options.text);
  if (!text) return { row: null, error: "Goal text is required" };

  const { data, error } = await supabase
    .from("block_goals")
    .insert({
      workspace_id: options.workspaceId,
      block_id: options.blockId,
      text,
      sort_order: options.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select("id, workspace_id, block_id, text, sort_order, created_at, updated_at")
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "Insert returned no row" };
  return { row: mapBlockRow(data as Record<string, unknown>) };
}

export async function updateBlockGoal(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    goalId: string;
    text?: string;
    sortOrder?: number;
  },
): Promise<{ row: BlockGoalRow | null; error?: string }> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (options.text !== undefined) {
    const text = normalizeGoalText(options.text);
    if (!text) return { row: null, error: "Goal text is required" };
    updates.text = text;
  }
  if (options.sortOrder !== undefined) {
    updates.sort_order = options.sortOrder;
  }

  const { data, error } = await supabase
    .from("block_goals")
    .update(updates)
    .eq("id", options.goalId)
    .eq("workspace_id", options.workspaceId)
    .select("id, workspace_id, block_id, text, sort_order, created_at, updated_at")
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "Goal not found" };
  return { row: mapBlockRow(data as Record<string, unknown>) };
}

export async function deleteBlockGoal(
  supabase: SupabaseClient,
  options: { workspaceId: string; goalId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("block_goals")
    .delete()
    .eq("id", options.goalId)
    .eq("workspace_id", options.workspaceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Summary string from evaluated goals for interim single-field consumers. */
export function evaluatedGoalsSummary(goals: readonly EvaluatedGoal[]): string | null {
  const parts = goals.map((g) => g.text.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join("; ").slice(0, 500);
}
