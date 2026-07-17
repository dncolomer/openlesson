import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";


export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user: authUser } = auth;

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
        .from("workspaces")
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