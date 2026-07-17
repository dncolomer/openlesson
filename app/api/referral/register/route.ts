import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const referralCode = searchParams.get("code");

    if (!referralCode) {
      return NextResponse.json({ error: "Referral code required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    const { data: partner, error: partnerError } = await adminClient
      .from("partners")
      .select("id, user_id")
      .eq("referral_code", referralCode.toUpperCase())
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("username")
      .eq("id", partner.user_id)
      .single();

    const username = profile?.username || null;

    return NextResponse.json({ success: true, partnerId: partner.id, username });
  } catch (error) {
    console.error("Get partner error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { referralCode } = await request.json();
    const userId = user.id;

    if (!referralCode) {
      return NextResponse.json({ error: "Referral code required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    const { data: partner, error: partnerError } = await adminClient
      .from("partners")
      .select("id, user_id")
      .eq("referral_code", referralCode.toUpperCase())
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
    }

    if (partner.user_id === userId) {
      return NextResponse.json({ error: "Cannot use your own referral code" }, { status: 400 });
    }

    const { data: existingReferral } = await adminClient
      .from("partner_referrals")
      .select("id")
      .eq("partner_id", partner.id)
      .eq("referred_user_id", userId)
      .single();

    if (existingReferral) {
      return NextResponse.json({ message: "Already referred", success: true });
    }

    const { error: insertError } = await adminClient
      .from("partner_referrals")
      .insert({
        partner_id: partner.id,
        referred_user_id: userId,
      });

    if (insertError) {
      console.error("Error creating referral:", insertError);
      return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
    }

    const { error: creditsError } = await adminClient.rpc("add_user_credits", {
      p_user_id: userId,
      p_lessons: 15,
    });

    if (creditsError) {
      console.error("Error adding credits:", creditsError);
    }

    return NextResponse.json({ success: true, partnerId: partner.id });
  } catch (error) {
    console.error("Referral register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}