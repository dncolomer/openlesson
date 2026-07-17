import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export type SupabaseBrowserClient = SupabaseClient;

export function createClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build time, return a placeholder client
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables not set. Using placeholder values for build.");
    client = createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-key"
    );
    return client;
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
