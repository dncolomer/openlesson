import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTapScoreBrief,
  getTapScoreBriefForUser,
  hashPrivateToken,
} from "@/lib/tap-score";
import type { TapPostSessionMode } from "@/lib/agent-v2/tap-link-config";

export interface ResolvedTapSessionContext {
  supabase: ReturnType<typeof createAdminClient>;
  workspaceId: string;
  /** Participant for PoW / attribution (assigned user, null for guest, owner otherwise). */
  userId: string | null;
  guestUserId: string | null;
  assignedUserId: string | null;
  /**
   * Workspace owner (session.user_id || workspace.user_id).
   * Use for TAP brief / ownership-scoped content — not guest or assignee.
   */
  workspaceOwnerUserId: string | null;
  organizationId: string | null;
  blockId: string | null;
  focusSessionId: string | null;
  tapSessionId: string;
  postSession: TapPostSessionMode;
  redirectUrl: string | null;
  completionWebhookUrl: string | null;
  existingSession: Record<string, unknown> | null;
}

export const TAP_SESSION_SELECT =
  "id, workspace_id, user_id, guest_user_id, assigned_user_id, organization_id, block_id, session_id, status, started_at, requested_duration_seconds, focus_block_ids, post_session, redirect_url, completion_webhook_url, workspaces!inner(user_id)";

const TAP_SESSION_SELECT_NO_JOIN =
  "id, workspace_id, user_id, guest_user_id, assigned_user_id, organization_id, block_id, session_id, status, started_at, requested_duration_seconds, focus_block_ids, post_session, redirect_url, completion_webhook_url";

export function workspaceOwnerFromSession(session: {
  user_id?: string | null;
  workspaces?: { user_id?: string } | Array<{ user_id?: string }> | null;
}): string | null {
  const workspaceOwner = Array.isArray(session.workspaces)
    ? session.workspaces[0]?.user_id
    : session.workspaces?.user_id;
  return session.user_id || workspaceOwner || null;
}

/**
 * Participant identity for access + PoW attribution.
 * Does NOT substitute assignee/guest for workspace owner (brief uses workspaceOwnerFromSession).
 */
export function participantAuthFromSession(session: {
  user_id: string | null;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  workspaces?: { user_id?: string } | Array<{ user_id?: string }>;
}): { userId: string | null; guestUserId: string | null; assignedUserId: string | null } {
  if (session.assigned_user_id) {
    return {
      userId: session.assigned_user_id,
      guestUserId: null,
      assignedUserId: session.assigned_user_id,
    };
  }

  if (session.guest_user_id) {
    return {
      userId: null,
      guestUserId: session.guest_user_id,
      assignedUserId: null,
    };
  }

  return {
    userId: workspaceOwnerFromSession(session),
    guestUserId: null,
    assignedUserId: null,
  };
}

/**
 * User id to pass to getTapScoreBriefForUser after private-token access is resolved.
 * Always the workspace owner when available so guest/assigned links do not fail ownership.
 */
export function selectTapBriefUserId(access: {
  workspaceOwnerUserId?: string | null;
  userId?: string | null;
}): string | null {
  return access.workspaceOwnerUserId || access.userId || null;
}

/**
 * Load TAP brief for an already-resolved session access context.
 * Uses workspace owner for ownership-gated brief (guest/assigned private links).
 * Cookie path falls back to getTapScoreBrief when no owner id is known.
 */
export async function loadTapScoreBriefForAccess(
  access: {
    workspaceId: string;
    workspaceOwnerUserId?: string | null;
    userId?: string | null;
  },
  focusNodeIds: string[] = [],
  focusSessionId?: string | null
) {
  const briefUserId = selectTapBriefUserId(access);
  if (briefUserId) {
    return getTapScoreBriefForUser(
      access.workspaceId,
      briefUserId,
      focusNodeIds,
      true,
      focusSessionId
    );
  }
  return getTapScoreBrief(access.workspaceId, focusNodeIds, focusSessionId);
}

export async function resolveTapSessionAccess(input: {
  privateToken?: string;
  workspaceId?: string;
  tapSessionId?: string;
  blockId?: string | null;
  focusSessionId?: string | null;
}): Promise<ResolvedTapSessionContext | { error: string; status: number }> {
  const privateToken = input.privateToken?.trim() || "";
  const tapSessionId = input.tapSessionId?.trim() || "";

  if (privateToken) {
    const supabase = createAdminClient();
    const { data: session, error } = await supabase
      .from("workspace_tap_sessions")
      .select(TAP_SESSION_SELECT)
      .eq("private_token_hash", hashPrivateToken(privateToken))
      .single();

    if (error || !session) return { error: "TAP block not found", status: 404 };
    if (tapSessionId && session.id !== tapSessionId) {
      return { error: "TAP session ID does not match private link", status: 403 };
    }

    if (session.assigned_user_id) {
      const authSupabase = await createClient();
      const {
        data: { user },
      } = await authSupabase.auth.getUser();
      if (!user) return { error: "Sign in required for this TAP link", status: 401 };
      if (user.id !== session.assigned_user_id) {
        return { error: "This TAP link is assigned to another user", status: 403 };
      }
    }

    const participant = participantAuthFromSession(session);
    const workspaceOwnerUserId = workspaceOwnerFromSession(session);

    return {
      supabase,
      workspaceId: session.workspace_id,
      userId: participant.userId,
      guestUserId: participant.guestUserId,
      assignedUserId: participant.assignedUserId,
      workspaceOwnerUserId,
      organizationId: session.organization_id || null,
      blockId: session.block_id || null,
      focusSessionId: session.session_id || null,
      tapSessionId: session.id,
      postSession: (session.post_session as TapPostSessionMode) || "redirect_workspace",
      redirectUrl: session.redirect_url || null,
      completionWebhookUrl: session.completion_webhook_url || null,
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
    await getTapScoreBrief(workspaceId, input.blockId ? [input.blockId] : [], input.focusSessionId || null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 404;
    return { error: message, status };
  }

  const supabase = createAdminClient();
  let existingSession: Record<string, unknown> | null = null;

  if (tapSessionId) {
    const { data: session, error } = await supabase
      .from("workspace_tap_sessions")
      .select(TAP_SESSION_SELECT_NO_JOIN)
      .eq("id", tapSessionId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !session) return { error: "TAP session not found", status: 404 };
    if (session.assigned_user_id && session.assigned_user_id !== user.id) {
      return { error: "Not authorized", status: 403 };
    }
    if (session.user_id && session.user_id !== user.id && !session.assigned_user_id) {
      return { error: "Not authorized", status: 403 };
    }
    existingSession = session;
  }

  return {
    supabase,
    workspaceId,
    userId: user.id,
    guestUserId: null,
    assignedUserId: existingSession?.assigned_user_id?.toString() || null,
    workspaceOwnerUserId: user.id,
    organizationId: null,
    blockId: input.blockId || existingSession?.block_id?.toString() || null,
    focusSessionId: input.focusSessionId || existingSession?.session_id?.toString() || null,
    tapSessionId: tapSessionId || "",
    postSession: (existingSession?.post_session as TapPostSessionMode) || "redirect_workspace",
    redirectUrl: (existingSession?.redirect_url as string | null) || null,
    completionWebhookUrl: (existingSession?.completion_webhook_url as string | null) || null,
    existingSession,
  };
}
