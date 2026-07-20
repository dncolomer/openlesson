import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonymousTapGuest } from "./anonymous-tap-guest";
import { createdByApiKeyId } from "./auth";
import type { AuthContext, ErrorCode } from "./types";
import { canAccessAgentWorkspace } from "./workspace-access";
import {
  buildTapScoreSessionUrl,
  createPrivateToken,
  getTapScoreBriefForUser,
  hashPrivateToken,
} from "@/lib/tap-score";
import {
  normalizeRedirectUrl,
  normalizeTapLinkMinutes,
  normalizeTapPostSession,
  normalizeWebhookUrl,
  resolveTapParticipantType,
  type CreateTapLinkInput,
  type TapParticipantType,
} from "./tap-link-config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

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
  private_url: string;
}

async function resolveGuestUserId(
  supabase: SupabaseClient,
  auth: AuthContext,
  body: CreateTapLinkInput,
  participantType: TapParticipantType | null,
  workspace: { id: string; organization_id: string | null; user_id: string | null }
): Promise<string | null> {
  if (auth.guest_user_id) return auth.guest_user_id;

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

  const guestEmail = typeof body.guest_email === "string" ? body.guest_email.trim().toLowerCase() : "";
  const requestedGuestId = typeof body.guest_user_id === "string" ? body.guest_user_id.trim() : "";

  if (!requestedGuestId && !guestEmail) return null;

  if (!auth.is_org_admin || !auth.organization_id) {
    throw new CreateTapLinkError(
      "Only organization admins can assign TAP links to named guests",
      403,
      "forbidden"
    );
  }

  let guestQuery = supabase
    .from("organization_guest_users")
    .select("id, status")
    .eq("organization_id", auth.organization_id)
    .eq("status", "active");
  guestQuery = requestedGuestId ? guestQuery.eq("id", requestedGuestId) : guestQuery.eq("email", guestEmail);
  const { data: guest } = await guestQuery.single();
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
  };

  if (blockId) {
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, workspace_id, workspaces!inner(id, user_id, organization_id, guest_user_id)")
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
    };
  } else {
    const { data: workspaceRow, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, user_id, organization_id, guest_user_id")
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

  const privateToken = createPrivateToken();
  const { data: link, error } = await supabase
    .from("workspace_tap_sessions")
    .insert({
      workspace_id: workspaceId,
      user_id: ownerUserId,
      guest_user_id: guestUserId,
      assigned_user_id: assignedUserId,
      organization_id: auth.organization_id || workspace.organization_id,
      created_by_api_key_id: createdByApiKeyId(auth),
      private_token_hash: hashPrivateToken(privateToken),
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
    .select(
      "id, workspace_id, block_id, status, requested_duration_seconds, focus_block_ids, created_at, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id"
    )
    .single();

  if (error || !link) {
    console.error("[create-tap-link] Insert error:", error);
    throw new CreateTapLinkError("Failed to create TAP link", 500, "internal_error");
  }

  return {
    ...link,
    private_url: buildTapScoreSessionUrl(baseUrl, privateToken),
  };
}