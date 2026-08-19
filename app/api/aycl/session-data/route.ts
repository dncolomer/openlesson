import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { resolveAyclSessionAccess } from "@/lib/aycl-session-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  const sessionId = new URL(request.url).searchParams.get("id")?.trim() || "";

  if (!token || !sessionId) {
    return jsonError(400, "token and id are required");
  }

  const ctx = await resolveAyclSessionAccess(token, sessionId);
  if ("error" in ctx) {
    return jsonError(ctx.status, ctx.error);
  }

  const { data: sessionRow, error: sessionError } = await ctx.supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !sessionRow) {
    return jsonError(404, "Session not found");
  }

  const { data: probeRows } = await ctx.supabase
    .from("probes")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  return NextResponse.json({
    session: sessionRow,
    probes: probeRows || [],
  });
}