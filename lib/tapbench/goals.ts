/**
 * TAPBench task goals: what an agent should demonstrate.
 * Public catalog of workspace + block goals for a Benchmark Task.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadGoalCatalogs,
  type BlockGoalRow,
  type WorkspaceGoalRow,
} from "@/lib/pow-api/goals-store";
import type { GoalCatalogEntry } from "@/lib/pow-api/goals";
import { normalizeGoalText } from "@/lib/pow-api/goals";
import { getTapbenchBenchmarkTask, type TapbenchTask } from "./catalog";

export type TapbenchTaskGoal = {
  id: string | null;
  text: string;
  scope: "workspace" | "block";
  block_id: string | null;
  block_title: string | null;
};

export type TapbenchTaskGoals = {
  workspace_id: string;
  task: { id: string; title: string };
  /** Workspace-level success phrase (legacy column and/or catalog summary). */
  workspace_goal: string | null;
  goals: TapbenchTaskGoal[];
};

export function presentTapbenchTaskGoals(options: {
  task: TapbenchTask;
  workspaceGoal: string | null;
  workspaceGoals: readonly GoalCatalogEntry[] | readonly WorkspaceGoalRow[];
  blockGoals: readonly (GoalCatalogEntry | BlockGoalRow)[];
  blocks?: readonly { id: string; title?: string | null }[];
}): TapbenchTaskGoals {
  const titleById = new Map(
    (options.blocks ?? []).map((b) => [b.id, (b.title || "").trim() || null]),
  );

  const workspaceGoals: TapbenchTaskGoal[] = [];
  for (const g of options.workspaceGoals) {
    const text = normalizeGoalText(g.text);
    if (!text) continue;
    workspaceGoals.push({
      id: g.id,
      text,
      scope: "workspace",
      block_id: null,
      block_title: null,
    });
  }

  const blockGoals: TapbenchTaskGoal[] = [];
  for (const g of options.blockGoals) {
    const text = normalizeGoalText(g.text);
    if (!text) continue;
    const blockId =
      "block_id" in g && typeof g.block_id === "string" ? g.block_id : null;
    blockGoals.push({
      id: g.id,
      text,
      scope: "block",
      block_id: blockId,
      block_title: blockId ? titleById.get(blockId) ?? null : null,
    });
  }

  const workspaceGoal = normalizeGoalText(options.workspaceGoal);
  if (workspaceGoal && workspaceGoals.length === 0) {
    workspaceGoals.push({
      id: null,
      text: workspaceGoal,
      scope: "workspace",
      block_id: null,
      block_title: null,
    });
  }

  const goals = [...workspaceGoals, ...blockGoals];
  const headline =
    workspaceGoal ||
    (workspaceGoals.length === 1 ? workspaceGoals[0].text : null) ||
    (goals.length === 1 ? goals[0].text : null);

  return {
    workspace_id: options.task.id,
    task: { id: options.task.id, title: options.task.title },
    workspace_goal: headline,
    goals,
  };
}

export async function loadTapbenchTaskGoals(
  supabase: SupabaseClient | null,
  workspaceId: string,
): Promise<TapbenchTaskGoals | null> {
  const found = await getTapbenchBenchmarkTask(supabase, workspaceId);
  if (!found || !supabase) return null;

  const [catalogs, blocksRes] = await Promise.all([
    loadGoalCatalogs(supabase, found.task.id),
    supabase
      .from("blocks")
      .select("id, title")
      .eq("workspace_id", found.task.id)
      .order("created_at", { ascending: true }),
  ]);

  const blocks = Array.isArray(blocksRes.data)
    ? (blocksRes.data as Array<{ id: string; title?: string | null }>)
    : [];

  return presentTapbenchTaskGoals({
    task: found.task,
    workspaceGoal: found.workspace_goal,
    workspaceGoals: catalogs.workspaceGoals,
    blockGoals: catalogs.blockGoals,
    blocks,
  });
}
