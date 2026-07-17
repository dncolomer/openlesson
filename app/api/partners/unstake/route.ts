import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getUnstakeUnlockDate, UNSTAKE_LOCKUP_DAYS } from "@/lib/partners";

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

    if (partner.unstake_requested_at) {
      const unlockDate = getUnstakeUnlockDate(partner.unstake_requested_at);
      return NextResponse.json({
        error: "Unstake already requested",
        unlockDate: unlockDate?.toISOString() || null,
      });
    }

    // Set unstake request timestamp
    const { data: updatedPartner, error: updateError } = await supabase
      .from("partners")
      .update({
        unstake_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error requesting unstake:", updateError);
      return NextResponse.json({ error: "Failed to request unstake" }, { status: 500 });
    }

    const unlockDate = getUnstakeUnlockDate(updatedPartner.unstake_requested_at);

    return NextResponse.json({
      success: true,
      unstakeRequestedAt: updatedPartner.unstake_requested_at,
      unlockDate: unlockDate?.toISOString() || null,
      lockupDays: UNSTAKE_LOCKUP_DAYS,
    });
  } catch (error) {
    console.error("Partner unstake error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}