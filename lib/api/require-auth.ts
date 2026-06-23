import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedRequest =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: NextResponse };

export async function requireAuthenticatedUser(): Promise<AuthenticatedRequest> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  return { ok: true, user, supabase };
}

export async function requireSessionOwnership(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<NextResponse | null> {
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  if (session.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/** Auth + optional session ownership for LLM/session API routes. */
export async function guardSessionRoute(sessionId?: string | null): Promise<AuthenticatedRequest> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  if (sessionId) {
    const denied = await requireSessionOwnership(auth.supabase, auth.user.id, sessionId);
    if (denied) {
      return { ok: false, response: denied };
    }
  }

  return auth;
}