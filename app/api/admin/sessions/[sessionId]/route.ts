import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getProfileEmail } from "@/lib/admin/users";
import { findPlanNodeForSession, getGhlSessionDetail } from "@/lib/admin/sessions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data: sessionData, error: sessionError } = await adminClient
      .from("sessions")
      .select("id, user_id, problem, status, created_at, duration_ms, report, report_generated_at, audio_path")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("Admin session lookup error:", sessionError);
      return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
    }

    if (sessionData) {
      const [{ data: ownerData }, email, planNode] = await Promise.all([
        adminClient.from("profiles").select("id, username").eq("id", sessionData.user_id).maybeSingle(),
        getProfileEmail(adminClient, sessionData.user_id),
        findPlanNodeForSession(adminClient, sessionId),
      ]);

      return NextResponse.json({
        kind: "tutoring",
        session: {
          ...sessionData,
          owner: ownerData ? { ...ownerData, email } : undefined,
        },
        planNode,
      });
    }

    const ghlDetail = await getGhlSessionDetail(adminClient, sessionId);
    if (ghlDetail) {
      return NextResponse.json(ghlDetail);
    }

    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  } catch (err) {
    console.error("Admin session detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}