import type { SupabaseClient } from "@supabase/supabase-js";

export type EnrichedProfile = {
  id: string;
  username: string | null;
  email: string | null;
  email_confirmed_at: string | null;
};

export async function enrichProfilesWithAuth(
  adminClient: SupabaseClient,
  profiles: Array<{ id: string; username: string | null }>
): Promise<EnrichedProfile[]> {
  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const authById = new Map(authUsers.users.map((user) => [user.id, user]));

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