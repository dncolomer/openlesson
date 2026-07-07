import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";

interface RouteProps {
  params: Promise<{ id: string; linkId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "tap:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id, linkId } = await params;

  let query = supabase
    .from("workspace_ghc_sessions")
    .select("id, plan_id, plan_node_id, xai_file_id, status, duration_seconds, requested_duration_seconds, focus_node_ids, summary, analysis, overall_score, marker_scores, created_at, started_at, completed_at")
    .eq("id", linkId)
    .eq("plan_id", id);

  if (auth.guest_user_id) query = query.eq("guest_user_id", auth.guest_user_id);
  else if (!auth.is_org_admin) query = query.eq("user_id", auth.user_id);

  const { data: link, error } = await query.single();

  if (error || !link) {
    return errorResponse(404, "tap_link_not_found", "TAP link not found");
  }

  return NextResponse.json({
    tap_result: {
      id: link.id,
      workspace_id: link.plan_id,
      block_id: link.plan_node_id,
      xai_file_id: link.xai_file_id,
      status: link.status,
      completed: link.status === "completed",
      duration_seconds: link.duration_seconds,
      requested_duration_seconds: link.requested_duration_seconds,
      focus_block_ids: link.focus_node_ids,
      summary: link.status === "completed" ? link.summary : null,
      overall_score: link.status === "completed" ? link.overall_score : null,
      marker_scores: link.status === "completed" ? link.marker_scores : null,
      gap_analysis: link.status === "completed" ? (link.analysis as any)?.gap_analysis || null : null,
      analysis: link.status === "completed" ? link.analysis : null,
      created_at: link.created_at,
      started_at: link.started_at,
      completed_at: link.completed_at,
    },
  });
}
