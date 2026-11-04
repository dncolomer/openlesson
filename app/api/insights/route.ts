import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  authorMayListPlayCopyInsights,
  includeAuthorPlayCopyInsight,
  mergeInsightRowsById,
  parseMapPlayDataAccessFlags,
} from "@/lib/map-play-data-access";
import { createAdminClient } from "@/lib/supabase/admin";

const INSIGHT_LIST_SELECT =
  "id, title, summary, workspace_id, block_id, chapter_id, session_id, aesthetic_image, share_token, created_at";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  // Workspace Insights (Knowledge) = bookmarks originating from workspaces only.
  // Optional workspaceId scopes the list to a single workspace Knowledge view.
  // Optional sessionId scopes to insights crafted in one TAP Learning session.
  let query = supabase
    .from("insights")
    .select(INSIGHT_LIST_SELECT)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  } else if (!sessionId) {
    query = query.not("workspace_id", "is", null);
  }
  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;

  if (error) return jsonError(500, error.message);
  const own = data || [];
  if (!workspaceId) {
    return NextResponse.json({ insights: own });
  }

  const admin = createAdminClient();
  const { data: source } = await admin
    .from("workspaces")
    .select("id, user_id, play_share_insights")
    .eq("id", workspaceId)
    .maybeSingle();
  const flags = parseMapPlayDataAccessFlags(source);
  if (
    !authorMayListPlayCopyInsights({
      viewerUserId: user.id,
      sourceOwnerUserId: String(source?.user_id || ""),
      flags,
    })
  ) {
    return NextResponse.json({ insights: own });
  }

  const { data: copies } = await admin
    .from("workspaces")
    .select("id")
    .eq("original_workspace_id", workspaceId)
    .eq("is_play_copy", true);
  const copyWorkspaceIds = (copies || [])
    .map((row) => String((row as { id?: unknown }).id || "").trim())
    .filter(Boolean);
  if (copyWorkspaceIds.length === 0) {
    return NextResponse.json({ insights: own });
  }

  const { data: playCopyInsights, error: playCopyError } = await admin
    .from("insights")
    .select(INSIGHT_LIST_SELECT)
    .in("workspace_id", copyWorkspaceIds)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (playCopyError) return jsonError(500, playCopyError.message);

  const extra = (playCopyInsights || []).filter((row) =>
    includeAuthorPlayCopyInsight({
      viewerUserId: user.id,
      sourceOwnerUserId: String(source?.user_id || ""),
      flags,
      insightWorkspaceId: String((row as { workspace_id?: unknown }).workspace_id || ""),
      copyWorkspaceIds,
    }),
  );
  const insights = mergeInsightRowsById(own, extra).sort(
    (a, b) =>
      new Date(String((b as { created_at?: unknown }).created_at || 0)).getTime() -
      new Date(String((a as { created_at?: unknown }).created_at || 0)).getTime(),
  );
  return NextResponse.json({ insights });
}
