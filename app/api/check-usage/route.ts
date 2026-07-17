import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canCreateWorkspace,
  canSubmitProofOfWork,
  estimateApiMeteredInvoice,
  isApiMeteredPlan,
  PLANS,
  type OrgUsageSummary,
  type PlanId,
} from "@/lib/plans";
import {
  billingEntityToUserProfile,
  resolveBillingEntity,
  type OrgBillingRow,
} from "@/lib/billing-entity";
import {
  billingPeriodStart,
  countActiveWorkspaces,
  countProofOfWorkSubmissions,
  countOrgProofOfWorkSubmissions,
  countPowApiSubmissions,
  loadUsageProfile,
} from "@/lib/usage-metrics";

export const runtime = "nodejs";

/**
 * POST: Legacy no-op. One-time extra PoW packs are no longer sold or consumed.
 * Kept so older clients that call POST /api/check-usage after session create still succeed.
 */
export async function POST() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { profile, error: profileError } = await loadUsageProfile(supabase, user.id);

    if (profileError || !profile) {
      return NextResponse.json({
        allowed: false,
        reason: "Profile not found. Please complete account setup or contact support.",
        plan: "inactive",
        used: 0,
        limit: PLANS.inactive.proofOfWorkPerPeriod,
        isAdmin: false,
        workspacesUsed: 0,
        workspacesLimit: PLANS.inactive.workspacesPerPeriod,
      });
    }

    const admin = createAdminClient();
    let org: OrgBillingRow | null = null;
    if (profile.organization_id) {
      const { data: orgRow } = await admin
        .from("organizations")
        .select(
          "id, name, plan, subscription_status, current_period_end, extra_lessons, billing_mode, kind, archived_at"
        )
        .eq("id", profile.organization_id)
        .maybeSingle();
      org = (orgRow as (OrgBillingRow & { name?: string }) | null) ?? null;
    }

    const entity = resolveBillingEntity(
      {
        plan: (profile.plan || "inactive") as PlanId,
        is_admin: profile.is_admin ?? false,
        extra_lessons: profile.extra_lessons ?? 0,
        subscription_status: profile.subscription_status ?? "inactive",
        current_period_end: profile.current_period_end,
        token_tier: profile.token_tier,
        token_validity_expires_at: profile.token_validity_expires_at,
        organization_id: profile.organization_id,
      },
      org
    );

    const userProfile = billingEntityToUserProfile(entity);

    let periodStart: Date | null = null;
    if (entity.source === "organization") {
      if (entity.currentPeriodEnd) {
        periodStart = billingPeriodStart(entity.currentPeriodEnd);
      } else if (entity.billingMode === "partner" && entity.entitled) {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        periodStart = start;
      }
    } else if (entity.source === "user" && entity.currentPeriodEnd) {
      periodStart = billingPeriodStart(entity.currentPeriodEnd);
    }

    let personalProofOfWorkCount = await countProofOfWorkSubmissions(
      supabase,
      user.id,
      periodStart
    );
    let proofOfWorkCount = personalProofOfWorkCount;
    let organizationSummary: OrgUsageSummary | null = null;

    if (entity.source === "organization" && profile.organization_id && periodStart) {
      const { data: orgMembers } = await admin
        .from("profiles")
        .select("id")
        .eq("organization_id", profile.organization_id);
      const memberIds = (orgMembers || []).map((member) => member.id);

      if (memberIds.length > 0) {
        proofOfWorkCount = await countOrgProofOfWorkSubmissions(admin, memberIds, periodStart);
      }

      const { count: guestCount } = await admin
        .from("organization_guest_users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "active");

      organizationSummary = {
        id: profile.organization_id,
        name: (org as { name?: string } | null)?.name || "Organization",
        isOrgAdmin: profile.is_org_admin === true,
        memberCount: memberIds.length,
        guestCount: guestCount ?? 0,
        used: proofOfWorkCount,
        limit: entity.limit,
      };
    }

    const result = canSubmitProofOfWork(userProfile, proofOfWorkCount);
    const workspaceCount = await countActiveWorkspaces(supabase, user.id);
    const workspaceResult = canCreateWorkspace(userProfile, workspaceCount);

    let apiPowCallsUsed = 0;
    let apiMeteredInvoice: ReturnType<typeof estimateApiMeteredInvoice> | null = null;
    if (isApiMeteredPlan(userProfile.plan)) {
      if (entity.source === "organization" && profile.organization_id && periodStart) {
        const { data: orgMembers } = await admin
          .from("profiles")
          .select("id")
          .eq("organization_id", profile.organization_id);
        const memberIds = (orgMembers || []).map((m) => m.id);
        // Sum API PoW across members (simple sequential; fine for admin-scale orgs)
        for (const memberId of memberIds) {
          apiPowCallsUsed += await countPowApiSubmissions(admin, memberId, periodStart);
        }
      } else {
        apiPowCallsUsed = await countPowApiSubmissions(supabase, user.id, periodStart);
      }
      apiMeteredInvoice = estimateApiMeteredInvoice(apiPowCallsUsed);
    }

    const proofOfWorkPayload = {
      proofOfWorkUsed: proofOfWorkCount,
      proofOfWorkPersonalUsed: personalProofOfWorkCount,
      proofOfWorkLimit: result.limit,
      canSubmitProofOfWork: result.allowed,
      evidenceReason: result.reason,
      apiPowCallsUsed,
      apiMeteredInvoice,
    };

    const subscriptionStatus =
      entity.source === "organization"
        ? entity.subscriptionStatus
        : entity.source === "user"
          ? entity.subscriptionStatus
          : entity.source === "admin" || entity.source === "token"
            ? "active"
            : "inactive";
    const periodEnd =
      entity.source === "organization"
        ? entity.currentPeriodEnd
        : entity.source === "user"
          ? entity.currentPeriodEnd
          : null;

    return NextResponse.json({
      allowed: result.allowed,
      reason: result.reason,
      plan: result.plan,
      used: proofOfWorkCount,
      limit: result.limit,
      isAdmin: result.isAdmin,
      personalUsed: personalProofOfWorkCount,
      organization: organizationSummary,
      workspacesUsed: workspaceCount,
      workspacesLimit: workspaceResult.limit,
      canCreateWorkspace: workspaceResult.allowed,
      workspaceReason: workspaceResult.reason,
      billingSource: entity.source,
      subscriptionStatus,
      periodEnd,
      // Teams / API Metered product features (org-resolved plan)
      canUseAgentApi:
        result.isAdmin || result.plan === "pro_teams" || result.plan === "api_metered",
      ...proofOfWorkPayload,
    });
  } catch (error) {
    console.error("check-usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
