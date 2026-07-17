import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import Stripe from "stripe";
import { getAdminClient, PARTNER_TIERS, PartnerTier } from "@/lib/partners";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    const { partnerId } = await request.json();

    if (!partnerId) {
      return NextResponse.json({ error: "Partner ID required" }, { status: 400 });
    }

    // Get partner with all pending revenue
    const { data: partner, error: partnerError } = await adminClient
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    if (!partner.stripe_account_id || partner.stripe_account_status !== "connected") {
      return NextResponse.json({ error: "Partner has not connected Stripe" }, { status: 400 });
    }

    // Get all unclaimed revenue
    const { data: revenues, error: revenueError } = await adminClient
      .from("partner_revenue")
      .select("id, amount")
      .eq("partner_id", partnerId);

    if (revenueError) {
      console.error("Error fetching revenue:", revenueError);
      return NextResponse.json({ error: "Failed to fetch revenue" }, { status: 500 });
    }

    const totalUnclaimed = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

    if (totalUnclaimed <= 0) {
      return NextResponse.json({ error: "No unclaimed revenue to payout" }, { status: 400 });
    }

    // Create Stripe transfer
    const stripe = getStripe();
    
    try {
      // Convert cents to dollars for Stripe
      const amountInDollars = Math.floor(totalUnclaimed * 100) / 100;
      
      // Minimum transfer is $1 (Stripe limit)
      if (amountInDollars < 1) {
        return NextResponse.json({ error: "Minimum payout is $1.00" }, { status: 400 });
      }

      const transfer = await stripe.transfers.create({
        amount: Math.round(amountInDollars * 100), // Convert to cents
        currency: "usd",
        destination: partner.stripe_account_id,
        metadata: {
          partner_id: partnerId,
          payout_type: "partner_revenue_share",
        },
      });

      // Update partner record
      const newTotalClaimed = Number(partner.total_revenue_claimed) + totalUnclaimed;
      await adminClient
        .from("partners")
        .update({
          total_revenue_claimed: newTotalClaimed,
          last_payout_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", partnerId);

      // Delete the revenue records (they've been paid out)
      if (revenues && revenues.length > 0) {
        const revenueIds = revenues.map(r => r.id);
        await adminClient
          .from("partner_revenue")
          .delete()
          .in("id", revenueIds);
      }

      return NextResponse.json({
        success: true,
        payoutAmount: amountInDollars,
        transferId: transfer.id,
        partnerId,
      });
    } catch (stripeError: unknown) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : "Stripe transfer failed";
      console.error("Stripe transfer error:", errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error("Admin payout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}