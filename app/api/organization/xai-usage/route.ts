import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingPeriodStart } from "@/lib/usage-metrics";
import {
  getTeamApiKeyUsage,
  isXaiManagementConfigured,
} from "@/lib/xai-management";

export const runtime = "nodejs";

const PRESETS = new Set(["7d", "30d", "90d", "billing"]);

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolvePeriod(params: {
  period: string | null;
  from: string | null;
  to: string | null;
  currentPeriodEnd: string | null;
}): { start: Date; end: Date; preset: string } {
  const end = parseIsoDate(params.to) ?? new Date();
  const customFrom = parseIsoDate(params.from);

  if (customFrom) {
    if (customFrom >= end) {
      throw new Error("from must be before to");
    }
    // Cap range at 366 days
    const maxMs = 366 * 86400000;
    if (end.getTime() - customFrom.getTime() > maxMs) {
      throw new Error("Date range cannot exceed 366 days");
    }
    return { start: customFrom, end, preset: "custom" };
  }

  const period = params.period && PRESETS.has(params.period) ? params.period : "billing";

  if (period === "billing") {
    const fromBilling = params.currentPeriodEnd
      ? billingPeriodStart(params.currentPeriodEnd)
      : null;
    const start =
      fromBilling ?? new Date(end.getTime() - 30 * 86400000);
    return { start, end, preset: "billing" };
  }

  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return {
    start: new Date(end.getTime() - days * 86400000),
    end,
    preset: period,
  };
}

/**
 * GET /api/organization/xai-usage
 * Query:
 *   period=7d|30d|90d|billing (default billing)
 *   from=ISO&to=ISO (optional custom range; overrides period)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    if (!isXaiManagementConfigured()) {
      return NextResponse.json({
        available: false,
        error: "xAI Management API is not configured",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { available: false, error: "No organization on this account" },
        { status: 404 }
      );
    }

    const admin = createAdminClient();
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select(
        "id, name, current_period_end, billing_mode, xai_api_key_id, xai_api_key_name, xai_api_key_status"
      )
      .eq("id", profile.organization_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { available: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    if (org.xai_api_key_status !== "ready" || !org.xai_api_key_id) {
      return NextResponse.json({
        available: false,
        error: "This organization does not have a ready xAI API key",
        organizationId: org.id,
      });
    }

    const { searchParams } = new URL(req.url);
    let range: { start: Date; end: Date; preset: string };
    try {
      range = resolvePeriod({
        period: searchParams.get("period"),
        from: searchParams.get("from"),
        to: searchParams.get("to"),
        currentPeriodEnd: org.current_period_end,
      });
    } catch (err) {
      return jsonError(400, err instanceof Error ? err.message : "Invalid period");
    }

    const queryEnd = new Date(range.end.getTime() + 1000);

    try {
      const usage = await getTeamApiKeyUsage({
        apiKeyId: org.xai_api_key_id,
        start: range.start,
        end: queryEnd,
      });

      return NextResponse.json({
        available: true,
        period: range.preset,
        billingMode: org.billing_mode || "subscription",
        organizationId: org.id,
        organizationName: org.name,
        apiKeyId: org.xai_api_key_id,
        apiKeyName: org.xai_api_key_name,
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
        totalUsd: usage.totalUsd,
        lines: usage.lines,
      });
    } catch (err) {
      console.error("organization xai-usage query failed:", err);
      return NextResponse.json({
        available: false,
        period: range.preset,
        apiKeyId: org.xai_api_key_id,
        apiKeyName: org.xai_api_key_name,
        periodStart: range.start.toISOString(),
        periodEnd: range.end.toISOString(),
        totalUsd: 0,
        lines: [],
        error: err instanceof Error ? err.message : "Failed to load xAI usage",
      });
    }
  } catch (error) {
    console.error("organization xai-usage error:", error);
    return jsonError(500, "Internal server error");
  }
}
