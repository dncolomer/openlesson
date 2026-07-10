import type { SupabaseClient } from "@supabase/supabase-js";

export async function findPlanNodeForSession(
  adminClient: SupabaseClient,
  sessionId: string
) {
  const { data: directNode } = await adminClient
    .from("plan_nodes")
    .select("id, plan_id, title")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (directNode) {
    return loadPlanNodeContext(adminClient, directNode);
  }

  const { data: link } = await adminClient
    .from("plan_node_sessions")
    .select("plan_node_id")
    .eq("session_id", sessionId)
    .limit(1)
    .maybeSingle();

  if (!link?.plan_node_id) return null;

  const { data: linkedNode } = await adminClient
    .from("plan_nodes")
    .select("id, plan_id, title")
    .eq("id", link.plan_node_id)
    .maybeSingle();

  if (!linkedNode) return null;
  return loadPlanNodeContext(adminClient, linkedNode);
}

async function loadPlanNodeContext(
  adminClient: SupabaseClient,
  nodeData: { id: string; plan_id: string; title: string }
) {
  const { data: planData } = await adminClient
    .from("learning_plans")
    .select("id, title, root_topic")
    .eq("id", nodeData.plan_id)
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
      "id, plan_id, plan_node_id, user_id, guest_user_id, organization_id, status, created_at, completed_at, requested_duration_seconds, duration_seconds, overall_score, marker_scores, analysis, summary, mode"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;

  let plan = null;
  if (data.plan_id) {
    const { data: planData } = await adminClient
      .from("learning_plans")
      .select("id, title, root_topic")
      .eq("id", data.plan_id)
      .single();
    if (planData) {
      plan = { ...planData, display_topic: planData.title || planData.root_topic };
    }
  }

  let planNode = null;
  if (data.plan_node_id) {
    const { data: nodeData } = await adminClient
      .from("plan_nodes")
      .select("id, plan_id, title")
      .eq("id", data.plan_node_id)
      .maybeSingle();
    if (nodeData) {
      planNode = nodeData;
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
    planNode,
    owner,
  };
}