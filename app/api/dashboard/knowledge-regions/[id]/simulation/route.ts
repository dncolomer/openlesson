/**
 * Owner dashboard: add or remove simulated samples on an existing region.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { parseDashboardKnowledgeRegionKind } from "@/lib/dashboard-knowledge-regions";
import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import {
  isRegionSimulationClusterRow,
  parseRegionSimulationClusterStrategyId,
} from "@/lib/knowledge-region-details";
import {
  flowOwnedByUser,
  parseProductFlowKind,
  productFlowEmbeddingKind,
  type ProductFlowKind,
} from "@/lib/product-flow";
import {
  clampSamplesPerStrategy,
  isSimulationStrategyClusterName,
  parseSimulationStrategiesWithRecovered,
  regionSimulationFlowIds,
} from "@/lib/region-simulation";
import {
  addRegionSimulationSamples,
  problemsForSimulationFlow,
  removeRegionSimulationSamples,
} from "@/lib/region-simulation-run";
import { getCalibrationFlowById } from "@/lib/calibration-flow-repository";
import { getSolveFlowById } from "@/lib/solve-flow-repository";
import { getVerificationFlowById } from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

async function ownedSimulationFlow(
  kind: ProductFlowKind,
  flowId: string,
  userId: string,
): Promise<{
  id: string;
  name: string;
  workspaceId: string | null;
  problems: string[];
} | null> {
  const flow =
    kind === "calibration"
      ? await getCalibrationFlowById(flowId)
      : kind === "solve"
        ? await getSolveFlowById(flowId)
        : await getVerificationFlowById(flowId);
  if (!flow || !flowOwnedByUser(flow, userId)) return null;
  return {
    id: flow.id,
    name: flow.name,
    workspaceId: flow.workspaceId || null,
    problems: problemsForSimulationFlow(flow),
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
  kind: ProductFlowKind;
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
      flowKind: productFlowEmbeddingKind(input.kind),
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
    const flow = await ownedSimulationFlow(input.kind, flowId, input.ownerUserId);
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
      kind: ProductFlowKind;
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
      "id, name, product, owner_user_id, embedding_model_id, verify_flow_id, calibrate_flow_id, solve_flow_id",
    )
    .eq("id", regionId)
    .eq("owner_user_id", auth.user.id)
    .maybeSingle();
  if (error || !row) return { ok: false, response: jsonError(404, "Region not found") };
  if (String(row.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
    return { ok: false, response: jsonError(404, "Region not found") };
  }
  const requested = parseDashboardKnowledgeRegionKind(
    new URL(req.url).searchParams.get("kind"),
  );
  const kind =
    requested ||
    parseProductFlowKind(row.product) ||
    "verification";
  const seedFlowId =
    kind === "calibration"
      ? String(row.calibrate_flow_id || "").trim()
      : kind === "solve"
        ? String(row.solve_flow_id || "").trim()
        : String(row.verify_flow_id || "").trim();
  const { data: siblings } = await auth.supabase
    .from("knowledge_regions")
    .select("name, description, embedding_model_id, product")
    .eq("owner_user_id", auth.user.id)
    .eq("product", kind);
  return {
    ok: true,
    userId: auth.user.id,
    kind,
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
    const kind = parseProductFlowKind(body.kind) || loaded.kind;
    let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
    try {
      embeddings = await listFlowEmbeddingsForOwner({
        ownerUserId: loaded.userId,
        flowKind: productFlowEmbeddingKind(kind),
      });
    } catch {
      embeddings = [];
    }
    const strategies = parseSimulationStrategiesWithRecovered({
      strategyIds: body.strategyIds,
      customStrategies: body.customStrategies,
      embeddings,
    });
    if (!strategies.length) return jsonError(400, "Select at least one exploration strategy");
    const requestedFlowIds = Array.isArray(body.flowIds)
      ? body.flowIds.map((flowId) => String(flowId || "").trim()).filter(Boolean)
      : [];
    const flows = await flowsForRegion({
      kind,
      ownerUserId: loaded.userId,
      seedFlowId: loaded.seedFlowId,
      parentName: loaded.name,
      clusters: loaded.clusters,
      requestedFlowIds,
    });
    if (!flows.length) return jsonError(400, "Select at least one flow");
    const result = await addRegionSimulationSamples({
      ownerUserId: loaded.userId,
      regionId: id,
      name: loaded.name,
      kind,
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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const loaded = await loadOwnedParent(req, id);
    if (!loaded.ok) return loaded.response;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = parseProductFlowKind(body.kind) || loaded.kind;
    const sampleIds = Array.isArray(body.sampleIds)
      ? body.sampleIds.map((sampleId) => String(sampleId || "").trim()).filter(Boolean)
      : [];
    const strategyIds = Array.isArray(body.strategyIds)
      ? body.strategyIds.map((strategyId) => String(strategyId || "").trim()).filter(Boolean)
      : [];
    if (!sampleIds.length && !strategyIds.length) {
      return jsonError(400, "Select simulated samples or a strategy to remove");
    }
    const flows = await flowsForRegion({
      kind,
      ownerUserId: loaded.userId,
      seedFlowId: loaded.seedFlowId,
      parentName: loaded.name,
      clusters: loaded.clusters,
    });
    const result = await removeRegionSimulationSamples({
      ownerUserId: loaded.userId,
      regionId: id,
      name: loaded.name,
      kind,
      flows,
      sampleIds,
      strategyIds,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove simulated samples";
    return jsonError(500, message);
  }
}
