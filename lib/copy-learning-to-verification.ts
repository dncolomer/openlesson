/**
 * Copy goals, context (notes, links, file rows), and knowledge regions from a
 * Learning workspace into a new Verification workspace. Does not copy the map.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORKSPACE_KIND_KNOWLEDGE_REGION,
  isKnowledgeRegionWorkspace,
} from "@/lib/workspace-kind";

const REGION_COPY_COLUMNS = [
  "name",
  "description",
  "embedding_model_id",
  "dim",
  "centroid",
  "cohort_cohesion",
  "mean_radius",
  "cosine_threshold",
  "subject_count",
  "subjects",
  "created_by",
] as const;

export async function copyLearningWorkspaceToVerification(
  supabase: SupabaseClient,
  options: { sourceWorkspaceId: string; ownerUserId: string; title: string },
): Promise<{ workspaceId: string }> {
  const title = options.title.trim().slice(0, 120);
  if (!title) throw new Error("Name is required");

  const { data: source, error: sourceError } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, description, notes, workspace_kind")
    .eq("id", options.sourceWorkspaceId)
    .maybeSingle();

  if (sourceError || !source) throw new Error("Workspace not found");
  if (source.user_id !== options.ownerUserId) throw new Error("Forbidden");
  if (isKnowledgeRegionWorkspace(source.workspace_kind)) {
    throw new Error("Verification workspaces cannot be copied this way.");
  }

  const { data: created, error: createError } = await supabase
    .from("workspaces")
    .insert({
      user_id: options.ownerUserId,
      organization_id: source.organization_id,
      title,
      root_topic: title,
      description: source.description ?? null,
      notes: source.notes ?? "",
      status: "active",
      source_type: "topic",
      is_public: false,
      workspace_kind: WORKSPACE_KIND_KNOWLEDGE_REGION,
      original_workspace_id: source.id,
    })
    .select("id")
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || "Failed to create Verification workspace");
  }

  const workspaceId = created.id as string;

  const { data: goals } = await supabase
    .from("workspace_goals")
    .select("text, sort_order")
    .eq("workspace_id", source.id);
  if (goals && goals.length > 0) {
    await supabase.from("workspace_goals").insert(
      goals.map((goal) => ({
        workspace_id: workspaceId,
        text: goal.text,
        sort_order: goal.sort_order ?? 0,
      })),
    );
  }

  const { data: links } = await supabase
    .from("workspace_external_resources")
    .select(
      "title, url, resource_type, description, source, dantes_topic_slug, meta, sort_order",
    )
    .eq("workspace_id", source.id);
  if (links && links.length > 0) {
    await supabase.from("workspace_external_resources").insert(
      links.map((link) => ({
        ...link,
        workspace_id: workspaceId,
        user_id: options.ownerUserId,
      })),
    );
  }

  const { data: files } = await supabase
    .from("workspace_files")
    .select("file_name, file_size, mime_type, xai_file_id")
    .eq("workspace_id", source.id);
  if (files && files.length > 0) {
    await supabase.from("workspace_files").insert(
      files.map((file) => ({
        ...file,
        workspace_id: workspaceId,
        user_id: options.ownerUserId,
      })),
    );
  }

  const { data: regions } = await supabase
    .from("custom_verification_models")
    .select(REGION_COPY_COLUMNS.join(", "))
    .eq("workspace_id", source.id);
  if (regions && regions.length > 0) {
    await supabase.from("custom_verification_models").insert(
      (regions as unknown as Record<string, unknown>[]).map((region) => ({
        ...region,
        workspace_id: workspaceId,
      })),
    );
  }

  return { workspaceId };
}
