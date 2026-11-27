/**
 * Owner dashboard: configure and run a knowledge-region simulation
 * for knowledge verification protocols.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { flowOwnedByUser, productFlowEmbeddingKind } from "@/lib/product-flow";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import {
  clampSamplesPerStrategy,
  EXPLORATION_STRATEGIES,
  isSimulatedEmbedding,
  parseSimulationStrategies,
  protocolIdsFromRequestBody,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_MAX_SAMPLES,
  REGION_SIMULATION_MIN_SAMPLES,
} from "@/lib/region-simulation";
import {
  AI_USE_DEFAULT_CHECKED,
  clampSamplesPerAiUse,
  parseAiUseCatalogIds,
  publicAiUseCatalog,
  REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE,
  REGION_SIMULATION_MAX_SAMPLES_PER_AI_USE,
  REGION_SIMULATION_MIN_SAMPLES_PER_AI_USE,
} from "@/lib/region-simulation-ai-use-catalog";
import {
  enqueueRegionSimulation,
  jobsPublicPayload,
  tickRegionSimulationJob,
} from "@/lib/region-simulation-jobs";
import { OPENROUTER_ORG_KEY_MISSING } from "@/lib/ai/openrouter";
import { loadOpenRouterApiKeyForOwnerUser } from "@/lib/organization/org-backend-runtime";
import { regionSimulationJobsEnabled } from "@/lib/region-simulation-flags";
import { problemsForSimulationFlow, runRegionSimulation } from "@/lib/region-simulation-run";
import { loadActiveOrganizationId } from "@/lib/organization/membership-store";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVerificationFlowById,
  listVerificationFlowsForDashboard,
  listVerificationResultsForFlowId,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";
export const maxDuration = 60;

async function realSessionCountForFlow(input: {
  flowId: string;
  embeddings: readonly { flow_id?: string | null; source?: string | null; identity?: string | null }[];
}): Promise<number> {
  const fromEmbeddings = input.embeddings.filter(
    (row) => String(row.flow_id || "") === input.flowId && !isSimulatedEmbedding(row),
  ).length;
  if (fromEmbeddings > 0) return fromEmbeddings;
  const results = await listVerificationResultsForFlowId(input.flowId);
  return results.filter((row) => row.source !== "skill" || Boolean(row.identity)).length;
}

async function listedSimulationFlows(input: {
  ownerUserId: string;
  organizationId?: string | null;
  embeddings: readonly { flow_id?: string | null; source?: string | null; identity?: string | null }[];
}) {
  const flows = await listVerificationFlowsForDashboard({
    ownerUserId: input.ownerUserId,
    organizationId: input.organizationId,
  });
  const listed = [];
  for (const flow of flows) {
    listed.push({
      id: flow.id,
      name: flow.name,
      challenge: flow.topic,
      questionCount: Math.max(1, problemsForSimulationFlow(flow).length),
      realSessionCount: await realSessionCountForFlow({
        flowId: flow.id,
        embeddings: input.embeddings,
      }),
    });
  }
  return listed;
}

async function ownedSimulationFlow(
  flowId: string,
  userId: string,
  organizationId?: string | null,
): Promise<{
  id: string;
  name: string;
  workspaceId: string | null;
  problems: string[];
  answersModelSeed?: unknown;
} | null> {
  const flow = await getVerificationFlowById(flowId);
  if (!flow) return null;
  const org = String(organizationId || "").trim();
  const inOrg = org && String(flow.organizationId || "").trim() === org;
  if (!flowOwnedByUser(flow, userId) && !inOrg) return null;
  return {
    id: flow.id,
    name: flow.name,
    workspaceId: flow.workspaceId || null,
    problems: problemsForSimulationFlow(flow),
    answersModelSeed: flow.answersModelSeed ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
    try {
      embeddings = await listFlowEmbeddingsForOwner({
        ownerUserId: auth.user.id,
        flowKind: productFlowEmbeddingKind(),
      });
    } catch {
      embeddings = [];
    }
    const organizationId = await loadActiveOrganizationId(
      createAdminClient(),
      auth.user.id,
    );
    const listed = await listedSimulationFlows({
      ownerUserId: auth.user.id,
      organizationId,
      embeddings,
    });
    return NextResponse.json({
      strategies: EXPLORATION_STRATEGIES.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
      })),
      defaultSamplesPerStrategy: REGION_SIMULATION_DEFAULT_SAMPLES,
      minSamplesPerStrategy: REGION_SIMULATION_MIN_SAMPLES,
      maxSamplesPerStrategy: REGION_SIMULATION_MAX_SAMPLES,
      aiUseCatalog: publicAiUseCatalog(),
      defaultChecked: AI_USE_DEFAULT_CHECKED,
      defaultSamplesPerAiUse: REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE,
      minSamplesPerAiUse: REGION_SIMULATION_MIN_SAMPLES_PER_AI_USE,
      maxSamplesPerAiUse: REGION_SIMULATION_MAX_SAMPLES_PER_AI_USE,
      protocols: listed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load simulation setup";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    if (!name) return jsonError(400, "name is required");
    const protocolIds = protocolIdsFromRequestBody(body);
    if (!protocolIds.length) return jsonError(400, "Select at least one protocol");
    const strategies = parseSimulationStrategies({
      strategyIds: body.strategyIds,
      customStrategies: body.customStrategies,
    });
    if (!strategies.length) return jsonError(400, "Select at least one exploration strategy");
    const samplesPerStrategy = clampSamplesPerStrategy(body.samplesPerStrategy);
    const includeHumanData = body.includeHumanData === true;
    const aiUseCatalogIds = parseAiUseCatalogIds(body.aiUseCatalogIds);
    const samplesPerAiUse = clampSamplesPerAiUse(body.samplesPerAiUse);
    if (aiUseCatalogIds.length) {
      const openRouterKey = await loadOpenRouterApiKeyForOwnerUser(auth.user.id);
      if (!openRouterKey) return jsonError(400, OPENROUTER_ORG_KEY_MISSING);
    }
    const selectedFlows = aiUseCatalogIds.length ? protocolIds.slice(0, 1) : protocolIds;
    const organizationId = await loadActiveOrganizationId(
      createAdminClient(),
      auth.user.id,
    );

    const flows: Array<{
      id: string;
      name: string;
      workspaceId: string | null;
      problems: string[];
      answersModelSeed?: unknown;
    }> = [];
    for (const flowId of selectedFlows) {
      const flow = await ownedSimulationFlow(flowId, auth.user.id, organizationId);
      if (!flow) return jsonError(404, "Protocol not found");
      flows.push(flow);
    }

    if (regionSimulationJobsEnabled()) {
      const job = await enqueueRegionSimulation({
        ownerUserId: auth.user.id,
        family: "exploration",
        name,
        kind: "verification",
        flows,
        strategies,
        samplesPerStrategy,
        includeHumanData,
        followUp: aiUseCatalogIds.length
          ? { family: "ai_use", catalogIds: aiUseCatalogIds, samplesPerAiUse }
          : null,
      });
      const ticked = await tickRegionSimulationJob(job.id);
      if (ticked.shouldContinue) after(() => tickRegionSimulationJob(job.id));
      const followUpId = ticked.followUpJobId;
      if (followUpId) after(() => tickRegionSimulationJob(followUpId));
      return NextResponse.json({
        ...jobsPublicPayload(ticked.job),
        explorationJobId: job.id,
        aiUseJobId: ticked.followUpJobId,
        pendingAiUseCatalogIds: aiUseCatalogIds,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        try {
          const result = await runRegionSimulation({
            ownerUserId: auth.user.id,
            name,
            kind: "verification",
            flows,
            strategies,
            samplesPerStrategy,
            includeHumanData,
            onProgress: (progress) => send({ type: "progress", progress }),
          });
          send({ type: "result", ...result });
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to run simulation";
          send({ type: "error", error: message });
          controller.close();
        }
      },
    });
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run simulation";
    return jsonError(500, message);
  }
}
