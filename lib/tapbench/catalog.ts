/**
 * Benchmark Tasks = public workspaces owned by tapbench@uncertain.systems.
 * Empty catalog is valid when the owner has no public workspaces (or cannot be resolved).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TAPBENCH_OWNER_EMAIL } from "./constants";

export interface TapbenchTask {
  id: string;
  title: string;
  root_topic: string | null;
  description: string | null;
  cover_image_url: string | null;
  created_at: string | null;
  owner_email: typeof TAPBENCH_OWNER_EMAIL;
}

export interface TapbenchTaskSourceRow {
  id: string;
  title?: string | null;
  root_topic?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
  is_public?: boolean | null;
  user_id?: string | null;
  archived_at?: string | null;
  status?: string | null;
}

export function isTapbenchPublicWorkspace(
  row: TapbenchTaskSourceRow,
  ownerUserId: string,
): boolean {
  if (!ownerUserId) return false;
  if (row.user_id !== ownerUserId) return false;
  if (row.is_public !== true) return false;
  if (row.archived_at) return false;
  if (row.status && row.status !== "active" && row.status !== "published") {
    return false;
  }
  return Boolean(row.id);
}

export function selectTapbenchBenchmarkTasks(
  rows: readonly TapbenchTaskSourceRow[],
  ownerUserId: string,
): TapbenchTask[] {
  if (!ownerUserId) return [];
  return rows
    .filter((row) => isTapbenchPublicWorkspace(row, ownerUserId))
    .map((row) => ({
      id: row.id,
      title: (row.title || row.root_topic || "Untitled Task").trim() || "Untitled Task",
      root_topic: row.root_topic ?? null,
      description: row.description ?? null,
      cover_image_url: row.cover_image_url ?? null,
      created_at: row.created_at ?? null,
      owner_email: TAPBENCH_OWNER_EMAIL,
    }));
}

export async function resolveTapbenchOwnerUserId(
  supabase: SupabaseClient | null,
): Promise<string | null> {
  if (!supabase) return null;
  const admin = supabase.auth?.admin;
  if (!admin || typeof admin.listUsers !== "function") return null;
  const needle = TAPBENCH_OWNER_EMAIL.toLowerCase();
  try {
    for (let page = 1; page <= 8; page += 1) {
      const { data, error } = await admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users) return null;
      const hit = data.users.find(
        (u) => typeof u.email === "string" && u.email.toLowerCase() === needle,
      );
      if (hit?.id) return hit.id;
      if (data.users.length < 200) break;
    }
  } catch {
    return null;
  }
  return null;
}

export async function listTapbenchBenchmarkTasks(
  supabase: SupabaseClient | null,
): Promise<TapbenchTask[]> {
  if (!supabase) return [];
  const ownerUserId = await resolveTapbenchOwnerUserId(supabase);
  if (!ownerUserId) return [];

  const { data, error } = await supabase
    .from("workspaces")
    .select(
      "id, title, root_topic, description, cover_image_url, created_at, is_public, user_id, archived_at, status",
    )
    .eq("user_id", ownerUserId)
    .eq("is_public", true)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return selectTapbenchBenchmarkTasks(data as TapbenchTaskSourceRow[], ownerUserId);
}

const TASK_SELECT =
  "id, title, root_topic, description, cover_image_url, created_at, is_public, user_id, archived_at, status, workspace_goal";

/** Name + description for a TAPBench task detail intro. */
export function presentTapbenchTaskIntro(
  task: TapbenchTask,
  workspaceGoal?: string | null,
): { name: string; description: string | null } {
  const name = task.title.trim() || "Untitled Task";
  const goal = workspaceGoal?.trim() || "";
  const desc = (task.description || "").trim();
  const topic = (task.root_topic || "").trim();
  const description =
    goal ||
    (desc && desc !== name ? desc : "") ||
    (topic && topic !== name ? topic : "") ||
    "";
  return { name, description: description || null };
}

export async function getTapbenchBenchmarkTask(
  supabase: SupabaseClient | null,
  workspaceId: string,
): Promise<{ task: TapbenchTask; workspace_goal: string | null } | null> {
  const id = workspaceId.trim();
  if (!supabase || !id) return null;
  const ownerUserId = await resolveTapbenchOwnerUserId(supabase);
  if (!ownerUserId) return null;

  const { data, error } = await supabase
    .from("workspaces")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as TapbenchTaskSourceRow & { workspace_goal?: string | null };
  const [task] = selectTapbenchBenchmarkTasks([row], ownerUserId);
  if (!task) return null;
  const goal =
    typeof row.workspace_goal === "string" && row.workspace_goal.trim()
      ? row.workspace_goal.trim()
      : null;
  return { task, workspace_goal: goal };
}
