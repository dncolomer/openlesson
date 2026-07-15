import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { AYCL_PRICE_CENTS, AYCL_PRICE_LABEL, buildAyclAccessUrl } from "@/lib/aycl-shared";
import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import { forkWorkspaceExactCopy } from "@/lib/fork-workspace";
import { emailFromCheckoutSession } from "@/lib/stripe-checkout";

export { AYCL_PRICE_CENTS, AYCL_PRICE_LABEL, buildAyclAccessUrl };

export interface AyclPurchase {
  id: string;
  source_workspace_id: string;
  forked_workspace_id: string | null;
  access_token_hash: string;
  stripe_checkout_session_id: string | null;
  purchaser_email: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
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
  }
): Promise<{ purchaseId: string; accessToken: string }> {
  const accessToken = createPrivateToken();

  const { data, error } = await supabase
    .from("aycl_purchases")
    .insert({
      source_workspace_id: params.sourceWorkspaceId,
      access_token_hash: hashPrivateToken(accessToken),
      stripe_checkout_session_id: params.stripeCheckoutSessionId,
      purchaser_email: params.purchaserEmail ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create AYCL purchase record");
  }

  return { purchaseId: data.id, accessToken };
}

export async function fulfillAyclPurchase(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ forkedWorkspaceId: string } | null> {
  const sessionId = session.id;

  const { data: existing } = await supabase
    .from("aycl_purchases")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (existing?.status === "completed" && existing.forked_workspace_id) {
    return { forkedWorkspaceId: existing.forked_workspace_id };
  }

  const sourceWorkspaceId =
    existing?.source_workspace_id || session.metadata?.workspace_id?.trim() || "";

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

  if (!existing) {
    console.error("[aycl] Pending purchase not found for session:", sessionId);
    return null;
  }

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