import type { SupabaseClient, User } from "@supabase/supabase-js";

export type EnrichedProfile = {
  id: string;
  username: string | null;
  email: string | null;
  email_confirmed_at: string | null;
};

export type AdminProfileRow = {
  id: string;
  username: string | null;
  created_at: string;
  plan: string;
  is_admin: boolean;
  extra_lessons: number;
  extra_workspaces: number;
  subscription_status: string;
  current_period_end: string | null;
  token_tier: string | null;
  token_validity_expires_at: string | null;
  metadata: Record<string, unknown> | null;
  organization_id: string | null;
  is_org_admin: boolean;
};

const ADMIN_PROFILE_FIELDS =
  "id, username, created_at, plan, is_admin, extra_lessons, extra_workspaces, subscription_status, current_period_end, token_tier, token_validity_expires_at, metadata, organization_id, is_org_admin";

function normalizeAdminProfile(row: Record<string, unknown>): AdminProfileRow {
  return {
    id: String(row.id),
    username: (row.username as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    plan: String(row.plan ?? "inactive"),
    is_admin: Boolean(row.is_admin),
    extra_lessons: Number(row.extra_lessons ?? 0),
    extra_workspaces: Number(row.extra_workspaces ?? 0),
    subscription_status: String(row.subscription_status ?? "inactive"),
    current_period_end: (row.current_period_end as string | null) ?? null,
    token_tier: (row.token_tier as string | null) ?? null,
    token_validity_expires_at: (row.token_validity_expires_at as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    organization_id: (row.organization_id as string | null) ?? null,
    is_org_admin: Boolean(row.is_org_admin),
  };
}

export async function listAdminProfiles(
  adminClient: SupabaseClient
): Promise<{ profiles: AdminProfileRow[]; error: { message: string } | null }> {
  const { data, error } = await adminClient
    .from("profiles")
    .select(ADMIN_PROFILE_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    return { profiles: [], error: { message: error.message } };
  }

  return {
    profiles: (data || []).map((row) => normalizeAdminProfile(row)),
    error: null,
  };
}

export async function listAllAuthUsers(adminClient: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function enrichProfilesWithAuth(
  adminClient: SupabaseClient,
  profiles: Array<{ id: string; username: string | null }>
): Promise<EnrichedProfile[]> {
  const authUsers = await listAllAuthUsers(adminClient);
  const authById = new Map(authUsers.map((user) => [user.id, user]));

  return profiles.map((profile) => {
    const authUser = authById.get(profile.id);
    return {
      id: profile.id,
      username: profile.username,
      email: authUser?.email || null,
      email_confirmed_at: authUser?.email_confirmed_at || null,
    };
  });
}

export async function getProfileEmail(
  adminClient: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await adminClient.auth.admin.getUserById(userId);
  return data.user?.email || null;
}