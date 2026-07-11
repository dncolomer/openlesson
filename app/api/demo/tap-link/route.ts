import { NextRequest, NextResponse } from "next/server";
import { createPrivateToken, getGhcScoreBriefForUser, hashPrivateToken } from "@/lib/ghc-score";
import { requireDemoAdminWorkspaceSession } from "@/lib/openlesson-demo/demo-access";
import { buildDemoTapSessionUrl } from "@/lib/openlesson-demo/demo-session-url";
import { selectTapValidationBlock } from "@/lib/openlesson-demo/tap-validation";
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

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const access = await requireDemoAdminWorkspaceSession(workspaceId);
    if (access instanceof NextResponse) return access;

    let blockId = typeof body.blockId === "string" ? body.blockId : "";
    if (!blockId) {
      const { data: blocks, error: blocksError } = await access.supabase
        .from("blocks")
        .select("id, title, description")
        .eq("workspace_id", workspaceId)
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
      .from("blocks")
      .select("id, workspace_id, title, description")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    await getGhcScoreBriefForUser(workspaceId, access.userId, [blockId], true, null);

    const privateToken = createPrivateToken();
    const { data: link, error } = await access.supabase
      .from("workspace_ghc_sessions")
      .insert({
        workspace_id: workspaceId,
        user_id: access.userId,
        guest_user_id: null,
        organization_id: access.plan.organization_id ?? access.auth.organization_id ?? null,
        created_by_api_key_id: isUuid(access.auth.key_id) ? access.auth.key_id : null,
        private_token_hash: hashPrivateToken(privateToken),
        requested_duration_seconds: 15 * 60,
        block_id: blockId,
        mode: "curious",
        focus_block_ids: [blockId],
        voice_id: "ara",
        status: "pending",
      })
      .select("id, workspace_id, block_id, status, requested_duration_seconds, focus_block_ids, created_at")
      .single();

    if (error || !link) {
      console.error("[demo/tap-link] Create error:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to create TAP link" },
        { status: 500 }
      );
    }

    const privateUrl = buildDemoTapSessionUrl(req.nextUrl.origin, privateToken);

    return NextResponse.json({
      tap_link: {
        ...link,
        private_url: privateUrl,
        block_title: block.title,
      },
      private_url: privateUrl,
    });
  } catch (error) {
    console.error("[demo/tap-link] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create TAP link" },
      { status: 500 }
    );
  }
}