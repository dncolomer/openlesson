import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getUnstakeUnlockDate, isUnstakeLocked, PARTNER_TIERS, PartnerTier } from "@/lib/partners";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    // Get partner record
    const { data: partner, error } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !partner) {
      return NextResponse.json({ error: "You are not a partner" }, { status: 400 });
    }

    if (!partner.unstake_requested_at) {
      return NextResponse.json({ error: "No unstake request found. Call unstake first." }, { status: 400 });
    }

    if (isUnstakeLocked(partner.unstake_requested_at)) {
      const unlockDate = getUnstakeUnlockDate(partner.unstake_requested_at);
      return NextResponse.json({
        error: "Unstake still locked",
        unlockDate: unlockDate?.toISOString() || null,
        daysRemaining: unlockDate ? Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0,
      });
    }

    // Revoke token-based plan access
    await supabase
      .from("profiles")
      .update({
        token_tier: null,
        token_validated_at: null,
        token_validity_expires_at: null,
        wallet_address: null,
      })
      .eq("id", user.id);

    // Delete partner record (unstake complete)
    const { error: deleteError } = await supabase
      .from("partners")
      .delete()
      .eq("id", partner.id);

    if (deleteError) {
      console.error("Error confirming unstake:", deleteError);
      return NextResponse.json({ error: "Failed to complete unstake" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully unstaked ${(partner.stake_amount / 1_000_000).toFixed(0)}M $UNSYS. Your plan access has been revoked. Contact us at https://x.com/uncertainsys to arrange return of your tokens.`,
      tier: partner.tier,
    });
  } catch (error) {
    console.error("Partner confirm-unstake error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}