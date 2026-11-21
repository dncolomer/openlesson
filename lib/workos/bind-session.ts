import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePersonalOrganization } from "@/lib/organization/ensure-personal-org";
import { ensureUserProfile } from "@/lib/organization/ensure-profile";
import {
  bindWorkOsIdentityToUserId,
  type WorkOsAppIdentity,
} from "@/lib/workos/identity";

async function findUserIdByWorkOs(
  admin: SupabaseClient,
  workosUserId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("workos_user_id", workosUserId)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function findOrgIdByWorkOs(
  admin: SupabaseClient,
  workosOrganizationId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("workos_organization_id", workosOrganizationId)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function ensureAuthUser(
  admin: SupabaseClient,
  identity: WorkOsAppIdentity,
): Promise<string> {
  const existing = await findUserIdByWorkOs(admin, identity.workosUserId);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email: identity.email,
    email_confirm: true,
    user_metadata: {
      workos_user_id: identity.workosUserId,
      full_name: identity.displayName,
    },
  });
  if (!error && data.user?.id) return data.user.id;
  const message = error?.message || "";
  if (!/already|registered|exists/i.test(message)) {
    throw new Error(message || "Failed to create WorkOS user");
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: identity.email,
  });
  if (linkError) throw new Error(linkError.message);
  const userId = String((link as { user?: { id?: string } } | null)?.user?.id || "").trim();
  if (userId) return userId;
  throw new Error("An account with this email already exists");
}

export async function bindWorkOsIdentityToSupabaseSession(input: {
  admin: SupabaseClient;
  supabase: SupabaseClient;
  identity: WorkOsAppIdentity;
}): Promise<WorkOsAppIdentity> {
  const authUserId = await ensureAuthUser(input.admin, input.identity);
  await ensureUserProfile(input.admin, authUserId, {
    email: input.identity.email,
    username: input.identity.displayName,
  });
  await input.admin
    .from("profiles")
    .update({ workos_user_id: input.identity.workosUserId })
    .eq("id", authUserId);

  if (input.identity.organizationId) {
    const orgId = await findOrgIdByWorkOs(input.admin, input.identity.organizationId);
    if (orgId) {
      await input.admin
        .from("profiles")
        .update({ organization_id: orgId, is_org_admin: false })
        .eq("id", authUserId)
        .is("organization_id", null);
    }
  }

  await ensurePersonalOrganization(input.admin, authUserId, {
    email: input.identity.email,
    username: input.identity.displayName,
  }).catch(() => undefined);

  const { data: link, error: linkError } = await input.admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.identity.email,
  });
  if (linkError) throw new Error(linkError.message);
  const tokenHash = String(
    (link as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token || "",
  ).trim();
  if (!tokenHash) throw new Error("Could not create app session");
  const { error: verifyError } = await input.supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (verifyError) throw new Error(verifyError.message);
  return bindWorkOsIdentityToUserId(input.identity, authUserId);
}
