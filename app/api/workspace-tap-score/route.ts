import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const planId = req.nextUrl.searchParams.get("planId");
  if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("workspace_ghc_sessions")
    .select("id, plan_node_id, session_id, xai_file_id, duration_seconds, requested_duration_seconds, status, summary, analysis, overall_score, marker_scores, created_at, completed_at")
    .eq("plan_id", planId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tapSessions: data || [], ghlSessions: data || [] });
}
