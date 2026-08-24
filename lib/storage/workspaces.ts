// Workspace & block persistence
import { createClient } from "@/lib/supabase/client";
import type { Workspace, Block } from "@/lib/domain/types";

// ---- Learning Plans ----

export async function getWorkspaces(options?: { includeArchived?: boolean }): Promise<Workspace[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id);

  if (!options?.includeArchived) {
    query = query.neq("status", "archived");
  }

   
  const { data } = await query.order("created_at", { ascending: false });

  return (data || []).map((p: any) => ({
    id: p.id,
    title: p.title || p.root_topic,
    root_topic: p.root_topic,
    status: p.status || "active",
    created_at: p.created_at,
    is_public: p.is_public || false,
    author_id: p.author_id,
    remix_count: p.remix_count || 0,
    original_workspace_id: p.original_workspace_id,
    source_type: p.source_type,
    source_url: p.source_url,
    source_summary: p.source_summary,
    notes: p.notes,
    cover_image_url: p.cover_image_url,
    workspace_kind: p.workspace_kind === "knowledge_region" ? "knowledge_region" : "standard",
    is_group: p.is_group || false,
    is_all_you_can_learn: Boolean(p.is_all_you_can_learn),
  }));
}

export async function getBlocks(workspaceId: string): Promise<Block[]> {
  const supabase = createClient();

   
  const { data } = await supabase
    .from("blocks")
    .select("*")
    .eq("workspace_id", workspaceId);

  return (data || []).map((n: any) => ({
    id: n.id,
    workspace_id: n.workspace_id,
    title: n.title,
    description: n.description || "",
    is_start: n.is_start || false,
    next_block_ids: n.next_block_ids || [],
    status: n.status || "not_started",
  }));
}

export async function getIncompleteNodes(): Promise<(Block & { workspaceTitle: string })[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

   
  const { data: plans } = await supabase
    .from("workspaces")
    .select("id, root_topic")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!plans || plans.length === 0) return [];

  const workspaceIds = plans.map((p: any) => p.id);
  const workspaceTitles = new Map(plans.map((p: any) => [p.id, p.root_topic]));

   
  const { data: nodes } = await supabase
    .from("blocks")
    .select("*")
    .in("workspace_id", workspaceIds)
    .in("status", ["not_started", "in_progress"]);

  return (nodes || []).map((n: any) => ({
    id: n.id,
    workspace_id: n.workspace_id,
    title: n.title,
    description: n.description || "",
    is_start: n.is_start || false,
    next_block_ids: n.next_block_ids || [],
    status: n.status || "not_started",
    workspaceTitle: workspaceTitles.get(n.workspace_id) || "",
  }));
}

export async function getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("workspaces")
    .select(
      "id, root_topic, status, created_at, is_public, author_id, user_id, remix_count, original_workspace_id, source_type, source_url, source_summary, notes, workspace_kind"
    )
    .eq("id", workspaceId)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    title: data.root_topic,
    root_topic: data.root_topic,
    status: data.status || "active",
    created_at: data.created_at,
    is_public: data.is_public,
    author_id: data.author_id,
    remix_count: data.remix_count || 0,
    original_workspace_id: data.original_workspace_id,
    source_type: data.source_type || "topic",
    source_url: data.source_url,
    source_summary: data.source_summary,
    notes: data.notes || undefined,
    workspace_kind:
      data.workspace_kind === "knowledge_region" ? "knowledge_region" : "standard",
  };
}

export async function updatePlanNotes(workspaceId: string, notes: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("workspaces")
    .update({ notes })
    .eq("id", workspaceId)
    .eq("user_id", user.id);

  if (error) throw new Error("Failed to update plan notes: " + error.message);
}

export async function updatePlanVisibility(
  workspaceId: string,
  userId: string,
  isPublic: boolean
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("workspaces")
    .update({ is_public: isPublic, author_id: userId })
    .eq("id", workspaceId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Could not update plan visibility");
  }
}

