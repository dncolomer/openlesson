/**
 * Owner dashboard: add simulated samples on an existing region.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import {
  isRegionSimulationClusterRow,
  parseRegionSimulationClusterStrategyId,
} from "@/lib/knowledge-region-details";
import { flowOwnedByUser, productFlowEmbeddingKind } from "@/lib/product-flow";
import {
  clampSamplesPerStrategy,
  isSimulationStrategyClusterName,
  parseSimulationStrategiesWithRecovered,
  regionSimulationFlowIds,
} from "@/lib/region-simulation";
import {
  addRegionSimulationSamples,
  problemsForSimulationFlow,
} from "@/lib/region-simulation-run";
import { clampSamplesPerAiUse, parseAiUseCatalogIds } from "@/lib/region-simulation-ai-use-catalog";
import { OPENROUTER_ORG_KEY_MISSING } from "@/lib/ai/openrouter";
import { loadOpenRouterApiKeyForOwnerUser } from "@/lib/organization/org-backend-runtime";
import { regionSimulationJobsEnabled } from "@/lib/region-simulation-flags";
import {
  enqueueRegionSimulation,
  jobsPublicPayload,
  REGION_SIM_TICK_MAX_DURATION,
  tickRegionSimulationJob,
} from "@/lib/region-simulation-jobs";
import { getVerificationFlowById } from "@/lib/verification-flow-repository";

export const runtime = "nodejs";
export const maxDuration = REGION_SIM_TICK_MAX_DURATION;

async function ownedSimulationFlow(
  flowId: string,
  userId: string,
): Promise<{
  id: string;
  name: string;
  workspaceId: string | null;
  problems: string[];
  answersModelSeed?: unknown;
} | null> {
  const flow = await getVerificationFlowById(flowId);
  if (!flow || !flowOwnedByUser(flow, userId)) return null;
  return {
    id: flow.id,
    name: flow.name,
    workspaceId: flow.workspaceId || null,
    problems: problemsForSimulationFlow(flow),
    answersModelSeed: flow.answersModelSeed ?? null,
  };
}

function clusterStrategiesForParent(
  parentName: string,
  rows: readonly { name?: unknown; description?: unknown; embedding_model_id?: unknown }[],
): Array<{ id: string; name: string }> {
  const prefix = `${parentName} · `;
  const out: Array<{ id: string; name: string }> = [];
  for (const row of rows) {
    if (!isRegionSimulationClusterRow(row)) continue;
    const name = String(row.name || "").trim();
    if (!isSimulationStrategyClusterName(parentName, name)) continue;
    const strategyId = parseRegionSimulationClusterStrategyId(row.description);
    if (!strategyId) continue;
    out.push({
      id: strategyId,
      name: name.startsWith(prefix) ? name.slice(prefix.length).trim() : name,
    });
  }
  return out;
}

async function flowsForRegion(input: {
  ownerUserId: string;
  seedFlowId: string;
  parentName: string;
  clusters: readonly { name?: unknown; description?: unknown; embedding_model_id?: unknown }[];
  requestedFlowIds?: string[];
}): Promise<Array<{ id: string; name: string; workspaceId: string | null; problems: string[] }>> {
  let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
  try {
    embeddings = await listFlowEmbeddingsForOwner({
      ownerUserId: input.ownerUserId,
      flowKind: productFlowEmbeddingKind(),
    });
  } catch {
    embeddings = [];
  }
  const allowed = regionSimulationFlowIds({
    seedFlowId: input.seedFlowId,
    embeddings,
    strategies: clusterStrategiesForParent(input.parentName, input.clusters),
  });
  const requested = (input.requestedFlowIds ?? [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && allowed.includes(id));
  const ids = requested.length ? requested : allowed;
  const flows = [];
  for (const flowId of ids) {
    const flow = await ownedSimulationFlow(flowId, input.ownerUserId);
    if (flow) flows.push(flow);
  }
  return flows;
}

async function loadOwnedParent(
  req: NextRequest,
  regionId: string,
): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      userId: string;
      name: string;
      seedFlowId: string;
      clusters: Array<{ name?: unknown; description?: unknown; embedding_model_id?: unknown }>;
    }
> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  const { data: row, error } = await auth.supabase
    .from("knowledge_regions")
    .select(
      "id, name, owner_user_id, embedding_model_id, verify_flow_id",
    )
    .eq("id", regionId)
    .eq("owner_user_id", auth.user.id)
    .maybeSingle();
  if (error || !row) return { ok: false, response: jsonError(404, "Region not found") };
  if (String(row.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
    return { ok: false, response: jsonError(404, "Region not found") };
  }
  const seedFlowId = String(row.verify_flow_id || "").trim();
  const { data: siblings } = await auth.supabase
    .from("knowledge_regions")
    .select("name, description, embedding_model_id")
    .eq("owner_user_id", auth.user.id);
  return {
    ok: true,
    userId: auth.user.id,
    name: String(row.name || "").trim(),
    seedFlowId,
    clusters: siblings || [],
  };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const loaded = await loadOwnedParent(req, id);
    if (!loaded.ok) return loaded.response;
    const body = (await req.json()) as Record<string, unknown>;
    let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
    try {
      embeddings = await listFlowEmbeddingsForOwner({
        ownerUserId: loaded.userId,
        flowKind: productFlowEmbeddingKind(),
      });
    } catch {
      embeddings = [];
    }
    const strategies = parseSimulationStrategiesWithRecovered({
      strategyIds: body.strategyIds,
      customStrategies: body.customStrategies,
      embeddings,
    });
    const aiUseCatalogIds = parseAiUseCatalogIds(body.aiUseCatalogIds);
    const samplesPerAiUse = clampSamplesPerAiUse(body.samplesPerAiUse);
    if (aiUseCatalogIds.length) {
      const openRouterKey = await loadOpenRouterApiKeyForOwnerUser(loaded.userId);
      if (!openRouterKey) return jsonError(400, OPENROUTER_ORG_KEY_MISSING);
    }
    if (!strategies.length && !aiUseCatalogIds.length) {
      return jsonError(400, "Select at least one exploration strategy");
    }
    const requestedFlowIds = Array.isArray(body.flowIds)
      ? body.flowIds.map((flowId) => String(flowId || "").trim()).filter(Boolean)
      : [];
    const flows = await flowsForRegion({
      ownerUserId: loaded.userId,
      seedFlowId: loaded.seedFlowId,
      parentName: loaded.name,
      clusters: loaded.clusters,
      requestedFlowIds,
    });
    if (!flows.length) return jsonError(400, "Select at least one flow");
    if (regionSimulationJobsEnabled()) {
      if (strategies.length) {
        const job = await enqueueRegionSimulation({
          ownerUserId: loaded.userId,
          family: "exploration",
          name: loaded.name,
          kind: "verification",
          flows: aiUseCatalogIds.length ? flows.slice(0, 1) : flows,
          strategies,
          samplesPerStrategy: clampSamplesPerStrategy(body.samplesPerStrategy),
          regionId: id,
          followUp: aiUseCatalogIds.length
            ? { family: "ai_use", catalogIds: aiUseCatalogIds, samplesPerAiUse }
            : null,
        });
        const ticked = await tickRegionSimulationJob(job.id);
        if (ticked.shouldContinue) after(() => tickRegionSimulationJob(job.id));
        const followUpId = ticked.followUpJobId;
        if (followUpId) after(() => tickRegionSimulationJob(followUpId));
        return NextResponse.json(jobsPublicPayload(ticked.job));
      }
      const job = await enqueueRegionSimulation({
        ownerUserId: loaded.userId,
        family: "ai_use",
        name: loaded.name,
        kind: "verification",
        flows: flows.slice(0, 1),
        catalogIds: aiUseCatalogIds,
        samplesPerAiUse,
        regionId: id,
      });
      const ticked = await tickRegionSimulationJob(job.id);
      if (ticked.shouldContinue) after(() => tickRegionSimulationJob(job.id));
      return NextResponse.json(jobsPublicPayload(ticked.job));
    }
    if (!strategies.length) return jsonError(400, "Select at least one exploration strategy");
    const result = await addRegionSimulationSamples({
      ownerUserId: loaded.userId,
      regionId: id,
      name: loaded.name,
      kind: "verification",
      flows,
      strategies,
      samplesPerStrategy: clampSamplesPerStrategy(body.samplesPerStrategy),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add simulated samples";
    return jsonError(500, message);
  }
}


