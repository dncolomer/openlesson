import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { rejectIfInsufficientSessionCredits } from "@/lib/credits/account";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DASHBOARD_PLAY_CURIOUS_KIND,
  DASHBOARD_PLAY_CURIOUS_SYSTEM,
  curiousPromptUserMessage,
  dashboardPlayHref,
  dashboardPlaySessionMetadata,
  parseCuriousPrompt,
} from "@/lib/dashboard-play";
import { callXaiText, DEFAULT_MODEL, systemMessage, userMessage } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const seed =
      typeof body.seed === "string" && body.seed.trim()
        ? body.seed.trim().slice(0, 64)
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const ai = await callXaiText(
      [systemMessage(DASHBOARD_PLAY_CURIOUS_SYSTEM), userMessage(curiousPromptUserMessage(seed))],
      { model: DEFAULT_MODEL, maxTokens: 80, temperature: 1 },
    );
    const prompt = parseCuriousPrompt(ai.success ? ai.data : "");
    if (!prompt) {
      return jsonError(500, "Could not invent a topic");
    }

    const denied = await rejectIfInsufficientSessionCredits(createAdminClient(), {
      runnerUserId: auth.user.id,
      ownerUserId: auth.user.id,
      flowKind: "learn",
    });
    if (denied) return denied;

    const kind = DASHBOARD_PLAY_CURIOUS_KIND;
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
      const { creditStoreFromClient, refundFlowSessionCredits } = await import("@/lib/credits/account");
      await refundFlowSessionCredits(creditStoreFromClient(createAdminClient()), auth.user.id).catch(() => {});
      return jsonError(500, error?.message || "Failed to start play session");
    }

    return NextResponse.json({
      sessionId: data.id,
      kind,
      prompt,
      href: dashboardPlayHref(kind, data.id),
    });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : "Failed to start play session");
  }
}
