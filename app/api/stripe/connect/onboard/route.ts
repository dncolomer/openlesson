import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getAppOrigin } from "@/lib/app-url";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  if (!process.env.STRIPE_SECRET_KEY) {
    return jsonError(500, "Stripe is not configured");
  }

  const stripe = getStripe();
  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("stripe_connect_account_id, email")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) return jsonError(500, error.message);

  let accountId = profile?.stripe_connect_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: auth.user.email || profile?.email || undefined,
      metadata: { supabase_user_id: auth.user.id },
    });
    accountId = account.id;
    await auth.supabase
      .from("profiles")
      .update({
        stripe_connect_account_id: accountId,
        stripe_connect_charges_enabled: Boolean(account.charges_enabled),
      })
      .eq("id", auth.user.id);
  } else {
    const account = await stripe.accounts.retrieve(accountId);
    await auth.supabase
      .from("profiles")
      .update({ stripe_connect_charges_enabled: Boolean(account.charges_enabled) })
      .eq("id", auth.user.id);
  }

  const origin = getAppOrigin(request);
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard?tab=shop`,
    return_url: `${origin}/dashboard?tab=shop`,
    type: "account_onboarding",
  });
  return NextResponse.json({ url: link.url, accountId });
}
