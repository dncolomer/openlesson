import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getAdminClient } from "@/lib/partners";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    // Get all partners with user info
    const { data: partners, error } = await adminClient
      .from("partners")
      .select(`
        id,
        user_id,
        tier,
        stake_amount,
        referral_code,
        stripe_account_id,
        stripe_account_status,
        total_revenue_claimed,
        last_payout_at,
        unstake_requested_at,
        created_at,
        profiles!inner(id, username)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching partners:", error);
      return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
    }

    // Enrich with revenue data
    const partnerIds = (partners || []).map(p => p.id);
    
    let revenueData: Record<string, number> = {};
    let referralCounts: Record<string, number> = {};

    if (partnerIds.length > 0) {
      const { data: revenues } = await adminClient
        .from("partner_revenue")
        .select("partner_id, amount");

      if (revenues) {
        revenues.forEach(r => {
          revenueData[r.partner_id] = (revenueData[r.partner_id] || 0) + Number(r.amount);
        });
      }

      const { count: countByPartner } = await adminClient
        .from("partner_referrals")
        .select("partner_id", { count: "exact", head: true })
        .in("partner_id", partnerIds);

      // Get individual counts
      for (const pid of partnerIds) {
        const { count } = await adminClient
          .from("partner_referrals")
          .select("*", { count: "exact", head: true })
          .eq("partner_id", pid);
        referralCounts[pid] = count || 0;
      }
    }

    const enrichedPartners = (partners || []).map(p => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return {
        id: p.id,
        userId: p.user_id,
        username: profile?.username || "Unknown",
        tier: p.tier,
        stakeAmount: p.stake_amount,
        referralCode: p.referral_code,
        stripeAccountStatus: p.stripe_account_status,
        totalRevenueClaimed: Number(p.total_revenue_claimed),
        unclaimedRevenue: revenueData[p.id] || 0,
        referralCount: referralCounts[p.id] || 0,
        lastPayoutAt: p.last_payout_at,
        unstakeRequestedAt: p.unstake_requested_at,
        createdAt: p.created_at,
      };
    });

    return NextResponse.json({ partners: enrichedPartners });
  } catch (error) {
    console.error("Admin partners error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}