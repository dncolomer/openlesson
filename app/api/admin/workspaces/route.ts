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
    const visibility = params.get("visibility") || "all";
    const statusFilter = params.get("status") || "active";
    const search = (params.get("search") || "").trim();
    const sortField = params.get("sort") || "created_at";
    const sortDirection = params.get("direction") === "asc" ? "asc" : "desc";

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = adminClient
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, status, is_public, is_agent_workspace, organization_id, created_at",
        { count: "exact" }
      );

    if (visibility === "public") query = query.eq("is_public", true);
    if (visibility === "private") query = query.eq("is_public", false);
    if (statusFilter === "active") {
      query = query.neq("status", "archived");
    } else if (statusFilter === "archived") {
      query = query.eq("status", "archived");
    }
    if (search) {
      query = query.or(`root_topic.ilike.%${search}%,title.ilike.%${search}%`);
    }

    const orderColumn = sortField === "root_topic" ? "root_topic" : "created_at";
    const { data: plansData, count, error } = await query
      .order(orderColumn, { ascending: sortDirection === "asc" })
      .range(from, to);

    if (error) {
      console.error("Admin plans list error:", error);
      return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 });
    }

    const workspaceIds = (plansData || []).map((plan) => plan.id);
    const userIds = [...new Set((plansData || []).map((plan) => plan.user_id))];

    const nodeCountMap = new Map<string, number>();
    const tapCountMap = new Map<string, number>();
    const profileMap = new Map<string, { id: string; username: string | null; email: string | null }>();

    if (workspaceIds.length > 0) {
      const [{ data: nodes }, { data: tapSessions }] = await Promise.all([
        adminClient.from("blocks").select("workspace_id").in("workspace_id", workspaceIds),
        adminClient.from("workspace_tap_sessions").select("workspace_id").in("workspace_id", workspaceIds),
      ]);
      nodes?.forEach((node) => nodeCountMap.set(node.workspace_id, (nodeCountMap.get(node.workspace_id) || 0) + 1));
      tapSessions?.forEach((session) =>
        tapCountMap.set(session.workspace_id, (tapCountMap.get(session.workspace_id) || 0) + 1)
      );
    }

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      const enriched = await enrichProfilesWithAuth(adminClient, profiles || []);
      enriched.forEach((profile) => profileMap.set(profile.id, profile));
    }

    const plans = (plansData || []).map((plan) => {
      const profile = profileMap.get(plan.user_id);
      return {
        ...plan,
        display_topic: plan.title || plan.root_topic,
        node_count: nodeCountMap.get(plan.id) || 0,
        tap_session_count: tapCountMap.get(plan.id) || 0,
        owner: {
          id: plan.user_id,
          username: profile?.username || null,
          email: profile?.email || null,
        },
      };
    });

    if (sortField === "node_count") {
      plans.sort((a, b) =>
        sortDirection === "asc" ? a.node_count - b.node_count : b.node_count - a.node_count
      );
    }

    return NextResponse.json({
      plans,
      totalCount: count || 0,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    });
  } catch (error) {
    console.error("Admin plans error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}