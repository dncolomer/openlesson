import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canCreateWorkspace,
  canStartSession,
  canSubmitProofOfWork,
  proofOfWorkLimitForSessionAllowance,
  getSessionAllowance,
  PLANS,
  type OrgUsageSummary,
  type PlanId,
} from "@/lib/plans";
import {
  billingPeriodStart,
  countActiveWorkspaces,
  countProofOfWorkSubmissions,
  countOrgProofOfWorkSubmissions,
  countOrgTapIleSessions,
  countTapIleSessions,
  loadUsageProfile,
} from "@/lib/usage-metrics";

export const runtime = "nodejs";

/**
 * POST: Called after session creation to consume an extra lesson if needed.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const { profile } = await loadUsageProfile(supabase, user.id);
    if (!profile || profile.is_admin) return NextResponse.json({ ok: true });

    const plan = (profile.plan || "free") as PlanId;
    const baseLimit = PLANS[plan]?.sessionsPerPeriod ?? 1;
    const extraLessons = profile.extra_lessons ?? 0;

    if (plan !== "free") {
      return NextResponse.json({ ok: true });
    }

    const sessionCount = await countTapIleSessions(supabase, user.id);

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

    const { profile, error: profileError } = await loadUsageProfile(supabase, user.id);

    if (profileError || !profile) {
      return NextResponse.json({
        allowed: false,
        reason: "Profile not found. Please complete account setup or contact support.",
        plan: "free",
        used: 0,
        limit: PLANS.free.sessionsPerPeriod,
        isAdmin: false,
        workspacesUsed: 0,
        workspacesLimit: PLANS.free.workspacesPerPeriod,
      });
    }

    const periodStart =
      profile.plan === "free" || !profile.current_period_end
        ? null
        : billingPeriodStart(profile.current_period_end);

    let sessionCount = await countTapIleSessions(supabase, user.id, periodStart);
    let personalSessionCount = sessionCount;
    let personalProofOfWorkCount = await countProofOfWorkSubmissions(supabase, user.id, periodStart);
    let proofOfWorkCount = personalProofOfWorkCount;

    let organizationSummary: OrgUsageSummary | null = null;

    if (profile.plan === "pro_teams" && profile.organization_id && periodStart) {
      const admin = createAdminClient();
      const { data: orgMembers } = await admin
        .from("profiles")
        .select("id")
        .eq("organization_id", profile.organization_id);
      const memberIds = (orgMembers || []).map((member) => member.id);

      if (memberIds.length > 0) {
        sessionCount = await countOrgTapIleSessions(admin, memberIds, periodStart);
        proofOfWorkCount = await countOrgProofOfWorkSubmissions(admin, memberIds, periodStart);
      }

      const { data: organization } = await admin
        .from("organizations")
        .select("id, name")
        .eq("id", profile.organization_id)
        .single();

      const { count: guestCount } = await admin
        .from("organization_guest_users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "active");

      const planLimit = PLANS.pro_teams.sessionsPerPeriod;
      const effectiveOrgLimit = (planLimit ?? 0) + (profile.extra_lessons ?? 0);
      organizationSummary = {
        id: profile.organization_id,
        name: organization?.name || "Organization",
        isOrgAdmin: profile.is_org_admin === true,
        memberCount: memberIds.length,
        guestCount: guestCount ?? 0,
        used: sessionCount,
        limit: effectiveOrgLimit,
        proofOfWorkUsed: proofOfWorkCount,
        proofOfWorkLimit: proofOfWorkLimitForSessionAllowance("pro_teams", effectiveOrgLimit),
      };
    }

    const userProfile = {
      plan: (profile.plan || "free") as PlanId,
      is_admin: profile.is_admin ?? false,
      extra_lessons: profile.extra_lessons ?? 0,
      extra_workspaces: profile.extra_workspaces ?? 0,
      subscription_status: profile.subscription_status ?? "inactive",
      current_period_end: profile.current_period_end,
      token_tier: profile.token_tier,
      token_validity_expires_at: profile.token_validity_expires_at,
    };

    const result = canStartSession(userProfile, sessionCount);
    const { limit: sessionAllowance } = getSessionAllowance(userProfile, sessionCount);
    const evidenceResult = canSubmitProofOfWork(userProfile, proofOfWorkCount, sessionAllowance);
    const workspaceCount = await countActiveWorkspaces(supabase, user.id);
    const workspaceResult = canCreateWorkspace(userProfile, workspaceCount);

    const proofOfWorkPayload = {
      proofOfWorkUsed: proofOfWorkCount,
      proofOfWorkPersonalUsed: personalProofOfWorkCount,
      proofOfWorkLimit: evidenceResult.limit,
      canSubmitProofOfWork: evidenceResult.allowed,
      evidenceReason: evidenceResult.reason,
    };

    if (profile.is_admin) {
      return NextResponse.json({
        ...result,
        ...proofOfWorkPayload,
        allowed: true,
        reason: "Admin",
        limit: null,
        isAdmin: true,
        personalUsed: personalSessionCount,
        organization: organizationSummary,
        workspacesUsed: workspaceCount,
        workspacesLimit: null,
        canCreateWorkspace: true,
        canSubmitProofOfWork: true,
        proofOfWorkLimit: null,
      });
    }

    return NextResponse.json({
      ...result,
      ...proofOfWorkPayload,
      personalUsed: personalSessionCount,
      organization: organizationSummary,
      workspacesUsed: workspaceCount,
      workspacesLimit: workspaceResult.limit,
      canCreateWorkspace: workspaceResult.allowed,
    });
  } catch (error) {
    console.error("Check usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}