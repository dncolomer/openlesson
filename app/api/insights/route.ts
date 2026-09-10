import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  // Workspace Insights (Knowledge) = bookmarks originating from workspaces only.
  // Optional workspaceId scopes the list to a single workspace Knowledge view.
  // Optional sessionId scopes to insights crafted in one ILE session.
  let query = supabase
    .from("insights")
    .select("id, title, summary, workspace_id, block_id, chapter_id, session_id, aesthetic_image, share_token, created_at")
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
  return NextResponse.json({ insights: data || [] });
}