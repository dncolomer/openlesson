/**
 * Shared list-workspaces logic for REST and MCP.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export type ListAgentWorkspacesInput = {
  status?: string | null;
  limit?: unknown;
  offset?: unknown;
};

export async function listAgentWorkspaces(
  supabase: SupabaseClient,
  auth: AuthContext,
  input: ListAgentWorkspacesInput = {},
) {
  const limit = boundedInt(input.limit, 20, 1, 100);
  const offset = boundedInt(input.offset, 0, 0, 10_000);
  const status =
    typeof input.status === "string" && input.status.trim() ? input.status.trim() : null;

  let query = supabase
    .from("workspaces")
    .select("id, title, root_topic, status, notes, workspace_goal, created_at, updated_at", {
      count: "exact",
    })
    .or(
      auth.user_id
        ? `user_id.eq.${auth.user_id},organization_id.eq.${auth.organization_id}`
        : `organization_id.eq.${auth.organization_id}`,
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    workspaces: data || [],
    pagination: {
      total: count ?? 0,
      limit,
      offset,
      has_more: offset + limit < (count ?? 0),
    },
  };
}
