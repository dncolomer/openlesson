import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  emailFromCheckoutSession,
  extraLessonsForCheckout,
  normalizeCheckoutEmail,
  periodEndForCheckout,
  planIdFromPriceType,
  profileUpdateFromCheckout,
} from "@/lib/stripe-checkout";

export interface PendingCheckoutRow {
  id: string;
  stripe_session_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  email: string;
  price_type: string;
  plan: string;
  monthly_volume: number | null;
  current_period_end: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  created_at: string;
}

export async function upsertPendingCheckoutFromSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  subscription?: Stripe.Subscription | null
): Promise<PendingCheckoutRow | null> {
  const email = emailFromCheckoutSession(session);
  const priceType = session.metadata?.price_type;
  if (!email || !priceType || !session.id) return null;

  const monthlyVolume = Math.max(0, Number(session.metadata?.monthly_volume) || 0);
  const plan = planIdFromPriceType(priceType);
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? subscription?.id ?? null;

  const row = {
    stripe_session_id: session.id,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    email,
    price_type: priceType,
    plan,
    monthly_volume: monthlyVolume || null,
    current_period_end: periodEndForCheckout(priceType, subscription),
  };

  const { data, error } = await supabase
    .from("pending_checkouts")
    .upsert(row, { onConflict: "stripe_session_id" })
    .select("*")
    .single();

  if (error) {
    console.error("upsertPendingCheckoutFromSession error:", error);
    return null;
  }
  return data as PendingCheckoutRow;
}

export async function getPendingCheckoutBySessionId(
  supabase: SupabaseClient,
  sessionId: string
): Promise<PendingCheckoutRow | null> {
  const { data, error } = await supabase
    .from("pending_checkouts")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("getPendingCheckoutBySessionId error:", error);
    return null;
  }
  return (data as PendingCheckoutRow | null) ?? null;
}

export async function claimPendingCheckout(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  email: string
): Promise<{ ok: true; pending: PendingCheckoutRow } | { ok: false; error: string }> {
  const pending = await getPendingCheckoutBySessionId(supabase, sessionId);
  if (!pending) {
    return { ok: false, error: "Checkout session not found or not paid yet." };
  }
  if (pending.claimed_at) {
    if (pending.claimed_by === userId) {
      return { ok: true, pending };
    }
    return { ok: false, error: "This checkout has already been used." };
  }

  const normalizedEmail = normalizeCheckoutEmail(email);
  if (!normalizedEmail || normalizedEmail !== pending.email) {
    return { ok: false, error: "Email does not match the checkout payment." };
  }

  const update = profileUpdateFromCheckout({
    priceType: pending.price_type,
    monthlyVolume: pending.monthly_volume ?? 0,
    stripeCustomerId: pending.stripe_customer_id,
    stripeSubscriptionId: pending.stripe_subscription_id,
    currentPeriodEnd: pending.current_period_end,
  });

  const { error: profileError } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId);

  if (profileError) {
    console.error("claimPendingCheckout profile update error:", profileError);
    return { ok: false, error: "Failed to activate subscription on profile." };
  }

  const { error: claimError } = await supabase
    .from("pending_checkouts")
    .update({ claimed_at: new Date().toISOString(), claimed_by: userId })
    .eq("id", pending.id)
    .is("claimed_at", null);

  if (claimError) {
    console.error("claimPendingCheckout claim error:", claimError);
    return { ok: false, error: "Failed to mark checkout as claimed." };
  }

  return { ok: true, pending };
}

export function pendingCheckoutIsClaimable(pending: PendingCheckoutRow | null): boolean {
  if (!pending) return false;
  if (pending.claimed_at) return false;
  if (pending.current_period_end && new Date(pending.current_period_end) <= new Date()) {
    return false;
  }
  return true;
}

/** @internal exported for tests */
export function buildProfilePatchFromPending(pending: PendingCheckoutRow) {
  return profileUpdateFromCheckout({
    priceType: pending.price_type,
    monthlyVolume: pending.monthly_volume ?? 0,
    stripeCustomerId: pending.stripe_customer_id,
    stripeSubscriptionId: pending.stripe_subscription_id,
    currentPeriodEnd: pending.current_period_end,
  });
}

/** @internal exported for tests */
export function extraLessonsFromPending(pending: PendingCheckoutRow): number {
  return extraLessonsForCheckout(
    pending.price_type,
    pending.monthly_volume ?? 0,
    planIdFromPriceType(pending.price_type)
  );
}