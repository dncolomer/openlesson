import { NextRequest, NextResponse } from "next/server";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  const ctx = await resolveAyclAccess(token);

  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // Full workspace row (includes unusable_cells, workspace_dags, etc.) — AYCL is a clone.
  const { data: workspace, error: workspaceError } = await ctx.supabase
    .from("workspaces")
    .select("*")
    .eq("id", ctx.workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { data: blocks, error: blocksError } = await ctx.supabase
    .from("blocks")
    .select("*")
    .eq("workspace_id", ctx.workspaceId);

  if (blocksError) {
    return NextResponse.json({ error: blocksError.message }, { status: 500 });
  }

  return NextResponse.json({
    workspace,
    blocks: blocks || [],
    purchaseId: ctx.purchase.id,
    accessTier: ctx.accessTier,
    capabilities: ctx.capabilities,
  });
}