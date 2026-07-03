import { NextResponse } from "next/server";
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
      return NextResponse.json({ authenticated: false, hasTeams: false, isAdmin: false });
    }

    let profile: {
      plan: string | null;
      subscription_status: string | null;
      is_admin: boolean | null;
    } | null = null;

    const { data: sessionProfile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, subscription_status, is_admin")
      .eq("id", user.id)
      .single();

    if (!profileError && sessionProfile) {
      profile = sessionProfile;
    } else {
      try {
        const admin = createAdminClient();
        const { data: adminProfile } = await admin
          .from("profiles")
          .select("plan, subscription_status, is_admin")
          .eq("id", user.id)
          .single();
        profile = adminProfile;
      } catch {
        // Service role unavailable in local dev — fall through with null profile.
      }
    }

    const isAdmin = profile?.is_admin === true;
    const hasTeams =
      isAdmin || (profile?.plan === "pro_teams" && profile?.subscription_status === "active");

    return NextResponse.json({
      authenticated: true,
      hasTeams,
      isAdmin,
      plan: profile?.plan ?? null,
    });
  } catch (error) {
    console.error("[evidence-api-demo/status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}