import type { SupabaseClient } from "@supabase/supabase-js";
import { toSkillGridNodes, withSkillGridPositions } from "@/lib/skill-grid-positions";

export interface ForkWorkspaceResult {
  workspaceId: string;
  blockCount: number;
}

/**
 * Deep-copy a workspace and its blocks (exact fork).
 * Used by remix API and All-You-Can-Learn fulfillment.
 */
export async function forkWorkspaceExactCopy(
  supabase: SupabaseClient,
  params: {
    sourceWorkspaceId: string;
    ownerUserId: string;
    title?: string;
    originalWorkspaceId?: string;
    isAyclFork?: boolean;
  }
): Promise<ForkWorkspaceResult> {
  const { data: sourcePlan, error: planQueryError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", params.sourceWorkspaceId)
    .single();

  if (planQueryError || !sourcePlan) {
    throw new Error("Source workspace not found");
  }

  const title = (params.title || sourcePlan.title || sourcePlan.root_topic || "Workspace").trim();

  const { data: sourceNodes, error: nodesError } = await supabase
    .from("blocks")
    .select("*")
    .eq("workspace_id", params.sourceWorkspaceId);

  if (nodesError) {
    throw new Error(`Could not fetch source blocks: ${nodesError.message}`);
  }

  const { data: newPlan, error: planError } = await supabase
    .from("workspaces")
    .insert({
      user_id: params.ownerUserId,
      root_topic: title,
      title,
      status: "active",
      is_public: false,
      is_all_you_can_learn: false,
      author_id: params.ownerUserId,
      original_workspace_id: params.originalWorkspaceId ?? params.sourceWorkspaceId,
      description: sourcePlan.description ?? null,
      notes: sourcePlan.notes ?? null,
      cover_image_url: sourcePlan.cover_image_url ?? null,
      source_type: sourcePlan.source_type ?? null,
      source_url: sourcePlan.source_url ?? null,
      source_summary: sourcePlan.source_summary ?? null,
    })
    .select("id")
    .single();

  if (planError || !newPlan) {
    throw new Error(`Could not create forked workspace: ${planError?.message || "unknown"}`);
  }

  const blockIdMap = new Map<string, string>();
  for (const node of sourceNodes || []) {
    blockIdMap.set(node.id, crypto.randomUUID());
  }

  const newNodes = (sourceNodes || []).map((node) => ({
    id: blockIdMap.get(node.id),
    workspace_id: newPlan.id,
    title: node.title,
    description: node.description,
    is_start: node.is_start || false,
    next_block_ids: (node.next_block_ids || [])
      .map((id: string) => blockIdMap.get(id))
      .filter(Boolean),
    status: "available",
    planning_prompt: node.planning_prompt ?? null,
  }));

  const nodesWithPositions = withSkillGridPositions(
    newNodes.map((node, index) => ({
      ...node,
      id: node.id as string,
      position_x: sourceNodes?.[index]?.position_x ?? undefined,
      position_y: sourceNodes?.[index]?.position_y ?? undefined,
    })),
    toSkillGridNodes(
      newNodes.map((node, index) => ({
        id: node.id as string,
        title: node.title,
        is_start: node.is_start,
        next_block_ids: (node.next_block_ids || []).filter(
          (nextId: string | undefined): nextId is string => Boolean(nextId)
        ),
        status: node.status,
        position_x: sourceNodes?.[index]?.position_x ?? undefined,
        position_y: sourceNodes?.[index]?.position_y ?? undefined,
      }))
    )
  );

  const { error: insertError } = await supabase.from("blocks").insert(nodesWithPositions);

  if (insertError) {
    if (insertError.message.includes("schema cache") && insertError.message.includes("position_")) {
      const { error: retryError } = await supabase.from("blocks").insert(newNodes);
      if (retryError) {
        await supabase.from("workspaces").delete().eq("id", newPlan.id);
        throw new Error(`Could not copy blocks: ${retryError.message}`);
      }
    } else {
      await supabase.from("workspaces").delete().eq("id", newPlan.id);
      throw new Error(`Could not copy blocks: ${insertError.message}`);
    }
  }

  await supabase
    .from("workspaces")
    .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
    .eq("id", params.sourceWorkspaceId);

  return {
    workspaceId: newPlan.id,
    blockCount: newNodes.length,
  };
}