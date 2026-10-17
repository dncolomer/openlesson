import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  dashboardPlayHref,
  dashboardPlaySessionMetadata,
  normalizeDashboardPlayPrompt,
  parseDashboardPlayKind,
} from "@/lib/dashboard-play";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = parseDashboardPlayKind(body.kind);
    const prompt = normalizeDashboardPlayPrompt(body.prompt);
    if (!kind) return jsonError(400, "kind must be learn, verify, or calibrate");
    if (!prompt) return jsonError(400, "prompt is required");

    const { data, error } = await auth.supabase
      .from("sessions")
      .insert({
        user_id: auth.persistUserId,
        problem: prompt,
        status: "active",
        metadata: dashboardPlaySessionMetadata(kind),
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      return jsonError(500, error?.message || "Failed to start play session");
    }

    return NextResponse.json({
      sessionId: data.id,
      kind,
      href: dashboardPlayHref(kind, data.id),
    });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : "Failed to start play session");
  }
}
