import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ authenticated: false, isAdmin: false });
    }

    let profile: {
      is_admin: boolean | null;
    } | null = null;

    const { data: sessionProfile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profileError && sessionProfile) {
      profile = sessionProfile;
    } else {
      try {
        const admin = createAdminClient();
        const { data: adminProfile } = await admin
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        profile = adminProfile;
      } catch {
        // Service role unavailable in local dev — fall through with null profile.
      }
    }

    const isAdmin = profile?.is_admin === true;

    return NextResponse.json({
      authenticated: true,
      isAdmin,
    });
  } catch (error) {
    console.error("[demo/status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}