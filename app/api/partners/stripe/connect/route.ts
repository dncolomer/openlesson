import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import Stripe from "stripe";
import { getAppOrigin } from "@/lib/app-url";
import { getAdminClient } from "@/lib/partners";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

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

    // Prefer email from the already-authenticated user
    const userEmail = user.email;

    const stripe = getStripe();

    // Create Stripe Connect account if not exists
    let accountId = partner.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: userEmail || undefined,
        metadata: {
          partner_id: partner.id,
          user_id: user.id,
        },
        capabilities: {
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Update partner with account ID
      await supabase
        .from("partners")
        .update({
          stripe_account_id: accountId,
          stripe_account_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", partner.id);
    }

    // Create account link for onboarding
    const baseUrl = getAppOrigin(request);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/dashboard/partner?stripe_refresh=1`,
      return_url: `${baseUrl}/dashboard/partner?stripe_connected=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: accountLink.url,
    });
  } catch (error) {
    console.error("Stripe connect error:", error);
    return NextResponse.json({ error: "Failed to create Stripe connection" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    // Check account status
    const { data: partner } = await supabase
      .from("partners")
      .select("stripe_account_id, stripe_account_status")
      .eq("user_id", user.id)
      .single();

    if (!partner) {
      return NextResponse.json({ error: "You are not a partner" }, { status: 400 });
    }

    if (!partner.stripe_account_id) {
      return NextResponse.json({ status: "not_connected" });
    }

    // Verify account status with Stripe
    const stripe = getStripe();
    try {
      const account = await stripe.accounts.retrieve(partner.stripe_account_id);
      const chargesEnabled = account.charges_enabled;
      const payoutsEnabled = account.payouts_enabled;

      const status = chargesEnabled && payoutsEnabled ? "connected" : "pending";

      // Update status if changed
      if (status !== partner.stripe_account_status) {
        await supabase
          .from("partners")
          .update({
            stripe_account_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }

      return NextResponse.json({ status });
    } catch {
      return NextResponse.json({ status: partner.stripe_account_status });
    }
  } catch (error) {
    console.error("Stripe status check error:", error);
    return NextResponse.json({ error: "Failed to check Stripe status" }, { status: 500 });
  }
}