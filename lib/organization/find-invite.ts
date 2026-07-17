import type { SupabaseClient } from "@supabase/supabase-js";
import { hashInviteToken } from "@/lib/organization/invite-token";

const INVITE_SELECT_WITH_LOGO = `
  id,
  token,
  token_hash,
  used_by,
  used_at,
  organization_id,
  organization:organizations(id, name, slug, logo_url)
`;

const INVITE_SELECT_NO_LOGO = `
  id,
  token,
  token_hash,
  used_by,
  used_at,
  organization_id,
  organization:organizations(id, name, slug)
`;

export type FoundInvite = {
  id: string;
  token: string;
  token_hash: string | null;
  used_by: string | null;
  used_at: string | null;
  organization_id: string;
  organization:
    | {
        id: string;
        name: string;
        slug: string;
        logo_url?: string | null;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        logo_url?: string | null;
      }>
    | null;
};

/**
 * Resolve an organization invite by secret token (hashed first, then legacy plaintext).
 */
export async function findInviteByToken(
  adminClient: SupabaseClient,
  token: string
): Promise<FoundInvite | null> {
  const tokenHash = hashInviteToken(token);

  let { data: byHash, error: hashError } = await adminClient
    .from("organization_invites")
    .select(INVITE_SELECT_WITH_LOGO)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (hashError && /logo_url/i.test(hashError.message || "")) {
    ({ data: byHash } = await adminClient
      .from("organization_invites")
      .select(INVITE_SELECT_NO_LOGO)
      .eq("token_hash", tokenHash)
      .maybeSingle());
  }

  if (byHash) return byHash as FoundInvite;

  let { data: byPlain, error } = await adminClient
    .from("organization_invites")
    .select(INVITE_SELECT_WITH_LOGO)
    .eq("token", token)
    .maybeSingle();

  if (error && /logo_url/i.test(error.message || "")) {
    ({ data: byPlain, error } = await adminClient
      .from("organization_invites")
      .select(INVITE_SELECT_NO_LOGO)
      .eq("token", token)
      .maybeSingle());
  }

  if (error || !byPlain) return null;
  return byPlain as FoundInvite;
}

export function inviteOrganization(invite: FoundInvite) {
  const orgData = invite.organization;
  return Array.isArray(orgData) ? orgData[0] ?? null : orgData;
}
