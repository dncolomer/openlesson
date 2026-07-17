import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { buildTierUpdate, isAdminTier } from "@/lib/admin/tiers";
import { listAdminProfiles, listAllAuthUsers } from "@/lib/admin/users";

export const runtime = "nodejs";


export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    const { profiles: users, error } = await listAdminProfiles(adminClient);

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const userIds = users.map((u) => u.id);
    
    // Get organization IDs that users belong to
    const orgIds = [...new Set((users || []).map(u => u.organization_id).filter(Boolean))];

    const [sessionsData, plansData, orgsData] = await Promise.all([
      userIds.length > 0 
        ? adminClient.from("sessions").select("user_id").in("user_id", userIds)
        : { data: [] as { user_id: string }[] | null, error: null },
      userIds.length > 0 
        ? adminClient.from("workspaces").select("user_id").in("user_id", userIds)
        : { data: [] as { user_id: string }[] | null, error: null },
      orgIds.length > 0
        ? adminClient.from("organizations").select("id, name, slug").in("id", orgIds)
        : { data: [] as { id: string; name: string; slug: string }[] | null, error: null },
    ]);

    const sessionsByUser: Record<string, number> = {};
    const plansByUser: Record<string, number> = {};
    const orgsById: Record<string, { id: string; name: string; slug: string }> = {};
    
    (sessionsData.data || []).forEach(s => {
      sessionsByUser[s.user_id] = (sessionsByUser[s.user_id] || 0) + 1;
    });
    (plansData.data || []).forEach(p => {
      plansByUser[p.user_id] = (plansByUser[p.user_id] || 0) + 1;
    });
    (orgsData.data || []).forEach(o => {
      orgsById[o.id] = o;
    });

    const authUsers = await listAllAuthUsers(adminClient);
    const authById = new Map(authUsers.map((a) => [a.id, a]));

    const enrichedUsers = users.map((u) => {
      const authUser = authById.get(u.id);
      const org = u.organization_id ? orgsById[u.organization_id] : null;
      return {
        ...u,
        email: authUser?.email || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        lessons_count: sessionsByUser[u.id] || 0,
        plans_count: plansByUser[u.id] || 0,
        organization: org,
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    const {
      userId,
      plan,
      subscription_status,
      extra_lessons,
      extra_workspaces,
      current_period_end,
      is_admin,
      organization_id,
      is_org_admin,
    } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (is_admin !== undefined) updateData.is_admin = is_admin;
    if (organization_id !== undefined) updateData.organization_id = organization_id;
    if (is_org_admin !== undefined) updateData.is_org_admin = is_org_admin;
    // Profile-level plan fields are no longer product truth; apply to org below.
    if (extra_workspaces !== undefined) updateData.extra_workspaces = extra_workspaces;

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (profileError) {
        console.error("Error updating user:", profileError);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
      }
    }

    // Tier / subscription / volume → organization billing entity
    if (
      plan !== undefined ||
      subscription_status !== undefined ||
      extra_lessons !== undefined ||
      current_period_end !== undefined
    ) {
      if (plan !== undefined && !isAdminTier(plan)) {
        return NextResponse.json({ error: "Invalid plan tier" }, { status: 400 });
      }
      const { applyBillingToUserOrganization } = await import(
        "@/lib/organization/apply-org-billing"
      );
      const tierPatch = plan !== undefined ? buildTierUpdate(plan) : null;
      await applyBillingToUserOrganization(adminClient, {
        userId,
        plan: tierPatch?.plan ?? plan ?? "inactive",
        subscriptionStatus:
          subscription_status ??
          tierPatch?.subscription_status ??
          "inactive",
        currentPeriodEnd:
          current_period_end !== undefined
            ? current_period_end
            : (tierPatch?.current_period_end ?? null),
        extraLessons:
          extra_lessons !== undefined
            ? extra_lessons
            : (tierPatch?.extra_lessons ?? 0),
      });
    }

    const { data, error } = await adminClient
      .from("profiles")
      .select()
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching updated user:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error("Admin update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
