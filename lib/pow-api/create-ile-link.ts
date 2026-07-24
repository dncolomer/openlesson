import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonymousTapGuest } from "./anonymous-tap-guest";
import { createdByApiKeyId } from "./auth";
import type { AuthContext, ErrorCode } from "./types";
import { canAccessAgentWorkspace } from "./workspace-access";
import { createPrivateToken, hashPrivateToken } from "@/lib/ile-link";
import {
  normalizeTapParticipantType,
  resolveShowEndSessionFromBody,
  resolveTapParticipantType,
  type CreateTapLinkInput,
  type TapParticipantType,
} from "./tap-link-config";
import {
  assertReusableWorkspaceGuest,
  isUuid,
  ResolveWorkspaceGuestError,
} from "./resolve-workspace-guest";
import {
  buildGuestLinkUrl,
  normalizeGuestLinkAccessMode,
  type GuestLinkAccessMode,
} from "@/lib/guest-link-access";

export class CreateIleLinkError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode
  ) {
    super(message);
    this.name = "CreateIleLinkError";
  }
}

export interface CreateIleLinkOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  /** Required — ILE practice is scoped to a single block. */
  blockId: string;
  body: CreateTapLinkInput;
  baseUrl: string;
  allowAnonymousForNonAdmin?: boolean;
}

export interface CreatedIleLink {
  id: string;
  workspace_id: string;
  block_id: string;
  status: string;
  created_at: string;
  participant_type: TapParticipantType | null;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  access_mode: GuestLinkAccessMode;
  public_token: string | null;
  entry_query_params: unknown;
  show_end_session: boolean;
  url: string;
  private_url: string;
}

const ILE_LINK_SELECT =
  "id, workspace_id, block_id, status, created_at, participant_type, guest_user_id, assigned_user_id, access_mode, public_token, entry_query_params, show_end_session";

function withIleLinkUrl(
  link: Omit<CreatedIleLink, "url" | "private_url" | "show_end_session"> & {
    access_mode?: string | null;
    public_token?: string | null;
    show_end_session?: boolean | null;
  },
  baseUrl: string,
  sessionToken: string,
): CreatedIleLink {
  const access_mode: GuestLinkAccessMode =
    link.access_mode === "public" ? "public" : "private";
  const url = buildGuestLinkUrl(baseUrl, "ile", sessionToken);
  return {
    ...link,
    access_mode,
    public_token: access_mode === "public" ? link.public_token ?? sessionToken : null,
    entry_query_params: link.entry_query_params ?? [],
    show_end_session: link.show_end_session !== false,
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
        throw new CreateIleLinkError(err.message, err.status, err.code);
      }
      throw err;
    }
  }

  if (participantType === "anonymous") {
    const ownerUserId = auth.user_id || workspace.user_id;
    if (!ownerUserId) {
      throw new CreateIleLinkError("Workspace owner is missing", 500, "internal_error");
    }
    try {
      const guest = await createAnonymousTapGuest(supabase, {
        workspaceId: workspace.id,
        organizationId: auth.organization_id || workspace.organization_id,
        createdByUserId: ownerUserId,
        createdByApiKeyId: createdByApiKeyId(auth),
        guestType: "anonymous_ile_link",
      });
      return guest.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to provision anonymous ILE participant";
      throw new CreateIleLinkError(message, 500, "internal_error");
    }
  }

  if (!guestEmail) return null;

  if (!auth.is_org_admin || !auth.organization_id) {
    throw new CreateIleLinkError(
      "Only organization admins can assign ILE links to named guests",
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
    throw new CreateIleLinkError("Guest user not found", 404, "guest_not_found");
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
      throw new CreateIleLinkError(
        "user_id requires participant_type=user",
        400,
        "validation_error"
      );
    }
    return null;
  }

  if (!requestedUserId || !isUuid(requestedUserId)) {
    throw new CreateIleLinkError("A valid user_id is required for member ILE links", 400, "validation_error");
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
    throw new CreateIleLinkError("Not authorized to assign ILE links to this user", 403, "forbidden");
  }

  throw new CreateIleLinkError("User is not a member of this workspace", 404, "not_found");
}

export async function createWorkspaceIleLink(options: CreateIleLinkOptions): Promise<CreatedIleLink> {
  const { supabase, auth, workspaceId, body, baseUrl, allowAnonymousForNonAdmin = false } = options;
  const blockId = typeof options.blockId === "string" ? options.blockId.trim() : "";

  if (!blockId || !isUuid(blockId)) {
    throw new CreateIleLinkError("blockId is required for ILE links", 400, "validation_error");
  }

  const participantType =
    resolveTapParticipantType(body) || normalizeTapParticipantType(body.participant_type) || "anonymous";

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, workspace_id, workspaces!inner(id, user_id, organization_id, guest_user_id)")
    .eq("id", blockId)
    .eq("workspace_id", workspaceId)
    .single();

  if (blockError || !block) {
    throw new CreateIleLinkError("Block not found", 404, "block_not_found");
  }

  const workspaceRaw = (block as { workspaces: unknown }).workspaces;
  const workspace = (Array.isArray(workspaceRaw) ? workspaceRaw[0] : workspaceRaw) as {
    id: string;
    user_id: string | null;
    organization_id: string | null;
    guest_user_id: string | null;
  };

  if (!canAccessAgentWorkspace(auth, workspace)) {
    throw new CreateIleLinkError("Workspace not found", 404, "workspace_not_found");
  }

  const ownerUserId = auth.user_id || workspace.user_id;
  if (!ownerUserId) {
    throw new CreateIleLinkError("Workspace owner is missing", 500, "internal_error");
  }

  if (participantType === "anonymous" && !auth.is_org_admin && !allowAnonymousForNonAdmin && !auth.user_id) {
    throw new CreateIleLinkError("Only workspace owners can create anonymous ILE links", 403, "forbidden");
  }

  const assignedUserId = await resolveAssignedUserId(supabase, auth, body, participantType, workspace);
  const guestUserId = assignedUserId
    ? null
    : await resolveGuestUserId(supabase, auth, body, participantType, workspace);

  if (participantType === "user" && !assignedUserId) {
    throw new CreateIleLinkError("A valid user_id is required for member ILE links", 400, "validation_error");
  }

  if (participantType === "anonymous" && !guestUserId) {
    throw new CreateIleLinkError("Failed to provision anonymous ILE participant", 500, "internal_error");
  }

  const accessMode = normalizeGuestLinkAccessMode(body);
  const showEndSession = resolveShowEndSessionFromBody(body);
  const sessionToken = createPrivateToken();
  const publicToken = accessMode === "public" ? sessionToken : null;

  const { data: link, error } = await supabase
    .from("workspace_ile_links")
    .insert({
      workspace_id: workspaceId,
      block_id: blockId,
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
      status: "pending",
      participant_type: participantType,
    })
    .select(ILE_LINK_SELECT)
    .single();

  if (error || !link) {
    console.error("[create-ile-link] Insert error:", error);
    throw new CreateIleLinkError("Failed to create ILE link", 500, "internal_error");
  }

  return withIleLinkUrl(link, baseUrl, sessionToken);
}

export interface ReissueIleLinkOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  linkId: string;
  baseUrl: string;
}

/**
 * Rotate the private token on an existing ILE link row.
 * Keeps guest, block scope, and participant settings on the same card.
 * Invalidates any previously issued URL for this link.
 */
export async function reissueWorkspaceIleLink(
  options: ReissueIleLinkOptions
): Promise<CreatedIleLink> {
  const { supabase, auth, workspaceId, linkId, baseUrl } = options;

  if (!isUuid(linkId)) {
    throw new CreateIleLinkError("linkId must be a UUID", 400, "validation_error");
  }

  const { data: existing, error: loadError } = await supabase
    .from("workspace_ile_links")
    .select(
      "id, workspace_id, block_id, status, created_at, participant_type, guest_user_id, assigned_user_id, private_token_hash, access_mode, public_token, entry_query_params, workspaces(id, user_id, organization_id, guest_user_id)"
    )
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (loadError) {
    console.error("[reissue-ile-link] Load error:", loadError);
    throw new CreateIleLinkError("Failed to load ILE link", 500, "internal_error");
  }
  if (!existing?.private_token_hash && !existing?.public_token) {
    throw new CreateIleLinkError("ILE link not found", 404, "not_found");
  }

  const workspaceRaw = (existing as { workspaces: unknown }).workspaces;
  const workspace = (Array.isArray(workspaceRaw) ? workspaceRaw[0] : workspaceRaw) as {
    id: string;
    user_id: string | null;
    organization_id: string | null;
    guest_user_id: string | null;
  } | null;

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    throw new CreateIleLinkError("Workspace not found", 404, "workspace_not_found");
  }

  const isPublic = existing.access_mode === "public";
  const sessionToken = isPublic
    ? String(existing.public_token || "")
    : createPrivateToken();
  if (!sessionToken) {
    throw new CreateIleLinkError("Public ILE link is missing public_token", 500, "internal_error");
  }

  const { data: link, error } = await supabase
    .from("workspace_ile_links")
    .update({
      ...(isPublic
        ? {}
        : { private_token_hash: hashPrivateToken(sessionToken), public_token: null }),
      status: "pending",
      started_at: null,
      completed_at: null,
      session_id: null,
    })
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .select(ILE_LINK_SELECT)
    .single();

  if (error || !link) {
    console.error("[reissue-ile-link] Update error:", error);
    throw new CreateIleLinkError("Failed to reissue ILE link", 500, "internal_error");
  }

  return withIleLinkUrl(link, baseUrl, sessionToken);
}
