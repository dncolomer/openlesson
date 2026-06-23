import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { enrichProfilesWithAuth } from "@/lib/admin/users";

export const runtime = "nodejs";

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") || "1"));
    const status = params.get("status") || "all";
    const search = (params.get("search") || "").trim();
    const sortField = params.get("sort") === "duration_ms" ? "duration_ms" : "created_at";
    const sortDirection = params.get("direction") === "asc" ? "asc" : "desc";

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = adminClient
      .from("sessions")
      .select("id, user_id, problem, status, created_at, duration_ms", { count: "exact" });

    if (status !== "all") {
      query = query.eq("status", status);
    }
    if (search) {
      query = query.ilike("problem", `%${search}%`);
    }

    const { data: sessionsData, count, error } = await query
      .order(sortField, { ascending: sortDirection === "asc" })
      .range(from, to);

    if (error) {
      console.error("Admin sessions list error:", error);
      return NextResponse.json({ error: "Failed to load blocks" }, { status: 500 });
    }

    const userIds = [...new Set((sessionsData || []).map((session) => session.user_id))];
    const profileMap = new Map<string, { id: string; username: string | null; email: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      const enriched = await enrichProfilesWithAuth(adminClient, profiles || []);
      enriched.forEach((profile) => profileMap.set(profile.id, profile));
    }

    const sessions = (sessionsData || []).map((session) => {
      const profile = profileMap.get(session.user_id);
      return {
        ...session,
        duration_ms: session.duration_ms || 0,
        user: {
          id: session.user_id,
          username: profile?.username || null,
          email: profile?.email || null,
        },
      };
    });

    return NextResponse.json({
      sessions,
      totalCount: count || 0,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    });
  } catch (error) {
    console.error("Admin sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}