import { NextRequest, NextResponse } from "next/server";
import { resolveAyclSessionAccess } from "@/lib/aycl-session-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  const sessionId = new URL(request.url).searchParams.get("id")?.trim() || "";

  if (!token || !sessionId) {
    return NextResponse.json({ error: "token and id are required" }, { status: 400 });
  }

  const ctx = await resolveAyclSessionAccess(token, sessionId);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data: sessionRow, error: sessionError } = await ctx.supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !sessionRow) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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