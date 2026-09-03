/**
 * Exit without saving: drop the chapter map, keep Proof of Work.
 * `workspace_proof_of_work` is intentionally not read or written here.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardSessionRoute,
} from "@/lib/api/require-auth";
import { ileUnsavedExitSessionPatch } from "@/lib/ile-unsaved-exit";
import { deleteSessionPlanBySessionId } from "@/lib/storage/session-plans";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const raw = body.sessionId ?? body.session_id;
    const sessionId = typeof raw === "string" ? raw.trim() : "";
    if (!sessionId) {
      return jsonError(400, "Missing sessionId");
    }

    const auth = await guardSessionRoute(sessionId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    try {
      await deleteSessionPlanBySessionId(sessionId, auth.supabase);
    } catch (planError) {
      console.error("[session-plan/discard] Failed to delete map:", planError);
      return jsonError(500, "Could not discard chapter map");
    }

    const { data: sessionRow, error: sessionError } = await auth.supabase
      .from("sessions")
      .select("metadata")
      .eq("id", sessionId)
      .single();
    if (sessionError || !sessionRow) {
      console.error("[session-plan/discard] Failed to load session:", sessionError);
      return jsonError(500, "Could not discard session");
    }

    const patch = ileUnsavedExitSessionPatch(sessionRow.metadata);
    const { error: updateError } = await auth.supabase
      .from("sessions")
      .update(patch)
      .eq("id", sessionId);
    if (updateError) {
      console.error("[session-plan/discard] Failed to stamp unsaved exit:", updateError);
      return jsonError(500, "Could not discard session");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[session-plan/discard]", error);
    return jsonError(500, "Failed to discard session");
  }
}
