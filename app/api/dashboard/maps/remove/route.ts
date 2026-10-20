import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { setWorkspaceArchived } from "@/lib/workspace-archive";
import { decideRemoveFromMyMaps } from "@/lib/workspace-play-copy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json().catch(() => ({}))) as { workspaceId?: unknown };
    const workspaceId = String(body.workspaceId || "").trim();
    if (!workspaceId) return jsonError(400, "workspaceId is required");

    const copySelect = () =>
      auth.supabase
        .from("workspaces")
        .select("id, original_workspace_id, is_play_copy")
        .eq("user_id", auth.user.id)
        .eq("is_play_copy", true)
        .neq("status", "archived");
    const [{ data: bySource }, { data: byCopy }] = await Promise.all([
      copySelect().eq("original_workspace_id", workspaceId),
      copySelect().eq("id", workspaceId),
    ]);

    const decision = decideRemoveFromMyMaps({
      sourceWorkspaceId: workspaceId,
      existingCopies: [...(bySource || []), ...(byCopy || [])],
    });
    if (decision.action === "reject") {
      return jsonError(404, "Map is not in My Maps");
    }

    const workspace = await setWorkspaceArchived(
      createAdminClient(),
      decision.copyId,
      auth.user.id,
      true,
    );
    return NextResponse.json({
      workspaceId: workspace.id,
      removed: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove map";
    return jsonError(500, message);
  }
}
