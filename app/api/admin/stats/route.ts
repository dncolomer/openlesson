import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { planFilterBucket } from "@/lib/admin/tiers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      usersRes,
      profilesRes,
      sessionsRes,
      completedRes,
      plansRes,
      orgsRes,
      tapRes,
      evidenceRes,
      monthlyIleRes,
      monthlyTapRes,
    ] = await Promise.all([
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient.from("profiles").select("plan, subscription_status"),
      adminClient.from("sessions").select("id", { count: "exact", head: true }),
      adminClient.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
      adminClient.from("workspaces").select("id", { count: "exact", head: true }),
      adminClient.from("organizations").select("id", { count: "exact", head: true }),
      adminClient.from("workspace_tap_sessions").select("id", { count: "exact", head: true }),
      adminClient.from("workspace_proof_of_work").select("id", { count: "exact", head: true }),
      adminClient
        .from("sessions")
        .select("user_id")
        .gte("created_at", monthStart.toISOString()),
      adminClient
        .from("workspace_tap_sessions")
        .select("user_id")
        .not("user_id", "is", null)
        .gte("created_at", monthStart.toISOString()),
    ]);

    const monthlyActiveUsers = new Set(
      [
        ...(monthlyIleRes.data || []).map((row: { user_id: string }) => row.user_id),
        ...(monthlyTapRes.data || []).map((row: { user_id: string | null }) => row.user_id),
      ].filter((id): id is string => Boolean(id))
    ).size;

    const tierBreakdown = {
      free: 0,
      trial: 0,
      regular_2026: 0,
      pro_teams: 0,
      api_metered: 0,
      legacy: 0,
      inactive: 0,
    };

    let activeSubscriptions = 0;

    for (const profile of profilesRes.data || []) {
      const bucket = planFilterBucket(profile);
      if (bucket !== "all") tierBreakdown[bucket] += 1;
      if (profile.subscription_status === "active") activeSubscriptions += 1;
    }

    const totalIleSessions = sessionsRes.count || 0;
    const totalTapSessions = tapRes.count || 0;

    return NextResponse.json({
      totalUsers: usersRes.count || 0,
      monthlyActiveUsers,
      totalIleSessions,
      totalTapSessions,
      combinedSessions: totalIleSessions + totalTapSessions,
      completedIleSessions: completedRes.count || 0,
      totalWorkspaces: plansRes.count || 0,
      totalOrganizations: orgsRes.count || 0,
      totalEvidence: evidenceRes.count || 0,
      activeSubscriptions,
      tierBreakdown,
      // Back-compat for older clients
      totalSessions: totalIleSessions,
      completedSessions: completedRes.count || 0,
      totalPlans: plansRes.count || 0,
      totalGhlSessions: totalTapSessions,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}