import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

export const runtime = "nodejs";

const SESSION_COLUMNS = "id, user_id, created_at, session_started_at, metadata";
const INSIGHT_COLUMNS = "user_id, session_id, workspace_id, created_at, archived_at";
const INSIGHT_ID_CHUNK = 100;

/**
 * Signed-in viewer's sessions on this workspace and their non-archived insights.
 * The KPIs tab turns these rows into the time-to-insight average.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  if (!workspaceId) return jsonError(400, "workspaceId is required");

  const { data: sessions, error } = await auth.supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", auth.user.id)
    .filter("metadata->>workspace_id", "eq", workspaceId);

  if (error) return jsonError(500, error.message);

  const sessionRows = sessions || [];
  const sessionIds = sessionRows
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter((id) => id.length > 0);

  const insights: unknown[] = [];
  for (let index = 0; index < sessionIds.length; index += INSIGHT_ID_CHUNK) {
    const chunk = sessionIds.slice(index, index + INSIGHT_ID_CHUNK);
    const { data, error: insightError } = await auth.supabase
      .from("insights")
      .select(INSIGHT_COLUMNS)
      .eq("user_id", auth.user.id)
      .is("archived_at", null)
      .in("session_id", chunk);
    if (insightError) return jsonError(500, insightError.message);
    insights.push(...(data || []));
  }

  return NextResponse.json({
    viewerId: auth.user.id,
    workspaceId,
    sessions: sessionRows,
    insights,
  });
}
