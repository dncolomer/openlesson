import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", authUser.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const adminClient = getAdminClient();

    const { data: userProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: authData } = await adminClient.auth.admin.getUserById(userId);

    // Get organization if user has one
    let organization = null;
    if (userProfile.organization_id) {
      const { data: orgData } = await adminClient
        .from("organizations")
        .select("id, name, slug")
        .eq("id", userProfile.organization_id)
        .single();
      organization = orgData;
    }
    
    const [sessionsData, plansData, eegData] = await Promise.all([
      adminClient
        .from("sessions")
        .select("id, problem, status, created_at, duration_ms, audio_path, report_generated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      adminClient
        .from("learning_plans")
        .select("id, root_topic, status, created_at, is_public")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      adminClient
        .from("session_eeg")
        .select("session_id")
        .eq("user_id", userId),
    ]);

    const sessionsWithMeta = (sessionsData.data || []).map(session => {
      const hasEeg = (eegData.data || []).some(e => e.session_id === session.id);
      return {
        ...session,
        has_audio: !!session.audio_path,
        has_eeg: hasEeg,
      };
    });

    return NextResponse.json({
      user: {
        ...userProfile,
        email: authData.user?.email || null,
        email_confirmed_at: authData.user?.email_confirmed_at || null,
        organization,
      },
      lessons: sessionsWithMeta,
      plans: plansData.data || [],
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}