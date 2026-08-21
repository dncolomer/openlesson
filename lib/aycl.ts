import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  AYCL_FULL_PRICE_CENTS,
  AYCL_FULL_PRICE_LABEL,
  AYCL_LEARNER_PRICE_CENTS,
  AYCL_LEARNER_PRICE_LABEL,
  AYCL_PRICE_CENTS,
  AYCL_PRICE_LABEL,
  AYCL_UPGRADE_PRICE_CENTS,
  AYCL_UPGRADE_PRICE_LABEL,
  ayclPriceCentsForTier,
  ayclTierAfterUpgrade,
  buildAyclAccessUrl,
  normalizeAyclAccessTier,
  resolveAyclCapabilities,
  type AyclAccessTier,
  type AyclCapabilities,
} from "@/lib/aycl-shared";
import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import { forkWorkspaceExactCopy } from "@/lib/fork-workspace";
import { emailFromCheckoutSession } from "@/lib/stripe-checkout";
import {
  ayclComplimentaryPurchaseRow,
  complimentaryAyclLinkEligible,
} from "@/lib/aycl-complimentary";

export {
  AYCL_PRICE_CENTS,
  AYCL_PRICE_LABEL,
  AYCL_LEARNER_PRICE_CENTS,
  AYCL_LEARNER_PRICE_LABEL,
  AYCL_FULL_PRICE_CENTS,
  AYCL_FULL_PRICE_LABEL,
  AYCL_UPGRADE_PRICE_CENTS,
  AYCL_UPGRADE_PRICE_LABEL,
  buildAyclAccessUrl,
  normalizeAyclAccessTier,
  resolveAyclCapabilities,
  ayclPriceCentsForTier,
};
export type { AyclAccessTier, AyclCapabilities };

export interface AyclPurchase {
  id: string;
  source_workspace_id: string;
  forked_workspace_id: string | null;
  access_token_hash: string;
  stripe_checkout_session_id: string | null;
  purchaser_email: string | null;
  status: "pending" | "completed" | "failed";
  /** learner | full — null/missing treated as full by normalizeAyclAccessTier */
  access_tier?: string | null;
  upgraded_from_purchase_id?: string | null;
  /** Set when this purchase was minted from a complimentary (free) special URL. */
  complimentary_link_id?: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AyclComplimentaryLink {
  id: string;
  workspace_id: string;
  created_by: string | null;
  access_tier: string;
  access_token_hash: string;
  public_token: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  status: "active" | "revoked" | string;
  created_at: string;
  revoked_at: string | null;
}

export async function getAyclComplimentaryLinkByToken(
  supabase: SupabaseClient,
  accessToken: string,
): Promise<AyclComplimentaryLink | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const { data, error } = await supabase
    .from("aycl_complimentary_links")
    .select("*")
    .eq("access_token_hash", hashPrivateToken(token))
    .maybeSingle();

  if (error || !data) return null;
  return data as AyclComplimentaryLink;
}

/**
 * Redeem a complimentary special URL: check eligibility, reserve a use, fork
 * a private copy, insert a completed aycl_purchases row with no Stripe session.
 * Returns a new personal access token (caller should redirect to /learn/{token}).
 */
export async function redeemComplimentaryAyclLink(
  supabase: SupabaseClient,
  couponToken: string,
  now: Date = new Date(),
): Promise<
  | { accessToken: string; purchase: AyclPurchase; accessTier: AyclAccessTier }
  | { error: string; status: number }
> {
  const token = couponToken.trim();
  if (!token) return { error: "Access token required", status: 401 };

  const link = await getAyclComplimentaryLinkByToken(supabase, token);
  if (!link) return { error: "Invalid or expired access link", status: 404 };

  const eligibility = complimentaryAyclLinkEligible(link, now);
  if (!eligibility.ok) {
    return { error: "Invalid or expired access link", status: 404 };
  }

  const accessTier = normalizeAyclAccessTier(link.access_tier);

  const nowIso = now.toISOString();
  const { data: reserved, error: reserveError } = await supabase
    .from("aycl_complimentary_links")
    .update({ use_count: link.use_count + 1 })
    .eq("id", link.id)
    .eq("status", "active")
    .eq("use_count", link.use_count)
    .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
    .select("id")
    .maybeSingle();

  if (reserveError || !reserved) {
    return { error: "Invalid or expired access link", status: 404 };
  }

  const { data: sourceWorkspace, error: sourceError } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, user_id, is_all_you_can_learn")
    .eq("id", link.workspace_id)
    .single();

  if (sourceError || !sourceWorkspace?.user_id) {
    await supabase
      .from("aycl_complimentary_links")
      .update({ use_count: link.use_count })
      .eq("id", link.id)
      .eq("use_count", link.use_count + 1);
    return { error: "Workspace not found", status: 404 };
  }

  const accessToken = createPrivateToken();
  try {
    const fork = await forkWorkspaceExactCopy(supabase, {
      sourceWorkspaceId: sourceWorkspace.id,
      ownerUserId: sourceWorkspace.user_id,
      title: sourceWorkspace.title || sourceWorkspace.root_topic,
      originalWorkspaceId: sourceWorkspace.id,
      isAyclFork: true,
    });

    const row = ayclComplimentaryPurchaseRow({
      sourceWorkspaceId: sourceWorkspace.id,
      forkedWorkspaceId: fork.workspaceId,
      accessTokenHash: hashPrivateToken(accessToken),
      accessTier,
      complimentaryLinkId: link.id,
      now,
    });

    const { data: purchase, error: insertError } = await supabase
      .from("aycl_purchases")
      .insert(row)
      .select("*")
      .single();

    if (insertError || !purchase) {
      throw new Error(insertError?.message || "Failed to create complimentary purchase");
    }

    return {
      accessToken,
      purchase: purchase as AyclPurchase,
      accessTier,
    };
  } catch (err) {
    console.error("[aycl] complimentary redeem failed", err);
    await supabase
      .from("aycl_complimentary_links")
      .update({ use_count: link.use_count })
      .eq("id", link.id)
      .eq("use_count", link.use_count + 1);
    return { error: "Failed to grant complimentary access", status: 500 };
  }
}

export async function getAyclPurchaseByToken(
  supabase: SupabaseClient,
  accessToken: string
): Promise<AyclPurchase | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const { data, error } = await supabase
    .from("aycl_purchases")
    .select("*")
    .eq("access_token_hash", hashPrivateToken(token))
    .eq("status", "completed")
    .maybeSingle();

  if (error || !data) return null;
  return data as AyclPurchase;
}

export async function getAyclPurchaseByCheckoutSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<(AyclPurchase & { access_token?: string }) | null> {
  const { data, error } = await supabase
    .from("aycl_purchases")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return data as AyclPurchase;
}

export async function createPendingAyclPurchase(
  supabase: SupabaseClient,
  params: {
    sourceWorkspaceId: string;
    stripeCheckoutSessionId: string;
    purchaserEmail?: string | null;
    accessTier?: AyclAccessTier | null;
  }
): Promise<{ purchaseId: string; accessToken: string }> {
  const accessToken = createPrivateToken();
  const access_tier = normalizeAyclAccessTier(params.accessTier ?? "full");

  const { data, error } = await supabase
    .from("aycl_purchases")
    .insert({
      source_workspace_id: params.sourceWorkspaceId,
      access_token_hash: hashPrivateToken(accessToken),
      stripe_checkout_session_id: params.stripeCheckoutSessionId,
      purchaser_email: params.purchaserEmail ?? null,
      status: "pending",
      access_tier,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create AYCL purchase record");
  }

  return { purchaseId: data.id, accessToken };
}

/**
 * Pure eligibility for upgrade checkout (same access link, promote to full).
 */
export function ayclPurchaseEligibleForUpgrade(
  purchase: Pick<AyclPurchase, "status" | "access_tier" | "forked_workspace_id">,
): boolean {
  if (purchase.status !== "completed") return false;
  if (!purchase.forked_workspace_id) return false;
  return normalizeAyclAccessTier(purchase.access_tier) === "learner";
}

export async function fulfillAyclPurchase(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ forkedWorkspaceId: string } | null> {
  const sessionId = session.id;
  const meta = (session.metadata || {}) as Record<string, string>;
  const isUpgrade = meta.aycl_upgrade === "1" || meta.aycl_upgrade === "true";

  // ── Upgrade path first (no new pending purchase row; promote by id) ──
  // Link this Stripe session id onto the same purchase so verify-session
  // (lookup by stripe_checkout_session_id) resolves after practice→full.
  if (isUpgrade && meta.upgrade_from_purchase_id) {
    const fromId = meta.upgrade_from_purchase_id.trim();
    const { data: original } = await supabase
      .from("aycl_purchases")
      .select("*")
      .eq("id", fromId)
      .maybeSingle();

    if (!original?.forked_workspace_id) {
      console.error("[aycl] Upgrade source purchase not found:", fromId);
      return null;
    }

    const email = emailFromCheckoutSession(session);
    const alreadyFull =
      normalizeAyclAccessTier(original.access_tier) === "full";

    if (!ayclPurchaseEligibleForUpgrade(original as AyclPurchase)) {
      if (alreadyFull) {
        // Idempotent: still bind this checkout session for verify-session.
        await supabase
          .from("aycl_purchases")
          .update({
            stripe_checkout_session_id: sessionId,
            purchaser_email: email || original.purchaser_email,
          })
          .eq("id", original.id);
        return { forkedWorkspaceId: original.forked_workspace_id };
      }
      console.error("[aycl] Purchase not eligible for upgrade:", fromId);
      return null;
    }

    const { error: updateError } = await supabase
      .from("aycl_purchases")
      .update({
        access_tier: ayclTierAfterUpgrade(),
        // Re-bind so /api/aycl/verify-session?session_id=… finds this row.
        stripe_checkout_session_id: sessionId,
        purchaser_email: email || original.purchaser_email,
      })
      .eq("id", original.id);

    if (updateError) {
      console.error("[aycl] Failed to complete upgrade:", updateError);
      return null;
    }

    return { forkedWorkspaceId: original.forked_workspace_id };
  }

  const { data: existing } = await supabase
    .from("aycl_purchases")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (existing?.status === "completed" && existing.forked_workspace_id) {
    return { forkedWorkspaceId: existing.forked_workspace_id };
  }

  if (!existing) {
    console.error("[aycl] Pending purchase not found for session:", sessionId);
    return null;
  }

  // ── Fresh purchase: fork workspace ──
  const sourceWorkspaceId =
    existing.source_workspace_id || meta.workspace_id?.trim() || "";

  if (!sourceWorkspaceId) {
    console.error("[aycl] Missing workspace_id in checkout metadata");
    return null;
  }

  const { data: sourceWorkspace, error: sourceError } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, user_id, is_all_you_can_learn")
    .eq("id", sourceWorkspaceId)
    .single();

  if (sourceError || !sourceWorkspace) {
    console.error("[aycl] Source workspace not found:", sourceWorkspaceId);
    return null;
  }

  if (!sourceWorkspace.is_all_you_can_learn) {
    console.error("[aycl] Workspace is not an AYCL catalog item:", sourceWorkspaceId);
    return null;
  }

  if (!sourceWorkspace.user_id) {
    console.error("[aycl] Source workspace has no owner");
    return null;
  }

  const access_tier = normalizeAyclAccessTier(
    existing.access_tier || meta.aycl_access_tier || "full",
  );

  const fork = await forkWorkspaceExactCopy(supabase, {
    sourceWorkspaceId,
    ownerUserId: sourceWorkspace.user_id,
    title: sourceWorkspace.title || sourceWorkspace.root_topic,
    originalWorkspaceId: sourceWorkspaceId,
    isAyclFork: true,
  });

  const { error: updateError } = await supabase
    .from("aycl_purchases")
    .update({
      forked_workspace_id: fork.workspaceId,
      status: "completed",
      completed_at: new Date().toISOString(),
      purchaser_email: emailFromCheckoutSession(session),
      access_tier,
    })
    .eq("stripe_checkout_session_id", sessionId);

  if (updateError) {
    console.error("[aycl] Failed to complete purchase:", updateError);
    return null;
  }

  return { forkedWorkspaceId: fork.workspaceId };
}

export async function sessionBelongsToAyclFork(
  supabase: SupabaseClient,
  sessionId: string,
  forkedWorkspaceId: string
): Promise<boolean> {
  const { data: session } = await supabase
    .from("sessions")
    .select("id, metadata")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return false;

  const metadata = (session.metadata || {}) as { workspace_id?: string; aycl_fork_workspace_id?: string };
  if (metadata.aycl_fork_workspace_id === forkedWorkspaceId) return true;
  if (metadata.workspace_id === forkedWorkspaceId) return true;

  const { data: blockSession } = await supabase
    .from("block_sessions")
    .select("workspace_id")
    .eq("session_id", sessionId)
    .eq("workspace_id", forkedWorkspaceId)
    .limit(1)
    .maybeSingle();

  return Boolean(blockSession);
}