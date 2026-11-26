import { after, NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { readLtiLaunchSession } from "@/lib/lti/request-session";
import { bindContextRegion, organizationAdminUserId } from "@/lib/lti/store";
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
import {
  getVerificationFlowById,
  listVerificationFlowsForOwnerUserId,
  listVerificationResultsForFlowId,
} from "@/lib/verification-flow-repository";
export const runtime = "nodejs";
export const maxDuration = 60;

async function requireInstructorOwner() {
  const session = await readLtiLaunchSession();
  if (!session?.instructor) return { error: jsonError(403, "Instructor launch required") as NextResponse };
  const ownerUserId = await organizationAdminUserId(session.organizationId);
  if (!ownerUserId) return { error: jsonError(400, "Organization has no owner") as NextResponse };
  return { session, ownerUserId };
}

async function realSessionCountForFlow(input: {
  flowId: string;
  embeddings: readonly { flow_id?: string | null; source?: string | null }[];
}): Promise<number> {
  const fromEmbeddings = input.embeddings.filter(
    (row) => String(row.flow_id || "") === input.flowId && !isSimulatedEmbedding(row),
  ).length;
  if (fromEmbeddings > 0) return fromEmbeddings;
  const results = await listVerificationResultsForFlowId(input.flowId);
  return results.filter((row) => row.source !== "skill" || Boolean(row.identity)).length;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructorOwner();
    if ("error" in auth) return auth.error;
    let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
    try {
      embeddings = await listFlowEmbeddingsForOwner({
        ownerUserId: auth.ownerUserId,
        flowKind: productFlowEmbeddingKind(),
      });
    } catch {
      embeddings = [];
    }
    const flows = await listVerificationFlowsForOwnerUserId(auth.ownerUserId);
    const listed = [];
    for (const flow of flows) {
      listed.push({
        id: flow.id,
        name: flow.name,
        challenge: flow.topic,
        questionCount: Math.max(1, problemsForSimulationFlow(flow).length),
        realSessionCount: await realSessionCountForFlow({
          flowId: flow.id,
          embeddings,
        }),
      });
    }
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
    const message = error instanceof Error ? error.message : "Failed to load simulation setup";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireInstructorOwner();
    if ("error" in auth) return auth.error;
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
    const flows: Array<{
      id: string;
      name: string;
      workspaceId: string | null;
      problems: string[];
      answersModelSeed?: unknown;
    }> = [];
    for (const flowId of protocolIds) {
      const flow = await getVerificationFlowById(flowId);
      if (!flow || !flowOwnedByUser(flow, auth.ownerUserId)) return jsonError(404, "Protocol not found");
      flows.push({
        id: flow.id,
        name: flow.name,
        workspaceId: flow.workspaceId || null,
        problems: problemsForSimulationFlow(flow),
        answersModelSeed: flow.answersModelSeed ?? null,
      });
    }
    const aiUseCatalogIds = parseAiUseCatalogIds(body.aiUseCatalogIds);
    const samplesPerAiUse = clampSamplesPerAiUse(body.samplesPerAiUse);
    if (aiUseCatalogIds.length) {
      const openRouterKey = await loadOpenRouterApiKeyForOwnerUser(auth.ownerUserId);
      if (!openRouterKey) return jsonError(400, OPENROUTER_ORG_KEY_MISSING);
    }
    if (regionSimulationJobsEnabled()) {
      const job = await enqueueRegionSimulation({
        ownerUserId: auth.ownerUserId,
        family: "exploration",
        name,
        kind: "verification",
        flows: aiUseCatalogIds.length ? flows.slice(0, 1) : flows,
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
      if (ticked.job.region_id && auth.session.contextId) {
        await bindContextRegion({
          platformId: auth.session.platformId,
          deploymentId: auth.session.deploymentId,
          contextId: auth.session.contextId,
          knowledgeRegionId: ticked.job.region_id,
        });
      }
      return NextResponse.json({
        ...jobsPublicPayload(ticked.job),
        explorationJobId: job.id,
        aiUseJobId: ticked.followUpJobId,
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
            ownerUserId: auth.ownerUserId,
            name,
            kind: "verification",
            flows,
            strategies,
            samplesPerStrategy,
            includeHumanData,
            onProgress: (progress) => send({ type: "progress", progress }),
          });
          if (result.id && auth.session.contextId) {
            await bindContextRegion({
              platformId: auth.session.platformId,
              deploymentId: auth.session.deploymentId,
              contextId: auth.session.contextId,
              knowledgeRegionId: result.id,
            });
          }
          send({
            type: "result",
            ...result,
            regionPath: result.id ? `/lti/regions/${result.id}` : result.regionPath,
          });
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to run simulation";
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
    const message = error instanceof Error ? error.message : "Failed to run simulation";
    return jsonError(500, message);
  }
}
