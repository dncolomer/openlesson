import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/ile-link";
import type { EntryQueryParams, GuestLinkAccessMode } from "@/lib/guest-link-access";
import { resolveGuestForLinkQueryParams } from "@/lib/guest-link-query-guest";
import {
  ILE_LINK_REVOKED_MESSAGE,
  isGuestLinkRevoked,
} from "@/lib/pow-api/invalidate-guest-links";
import { createAnonymousTapGuest } from "@/lib/pow-api/anonymous-tap-guest";
import {
  resolveGuestLinkAttribution,
  resolveIleActingParticipantId,
} from "@/lib/session-participant-identity";
import {
  ILE_SESSION_MODE_DEFAULT,
  normalizeIleSessionMode,
  type IleSessionMode,
} from "@/lib/ile-mode";

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
  accessMode: GuestLinkAccessMode;
  /** When true (default), guest UI shows End Session. */
  showEndSession: boolean;
  /** learning (default) | project — durable on the share link. */
  sessionMode: IleSessionMode;
  /** Guest / assigned participant — never the workspace owner. */
  subjectId: string;
}

const LINK_SELECT =
  "id, workspace_id, block_id, user_id, guest_user_id, assigned_user_id, organization_id, session_id, status, participant_type, private_token_hash, access_mode, public_token, entry_query_params, show_end_session, session_mode";

export async function resolveIleLinkAccess(
  accessToken: string,
  entryQueryParams: EntryQueryParams = {},
): Promise<ResolvedIleLinkContext | { error: string; status: number }> {
  const token = accessToken.trim();
  if (!token) return { error: "Access token required", status: 401 };

  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);

  // Private bearer hash; legacy public_token still resolves existing rows.
  let link: Record<string, unknown> | null = null;
  const { data: byHash } = await supabase
    .from("workspace_ile_links")
    .select(LINK_SELECT)
    .eq("private_token_hash", tokenHash)
    .maybeSingle();
  link = byHash;

  if (!link) {
    const { data: byPublic } = await supabase
      .from("workspace_ile_links")
      .select(LINK_SELECT)
      .eq("public_token", token)
      .eq("access_mode", "public")
      .maybeSingle();
    link = byPublic;
  }

  if (!link) {
    return { error: "Invalid or expired access link", status: 404 };
  }

  if (isGuestLinkRevoked(link.status as string | null | undefined)) {
    return { error: ILE_LINK_REVOKED_MESSAGE, status: 403 };
  }

  if (!link.user_id) {
    return { error: "Workspace owner is missing", status: 500 };
  }

  const accessMode: GuestLinkAccessMode =
    link.access_mode === "public" ? "public" : "private";
  const showEndSession = link.show_end_session !== false;
  const sessionMode = normalizeIleSessionMode(
    (link as { session_mode?: unknown }).session_mode,
    ILE_SESSION_MODE_DEFAULT,
  );
  const ownerUserId = String(link.user_id);
  const baseGuestUserId = (link.guest_user_id as string | null) ?? null;
  const assignedUserId = (link.assigned_user_id as string | null) ?? null;

  let guestUserId = baseGuestUserId;
  if (!assignedUserId) {
    const resolved = await resolveGuestForLinkQueryParams(supabase, {
      linkKind: "ile",
      linkId: String(link.id),
      workspaceId: String(link.workspace_id),
      organizationId: (link as { organization_id?: string | null }).organization_id ?? null,
      ownerUserId,
      baseGuestUserId,
      params: entryQueryParams,
    });
    guestUserId = resolved.guestUserId;

    // Guest share links must always have a guest subject — never owner.
    if (!guestUserId) {
      const created = await createAnonymousTapGuest(supabase, {
        workspaceId: String(link.workspace_id),
        organizationId: (link as { organization_id?: string | null }).organization_id ?? null,
        createdByUserId: ownerUserId,
        guestType: "anonymous_ile_link",
      });
      guestUserId = created.id;
      await supabase
        .from("workspace_ile_links")
        .update({ guest_user_id: guestUserId })
        .eq("id", String(link.id));
    }
  }

  const attribution = resolveGuestLinkAttribution({
    guestUserId,
    assignedUserId,
  });
  if (!attribution.userId && !attribution.guestUserId) {
    return { error: "ILE guest participant is not provisioned", status: 500 };
  }

  return {
    supabase,
    linkId: String(link.id),
    workspaceId: String(link.workspace_id),
    blockId: String(link.block_id),
    ownerUserId,
    guestUserId: attribution.guestUserId,
    assignedUserId: attribution.userId,
    sessionId: (link.session_id as string | null) ?? null,
    status: String(link.status),
    participantType: (link.participant_type as string | null) ?? null,
    accessMode,
    showEndSession,
    sessionMode,
    subjectId: resolveIleActingParticipantId({
      ownerUserId,
      assignedUserId: attribution.userId,
      guestUserId: attribution.guestUserId,
    }),
  };
}

export async function resolveIleLinkSessionAccess(
  accessToken: string,
  sessionId: string,
  entryQueryParams: EntryQueryParams = {},
): Promise<ResolvedIleLinkContext | { error: string; status: number }> {
  const base = await resolveIleLinkAccess(accessToken, entryQueryParams);
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
  | { sessionId: string; resumed: boolean; blockTitle: string; sessionMode: IleSessionMode }
  | { error: string; status: number }
> {
  const { supabase, workspaceId, blockId, ownerUserId, linkId, guestUserId, sessionMode } = ctx;

  // Resume only when the linked practice session is still live.
  // Completed / ended / missing sessions fall through to a new run (same guest).
  if (ctx.sessionId && ctx.status !== "completed") {
    const { data: existing } = await supabase
      .from("sessions")
      .select("id, status, metadata")
      .eq("id", ctx.sessionId)
      .maybeSingle();

    if (existing && (existing.status === "active" || existing.status === "paused")) {
      // Keep durable mode on resume (link is source of truth if metadata missing).
      const meta = (existing.metadata || {}) as Record<string, unknown>;
      if (meta.session_mode !== sessionMode || meta.ile_session_mode !== sessionMode) {
        await supabase
          .from("sessions")
          .update({
            metadata: {
              ...meta,
              session_mode: sessionMode,
              ile_session_mode: sessionMode,
            },
          })
          .eq("id", existing.id);
      }
      const { data: block } = await supabase
        .from("blocks")
        .select("title")
        .eq("id", blockId)
        .maybeSingle();
      return {
        sessionId: existing.id,
        resumed: true,
        blockTitle: block?.title || "Practice",
        sessionMode,
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
        source_link_kind: "ile",
        source_link_id: linkId,
        guest_user_id: guestUserId,
        ile_guest_access: true,
        session_mode: sessionMode,
        ile_session_mode: sessionMode,
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

  return { sessionId: session.id, resumed: false, blockTitle, sessionMode };
}
