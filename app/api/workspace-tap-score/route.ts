import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Not authenticated");

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return jsonError(400, "workspaceId is required");

  const { data, error } = await supabase
    .from("workspace_tap_sessions")
    .select("id, block_id, session_id, duration_seconds, requested_duration_seconds, status, created_at, completed_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return jsonError(500, error.message);
  return NextResponse.json({ tapSessions: data || [] });
}
