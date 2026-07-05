import { NextRequest, NextResponse } from "next/server";
import { createPrivateToken, getGhcScoreBriefForUser, hashPrivateToken } from "@/lib/ghc-score";
import { requireDemoAdminWorkspaceSession } from "@/lib/evidence-api-demo/demo-access";
import { buildDemoTapSessionUrl } from "@/lib/evidence-api-demo/demo-session-url";
import { selectTapValidationBlock } from "@/lib/evidence-api-demo/tap-validation";
import { isUuid } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const planId = typeof body.planId === "string" ? body.planId : "";
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const access = await requireDemoAdminWorkspaceSession(planId);
    if (access instanceof NextResponse) return access;

    let blockId = typeof body.blockId === "string" ? body.blockId : "";
    if (!blockId) {
      const { data: blocks, error: blocksError } = await access.supabase
        .from("plan_nodes")
        .select("id, title, description")
        .eq("plan_id", planId)
        .order("created_at", { ascending: true });

      if (blocksError) {
        return NextResponse.json({ error: blocksError.message }, { status: 500 });
      }

      const selected = selectTapValidationBlock(blocks || []);
      if (!selected?.id) {
        return NextResponse.json({ error: "No workspace blocks available for TAP validation" }, { status: 404 });
      }
      blockId = selected.id;
    }

    const { data: block, error: blockError } = await access.supabase
      .from("plan_nodes")
      .select("id, plan_id, title, description")
      .eq("id", blockId)
      .eq("plan_id", planId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    await getGhcScoreBriefForUser(planId, access.userId, [blockId], true, null);

    const privateToken = createPrivateToken();
    const { data: link, error } = await access.supabase
      .from("workspace_ghc_sessions")
      .insert({
        plan_id: planId,
        user_id: access.userId,
        guest_user_id: null,
        organization_id: access.plan.organization_id ?? access.auth.organization_id ?? null,
        created_by_api_key_id: isUuid(access.auth.key_id) ? access.auth.key_id : null,
        private_token_hash: hashPrivateToken(privateToken),
        requested_duration_seconds: 15 * 60,
        plan_node_id: blockId,
        mode: "curious",
        focus_node_ids: [blockId],
        voice_id: "ara",
        status: "pending",
      })
      .select("id, plan_id, plan_node_id, status, requested_duration_seconds, focus_node_ids, created_at")
      .single();

    if (error || !link) {
      console.error("[evidence-api-demo/tap-link] Create error:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to create TAP link" },
        { status: 500 }
      );
    }

    const privateUrl = buildDemoTapSessionUrl(req.nextUrl.origin, privateToken);

    return NextResponse.json({
      ghl_link: {
        ...link,
        private_url: privateUrl,
        block_title: block.title,
      },
      private_url: privateUrl,
    });
  } catch (error) {
    console.error("[evidence-api-demo/tap-link] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create TAP link" },
      { status: 500 }
    );
  }
}