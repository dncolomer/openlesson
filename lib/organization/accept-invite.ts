import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureUserProfile } from "@/lib/organization/ensure-profile";
import {
  findInviteByToken,
  inviteOrganization,
} from "@/lib/organization/find-invite";

export type AcceptInviteResult =
  | {
      ok: true;
      organization: {
        id: string;
        name: string;
        slug: string;
        logo_url?: string | null;
      } | null;
      alreadyMember?: boolean;
    }
  | { ok: false; error: string; status: number };

/**
 * Accept an organization invite for a user (service-role only).
 * Ensures a profile exists first so missing auth triggers cannot block join.
 */
export async function acceptOrganizationInviteForUser(
  admin: SupabaseClient,
  token: string,
  userId: string,
  options?: { email?: string | null }
): Promise<AcceptInviteResult> {
  try {
    await ensureUserProfile(admin, userId, { email: options?.email });
  } catch (err) {
    console.error("[accept-invite] ensureUserProfile failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to prepare user profile",
      status: 500,
    };
  }

  // Prefer RPC with transfer semantics (hashed + legacy token lookup).
  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "accept_organization_invite",
    {
      invite_token: token,
      accepting_user_id: userId,
    }
  );

  if (!rpcError && rpcResult) {
    const result = rpcResult as {
      success?: boolean;
      error?: string;
      organization_id?: string;
      organization_name?: string;
      organization_slug?: string;
      already_member?: boolean;
    };

    if (result.success) {
      return {
        ok: true,
        alreadyMember: result.already_member === true,
        organization: result.organization_id
          ? {
              id: result.organization_id,
              name: result.organization_name || "Organization",
              slug: result.organization_slug || "",
            }
          : null,
      };
    }

    // After ensureUserProfile, "User not found" is unexpected — fall through to inline.
    // Other RPC business errors are returned as-is.
    const rpcErr = result.error || "Failed to accept invite";
    if (!/user not found/i.test(rpcErr)) {
      return {
        ok: false,
        error: rpcErr,
        status: /already been used|invalid invite/i.test(rpcErr) ? 400 : 400,
      };
    }
    console.warn("accept_organization_invite returned User not found; retrying inline");
  } else if (rpcError) {
    console.warn("accept_organization_invite RPC error, using inline transfer:", rpcError);
  }

  // Inline transfer fallback
  const invite = await findInviteByToken(admin, token);
  if (!invite) {
    return { ok: false, error: "Invalid invite token", status: 404 };
  }
  if (invite.used_by && invite.used_by !== userId) {
    return { ok: false, error: "This invite has already been used", status: 400 };
  }

  const org = inviteOrganization(invite);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id, is_org_admin")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { ok: false, error: "User profile not found", status: 404 };
  }

  if (profile.organization_id === invite.organization_id) {
    if (!invite.used_by) {
      await admin
        .from("organization_invites")
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
    return {
      ok: true,
      alreadyMember: true,
      organization: org
        ? { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url ?? null }
        : null,
    };
  }

  const oldOrgId = profile.organization_id as string | null;

  if (oldOrgId) {
    const { error: leaveError } = await admin
      .from("profiles")
      .update({ organization_id: null, is_org_admin: false })
      .eq("id", userId);

    if (leaveError) {
      console.error("[accept-invite] leave old org failed:", leaveError);
      return {
        ok: false,
        error: leaveError.message || "Failed to leave current organization",
        status: 500,
      };
    }

    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", oldOrgId);

    if ((count ?? 0) === 0) {
      await admin
        .from("organizations")
        .update({
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", oldOrgId)
        .eq("kind", "personal");
    }
  }

  // Claim invite first (unique-ish race guard via used_by)
  if (!invite.used_by) {
    const { data: claimed, error: claimError } = await admin
      .from("organization_invites")
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("used_by", null)
      .select("id")
      .maybeSingle();

    if (claimError) {
      return { ok: false, error: "Failed to accept invite", status: 500 };
    }
    if (!claimed) {
      return { ok: false, error: "This invite has already been used", status: 400 };
    }
  }

  const { data: joined, error: joinError } = await admin
    .from("profiles")
    .update({ organization_id: invite.organization_id, is_org_admin: false })
    .eq("id", userId)
    .select("id, organization_id")
    .single();

  if (joinError || joined?.organization_id !== invite.organization_id) {
    // Roll back invite claim if we couldn't attach the profile
    if (!invite.used_by) {
      await admin
        .from("organization_invites")
        .update({ used_by: null, used_at: null })
        .eq("id", invite.id)
        .eq("used_by", userId);
    }
    console.error("[accept-invite] join org failed:", joinError);
    return {
      ok: false,
      error: joinError?.message || "Failed to join organization",
      status: 500,
    };
  }

  return {
    ok: true,
    organization: org
      ? { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url ?? null }
      : null,
  };
}
