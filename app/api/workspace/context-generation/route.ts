/**
 * Generate Goals or a verification-flow topic and questions from Context.
 * The caller appends each response onto its own pool.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import { assertWorkspacePolicy } from "@/lib/workspace-access-policy";
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";
import { callXaiJSON, DEFAULT_MODEL, systemMessage, userMessage } from "@/lib/xai-client";
import { loadWorkspacePromptContext } from "@/lib/pow-api/load-workspace-prompt-context";
import {
  formatContextGenerationSource,
  generateContextCandidates,
  type ContextGenerationKind,
} from "@/lib/context-generation";
import { generateCalibrationPoolFromGoal } from "@/lib/calibration-flow";

export const runtime = "nodejs";

function generationKind(value: unknown): ContextGenerationKind | null {
  if (value === "goals" || value === "verification_flow" || value === "calibration_flow") return value;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || "");
    const requestedKind = body.kind;
    if (requestedKind === "calibration_from_goal") {
      const goal = String(body.goal || "").trim();
      if (!workspaceId) return jsonError(400, "workspaceId is required");
      if (!goal) return jsonError(400, "goal is required");
      const ayclToken = typeof body.ayclToken === "string" ? body.ayclToken : null;
      const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
      if (!auth.ok) return auth.response;
      const policy = assertWorkspacePolicy({
        principal: auth.principal,
        workspaceOwnerId: auth.workspaceOwnerId,
        action: "author",
      });
      if (!policy.ok) return jsonError(403, "Forbidden");
      const { data: workspace } = await auth.supabase
        .from("workspaces")
        .select("workspace_kind")
        .eq("id", workspaceId)
        .maybeSingle();
      const storedKind = workspace?.workspace_kind;
      if (storedKind && !isKnowledgeRegionWorkspace(storedKind)) {
        return jsonError(403, "Context generation belongs to Verification Workspaces");
      }
      const questions = await generateCalibrationPoolFromGoal({
        goal,
        complete: async (request) => {
          const response = await callXaiJSON<unknown>(
            [systemMessage(request.instructions), userMessage(request.user)],
            { model: DEFAULT_MODEL, temperature: 0.3, maxTokens: 2000, reasoningEffort: "low" },
          );
          if (!response.success) throw new Error(response.error || "Calibration questions failed");
          return response.data;
        },
      });
      if (questions.length === 0) return jsonError(502, "No calibration questions generated");
      return NextResponse.json({ goal, questions });
    }
    const kind = generationKind(requestedKind);
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    if (!kind) return jsonError(400, "kind must be goals, verification_flow, or calibration_flow");
    const ayclToken = typeof body.ayclToken === "string" ? body.ayclToken : null;
    const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
    if (!auth.ok) return auth.response;
    const policy = assertWorkspacePolicy({
      principal: auth.principal,
      workspaceOwnerId: auth.workspaceOwnerId,
      action: "author",
    });
    if (!policy.ok) return jsonError(403, "Forbidden");

    const { data: workspace } = await auth.supabase
      .from("workspaces")
      .select("workspace_kind")
      .eq("id", workspaceId)
      .maybeSingle();
    const storedKind = workspace?.workspace_kind;
    if (storedKind && !isKnowledgeRegionWorkspace(storedKind)) {
      return jsonError(403, "Context generation belongs to Verification Workspaces");
    }

    const loaded = await loadWorkspacePromptContext(auth.supabase, workspaceId);
    const contextText = formatContextGenerationSource({
      title: loaded?.workspaceTitle,
      topic: loaded?.rootTopic,
      description: loaded?.workspaceDescription,
      notes: loaded?.notes,
      goal: loaded?.workspaceGoal,
      resources: loaded?.externalResources,
      files: loaded?.files,
    });
    if (!contextText.trim()) {
      return jsonError(400, "Add notes, files, or links in Context before generating.");
    }

    const avoid = Array.isArray(body.avoid)
      ? body.avoid.filter((item): item is string => typeof item === "string")
      : [];
    const modifier = typeof body.modifier === "string" ? body.modifier : "";
    const generated = await generateContextCandidates({
      kind,
      contextText,
      avoid,
      modifier,
      complete: async (request) => {
        const response = await callXaiJSON<unknown>(
          [systemMessage(request.instructions), userMessage(request.user)],
          { model: DEFAULT_MODEL, temperature: 0.3, maxTokens: 2000, reasoningEffort: "low" },
        );
        if (!response.success) {
          throw new Error(response.error || "Context generation failed");
        }
        return response.data;
      },
    });
    if (kind === "goals" && generated.goals.length === 0) {
      return jsonError(502, "No goals generated");
    }
    if (kind === "verification_flow" && generated.flows.length === 0) {
      return jsonError(502, "No topic generated");
    }
    if (kind === "calibration_flow" && generated.flows.length === 0) {
      return jsonError(502, "No calibration questions generated");
    }
    return NextResponse.json(generated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Context generation failed";
    return jsonError(500, message);
  }
}
