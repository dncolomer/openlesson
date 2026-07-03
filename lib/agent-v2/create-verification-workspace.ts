import type { SupabaseClient } from "@supabase/supabase-js";
import { callXaiJSON, DEFAULT_MODEL, userMessage } from "@/lib/xai-client";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import type { AuthContext } from "./types";

interface GeneratedBlock {
  id: string;
  title: string;
  description: string;
  is_start?: boolean;
  next?: string[];
}

interface GeneratedWorkspace {
  title: string;
  blocks: GeneratedBlock[];
}

export async function createVerificationWorkspaceFromPrompt(
  supabase: SupabaseClient,
  auth: AuthContext,
  initialPrompt: string
): Promise<{ workspace: Record<string, unknown>; blocks: Record<string, unknown>[] }> {
  const generated = await callXaiJSON<GeneratedWorkspace>(
    [
      userMessage(
        `Create a performance learning workspace from this prompt. Break it into assessable blocks for learning verification and evidence-based gap analysis.\n\nPrompt:\n${initialPrompt}\n\nReturn ONLY JSON:\n{\n  "title": "concise workspace title",\n  "blocks": [\n    { "id": "a", "title": "Block title", "description": "What the learner should demonstrate", "is_start": true, "next": ["b"] }\n  ]\n}\n\nRules:\n- Create 3 to 6 blocks.\n- Blocks are assessable learning/performance units.\n- Use short stable ids only for linking within this response.`
      ),
    ],
    { model: DEFAULT_MODEL, maxTokens: 1800, temperature: 0.3 }
  );

  if (!generated.success || !generated.data?.blocks?.length) {
    throw new Error("Failed to generate verification workspace");
  }

  let ownerUserId = auth.user_id;
  if (!ownerUserId && auth.organization_id) {
    const { data: orgAdmin } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", auth.organization_id)
      .eq("is_org_admin", true)
      .limit(1)
      .maybeSingle();
    ownerUserId = orgAdmin?.id || null;
  }
  if (!ownerUserId) {
    throw new Error("No user available to own this workspace");
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("learning_plans")
    .insert({
      user_id: ownerUserId,
      organization_id: auth.organization_id,
      guest_user_id: auth.guest_user_id,
      title: generated.data.title || "Verification Workspace",
      root_topic: initialPrompt.slice(0, 160),
      status: "active",
      source_type: "topic",
      notes: initialPrompt,
      description: "Created via Evidence API demo",
      is_agent_session: true,
    })
    .select("id, title, root_topic, status, notes, description, created_at, updated_at")
    .single();

  if (workspaceError || !workspace) {
    console.error("[create-verification-workspace] Workspace insert error:", workspaceError);
    throw new Error(workspaceError?.message || "Failed to create workspace");
  }

  const blockIdMap = new Map<string, string>();
  for (const block of generated.data.blocks) {
    const { data: insertedBlock, error: blockError } = await supabase
      .from("plan_nodes")
      .insert({
        plan_id: workspace.id,
        title: block.title,
        description: block.description || "",
        is_start: block.is_start === true,
        next_node_ids: [],
        status: "available",
      })
      .select("id, title, description, is_start")
      .single();

    if (blockError || !insertedBlock) continue;
    blockIdMap.set(block.id, insertedBlock.id);
  }

  for (const block of generated.data.blocks) {
    const dbId = blockIdMap.get(block.id);
    if (!dbId || !Array.isArray(block.next)) continue;
    const nextIds = block.next.map((id) => blockIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (nextIds.length) {
      await supabase.from("plan_nodes").update({ next_node_ids: nextIds }).eq("id", dbId);
    }
  }

  await persistSkillGridPositions(supabase, skillGridNodesFromRefs(generated.data.blocks, blockIdMap));

  const { data: blocks } = await supabase
    .from("plan_nodes")
    .select("id, title, description, is_start, next_node_ids, status, created_at")
    .eq("plan_id", workspace.id)
    .order("created_at", { ascending: true });

  return { workspace, blocks: blocks || [] };
}