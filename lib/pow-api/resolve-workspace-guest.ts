/**
 * Resolve a guest_user_id that may be reused for a new TAP/ILE link so scoring
 * and knowledge-config embeddings stay on the same subject identity.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export class ResolveWorkspaceGuestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "guest_not_found" | "forbidden" | "validation_error",
  ) {
    super(message);
    this.name = "ResolveWorkspaceGuestError";
  }
}

/**
 * Allow reusing a guest when:
 * - it is an active org guest in the caller's organization (admin path), or
 * - it already belongs to this workspace (workspace_id on guest row), or
 * - it already appears on a TAP/ILE link for this workspace (owner reuse path).
 */
export async function assertReusableWorkspaceGuest(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    organizationId: string | null;
    guestUserId: string;
    /** Org admins may attach named org guests by id. */
    isOrgAdmin: boolean;
    /** Workspace owners may reuse guests already tied to this workspace. */
    allowWorkspaceScopedReuse: boolean;
  },
): Promise<string> {
  const guestUserId = input.guestUserId.trim();
  if (!isUuid(guestUserId)) {
    throw new ResolveWorkspaceGuestError("guest_user_id must be a valid UUID", 400, "validation_error");
  }

  const { data: guest, error } = await supabase
    .from("organization_guest_users")
    .select("id, organization_id, workspace_id, status")
    .eq("id", guestUserId)
    .maybeSingle();

  if (error || !guest) {
    throw new ResolveWorkspaceGuestError("Guest user not found", 404, "guest_not_found");
  }
  if (guest.status !== "active") {
    throw new ResolveWorkspaceGuestError("Guest user is not active", 404, "guest_not_found");
  }

  if (
    input.isOrgAdmin &&
    input.organizationId &&
    guest.organization_id === input.organizationId
  ) {
    return guest.id;
  }

  if (input.allowWorkspaceScopedReuse) {
    if (guest.workspace_id === input.workspaceId) {
      return guest.id;
    }

    const { data: tapHit } = await supabase
      .from("workspace_tap_sessions")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("guest_user_id", guestUserId)
      .limit(1)
      .maybeSingle();
    if (tapHit) return guest.id;

    const { data: ileHit } = await supabase
      .from("workspace_ile_links")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("guest_user_id", guestUserId)
      .limit(1)
      .maybeSingle();
    if (ileHit) return guest.id;
  }

  throw new ResolveWorkspaceGuestError(
    "Guest user is not available for this workspace",
    403,
    "forbidden",
  );
}
