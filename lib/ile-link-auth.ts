import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/ile-link";

export interface ResolvedIleLinkContext {
  supabase: ReturnType<typeof createAdminClient>;
  linkId: string;
  workspaceId: string;
  blockId: string;
  ownerUserId: string;
  guestUserId: string | null;
  assignedUserId: string | null;
  sessionId: string | null;
  status: string;
  participantType: string | null;
  /** Synthetic user for routes that expect a user id (workspace owner). */
  actingUser: Pick<User, "id">;
}

const LINK_SELECT =
  "id, workspace_id, block_id, user_id, guest_user_id, assigned_user_id, session_id, status, participant_type, private_token_hash";

export async function resolveIleLinkAccess(
  accessToken: string
): Promise<ResolvedIleLinkContext | { error: string; status: number }> {
  const token = accessToken.trim();
  if (!token) return { error: "Access token required", status: 401 };

  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);

  const { data: link, error } = await supabase
    .from("workspace_ile_links")
    .select(LINK_SELECT)
    .eq("private_token_hash", tokenHash)
    .maybeSingle();

  if (error || !link) {
    return { error: "Invalid or expired access link", status: 404 };
  }

  if (link.status === "revoked") {
    return { error: "This ILE link has been revoked", status: 403 };
  }

  if (!link.user_id) {
    return { error: "Workspace owner is missing", status: 500 };
  }

  return {
    supabase,
    linkId: link.id,
    workspaceId: link.workspace_id,
    blockId: link.block_id,
    ownerUserId: link.user_id,
    guestUserId: link.guest_user_id,
    assignedUserId: link.assigned_user_id,
    sessionId: link.session_id,
    status: link.status,
    participantType: link.participant_type,
    actingUser: { id: link.user_id },
  };
}

export async function resolveIleLinkSessionAccess(
  accessToken: string,
  sessionId: string
): Promise<ResolvedIleLinkContext | { error: string; status: number }> {
  const base = await resolveIleLinkAccess(accessToken);
  if ("error" in base) return base;

  if (base.sessionId && base.sessionId === sessionId) {
    return base;
  }

  const { data: session } = await base.supabase
    .from("sessions")
    .select("id, metadata")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return { error: "Session not found", status: 404 };
  }

  const metadata = (session.metadata || {}) as {
    workspace_id?: string;
    ile_link_id?: string;
  };

  if (metadata.ile_link_id === base.linkId) {
    return base;
  }

  if (metadata.workspace_id === base.workspaceId) {
    const { data: blockSession } = await base.supabase
      .from("block_sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .eq("workspace_id", base.workspaceId)
      .eq("block_id", base.blockId)
      .limit(1)
      .maybeSingle();
    if (blockSession) return base;
  }

  return { error: "Session not found", status: 404 };
}

/**
 * Ensure an ILE practice session exists for this link (create or resume).
 * Sessions run as the workspace owner with guest attribution in metadata.
 *
 * Links are multi-use: after a run completes, reopening the same private URL
 * starts a fresh practice session while keeping the same guest_user_id so
 * knowledge-config / eval identity stays stable.
 */
export async function ensureIleLinkSession(
  ctx: ResolvedIleLinkContext
): Promise<
  | { sessionId: string; resumed: boolean; blockTitle: string }
  | { error: string; status: number }
> {
  const { supabase, workspaceId, blockId, ownerUserId, linkId, guestUserId } = ctx;

  // Resume only when the linked practice session is still live.
  // Completed / ended / missing sessions fall through to a new run (same guest).
  if (ctx.sessionId && ctx.status !== "completed") {
    const { data: existing } = await supabase
      .from("sessions")
      .select("id, status")
      .eq("id", ctx.sessionId)
      .maybeSingle();

    if (existing && (existing.status === "active" || existing.status === "paused")) {
      const { data: block } = await supabase
        .from("blocks")
        .select("title")
        .eq("id", blockId)
        .maybeSingle();
      return {
        sessionId: existing.id,
        resumed: true,
        blockTitle: block?.title || "Practice",
      };
    }
  }

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, workspace_id, title, description, planning_prompt, status")
    .eq("id", blockId)
    .eq("workspace_id", workspaceId)
    .single();

  if (blockError || !block) {
    return { error: "Block not found", status: 404 };
  }

  if (block.status === "locked") {
    return { error: "Block is locked", status: 403 };
  }

  const blockTitle = block.title || "Practice";
  const planningPrompt = block.planning_prompt || block.description || null;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: ownerUserId,
      problem: blockTitle,
      status: "active",
      planning_prompt: planningPrompt,
      metadata: {
        workspace_id: workspaceId,
        block_id: blockId,
        block_title: blockTitle,
        ile_link_id: linkId,
        guest_user_id: guestUserId,
        ile_guest_access: true,
      },
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("[ile-link] Session create error:", sessionError);
    return { error: "Failed to create ILE session", status: 500 };
  }

  await supabase
    .from("blocks")
    .update({
      status: "in_progress",
      session_id: session.id,
      ...(planningPrompt ? { planning_prompt: planningPrompt } : {}),
    })
    .eq("id", blockId);

  await supabase.from("block_sessions").insert({
    block_id: blockId,
    session_id: session.id,
    user_id: ownerUserId,
    workspace_id: workspaceId,
  });

  const now = new Date().toISOString();
  await supabase
    .from("workspace_ile_links")
    .update({
      session_id: session.id,
      status: "active",
      started_at: now,
      completed_at: null,
    })
    .eq("id", linkId);

  return { sessionId: session.id, resumed: false, blockTitle };
}
