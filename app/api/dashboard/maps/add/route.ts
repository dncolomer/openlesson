import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { forkWorkspaceExactCopy } from "@/lib/fork-workspace";
import {
  decideAddToMyMaps,
  playCopyMyMapsHref,
} from "@/lib/workspace-play-copy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json().catch(() => ({}))) as { workspaceId?: unknown };
    const workspaceId = String(body.workspaceId || "").trim();
    if (!workspaceId) return jsonError(400, "workspaceId is required");

    const { data: source, error } = await auth.supabase
      .from("workspaces")
      .select("id, title, root_topic, is_public, is_all_you_can_learn")
      .eq("id", workspaceId)
      .maybeSingle();
    if (error) return jsonError(500, error.message);

    const { data: existingRows } = await auth.supabase
      .from("workspaces")
      .select("id, original_workspace_id, is_play_copy")
      .eq("user_id", auth.user.id)
      .eq("is_play_copy", true)
      .eq("original_workspace_id", workspaceId);

    const decision = decideAddToMyMaps({
      source,
      existingCopies: existingRows || [],
    });
    if (decision.action === "reject") {
      return jsonError(decision.reason === "not_found" ? 404 : 403, "Map is not available");
    }
    if (decision.action === "reuse") {
      return NextResponse.json({
        workspaceId: decision.copyId,
        href: playCopyMyMapsHref(),
        reused: true,
      });
    }
    if (decision.action === "buy") {
      return jsonError(402, "This map is All You Can Learn. Buy it to add a play copy.");
    }

    const fork = await forkWorkspaceExactCopy(auth.supabase, {
      sourceWorkspaceId: workspaceId,
      ownerUserId: auth.user.id,
      title: source?.title || source?.root_topic,
      originalWorkspaceId: workspaceId,
      isPlayCopy: true,
    });
    return NextResponse.json({
      workspaceId: fork.workspaceId,
      href: playCopyMyMapsHref(),
      reused: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add map";
    return jsonError(500, message);
  }
}
