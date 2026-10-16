/**
 * Session start for Learn, Calibrate, and Verification.
 * xAI prepares the field. Nothing local fills it in.
 * Catalog size comes from the flow or workspace so all three flows share one gen model.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { guardSessionRoute } from "@/lib/api/require-auth";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";
import { getCalibrationFlowByToken } from "@/lib/calibration-flow-repository";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
import {
  continueSessionBranchModel,
  generateSessionBranchOpening,
  type SessionBranchContinuation,
} from "@/lib/session-branch-model-generate";
import {
  planSessionBranchPrepare,
  type SessionBranchPrepareInput,
  type SessionBranchPreparePlan,
} from "@/lib/session-branch-prepare";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { getVerificationFlowByToken } from "@/lib/verification-flow-repository";

export const runtime = "nodejs";
export const maxDuration = 300;

async function workspaceCatalogSize(workspaceId: string): Promise<LearningModelSize | null> {
  const id = workspaceId.trim();
  if (!id) return null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("workspaces")
      .select("learning_model_size")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return parseLearningModelSize(data.learning_model_size);
  } catch {
    return null;
  }
}

async function sessionWorkspaceCatalogSize(sessionId: string): Promise<LearningModelSize | null> {
  const id = sessionId.trim();
  if (!id) return null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("sessions").select("metadata").eq("id", id).maybeSingle();
    const workspaceId =
      data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as { workspace_id?: unknown }).workspace_id
        : null;
    if (typeof workspaceId !== "string") return null;
    return workspaceCatalogSize(workspaceId);
  } catch {
    return null;
  }
}

async function resolveCatalogSize(
  plan: Exclude<SessionBranchPreparePlan, { kind: "none" } | { kind: "missing-material" }>,
  requested: unknown,
): Promise<LearningModelSize> {
  const fallback = parseLearningModelSize(requested ?? plan.catalogSize);
  if (plan.kind === "calibration") {
    const flow = await getCalibrationFlowByToken(plan.token);
    return parseLearningModelSize(flow?.actionCatalog ?? fallback);
  }
  if (plan.kind === "verification") {
    const flow = await getVerificationFlowByToken(plan.token);
    return parseLearningModelSize(flow?.actionCatalog ?? fallback);
  }
  if (plan.kind === "workspace") {
    const fromWorkspace = await workspaceCatalogSize(plan.workspaceId);
    return fromWorkspace ?? fallback;
  }
  const fromSession = await sessionWorkspaceCatalogSize(plan.sessionId);
  return fromSession ?? fallback;
}

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

    const catalogSize = await resolveCatalogSize(plan, body.catalogSize);
    const material = {
      chapterTitle: plan.chapterTitle,
      chapterBrief: plan.chapterBrief,
      catalogSize,
    };
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
