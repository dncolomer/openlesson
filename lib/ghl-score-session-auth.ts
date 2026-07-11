import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGhcScoreBrief, hashPrivateToken } from "@/lib/ghc-score";

export interface ResolvedGhlSessionContext {
  supabase: ReturnType<typeof createAdminClient>;
  workspaceId: string;
  userId: string | null;
  guestUserId: string | null;
  organizationId: string | null;
  blockId: string | null;
  focusSessionId: string | null;
  ghlSessionId: string;
  existingSession: Record<string, unknown> | null;
}

export async function resolveGhlSessionAccess(input: {
  privateToken?: string;
  workspaceId?: string;
  ghlSessionId?: string;
  blockId?: string | null;
  focusSessionId?: string | null;
}): Promise<ResolvedGhlSessionContext | { error: string; status: number }> {
  const privateToken = input.privateToken?.trim() || "";
  const ghlSessionId = input.ghlSessionId?.trim() || "";

  if (privateToken) {
    const supabase = createAdminClient();
    const { data: session, error } = await supabase
      .from("workspace_ghc_sessions")
      .select("id, workspace_id, user_id, guest_user_id, organization_id, block_id, session_id, status, workspaces!inner(user_id)")
      .eq("private_token_hash", hashPrivateToken(privateToken))
      .single();

    if (error || !session) return { error: "TAP block not found", status: 404 };
    if (session.status === "completed") return { error: "TAP block is already completed", status: 409 };
    if (ghlSessionId && session.id !== ghlSessionId) {
      return { error: "TAP session ID does not match private link", status: 403 };
    }

    return {
      supabase,
      workspaceId: session.workspace_id,
      userId: session.user_id || (session as { workspaces?: { user_id?: string } }).workspaces?.user_id || null,
      guestUserId: session.guest_user_id || null,
      organizationId: session.organization_id || null,
      blockId: session.block_id || null,
      focusSessionId: session.session_id || null,
      ghlSessionId: session.id,
      existingSession: session,
    };
  }

  const workspaceId = input.workspaceId?.trim() || "";
  if (!workspaceId) return { error: "workspaceId is required", status: 400 };

  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };

  try {
    await getGhcScoreBrief(workspaceId, input.blockId ? [input.blockId] : [], input.focusSessionId || null);
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
      .select("id, workspace_id, user_id, guest_user_id, organization_id, block_id, session_id, status")
      .eq("id", ghlSessionId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !session) return { error: "TAP session not found", status: 404 };
    if (session.user_id && session.user_id !== user.id) {
      return { error: "Not authorized", status: 403 };
    }
    if (session.status === "completed") return { error: "TAP session is already completed", status: 409 };
    existingSession = session;
  }

  return {
    supabase,
    workspaceId,
    userId: user.id,
    guestUserId: null,
    organizationId: null,
    blockId: input.blockId || existingSession?.block_id?.toString() || null,
    focusSessionId: input.focusSessionId || existingSession?.session_id?.toString() || null,
    ghlSessionId: ghlSessionId || "",
    existingSession,
  };
}