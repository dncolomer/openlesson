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
  countIleSessions,
  countTapSessions,
  countOrgIleSessions,
  countOrgTapSessions,
  loadUsageProfile,
} from "@/lib/usage-metrics";
import {
  getTeamApiKeyUsage,
  isXaiManagementConfigured,
  type XaiApiKeyUsageResult,
} from "@/lib/xai-management";

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
          "id, name, plan, subscription_status, current_period_end, extra_lessons, billing_mode, kind, archived_at, xai_api_key_id, xai_api_key_name, xai_api_key_status"
        )
        .eq("id", profile.organization_id)
        .maybeSingle();
      org = (orgRow as (OrgBillingRow & {
        name?: string;
        xai_api_key_id?: string | null;
        xai_api_key_name?: string | null;
        xai_api_key_status?: string | null;
      }) | null) ?? null;
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
        billingMode: entity.billingMode,
      };
    }

    const result = canSubmitProofOfWork(userProfile, proofOfWorkCount);
    const workspaceCount = await countActiveWorkspaces(supabase, user.id);
    const workspaceResult = canCreateWorkspace(userProfile, workspaceCount);

    let apiPowCallsUsed = 0;
    let tapSessionsUsed = 0;
    let ileSessionsUsed = 0;
    let apiMeteredInvoice: ReturnType<typeof estimateApiMeteredInvoice> | null = null;
    if (isApiMeteredPlan(userProfile.plan)) {
      if (entity.source === "organization" && profile.organization_id && periodStart) {
        const { data: orgMembers } = await admin
          .from("profiles")
          .select("id")
          .eq("organization_id", profile.organization_id);
        const memberIds = (orgMembers || []).map((m) => m.id);
        // Sum external/API PoW across members (created_by_api_key_id set — not TAP/ILE internal PoW)
        for (const memberId of memberIds) {
          apiPowCallsUsed += await countPowApiSubmissions(admin, memberId, periodStart);
        }
        if (memberIds.length > 0) {
          tapSessionsUsed = await countOrgTapSessions(admin, memberIds, periodStart);
          ileSessionsUsed = await countOrgIleSessions(admin, memberIds, periodStart);
        }
      } else {
        apiPowCallsUsed = await countPowApiSubmissions(supabase, user.id, periodStart);
        tapSessionsUsed = await countTapSessions(supabase, user.id, periodStart);
        ileSessionsUsed = await countIleSessions(supabase, user.id, periodStart);
      }
      apiMeteredInvoice = estimateApiMeteredInvoice(
        apiPowCallsUsed,
        tapSessionsUsed,
        ileSessionsUsed
      );
    }

    const proofOfWorkPayload = {
      proofOfWorkUsed: proofOfWorkCount,
      proofOfWorkPersonalUsed: personalProofOfWorkCount,
      proofOfWorkLimit: result.limit,
      canSubmitProofOfWork: result.allowed,
      evidenceReason: result.reason,
      /** External/API-direct PoW only (created_by_api_key_id); not TAP/ILE-generated PoW. */
      apiPowCallsUsed,
      tapSessionsUsed,
      ileSessionsUsed,
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

    const billingMode =
      entity.source === "organization" ? entity.billingMode : null;

    // Per-org xAI inference spend (Management API, filtered by org API key + period).
    let xaiUsage: (XaiApiKeyUsageResult & {
      apiKeyName: string | null;
      available: boolean;
      error?: string;
    }) | null = null;

    const orgWithKey = org as (OrgBillingRow & {
      name?: string;
      xai_api_key_id?: string | null;
      xai_api_key_name?: string | null;
      xai_api_key_status?: string | null;
    }) | null;

    if (
      entity.source === "organization" &&
      orgWithKey?.xai_api_key_status === "ready" &&
      orgWithKey.xai_api_key_id &&
      isXaiManagementConfigured()
    ) {
      const end = new Date();
      let start: Date;
      if (periodStart) {
        start = periodStart;
      } else if (entity.currentPeriodEnd) {
        start = billingPeriodStart(entity.currentPeriodEnd) ?? new Date(end.getTime() - 30 * 86400000);
      } else {
        start = new Date(end.getTime() - 30 * 86400000);
      }
      // Usage API end is exclusive; nudge a second past now so in-progress spend is included.
      const queryEnd = new Date(end.getTime() + 1000);

      try {
        const usage = await getTeamApiKeyUsage({
          apiKeyId: orgWithKey.xai_api_key_id,
          start,
          end: queryEnd,
        });
        xaiUsage = {
          ...usage,
          apiKeyName: orgWithKey.xai_api_key_name ?? null,
          available: true,
        };
      } catch (err) {
        console.error("check-usage xAI spend query failed:", err);
        xaiUsage = {
          apiKeyId: orgWithKey.xai_api_key_id,
          apiKeyName: orgWithKey.xai_api_key_name ?? null,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          totalUsd: 0,
          lines: [],
          available: false,
          error: err instanceof Error ? err.message : "Failed to load xAI usage",
        };
      }
    }

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
      /** subscription | partner (org Stripe bypass) | null when not org-billed */
      billingMode,
      subscriptionStatus,
      periodEnd,
      /** Org inference cost from xAI Management API (per org API key + period). */
      xaiUsage,
      // API Metered product features (org-resolved plan)
      canUseAgentApi: result.isAdmin || result.plan === "api_metered",
      ...proofOfWorkPayload,
    });
  } catch (error) {
    console.error("check-usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
