/**
 * Hidden owner container for first-class flows and knowledge regions.
 * Users never pick a Verification or Calibration workspace type; this
 * finds or inserts the internal row that still owns workspace_id FKs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  productFlowOwnerTitle,
  productFlowOwnerWorkspaceKind,
  type ProductFlowKind,
} from "@/lib/product-flow";

export async function listProductFlowWorkspaceIds(
  supabase: SupabaseClient,
  userId: string,
  kind: ProductFlowKind,
): Promise<string[]> {
  const workspaceKind = productFlowOwnerWorkspaceKind(kind);
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_kind", workspaceKind)
    .neq("status", "archived");
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => String(row.id || "")).filter(Boolean);
}

export async function ensureProductFlowOwnerWorkspace(
  supabase: SupabaseClient,
  userId: string,
  kind: ProductFlowKind,
): Promise<{ id: string } | { error: string }> {
  const existing = await listProductFlowWorkspaceIds(supabase, userId, kind);
  if (existing[0]) return { id: existing[0]! };

  const title = productFlowOwnerTitle(kind);
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      user_id: userId,
      title,
      root_topic: title,
      status: "active",
      source_type: "topic",
      notes: "",
      workspace_kind: productFlowOwnerWorkspaceKind(kind),
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    return { error: error?.message || "Failed to create flow owner" };
  }
  return { id: String(data.id) };
}
