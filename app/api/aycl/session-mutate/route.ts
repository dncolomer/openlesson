import { NextRequest, NextResponse } from "next/server";
import { resolveAyclSessionAccess } from "@/lib/aycl-session-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const action = typeof body.action === "string" ? body.action : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

    if (!token || !action || !sessionId) {
      return NextResponse.json({ error: "token, action, and sessionId are required" }, { status: 400 });
    }

    const ctx = await resolveAyclSessionAccess(token, sessionId);
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    if (action === "get") {
      const { data: session, error } = await ctx.supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const { data: probes } = await ctx.supabase
        .from("probes")
        .select("*")
        .eq("session_id", sessionId)
        .order("timestamp_ms", { ascending: true });

      return NextResponse.json({ session, probes: probes || [] });
    }

    if (action === "save") {
      const sessionPatch = body.session || {};
      const probes = Array.isArray(body.probes) ? body.probes : [];

      const metadata: Record<string, unknown> = {
        ...(typeof sessionPatch.metadata === "object" && sessionPatch.metadata
          ? sessionPatch.metadata
          : {}),
      };
      if (Array.isArray(sessionPatch.objectives) && sessionPatch.objectives.length > 0) {
        metadata.objectives = sessionPatch.objectives;
      }

      const updatePayload: Record<string, unknown> = {};
      if (sessionPatch.status !== undefined) updatePayload.status = sessionPatch.status;
      if (sessionPatch.duration_ms !== undefined) updatePayload.duration_ms = sessionPatch.duration_ms;
      if (sessionPatch.ended_at !== undefined) updatePayload.ended_at = sessionPatch.ended_at;
      if (sessionPatch.report !== undefined) updatePayload.report = sessionPatch.report;
      if (sessionPatch.planning_prompt !== undefined) {
        updatePayload.planning_prompt = sessionPatch.planning_prompt;
      }
      if (Object.keys(metadata).length > 0) updatePayload.metadata = metadata;

      const { error: updateError } = await ctx.supabase
        .from("sessions")
        .update(updatePayload)
        .eq("id", sessionId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      for (const probe of probes) {
        if (!probe?.id) continue;
        await ctx.supabase.from("probes").upsert({
          id: probe.id,
          session_id: sessionId,
          text: probe.text,
          timestamp_ms: probe.timestamp_ms,
          gap_score: probe.gap_score ?? 0,
          signals: probe.signals ?? [],
          expanded_text: probe.expanded_text,
          starred: probe.starred ?? false,
          is_revealed: probe.is_revealed ?? false,
          request_type: probe.request_type ?? "question",
          plan_step_id: probe.plan_step_id,
          archived: probe.archived ?? false,
          focused: probe.focused ?? false,
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "add_probe") {
      const probe = body.probe || {};
      const id = typeof probe.id === "string" ? probe.id : crypto.randomUUID();
      const row = {
        id,
        session_id: sessionId,
        text: probe.text || "",
        timestamp_ms: probe.timestamp_ms ?? probe.timestamp ?? Date.now(),
        gap_score: probe.gap_score ?? probe.gapScore ?? 0,
        signals: probe.signals ?? [],
        expanded_text: probe.expanded_text ?? probe.expandedText ?? null,
        starred: probe.starred ?? false,
        is_revealed: probe.is_revealed ?? probe.isRevealed ?? false,
        request_type: probe.request_type ?? probe.requestType ?? "question",
        plan_step_id: probe.plan_step_id ?? probe.planStepId ?? null,
        archived: probe.archived ?? false,
        focused: probe.focused ?? false,
      };

      const { data, error } = await ctx.supabase.from("probes").insert(row).select("*").single();
      if (error || !data) {
        return NextResponse.json({ error: error?.message || "Failed to add probe" }, { status: 500 });
      }

      return NextResponse.json({ probe: data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[aycl/session-mutate]", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}