import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonymousTapGuest } from "./anonymous-tap-guest";
import { createdByApiKeyId } from "./auth";
import type { AuthContext, ErrorCode } from "./types";
import { canAccessAgentWorkspace } from "./workspace-access";
import {
  createPrivateToken,
  getTapScoreBriefForUser,
  hashPrivateToken,
} from "@/lib/tap-score";
import {
  normalizeRedirectUrl,
  normalizeTapLinkMinutes,
  normalizeTapPostSession,
  normalizeWebhookUrl,
  resolveShowEndSessionFromBody,
  resolveTapInteractionKindFromBody,
  resolveTapParticipantType,
  type CreateTapLinkInput,
  type TapInteractionKind,
  type TapParticipantType,
} from "./tap-link-config";
import {
  assertReusableWorkspaceGuest,
  isUuid,
  ResolveWorkspaceGuestError,
} from "./resolve-workspace-guest";
import {
  buildGuestLinkUrl,
  durableGuestLinkPublicToken,
  normalizeGuestLinkAccessMode,
  type GuestLinkAccessMode,
} from "@/lib/guest-link-access";
import {
  knowledgeLinkMintDeniedMessage,
  workspaceAllowsKnowledgeLinkMint,
} from "@/lib/workspace-kind";

export class CreateTapLinkError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode
  ) {
    super(message);
    this.name = "CreateTapLinkError";
  }
}

export interface CreateTapLinkOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  /** When omitted/null, the link scopes to the entire workspace. */
  blockId?: string | null;
  body: CreateTapLinkInput;
  baseUrl: string;
  allowAnonymousForNonAdmin?: boolean;
}

export interface CreatedTapLink {
  id: string;
  workspace_id: string;
  block_id: string | null;
  status: string;
  requested_duration_seconds: number;
  focus_block_ids: string[];
  created_at: string;
  participant_type: TapParticipantType | null;
  post_session: string;
  redirect_url: string | null;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  access_mode: GuestLinkAccessMode;
  public_token: string | null;
  entry_query_params: unknown;
  /** When true (default), guest TAP UI shows End Session. */
  show_end_session: boolean;
  /** conversational (default) | exercise — which TAP shell to open. */
  interaction_kind: TapInteractionKind;
  /** Shareable session URL (stable for public; secret bearer for private). */
  url: string;
  /** Alias of url for backward compatibility. */
  private_url: string;
}

const TAP_LINK_SELECT =
  "id, workspace_id, block_id, status, requested_duration_seconds, focus_block_ids, created_at, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id, access_mode, public_token, entry_query_params, show_end_session, interaction_kind";

function withTapLinkUrl(
  link: Omit<CreatedTapLink, "url" | "private_url" | "show_end_session" | "interaction_kind"> & {
    access_mode?: string | null;
    public_token?: string | null;
    show_end_session?: boolean | null;
    interaction_kind?: string | null;
  },
  baseUrl: string,
  sessionToken: string,
): CreatedTapLink {
  const access_mode: GuestLinkAccessMode =
    link.access_mode === "public" ? "public" : "private";
  // Always listable: prefer stored public_token, fall back to session bearer.
  const bearer = link.public_token?.trim() || sessionToken;
  const url = buildGuestLinkUrl(baseUrl, "tap", bearer);
  const interaction_kind: TapInteractionKind =
    link.interaction_kind === "exercise" ? "exercise" : "conversational";
  return {
    ...link,
    access_mode,
    public_token: bearer,
    entry_query_params: link.entry_query_params ?? [],
    show_end_session: link.show_end_session !== false,
    interaction_kind,
    url,
    private_url: url,
  };
}

async function resolveGuestUserId(
  supabase: SupabaseClient,
  auth: AuthContext,
  body: CreateTapLinkInput,
  participantType: TapParticipantType | null,
  workspace: { id: string; organization_id: string | null; user_id: string | null }
): Promise<string | null> {
  if (auth.guest_user_id) return auth.guest_user_id;

  const guestEmail = typeof body.guest_email === "string" ? body.guest_email.trim().toLowerCase() : "";
  const requestedGuestId = typeof body.guest_user_id === "string" ? body.guest_user_id.trim() : "";

  // Reuse an existing guest identity (same subject for eval / embeddings).
  if (requestedGuestId) {
    try {
      return await assertReusableWorkspaceGuest(supabase, {
        workspaceId: workspace.id,
        organizationId: auth.organization_id || workspace.organization_id,
        guestUserId: requestedGuestId,
        isOrgAdmin: Boolean(auth.is_org_admin && auth.organization_id),
        allowWorkspaceScopedReuse: Boolean(auth.user_id || auth.is_org_admin),
      });
    } catch (err) {
      if (err instanceof ResolveWorkspaceGuestError) {
        throw new CreateTapLinkError(err.message, err.status, err.code);
      }
      throw err;
    }
  }

  if (participantType === "anonymous") {
    const ownerUserId = auth.user_id || workspace.user_id;
    if (!ownerUserId) {
      throw new CreateTapLinkError("Workspace owner is missing", 500, "internal_error");
    }
    const guest = await createAnonymousTapGuest(supabase, {
      workspaceId: workspace.id,
      organizationId: auth.organization_id || workspace.organization_id,
      createdByUserId: ownerUserId,
      createdByApiKeyId: createdByApiKeyId(auth),
    });
    return guest.id;
  }

  if (!guestEmail) return null;

  if (!auth.is_org_admin || !auth.organization_id) {
    throw new CreateTapLinkError(
      "Only organization admins can assign TAP links to named guests",
      403,
      "forbidden"
    );
  }

  const { data: guest } = await supabase
    .from("organization_guest_users")
    .select("id, status")
    .eq("organization_id", auth.organization_id)
    .eq("status", "active")
    .eq("email", guestEmail)
    .single();
  if (!guest) {
    throw new CreateTapLinkError("Guest user not found", 404, "guest_not_found");
  }
  return guest.id;
}

async function resolveAssignedUserId(
  supabase: SupabaseClient,
  auth: AuthContext,
  body: CreateTapLinkInput,
  participantType: TapParticipantType | null,
  workspace: { id: string; organization_id: string | null; user_id: string | null }
): Promise<string | null> {
  const requestedUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (participantType !== "user") {
    if (requestedUserId) {
      throw new CreateTapLinkError(
        "user_id requires participant_type=user",
        400,
        "validation_error"
      );
    }
    return null;
  }

  if (!requestedUserId || !isUuid(requestedUserId)) {
    throw new CreateTapLinkError("A valid user_id is required for member TAP links", 400, "validation_error");
  }

  const ownerUserId = auth.user_id || workspace.user_id;
  if (requestedUserId === ownerUserId) {
    return requestedUserId;
  }

  if (auth.organization_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", requestedUserId)
      .eq("organization_id", auth.organization_id)
      .maybeSingle();
    if (profile) return requestedUserId;
  }

  const { data: groupSession } = await supabase
    .from("block_sessions")
    .select("user_id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", requestedUserId)
    .limit(1)
    .maybeSingle();

  if (groupSession) return requestedUserId;

  if (!auth.is_org_admin && ownerUserId !== auth.user_id) {
    throw new CreateTapLinkError("Not authorized to assign TAP links to this user", 403, "forbidden");
  }

  throw new CreateTapLinkError("User is not a member of this workspace", 404, "not_found");
}

export async function createWorkspaceTapLink(options: CreateTapLinkOptions): Promise<CreatedTapLink> {
  const { supabase, auth, workspaceId, body, baseUrl, allowAnonymousForNonAdmin = false } = options;
  const blockId =
    typeof options.blockId === "string" && options.blockId.trim() ? options.blockId.trim() : null;

  const minutes = normalizeTapLinkMinutes(body.minutes);
  const postSession = normalizeTapPostSession(body.post_session);
  const redirectUrl = normalizeRedirectUrl(body.redirect_url);
  const webhookUrl = normalizeWebhookUrl(body.completion_webhook_url);

  if (postSession === "redirect_url" && !redirectUrl) {
    throw new CreateTapLinkError(
      "redirect_url is required when post_session is redirect_url",
      400,
      "validation_error"
    );
  }

  const participantType = resolveTapParticipantType(body);

  let workspace: {
    id: string;
    user_id: string | null;
    organization_id: string | null;
    guest_user_id: string | null;
    workspace_kind?: string | null;
  };

  if (blockId) {
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, workspace_id, workspaces!inner(id, user_id, organization_id, guest_user_id, workspace_kind)")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();

    if (blockError || !block) {
      throw new CreateTapLinkError("Block not found", 404, "block_not_found");
    }

    const workspaceRaw = (block as { workspaces: unknown }).workspaces;
    workspace = (Array.isArray(workspaceRaw) ? workspaceRaw[0] : workspaceRaw) as {
      id: string;
      user_id: string | null;
      organization_id: string | null;
      guest_user_id: string | null;
      workspace_kind?: string | null;
    };
  } else {
    const { data: workspaceRow, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, user_id, organization_id, guest_user_id, workspace_kind")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspaceRow) {
      throw new CreateTapLinkError("Workspace not found", 404, "workspace_not_found");
    }

    workspace = workspaceRow;
  }

  if (!canAccessAgentWorkspace(auth, workspace)) {
    throw new CreateTapLinkError("Workspace not found", 404, "workspace_not_found");
  }

  if (!workspaceAllowsKnowledgeLinkMint(workspace.workspace_kind)) {
    throw new CreateTapLinkError(knowledgeLinkMintDeniedMessage(), 403, "forbidden");
  }

  const ownerUserId = auth.user_id || workspace.user_id;
  if (!ownerUserId) {
    throw new CreateTapLinkError("Workspace owner is missing", 500, "internal_error");
  }

  if (participantType === "anonymous" && !auth.is_org_admin && !allowAnonymousForNonAdmin && !auth.user_id) {
    throw new CreateTapLinkError("Only workspace owners can create anonymous TAP links", 403, "forbidden");
  }

  const assignedUserId = await resolveAssignedUserId(supabase, auth, body, participantType, workspace);
  const guestUserId = assignedUserId ? null : await resolveGuestUserId(supabase, auth, body, participantType, workspace);

  if (participantType === "user" && !assignedUserId) {
    throw new CreateTapLinkError("A valid user_id is required for member TAP links", 400, "validation_error");
  }

  if (participantType === "anonymous" && !guestUserId) {
    throw new CreateTapLinkError("Failed to provision anonymous TAP participant", 500, "internal_error");
  }

  try {
    await getTapScoreBriefForUser(workspaceId, ownerUserId, blockId ? [blockId] : [], true, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not authorized";
    if (message === "Workspace not found") {
      throw new CreateTapLinkError("Workspace not found", 404, "workspace_not_found");
    }
    throw new CreateTapLinkError(message, 403, "forbidden");
  }

  const accessMode = normalizeGuestLinkAccessMode(body);
  const showEndSession = resolveShowEndSessionFromBody(body);
  const interactionKind = resolveTapInteractionKindFromBody(body);
  // Always store public_token so list endpoints can rebuild the share URL after reload.
  const sessionToken = createPrivateToken();
  const publicToken = durableGuestLinkPublicToken(sessionToken);

  const { data: link, error } = await supabase
    .from("workspace_tap_sessions")
    .insert({
      workspace_id: workspaceId,
      user_id: ownerUserId,
      guest_user_id: guestUserId,
      assigned_user_id: assignedUserId,
      organization_id: auth.organization_id || workspace.organization_id,
      created_by_api_key_id: createdByApiKeyId(auth),
      private_token_hash: hashPrivateToken(sessionToken),
      access_mode: accessMode,
      public_token: publicToken,
      entry_query_params: [],
      show_end_session: showEndSession,
      interaction_kind: interactionKind,
      requested_duration_seconds: Math.round(minutes * 60),
      block_id: blockId,
      mode: "curious",
      focus_block_ids: blockId ? [blockId] : [],
      voice_id: "ara",
      status: "pending",
      participant_type: participantType,
      post_session: postSession,
      redirect_url: postSession === "redirect_url" ? redirectUrl : null,
      completion_webhook_url: webhookUrl,
    })
    .select(TAP_LINK_SELECT)
    .single();

  if (error || !link) {
    console.error("[create-tap-link] Insert error:", error);
    throw new CreateTapLinkError("Failed to create TAP link", 500, "internal_error");
  }

  return withTapLinkUrl(link, baseUrl, sessionToken);
}

export interface ReissueTapLinkOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  linkId: string;
  baseUrl: string;
}

/**
 * Rotate the private token on an existing TAP link row.
 * Keeps guest, scope, duration, and post-session settings on the same card.
 * Invalidates any previously issued URL for this link.
 */
export async function reissueWorkspaceTapLink(
  options: ReissueTapLinkOptions
): Promise<CreatedTapLink> {
  const { supabase, auth, workspaceId, linkId, baseUrl } = options;

  if (!isUuid(linkId)) {
    throw new CreateTapLinkError("linkId must be a UUID", 400, "validation_error");
  }

  const { data: existing, error: loadError } = await supabase
    .from("workspace_tap_sessions")
    .select(
      "id, workspace_id, block_id, status, requested_duration_seconds, focus_block_ids, created_at, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id, private_token_hash, access_mode, public_token, entry_query_params, workspaces(id, user_id, organization_id, guest_user_id)"
    )
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (loadError) {
    console.error("[reissue-tap-link] Load error:", loadError);
    throw new CreateTapLinkError("Failed to load TAP link", 500, "internal_error");
  }
  if (!existing?.private_token_hash && !existing?.public_token) {
    throw new CreateTapLinkError("TAP link not found", 404, "not_found");
  }

  const workspaceRaw = (existing as { workspaces: unknown }).workspaces;
  const workspace = (Array.isArray(workspaceRaw) ? workspaceRaw[0] : workspaceRaw) as {
    id: string;
    user_id: string | null;
    organization_id: string | null;
    guest_user_id: string | null;
  } | null;

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    throw new CreateTapLinkError("Workspace not found", 404, "workspace_not_found");
  }

  // Reissue rotates bearer; always keep public_token in sync so list URLs stay copyable.
  const sessionToken = createPrivateToken();
  if (!sessionToken) {
    throw new CreateTapLinkError("Failed to mint TAP link token", 500, "internal_error");
  }

  const { data: link, error } = await supabase
    .from("workspace_tap_sessions")
    .update({
      private_token_hash: hashPrivateToken(sessionToken),
      public_token: durableGuestLinkPublicToken(sessionToken),
      status: "pending",
      started_at: null,
      completed_at: null,
      session_id: null,
      duration_seconds: 0,
    })
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .select(TAP_LINK_SELECT)
    .single();

  if (error || !link) {
    console.error("[reissue-tap-link] Update error:", error);
    throw new CreateTapLinkError("Failed to reissue TAP link", 500, "internal_error");
  }

  return withTapLinkUrl(link, baseUrl, sessionToken);
}