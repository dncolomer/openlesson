import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { rejectIfInsufficientSessionCredits } from "@/lib/credits/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePracticeStartKind } from "@/lib/practice-problems";
import {
  ensurePracticeCalibrationFlow,
  ensurePracticeSolveFlow,
  ensurePracticeVerificationFlow,
  loadPublishedPracticeProblem,
  practiceCreatedFlowPayload,
  practiceSessionInsert,
  practiceStartPayload,
} from "@/lib/practice-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const problemId = String(body.problemId || "").trim();
    if (!problemId) return jsonError(400, "problemId is required");
    const kind = parsePracticeStartKind(body.kind);

    const problem = await loadPublishedPracticeProblem(problemId);
    if (!problem) return jsonError(404, "Problem not found");

    if (kind === "verification") {
      const flow = await ensurePracticeVerificationFlow({
        ownerUserId: auth.user.id,
        problem,
      });
      return NextResponse.json(practiceCreatedFlowPayload("verification", flow.id));
    }
    if (kind === "calibration") {
      const flow = await ensurePracticeCalibrationFlow({
        ownerUserId: auth.user.id,
        problem,
      });
      return NextResponse.json(practiceCreatedFlowPayload("calibration", flow.id));
    }

    const denied = await rejectIfInsufficientSessionCredits(createAdminClient(), {
      runnerUserId: auth.user.id,
      ownerUserId: auth.user.id,
      flowKind: "solve",
    });
    if (denied) return denied;

    try {
      const flow = await ensurePracticeSolveFlow({
        ownerUserId: auth.user.id,
        problem,
      });
      const { data, error } = await createAdminClient()
        .from("sessions")
        .insert(practiceSessionInsert({ userId: auth.user.id, flow, problem }))
        .select("id")
        .single();
      if (error || !data?.id) {
        throw new Error(error?.message || "Failed to start practice session");
      }
      return NextResponse.json(practiceStartPayload(String(data.id)));
    } catch (error) {
      const { creditStoreFromClient, refundFlowSessionCredits } = await import(
        "@/lib/credits/account"
      );
      await refundFlowSessionCredits(
        creditStoreFromClient(createAdminClient()),
        auth.user.id,
      ).catch(() => {});
      throw error;
    }
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to start practice",
    );
  }
}
