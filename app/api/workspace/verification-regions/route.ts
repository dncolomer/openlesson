/**
 * Verification-workspace region create:
 * from one flow's proof-of-work embeddings, or from synthetic-agent proof of work.
 * Snapshot math is the existing knowledgecfg centroid builder.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import { assertWorkspacePolicy } from "@/lib/workspace-access-policy";
import { callXaiJSON, DEFAULT_MODEL, systemMessage, userMessage } from "@/lib/xai-client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildRegionFromFlowEmbeddings,
  buildRegionFromSyntheticItems,
  generateSyntheticPowItems,
  type SyntheticPowRequest,
} from "@/lib/verification-flow";
import { listVerificationResults } from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

async function authorize(workspaceId: string, ayclToken: string | null) {
  const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
  if (!auth.ok) return auth;
  const policy = assertWorkspacePolicy({
    principal: auth.principal,
    workspaceOwnerId: auth.workspaceOwnerId,
    action: "author",
  });
  if (!policy.ok) return { ok: false as const, response: jsonError(403, "Forbidden") };
  return auth;
}

async function persistSpec(input: {
  workspaceId: string;
  name: string;
  description: string;
  spec: ReturnType<typeof buildRegionFromSyntheticItems>;
  createdBy: string | null;
}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { persisted: false as const, spec: input.spec };
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("custom_verification_models")
      .insert({
        workspace_id: input.workspaceId,
        name: input.spec.name,
        description: input.description,
        embedding_model_id: input.spec.embedding_model_id,
        dim: input.spec.dim,
        centroid: input.spec.centroid,
        cohort_cohesion: input.spec.cohort_cohesion,
        mean_radius: input.spec.mean_radius,
        cosine_threshold: input.spec.cosine_threshold,
        subject_count: input.spec.subject_count,
        subjects: input.spec.subjects,
        created_by: input.createdBy,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { persisted: false as const, spec: input.spec, error: error?.message };
    return { persisted: true as const, id: String(data.id), spec: input.spec };
  } catch (error) {
    const message = error instanceof Error ? error.message : "persist failed";
    return { persisted: false as const, spec: input.spec, error: message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || "");
    const name = String(body.name || "").trim();
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    if (!name) return jsonError(400, "name is required");
    const ayclToken = typeof body.ayclToken === "string" ? body.ayclToken : null;
    const auth = await authorize(workspaceId, ayclToken);
    if (!auth.ok) return auth.response;

    const action = String(body.action || "");
    if (action === "from_flow") {
      const flowId = String(body.flowId || "");
      if (!flowId) return jsonError(400, "flowId is required");
      const results = await listVerificationResults(workspaceId);
      const spec = buildRegionFromFlowEmbeddings({
        name,
        flowId,
        items: results,
      });
      const saved = await persistSpec({
        workspaceId,
        name,
        description: `verification-flow:${flowId}`,
        spec,
        createdBy: auth.subjectId,
      });
      return NextResponse.json({
        action,
        flowId,
        subject_count: spec.subject_count,
        embedding_model_id: spec.embedding_model_id,
        ...saved,
      });
    }

    if (action === "synthetic_agents") {
      const topic = String(body.topic || name);
      const promptModifier = typeof body.promptModifier === "string" ? body.promptModifier : "";
      const generated = await generateSyntheticPowItems({
        topic,
        promptModifier,
        complete: async (request: SyntheticPowRequest) => {
          const response = await callXaiJSON<{ items?: unknown[] }>(
            [systemMessage(request.instructions), userMessage(request.user)],
            { model: DEFAULT_MODEL, temperature: 0.2, maxTokens: 2000, reasoningEffort: "low" },
          );
          if (!response.success || !response.data) {
            throw new Error(response.error || "xAI returned no proof of work");
          }
          return response.data;
        },
      });
      if (generated.items.length === 0) {
        return jsonError(502, "Synthetic agents returned no proof of work items");
      }
      const spec = buildRegionFromSyntheticItems({ name, items: generated.items });
      const saved = await persistSpec({
        workspaceId,
        name,
        description: `[synthetic-agents] ${generated.request.modifier || topic}`,
        spec,
        createdBy: auth.subjectId,
      });
      return NextResponse.json({
        action,
        asksForProofOfWork: generated.request.asksForProofOfWork,
        includesModifier: generated.request.includesModifier,
        subject_count: spec.subject_count,
        ...saved,
      });
    }

    return jsonError(400, "action must be from_flow or synthetic_agents");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create region";
    return jsonError(500, message);
  }
}
