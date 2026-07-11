// ============================================
// USER PROMPT OVERRIDES (server-only loader)
//
// Split from lib/prompts.ts because this file depends on `next/headers`
// via the Supabase server client — client components must never import it.
// For the pure data + types (DEFAULT_PROMPTS, PROMPT_META, UserPrompts, etc.)
// import from "@/lib/prompts" instead.
// ============================================

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UserPrompts } from "./prompts";

/**
 * Load the user's custom prompt overrides from their Supabase profile.
 * Returns an empty object if the user is not authenticated or has no overrides.
 * Call this from server-side API routes.
 *
 * @param supabaseClient - Optional pre-authenticated Supabase client to avoid redundant auth calls
 * @param userId - Optional user ID if already known (skips auth.getUser() call)
 */
 
export async function getUserPrompts(supabaseClient?: any, userId?: string): Promise<UserPrompts> {
  try {
    const supabase = supabaseClient || await createClient();

    let uid = userId;
    if (!uid) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return {};
      uid = user.id;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", uid)
      .single();

    if (!profile?.metadata?.prompts) return {};

    return profile.metadata.prompts as UserPrompts;
  } catch {
    return {};
  }
}
