import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensure a public.profiles row exists for an auth user.
 *
 * Profile creation is normally handled by the on_auth_user_created trigger.
 * That trigger has been missing in some environments; this helper makes
 * signup / invite accept resilient when the trigger does not fire.
 */
export async function ensureUserProfile(
  admin: SupabaseClient,
  userId: string,
  options?: { email?: string | null; username?: string | null }
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to load profile");
  }
  if (existing?.id) {
    return { id: existing.id, created: false };
  }

  const username =
    options?.username ||
    (options?.email ? options.email.split("@")[0]?.slice(0, 64) : null) ||
    null;

  const { data: inserted, error: insertError } = await admin
    .from("profiles")
    .insert({
      id: userId,
      username,
      plan: "inactive",
      subscription_status: "inactive",
    })
    .select("id")
    .single();

  if (!insertError && inserted?.id) {
    return { id: inserted.id, created: true };
  }

  // Concurrent insert won the race — re-read.
  if (insertError?.code === "23505") {
    const { data: again } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (again?.id) return { id: again.id, created: false };
  }

  throw new Error(insertError?.message || "Failed to create profile");
}
