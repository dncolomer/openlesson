import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureUserProfile } from "@/lib/organization/ensure-profile";
import {
  findInviteByToken,
  inviteOrganization,
} from "@/lib/organization/find-invite";
import { upsertOrganizationMembership } from "@/lib/organization/membership-store";

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
 * Adds a membership and switches the active org; prior orgs stay attached.
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
    console.warn("accept_organization_invite RPC error, using inline join:", rpcError);
  }

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

  const { data: existingMembership } = await admin
    .from("organization_members")
    .select("is_org_admin")
    .eq("user_id", userId)
    .eq("organization_id", invite.organization_id)
    .maybeSingle();

  const alreadyMember =
    Boolean(existingMembership) || profile.organization_id === invite.organization_id;

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
    if (!claimed && !alreadyMember) {
      return { ok: false, error: "This invite has already been used", status: 400 };
    }
  }

  try {
    await upsertOrganizationMembership(
      admin,
      userId,
      invite.organization_id,
      existingMembership?.is_org_admin === true,
    );
  } catch (err) {
    console.error("[accept-invite] membership upsert failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to join organization",
      status: 500,
    };
  }

  const isOrgAdmin = existingMembership?.is_org_admin === true;
  const { data: joined, error: joinError } = await admin
    .from("profiles")
    .update({ organization_id: invite.organization_id, is_org_admin: isOrgAdmin })
    .eq("id", userId)
    .select("id, organization_id")
    .single();

  if (joinError || joined?.organization_id !== invite.organization_id) {
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
    alreadyMember,
    organization: org
      ? { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url ?? null }
      : null,
  };
}
