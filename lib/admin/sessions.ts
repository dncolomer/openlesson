import type { SupabaseClient } from "@supabase/supabase-js";

export async function findBlockForSession(
  adminClient: SupabaseClient,
  sessionId: string
) {
  const { data: directNode } = await adminClient
    .from("blocks")
    .select("id, workspace_id, title")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (directNode) {
    return loadBlockContext(adminClient, directNode);
  }

  const { data: link } = await adminClient
    .from("block_sessions")
    .select("block_id")
    .eq("session_id", sessionId)
    .limit(1)
    .maybeSingle();

  if (!link?.block_id) return null;

  const { data: linkedNode } = await adminClient
    .from("blocks")
    .select("id, workspace_id, title")
    .eq("id", link.block_id)
    .maybeSingle();

  if (!linkedNode) return null;
  return loadBlockContext(adminClient, linkedNode);
}

async function loadBlockContext(
  adminClient: SupabaseClient,
  nodeData: { id: string; workspace_id: string; title: string }
) {
  const { data: planData } = await adminClient
    .from("workspaces")
    .select("id, title, root_topic")
    .eq("id", nodeData.workspace_id)
    .single();

  return {
    ...nodeData,
    plan: planData
      ? { ...planData, display_topic: planData.title || planData.root_topic }
      : undefined,
  };
}

export async function getTapSessionDetail(adminClient: SupabaseClient, sessionId: string) {
  const { data, error } = await adminClient
    .from("workspace_ghc_sessions")
    .select(
      "id, workspace_id, block_id, user_id, guest_user_id, organization_id, status, created_at, completed_at, requested_duration_seconds, duration_seconds, overall_score, marker_scores, analysis, summary, mode"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;

  let plan = null;
  if (data.workspace_id) {
    const { data: planData } = await adminClient
      .from("workspaces")
      .select("id, title, root_topic")
      .eq("id", data.workspace_id)
      .single();
    if (planData) {
      plan = { ...planData, display_topic: planData.title || planData.root_topic };
    }
  }

  let block = null;
  if (data.block_id) {
    const { data: nodeData } = await adminClient
      .from("blocks")
      .select("id, workspace_id, title")
      .eq("id", data.block_id)
      .maybeSingle();
    if (nodeData) {
      block = nodeData;
    }
  }

  let owner = null;
  if (data.user_id) {
    const [{ data: profile }, email] = await Promise.all([
      adminClient.from("profiles").select("id, username").eq("id", data.user_id).maybeSingle(),
      adminClient.auth.admin.getUserById(data.user_id).then((r) => r.data.user?.email || null),
    ]);
    if (profile) owner = { ...profile, email };
  }

  return {
    kind: "tap" as const,
    session: data,
    plan,
    block,
    owner,
  };
}