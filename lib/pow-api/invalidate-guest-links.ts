/**
 * Invalidate (revoke) TAP / ILE guest share links so tokens stop granting access.
 * Pure helpers over a Supabase client — unit-testable without HTTP handlers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext, ErrorCode } from "./types";
import { canAccessAgentWorkspace } from "./workspace-access";
import { isUuid } from "./resolve-workspace-guest";

export const GUEST_LINK_REVOKED_STATUS = "revoked" as const;

export const TAP_LINK_REVOKED_MESSAGE = "This TAP link has been revoked";
export const ILE_LINK_REVOKED_MESSAGE = "This ILE link has been revoked";

export function isGuestLinkRevoked(status: string | null | undefined): boolean {
  return status === GUEST_LINK_REVOKED_STATUS;
}

export class InvalidateGuestLinkError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "InvalidateGuestLinkError";
  }
}

export interface InvalidateOneResult {
  id: string;
  workspace_id: string;
  status: typeof GUEST_LINK_REVOKED_STATUS;
}

export interface InvalidateAllResult {
  workspace_id: string;
  invalidated_count: number;
  ids: string[];
}

type WorkspaceRow = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  guest_user_id: string | null;
};

async function loadWorkspaceForAuth(
  supabase: SupabaseClient,
  workspaceId: string,
  auth: AuthContext,
): Promise<WorkspaceRow> {
  if (!isUuid(workspaceId)) {
    throw new InvalidateGuestLinkError("workspaceId must be a UUID", 400, "validation_error");
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[invalidate-guest-links] Workspace load error:", error);
    throw new InvalidateGuestLinkError("Failed to load workspace", 500, "internal_error");
  }
  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    throw new InvalidateGuestLinkError("Workspace not found", 404, "workspace_not_found");
  }
  return workspace as WorkspaceRow;
}

/**
 * Revoke a single TAP share link. Idempotent when already revoked.
 */
export async function invalidateTapLinkOne(options: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  linkId: string;
}): Promise<InvalidateOneResult> {
  const { supabase, auth, workspaceId, linkId } = options;
  await loadWorkspaceForAuth(supabase, workspaceId, auth);

  if (!isUuid(linkId)) {
    throw new InvalidateGuestLinkError("linkId must be a UUID", 400, "validation_error");
  }

  const { data: existing, error: loadError } = await supabase
    .from("workspace_tap_sessions")
    .select("id, workspace_id, status, private_token_hash, public_token")
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (loadError) {
    console.error("[invalidate-tap-link] Load error:", loadError);
    throw new InvalidateGuestLinkError("Failed to load TAP link", 500, "internal_error");
  }
  if (!existing || (!existing.private_token_hash && !existing.public_token)) {
    throw new InvalidateGuestLinkError("TAP link not found", 404, "not_found");
  }

  if (isGuestLinkRevoked(existing.status as string)) {
    return {
      id: existing.id as string,
      workspace_id: existing.workspace_id as string,
      status: GUEST_LINK_REVOKED_STATUS,
    };
  }

  const { data: updated, error } = await supabase
    .from("workspace_tap_sessions")
    .update({ status: GUEST_LINK_REVOKED_STATUS })
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .select("id, workspace_id, status")
    .single();

  if (error || !updated) {
    console.error("[invalidate-tap-link] Update error:", error);
    throw new InvalidateGuestLinkError("Failed to invalidate TAP link", 500, "internal_error");
  }

  return {
    id: updated.id as string,
    workspace_id: updated.workspace_id as string,
    status: GUEST_LINK_REVOKED_STATUS,
  };
}

/**
 * Revoke every shareable TAP link in a workspace (token-bearing, not already revoked).
 */
export async function invalidateTapLinksAll(options: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
}): Promise<InvalidateAllResult> {
  const { supabase, auth, workspaceId } = options;
  await loadWorkspaceForAuth(supabase, workspaceId, auth);

  // Shareable TAP list uses private_token_hash; also revoke public_token rows.
  const { data: withPrivate, error: errPrivate } = await supabase
    .from("workspace_tap_sessions")
    .update({ status: GUEST_LINK_REVOKED_STATUS })
    .eq("workspace_id", workspaceId)
    .neq("status", GUEST_LINK_REVOKED_STATUS)
    .not("private_token_hash", "is", null)
    .select("id");

  if (errPrivate) {
    console.error("[invalidate-tap-links-all] private update error:", errPrivate);
    throw new InvalidateGuestLinkError("Failed to invalidate TAP links", 500, "internal_error");
  }

  const { data: withPublic, error: errPublic } = await supabase
    .from("workspace_tap_sessions")
    .update({ status: GUEST_LINK_REVOKED_STATUS })
    .eq("workspace_id", workspaceId)
    .neq("status", GUEST_LINK_REVOKED_STATUS)
    .is("private_token_hash", null)
    .not("public_token", "is", null)
    .select("id");

  if (errPublic) {
    console.error("[invalidate-tap-links-all] public update error:", errPublic);
    throw new InvalidateGuestLinkError("Failed to invalidate TAP links", 500, "internal_error");
  }

  const ids = [
    ...((withPrivate || []) as { id: string }[]).map((r) => r.id),
    ...((withPublic || []) as { id: string }[]).map((r) => r.id),
  ];

  return {
    workspace_id: workspaceId,
    invalidated_count: ids.length,
    ids,
  };
}

/**
 * Revoke a single ILE share link. Idempotent when already revoked.
 */
export async function invalidateIleLinkOne(options: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  linkId: string;
}): Promise<InvalidateOneResult> {
  const { supabase, auth, workspaceId, linkId } = options;
  await loadWorkspaceForAuth(supabase, workspaceId, auth);

  if (!isUuid(linkId)) {
    throw new InvalidateGuestLinkError("linkId must be a UUID", 400, "validation_error");
  }

  const { data: existing, error: loadError } = await supabase
    .from("workspace_ile_links")
    .select("id, workspace_id, status, private_token_hash, public_token")
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (loadError) {
    console.error("[invalidate-ile-link] Load error:", loadError);
    throw new InvalidateGuestLinkError("Failed to load ILE link", 500, "internal_error");
  }
  if (!existing || (!existing.private_token_hash && !existing.public_token)) {
    throw new InvalidateGuestLinkError("ILE link not found", 404, "not_found");
  }

  if (isGuestLinkRevoked(existing.status as string)) {
    return {
      id: existing.id as string,
      workspace_id: existing.workspace_id as string,
      status: GUEST_LINK_REVOKED_STATUS,
    };
  }

  const { data: updated, error } = await supabase
    .from("workspace_ile_links")
    .update({ status: GUEST_LINK_REVOKED_STATUS })
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .select("id, workspace_id, status")
    .single();

  if (error || !updated) {
    console.error("[invalidate-ile-link] Update error:", error);
    throw new InvalidateGuestLinkError("Failed to invalidate ILE link", 500, "internal_error");
  }

  return {
    id: updated.id as string,
    workspace_id: updated.workspace_id as string,
    status: GUEST_LINK_REVOKED_STATUS,
  };
}

/**
 * Revoke every ILE share link in a workspace (not already revoked).
 */
export async function invalidateIleLinksAll(options: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
}): Promise<InvalidateAllResult> {
  const { supabase, auth, workspaceId } = options;
  await loadWorkspaceForAuth(supabase, workspaceId, auth);

  const { data: rows, error } = await supabase
    .from("workspace_ile_links")
    .update({ status: GUEST_LINK_REVOKED_STATUS })
    .eq("workspace_id", workspaceId)
    .neq("status", GUEST_LINK_REVOKED_STATUS)
    .select("id");

  if (error) {
    console.error("[invalidate-ile-links-all] Update error:", error);
    throw new InvalidateGuestLinkError("Failed to invalidate ILE links", 500, "internal_error");
  }

  const ids = ((rows || []) as { id: string }[]).map((r) => r.id);
  return {
    workspace_id: workspaceId,
    invalidated_count: ids.length,
    ids,
  };
}
