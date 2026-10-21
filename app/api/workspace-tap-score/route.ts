import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Not authenticated");

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return jsonError(400, "workspaceId is required");

  const select =
    "id, block_id, session_id, duration_seconds, requested_duration_seconds, status, created_at, completed_at";
  const [calibrate, verify] = await Promise.all([
    supabase
      .from("workspace_calibrate_sessions")
      .select(select)
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("workspace_verify_sessions")
      .select(select)
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (calibrate.error) return jsonError(500, calibrate.error.message);
  if (verify.error) return jsonError(500, verify.error.message);
  const data = [...(calibrate.data || []), ...(verify.data || [])].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || "")),
  );
  return NextResponse.json({ tapSessions: data.slice(0, 10) });
}
