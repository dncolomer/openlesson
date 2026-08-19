import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimPendingCheckout,
  getPendingCheckoutBySessionId,
  upsertPendingCheckoutFromSession,
} from "@/lib/pending-checkout";
import { emailFromCheckoutSession, isGuestCheckoutPriceType } from "@/lib/stripe-checkout";
import { ensurePersonalOrganization } from "@/lib/organization/ensure-personal-org";
import { ensureUserProfile } from "@/lib/organization/ensure-profile";
import { acceptOrganizationInviteForUser } from "@/lib/organization/accept-invite";
import {
  findInviteByToken,
  inviteOrganization,
} from "@/lib/organization/find-invite";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

async function registerFromInvite(body: {
  inviteToken?: string;
  email?: string;
  password?: string;
}) {
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!inviteToken) {
    return jsonError(400, "inviteToken is required");
  }
  if (!email || !email.includes("@")) {
    return jsonError(400, "A valid email is required");
  }
  if (!password || password.length < 6) {
    return jsonError(400, "Password must be at least 6 characters");
  }

  const admin = createAdminClient();
  const invite = await findInviteByToken(admin, inviteToken);
  if (!invite) {
    return jsonError(404, "Invalid invite link");
  }
  if (invite.used_by) {
    return jsonError(400, "This invite has already been used. Sign in instead.");
  }

  const org = inviteOrganization(invite);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    console.error("createUser (invite) error:", createError);
    const message = createError?.message || "Failed to create account";
    if (/already|registered|exists/i.test(message)) {
      return jsonError(409, "An account with this email already exists. Sign in instead.", "email_exists",);
    }
    return jsonError(500, message);
  }

  const userId = created.user.id;

  // Do not rely solely on auth.users trigger (missing in some environments).
  try {
    await ensureUserProfile(admin, userId, { email });
  } catch (err) {
    console.error("[register-invite] ensureUserProfile failed:", err);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return jsonError(500, "Account could not be fully set up. Please try again.");
  }

  await ensurePersonalOrganization(admin, userId, { email }).catch((err) => {
    console.error("[register-invite] ensurePersonalOrganization failed:", err);
  });

  const accept = await acceptOrganizationInviteForUser(admin, inviteToken, userId, {
    email,
  });

  if (!accept.ok) {
    console.error("[register-invite] accept failed:", accept.error);
    return NextResponse.json({
      ok: true,
      email,
      userId,
      joined: false,
      joinError: accept.error,
      invitePath: `/invite/${inviteToken}`,
      organization: org
        ? { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url ?? null }
        : null,
    });
  }

  return NextResponse.json({
    ok: true,
    email,
    userId,
    joined: true,
    joinError: null,
    invitePath: `/invite/${inviteToken}`,
    organization: accept.organization ||
      (org
        ? { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url ?? null }
        : null),
  });
}

async function registerFromCheckout(body: { sessionId?: string; password?: string }) {
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!sessionId) {
    return jsonError(400, "sessionId is required");
  }
  if (!password || password.length < 6) {
    return jsonError(400, "Password must be at least 6 characters");
  }

  const stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
  if (stripeSession.payment_status !== "paid" && stripeSession.status !== "complete") {
    return jsonError(400, "Checkout is not complete yet.");
  }

  const admin = createAdminClient();
  let pending = await getPendingCheckoutBySessionId(admin, sessionId);
  const priceType = stripeSession.metadata?.price_type || "";
  if (!pending && priceType && isGuestCheckoutPriceType(priceType)) {
    let subscription = null;
    const subscriptionId =
      typeof stripeSession.subscription === "string"
        ? stripeSession.subscription
        : stripeSession.subscription?.id;
    if (subscriptionId) {
      subscription = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
    }
    pending = await upsertPendingCheckoutFromSession(admin, stripeSession, subscription);
  }
  const email = pending?.email || emailFromCheckoutSession(stripeSession);
  if (!email) {
    return jsonError(400, "Checkout email not found.");
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    console.error("createUser error:", createError);
    const message = createError?.message || "Failed to create account";
    if (/already|registered|exists/i.test(message)) {
      return jsonError(409, "An account with this email already exists. Sign in instead.", "email_exists");
    }
    return jsonError(500, message);
  }

  try {
    await ensureUserProfile(admin, created.user.id, { email });
  } catch (err) {
    console.error("[register] ensureUserProfile failed:", err);
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return jsonError(500, "Account could not be fully set up. Please try again.");
  }

  const claim = await claimPendingCheckout(admin, sessionId, created.user.id, email);
  if (!claim.ok) {
    await admin.auth.admin.deleteUser(created.user.id);
    return jsonError(400, claim.error);
  }

  const stripeCustomerId = pending?.stripe_customer_id;
  const stripeSubscriptionId = pending?.stripe_subscription_id;
  if (stripeCustomerId) {
    await getStripe().customers.update(stripeCustomerId, {
      metadata: { supabase_user_id: created.user.id },
    });
  }
  if (stripeSubscriptionId) {
    await getStripe().subscriptions.update(stripeSubscriptionId, {
      metadata: { supabase_user_id: created.user.id },
    });
  }

  await ensurePersonalOrganization(admin, created.user.id, { email }).catch((err) => {
    console.error("[register] ensurePersonalOrganization failed:", err);
  });

  return NextResponse.json({
    ok: true,
    email,
    userId: created.user.id,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (typeof body?.inviteToken === "string" && body.inviteToken.trim()) {
      return await registerFromInvite(body);
    }

    return await registerFromCheckout(body);
  } catch (error) {
    console.error("register error:", error);
    return jsonError(500, "Failed to create account");
  }
}
