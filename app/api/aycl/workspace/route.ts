import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import {
  formatAyclPriceCents,
  resolveAyclUpgradeCents,
} from "@/lib/aycl-marketplace";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  const ctx = await resolveAyclAccess(token);

  if ("error" in ctx) {
    return jsonError(ctx.status, ctx.error);
  }

  // Full workspace row (includes unusable_cells, workspace_dags, etc.) — AYCL is a clone.
  const { data: workspace, error: workspaceError } = await ctx.supabase
    .from("workspaces")
    .select("*")
    .eq("id", ctx.workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return jsonError(404, "Workspace not found");
  }

  const { data: blocks, error: blocksError } = await ctx.supabase
    .from("blocks")
    .select("*")
    .eq("workspace_id", ctx.workspaceId);

  if (blocksError) {
    return jsonError(500, blocksError.message);
  }

  // Upgrade price comes from catalog source listing (not the private fork).
  let upgradePriceCents = resolveAyclUpgradeCents(null);
  if (ctx.purchase.source_workspace_id) {
    const { data: catalog } = await ctx.supabase
      .from("workspaces")
      .select("aycl_learner_price_cents, aycl_full_price_cents")
      .eq("id", ctx.purchase.source_workspace_id)
      .maybeSingle();
    if (catalog) {
      upgradePriceCents = resolveAyclUpgradeCents({
        aycl_learner_price_cents: catalog.aycl_learner_price_cents,
        aycl_full_price_cents: catalog.aycl_full_price_cents,
      });
    }
  }

  return NextResponse.json({
    workspace,
    blocks: blocks || [],
    purchaseId: ctx.purchase.id,
    accessTier: ctx.accessTier,
    capabilities: ctx.capabilities,
    upgradePriceCents,
    upgradePriceLabel: formatAyclPriceCents(upgradePriceCents),
  });
}