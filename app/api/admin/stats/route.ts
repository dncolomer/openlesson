import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [usersRes, sessionsRes, completedRes, plansRes, orgsRes, ghlRes, monthlySessionsRes] =
      await Promise.all([
        adminClient.from("profiles").select("id", { count: "exact", head: true }),
        adminClient.from("sessions").select("id", { count: "exact", head: true }),
        adminClient.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
        adminClient.from("learning_plans").select("id", { count: "exact", head: true }),
        adminClient.from("organizations").select("id", { count: "exact", head: true }),
        adminClient.from("workspace_ghc_sessions").select("id", { count: "exact", head: true }),
        adminClient
          .from("sessions")
          .select("user_id")
          .gte("created_at", monthStart.toISOString()),
      ]);

    const monthlyActiveUsers = new Set(
      (monthlySessionsRes.data || []).map((row: { user_id: string }) => row.user_id)
    ).size;

    return NextResponse.json({
      totalUsers: usersRes.count || 0,
      monthlyActiveUsers,
      totalSessions: sessionsRes.count || 0,
      completedSessions: completedRes.count || 0,
      totalPlans: plansRes.count || 0,
      totalOrganizations: orgsRes.count || 0,
      totalGhlSessions: ghlRes.count || 0,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}