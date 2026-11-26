/**
 * Session start for leftover Learn and Verification.
 * xAI prepares the field. Nothing local fills it in.
 * The author seed is used when present. Otherwise xAI writes the field.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { guardSessionRoute } from "@/lib/api/require-auth";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";
import { exactProblemOpeningWork } from "@/lib/learn-opening-work";
import {
  flowOpeningCanvasHasContent,
  parseFlowOpeningCanvasScene,
} from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import { studentSessionModelFromAuthorSeed } from "@/lib/author-unsys-model";
import {
  definitionUnsysSeedFromBlocks,
  studentModelFromDefinitionSeed,
} from "@/lib/definition-unsys-seed";
import {
  authorSeedBlockIdFromPreparePlan,
  authorSeedSessionIdFromPreparePlan,
  definitionFlowTokenFromPreparePlan,
  planSessionBranchPrepare,
  type SessionBranchPrepareInput,
} from "@/lib/session-branch-prepare";
import {
  continueSessionBranchModel,
  generateSessionBranchOpening,
  sessionBranchContinuationFromSeed,
  type SessionBranchContinuation,
} from "@/lib/session-branch-model-generate";
import { openingWorkForSessionField } from "@/lib/learn-opening-work-generate";
import { openingWorkFromArtifactProblem } from "@/lib/flow-problem-generate";
import { sessionBranchParentsNeedingGrowth } from "@/lib/session-branch-model";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { getVerificationFlowById, getVerificationFlowByToken } from "@/lib/verification-flow-repository";
import type { FlowArtifact } from "@/lib/flow-artifacts";

export const runtime = "nodejs";
export const maxDuration = 300;

type OpeningGenerateContext = {
  kind?: "verification" | "learn";
  problem?: string;
  artifacts?: FlowArtifact[];
  fileIds?: string[];
  exactProblemOnCanvas?: boolean;
  openingCanvasScene?: IleWorkCanvasScene | null;
  generateProblemOnOpen?: boolean;
};

async function openingWorkPayload(
  plan: { kind: string; sessionId?: string; chapterTitle?: string; chapterBrief?: string },
  model: Parameters<typeof openingWorkForSessionField>[0],
  generateContext: OpeningGenerateContext,
): Promise<{
  openingWork: string;
  openingWorkExact: boolean;
  openingCanvasScene: IleWorkCanvasScene | null;
}> {
  const openingCanvasScene = parseFlowOpeningCanvasScene(generateContext.openingCanvasScene);
  if (flowOpeningCanvasHasContent(openingCanvasScene)) {
    return { openingWork: "", openingWorkExact: false, openingCanvasScene };
  }
  const generated = await openingWorkFromArtifactProblem({
    generateProblemOnOpen: Boolean(generateContext.generateProblemOnOpen),
    exactProblemOnCanvas: Boolean(generateContext.exactProblemOnCanvas),
    artifacts: generateContext.artifacts,
    name: plan.chapterTitle,
    problem: generateContext.problem || plan.chapterBrief,
  });
  if (generated?.openingWork) {
    return {
      openingWork: generated.openingWork,
      openingWorkExact: generated.openingWorkExact,
      openingCanvasScene: null,
    };
  }
  if (generateContext.exactProblemOnCanvas) {
    const openingWork = exactProblemOpeningWork(
      generateContext.problem || plan.chapterBrief || plan.chapterTitle,
    );
    if (openingWork) return { openingWork, openingWorkExact: true, openingCanvasScene: null };
  }
  if (plan.kind === "learn") {
    return {
      openingWork: await openingWorkForSessionField(model, plan.sessionId || ""),
      openingWorkExact: false,
      openingCanvasScene: null,
    };
  }
  return { openingWork: "", openingWorkExact: false, openingCanvasScene: null };
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

    if (plan.kind === "verification") {
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
        solveToken: plan.solveToken || null,
        requireSessionId: !plan.ayclToken && !plan.ileToken && !plan.solveToken,
      });
      if (!auth.ok) return auth.response;
    }

    let generateContext: OpeningGenerateContext = {};
    const material = {
      chapterTitle: plan.chapterTitle,
      chapterBrief: plan.chapterBrief,
    };
    try {
      const tokenedEarly = definitionFlowTokenFromPreparePlan(plan);
      if (tokenedEarly?.kind === "verification") {
        const flow = await getVerificationFlowByToken(tokenedEarly.token);
        if (flow) {
          generateContext = {
            kind: "verification",
            problem: flow.topic,
            artifacts: flow.artifacts,
            exactProblemOnCanvas: flow.exactProblemOnCanvas,
            openingCanvasScene: flow.openingCanvasScene,
            generateProblemOnOpen: flow.generateProblemOnOpen,
          };
        }
      }
    } catch {
      /* flow lookup is optional context */
    }
    if (body.phase !== "continue") {
      try {
        const supabase = createAdminClient();
        const copyBlockId = authorSeedBlockIdFromPreparePlan(plan);
        let flowId = "";
        let definitionWorkspaceId = "";
        let flowSeed: unknown = null;
        const tokened = definitionFlowTokenFromPreparePlan(plan);
        if (tokened?.kind === "verification") {
          const flow = await getVerificationFlowByToken(tokened.token);
          flowId = String(flow?.id || "");
          definitionWorkspaceId = String(flow?.workspaceId || "");
          if (flow) {
            flowSeed = flow.answersModelSeed ?? null;
            generateContext = {
              kind: "verification",
              problem: flow.topic,
              artifacts: flow.artifacts,
              exactProblemOnCanvas: flow.exactProblemOnCanvas,
              openingCanvasScene: flow.openingCanvasScene,
              generateProblemOnOpen: flow.generateProblemOnOpen,
            };
          }
        }
        if (!flowId) {
          const sessionId = authorSeedSessionIdFromPreparePlan(plan);
          if (sessionId) {
            const { data: sessionRow } = await supabase
              .from("sessions")
              .select("metadata, verify_flow_id, workspace_id")
              .eq("id", sessionId)
              .maybeSingle();
            flowId = String(sessionRow?.verify_flow_id || "").trim();
            const meta =
              sessionRow?.metadata && typeof sessionRow.metadata === "object"
                ? (sessionRow.metadata as Record<string, unknown>)
                : null;
            if (meta?.exactProblemOnCanvas === true) {
              generateContext = {
                ...generateContext,
                exactProblemOnCanvas: true,
              };
            }
            if (meta?.openingCanvasScene) {
              generateContext = {
                ...generateContext,
                openingCanvasScene: parseFlowOpeningCanvasScene(meta.openingCanvasScene),
              };
            }
            if (meta?.generateProblemOnOpen === true) {
              generateContext = {
                ...generateContext,
                generateProblemOnOpen: true,
              };
            }
          }
        }
        if (flowId) {
          const verify = await getVerificationFlowById(flowId);
          if (verify) {
            flowSeed = flowSeed || verify.answersModelSeed || null;
            generateContext = {
              kind: "verification",
              problem: verify.topic,
              artifacts: verify.artifacts,
              exactProblemOnCanvas: verify.exactProblemOnCanvas,
              openingCanvasScene: verify.openingCanvasScene,
              generateProblemOnOpen: verify.generateProblemOnOpen,
            };
          }
        }
        if (flowId) {
          const { data: verRow } = await supabase
            .from("verify_flows")
            .select("id, workspace_id")
            .eq("id", flowId)
            .maybeSingle();
          definitionWorkspaceId =
            definitionWorkspaceId || String(verRow?.workspace_id || "");
          const { data: blocks } = definitionWorkspaceId
            ? await supabase
                .from("blocks")
                .select("id, workspace_id, map_block, answers_model_seed")
                .eq("workspace_id", definitionWorkspaceId)
            : { data: [] };
          const definitionSeed = definitionUnsysSeedFromBlocks({
            flowId,
            definitionWorkspaceId,
            flowSeed,
            blocks: blocks || [],
            copyBlockId,
          });
          const seeded = studentModelFromDefinitionSeed(definitionSeed);
          if (seeded) {
            const continuation = sessionBranchContinuationFromSeed(seeded);
            const done = sessionBranchParentsNeedingGrowth(seeded).length === 0;
            const opening = await openingWorkPayload(plan, seeded, generateContext);
            return NextResponse.json({
              model: seeded,
              continuation: done ? null : continuation,
              done,
              seeded: true,
              ...opening,
            });
          }
        } else if (copyBlockId) {
          const { data } = await supabase
            .from("blocks")
            .select("answers_model_seed")
            .eq("id", copyBlockId)
            .maybeSingle();
          const seeded = studentSessionModelFromAuthorSeed(data?.answers_model_seed);
          if (seeded) {
            const continuation = sessionBranchContinuationFromSeed(seeded);
            const done = sessionBranchParentsNeedingGrowth(seeded).length === 0;
            const opening = await openingWorkPayload(plan, seeded, generateContext);
            return NextResponse.json({
              model: seeded,
              continuation: done ? null : continuation,
              done,
              seeded: true,
              ...opening,
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
        ...generateContext,
        continuation: continuation as SessionBranchContinuation,
      });
      if (!prepared.ok) return jsonError(502, prepared.error);
      return NextResponse.json({
        model: prepared.model,
        continuation: prepared.continuation,
        done: prepared.done,
      });
    }
    const prepared = await generateSessionBranchOpening({
      ...material,
      ...generateContext,
    });
    if (!prepared.ok) return jsonError(502, prepared.error);
    const opening = await openingWorkPayload(plan, prepared.model, generateContext);
    return NextResponse.json({
      model: prepared.model,
      continuation: prepared.continuation,
      done: false,
      ...opening,
    });
  } catch (error) {
    console.error("[session-branch-model]", error);
    return jsonError(500, "The field could not be prepared.");
  }
}
