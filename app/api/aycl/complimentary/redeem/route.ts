import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { redeemComplimentaryAyclLink } from "@/lib/aycl";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Redeem a complimentary AYCL landing CTA (play or full) without Stripe.
 * Eligibility (usage remaining, not expired) is enforced in redeemComplimentaryAyclLink.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return jsonError(400, "token is required");
    }

    const redeemed = await redeemComplimentaryAyclLink(createAdminClient(), token);
    if ("error" in redeemed) {
      return jsonError(redeemed.status, redeemed.error);
    }

    return NextResponse.json({
      accessToken: redeemed.accessToken,
      ayclAccessToken: redeemed.accessToken,
      accessTier: redeemed.accessTier,
      url: `/learn/${redeemed.accessToken}`,
    });
  } catch (error) {
    console.error("[aycl/complimentary/redeem]", error);
    return jsonError(500, "Failed to redeem complimentary access");
  }
}
