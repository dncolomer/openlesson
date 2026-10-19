/**
 * Session start for Learn, Calibrate, and Verification.
 * xAI prepares the field. Nothing local fills it in.
 * The author seed is used when present. Otherwise xAI writes the field.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { guardSessionRoute } from "@/lib/api/require-auth";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";
import { getCalibrationFlowByToken } from "@/lib/calibration-flow-repository";
import { studentSessionModelFromAuthorSeed } from "@/lib/author-unsys-model";
import {
  continueSessionBranchModel,
  generateSessionBranchOpening,
  type SessionBranchContinuation,
} from "@/lib/session-branch-model-generate";
import {
  authorSeedBlockIdFromPreparePlan,
  authorSeedSessionIdFromPreparePlan,
  planSessionBranchPrepare,
  sessionPrepareBlockId,
  type SessionBranchPrepareInput,
} from "@/lib/session-branch-prepare";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { getVerificationFlowByToken } from "@/lib/verification-flow-repository";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const body =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as SessionBranchPrepareInput & Record<string, unknown>)
        : {};
    const plan = planSessionBranchPrepare({
      ...body,
      entryQueryParams: entryQueryParamsFromBody(body),
    });
    if (plan.kind === "missing-material") return jsonError(400, "A chapter is required.");
    if (plan.kind === "none") return jsonError(400, "A session is required.");

    if (plan.kind === "calibration") {
      const flow = await getCalibrationFlowByToken(plan.token);
      if (!flow) return jsonError(404, "Calibration flow not found");
    } else if (plan.kind === "verification") {
      const flow = await getVerificationFlowByToken(plan.token);
      if (!flow) return jsonError(404, "Verification flow not found");
    } else if (plan.kind === "workspace") {
      const access = await resolveTapSessionAccess({
        privateToken: plan.privateToken || undefined,
        workspaceId: plan.workspaceId || undefined,
        tapSessionId: plan.tapSessionId || undefined,
        blockId: plan.blockId || null,
        focusSessionId: plan.sessionId || null,
        entryQueryParams: plan.entryQueryParams,
      });
      if ("error" in access) return jsonError(access.status, access.error);
    } else {
      const auth = await guardSessionRoute(plan.sessionId, {
        ayclToken: plan.ayclToken || null,
        ileToken: plan.ileToken || null,
        requireSessionId: !plan.ayclToken && !plan.ileToken,
      });
      if (!auth.ok) return auth.response;
    }

    const material = {
      chapterTitle: plan.chapterTitle,
      chapterBrief: plan.chapterBrief,
    };
    if (body.phase !== "continue") {
      try {
        const supabase = createAdminClient();
        let blockId = authorSeedBlockIdFromPreparePlan(plan);
        if (!blockId) {
          const sessionId = authorSeedSessionIdFromPreparePlan(plan);
          if (sessionId) {
            const { data: sessionRow } = await supabase
              .from("sessions")
              .select("metadata")
              .eq("id", sessionId)
              .maybeSingle();
            blockId = sessionPrepareBlockId(sessionRow?.metadata);
          }
        }
        if (blockId) {
          const { data } = await supabase
            .from("blocks")
            .select("answers_model_seed")
            .eq("id", blockId)
            .maybeSingle();
          const seeded = studentSessionModelFromAuthorSeed(data?.answers_model_seed);
          if (seeded) {
            return NextResponse.json({
              model: seeded,
              continuation: null,
              done: true,
              seeded: true,
            });
          }
        }
      } catch {
        /* Missing column or row: fall through to on-the-fly opening. */
      }
    }
    if (body.phase === "continue") {
      const continuation = body.continuation;
      if (!continuation || typeof continuation !== "object" || Array.isArray(continuation)) {
        return jsonError(400, "A chapter is required.");
      }
      const prepared = await continueSessionBranchModel({
        ...material,
        continuation: continuation as SessionBranchContinuation,
      });
      if (!prepared.ok) return jsonError(502, prepared.error);
      return NextResponse.json({
        model: prepared.model,
        continuation: prepared.continuation,
        done: prepared.done,
      });
    }
    const prepared = await generateSessionBranchOpening(material);
    if (!prepared.ok) return jsonError(502, prepared.error);
    return NextResponse.json({ model: prepared.model, continuation: prepared.continuation, done: false });
  } catch (error) {
    console.error("[session-branch-model]", error);
    return jsonError(500, "The field could not be prepared.");
  }
}
