// ============================================
// Supabase admin (service-role) client
//
// Use this when you need to bypass RLS from a trusted server route — e.g.
// Stripe webhooks, invite acceptance, admin endpoints, Proof-of-Work API key lookups.
//
// RULES:
//   - NEVER import this from client components. The service role key is
//     server-only (not prefixed with NEXT_PUBLIC_).
//   - Prefer `@/lib/supabase/server` for user-scoped routes that should obey
//     RLS (i.e. anything where "the user is acting on their own data").
//   - Every call site should be auditable. Grep for `createAdminClient` to
//     list all privileged paths.
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Return a Supabase client authenticated with the service role key.
 * Throws if `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL` is missing.
 *
 * The client is cached per-process to avoid repeated construction in hot paths
 * (Stripe webhooks, agent key lookups). It is safe to share because the client
 * holds no per-request state.
 */
export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  cached = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
