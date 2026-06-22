import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canStartSession, PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * POST: Called after session creation to consume an extra lesson if needed.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, is_admin, extra_lessons")
      .eq("id", user.id)
      .single();

    if (!profile || profile.is_admin) return NextResponse.json({ ok: true });

    const plan = (profile.plan || "free") as PlanId;
    const baseLimit = PLANS[plan]?.sessionsPerPeriod ?? 1;
    const extraLessons = profile.extra_lessons ?? 0;

    // Count completed sessions (exclude unstarted "active" ones)
    let sessionCount = 0;
    if (plan === "free") {
      const { count } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "active");
      sessionCount = count ?? 0;
    } else {
      // For paid plans, we don't decrement extras here (handled by billing cycle reset)
      return NextResponse.json({ ok: true });
    }

    // If user has used more than the base limit, consume an extra lesson
    if (sessionCount > baseLimit && extraLessons > 0) {
      await supabase
        .from("profiles")
        .update({ extra_lessons: extraLessons - 1 })
        .eq("id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if admin via auth metadata first (bypasses RLS)
    if (user.user_metadata?.is_admin) {
      return NextResponse.json({ allowed: true, reason: "Admin" });
    }

    // Load profile - use service role query to bypass RLS
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, is_admin, extra_lessons, subscription_status, current_period_end, token_tier, token_validity_expires_at, organization_id")
      .eq("id", user.id)
      .single();

    // If profile doesn't exist, create one or allow access for testing
    if (profileError || !profile) {
      console.log("Profile not found, allowing access for user:", user.id);
      return NextResponse.json({ allowed: true, reason: "No profile - allowing" });
    }

    // Admin users bypass usage checks
    if (profile.is_admin) {
      return NextResponse.json({ allowed: true, reason: "Admin" });
    }

    // Count sessions in the current billing period
    let sessionCount = 0;

    if (profile.plan === "free" || !profile.current_period_end) {
      // Free plan: count ALL completed sessions ever (exclude unstarted "active" ones)
      const { count } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "active");
      sessionCount = count ?? 0;
    } else {
      // Paid plan: count completed sessions since current_period_end minus ~30 days
      const periodEnd = new Date(profile.current_period_end);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 30);

      if (profile.plan === "pro_teams" && profile.organization_id) {
        const admin = createAdminClient();
        const { data: orgMembers } = await admin
          .from("profiles")
          .select("id")
          .eq("organization_id", profile.organization_id);
        const memberIds = (orgMembers || []).map((member) => member.id);
        if (memberIds.length > 0) {
          const { count } = await admin
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .in("user_id", memberIds)
            .neq("status", "active")
            .gte("created_at", periodStart.toISOString());
          sessionCount = count ?? 0;
        }
      } else {
        const { count } = await supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("status", "active")
          .gte("created_at", periodStart.toISOString());
        sessionCount = count ?? 0;
      }
    }

    // Also count localStorage-based sessions if no DB sessions found
    // (handled client-side — the server only knows about DB sessions)

    const result = canStartSession(
      {
        plan: (profile.plan || "free") as PlanId,
        is_admin: profile.is_admin ?? false,
        extra_lessons: profile.extra_lessons ?? 0,
        subscription_status: profile.subscription_status ?? "inactive",
        current_period_end: profile.current_period_end,
        token_tier: profile.token_tier,
        token_validity_expires_at: profile.token_validity_expires_at,
      },
      sessionCount
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Check usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
