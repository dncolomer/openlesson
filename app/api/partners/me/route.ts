import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { PARTNER_TIERS, isUnstakeLocked, getUnstakeUnlockDate } from "@/lib/partners";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    // Get partner record with related stats
    const { data: partner, error } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !partner) {
      return NextResponse.json({ isPartner: false });
    }

    // Get referral count
    const { count: referralCount } = await supabase
      .from("partner_referrals")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partner.id);

    // Get unclaimed revenue
    const { data: revenueData } = await supabase
      .from("partner_revenue")
      .select("amount")
      .eq("partner_id", partner.id);

    const unclaimedRevenue = revenueData?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

    // Get referred users info
    const { data: referrals } = await supabase
      .from("partner_referrals")
      .select("referred_user_id, created_at")
      .eq("partner_id", partner.id);

    let referredUsers: { user_id: string; created_at: string }[] = [];
    if (referrals && referrals.length > 0) {
      const userIds = referrals.map(r => r.referred_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      referredUsers = referrals.map(r => {
        const profile = profiles?.find(p => p.id === r.referred_user_id);
        return {
          user_id: r.referred_user_id,
          username: profile?.username || "Unknown",
          created_at: r.created_at,
        };
      });
    }

    const isLocked = isUnstakeLocked(partner.unstake_requested_at);
    const unlockDate = getUnstakeUnlockDate(partner.unstake_requested_at);

    return NextResponse.json({
      isPartner: true,
      partner: {
        id: partner.id,
        tier: partner.tier,
        stakeAmount: partner.stake_amount,
        referralCode: partner.referral_code,
        stripeAccountId: partner.stripe_account_id,
        stripeAccountStatus: partner.stripe_account_status,
        totalRevenueClaimed: Number(partner.total_revenue_claimed),
        lastPayoutAt: partner.last_payout_at,
        unstakeRequestedAt: partner.unstake_requested_at,
        createdAt: partner.created_at,
      },
      stats: {
        referralCount: referralCount || 0,
        unclaimedRevenue,
        lifetimeEarnings: Number(partner.total_revenue_claimed),
        isUnstakeLocked: isLocked,
        unlockDate: unlockDate?.toISOString() || null,
      },
      referredUsers,
    });
  } catch (error) {
    console.error("Partner me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}