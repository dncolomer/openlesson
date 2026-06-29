import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGhcScoreBrief, hashPrivateToken } from "@/lib/ghc-score";

export interface ResolvedGhlSessionContext {
  supabase: ReturnType<typeof createAdminClient>;
  planId: string;
  userId: string | null;
  guestUserId: string | null;
  organizationId: string | null;
  planNodeId: string | null;
  focusSessionId: string | null;
  ghlSessionId: string;
  existingSession: Record<string, unknown> | null;
}

export async function resolveGhlSessionAccess(input: {
  privateToken?: string;
  planId?: string;
  ghlSessionId?: string;
  planNodeId?: string | null;
  focusSessionId?: string | null;
}): Promise<ResolvedGhlSessionContext | { error: string; status: number }> {
  const privateToken = input.privateToken?.trim() || "";
  const ghlSessionId = input.ghlSessionId?.trim() || "";

  if (privateToken) {
    const supabase = createAdminClient();
    const { data: session, error } = await supabase
      .from("workspace_ghc_sessions")
      .select("id, plan_id, user_id, guest_user_id, organization_id, plan_node_id, session_id, status, learning_plans!inner(user_id)")
      .eq("private_token_hash", hashPrivateToken(privateToken))
      .single();

    if (error || !session) return { error: "GHL Score block not found", status: 404 };
    if (session.status === "completed") return { error: "GHL Score block is already completed", status: 409 };
    if (ghlSessionId && session.id !== ghlSessionId) {
      return { error: "ghlSessionId does not match private link session", status: 403 };
    }

    return {
      supabase,
      planId: session.plan_id,
      userId: session.user_id || (session as { learning_plans?: { user_id?: string } }).learning_plans?.user_id || null,
      guestUserId: session.guest_user_id || null,
      organizationId: session.organization_id || null,
      planNodeId: session.plan_node_id || null,
      focusSessionId: session.session_id || null,
      ghlSessionId: session.id,
      existingSession: session,
    };
  }

  const planId = input.planId?.trim() || "";
  if (!planId) return { error: "planId is required", status: 400 };

  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };

  try {
    await getGhcScoreBrief(planId, input.planNodeId ? [input.planNodeId] : [], input.focusSessionId || null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 404;
    return { error: message, status };
  }

  const supabase = createAdminClient();
  let existingSession: Record<string, unknown> | null = null;

  if (ghlSessionId) {
    const { data: session, error } = await supabase
      .from("workspace_ghc_sessions")
      .select("id, plan_id, user_id, guest_user_id, organization_id, plan_node_id, session_id, status")
      .eq("id", ghlSessionId)
      .eq("plan_id", planId)
      .single();

    if (error || !session) return { error: "GHL session not found", status: 404 };
    if (session.user_id && session.user_id !== user.id) {
      return { error: "Not authorized", status: 403 };
    }
    if (session.status === "completed") return { error: "GHL session is already completed", status: 409 };
    existingSession = session;
  }

  return {
    supabase,
    planId,
    userId: user.id,
    guestUserId: null,
    organizationId: null,
    planNodeId: input.planNodeId || existingSession?.plan_node_id?.toString() || null,
    focusSessionId: input.focusSessionId || existingSession?.session_id?.toString() || null,
    ghlSessionId: ghlSessionId || "",
    existingSession,
  };
}