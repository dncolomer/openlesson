/**
 * Owner dashboard: configure and run a knowledge-region simulation
 * for Verification, Calibration, or Solve flows.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  flowOwnedByUser,
  parseProductFlowKind,
  productFlowEmbeddingKind,
  type ProductFlowKind,
} from "@/lib/product-flow";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import {
  clampSamplesPerStrategy,
  EXPLORATION_STRATEGIES,
  isSimulatedEmbedding,
  parseExplorationStrategyIds,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_MAX_SAMPLES,
  REGION_SIMULATION_MIN_SAMPLES,
} from "@/lib/region-simulation";
import { problemsForSimulationFlow, runRegionSimulation } from "@/lib/region-simulation-run";
import {
  getVerificationFlowById,
  listVerificationFlowsForOwnerUserId,
  listVerificationResultsForFlowId,
} from "@/lib/verification-flow-repository";
import {
  getCalibrationFlowById,
  listCalibrationFlowsForOwnerUserId,
} from "@/lib/calibration-flow-repository";
import { getSolveFlowById, listSolveFlowsForOwnerUserId } from "@/lib/solve-flow-repository";

export const runtime = "nodejs";

function simulationKind(value: unknown): ProductFlowKind {
  return parseProductFlowKind(value) || "verification";
}

async function realSessionCountForFlow(input: {
  kind: ProductFlowKind;
  flowId: string;
  embeddings: readonly { flow_id?: string | null; source?: string | null; identity?: string | null }[];
}): Promise<number> {
  const fromEmbeddings = input.embeddings.filter(
    (row) => String(row.flow_id || "") === input.flowId && !isSimulatedEmbedding(row),
  ).length;
  if (fromEmbeddings > 0 || input.kind !== "verification") return fromEmbeddings;
  const results = await listVerificationResultsForFlowId(input.flowId);
  return results.filter((row) => row.source !== "skill" || Boolean(row.identity)).length;
}

async function listedSimulationFlows(input: {
  kind: ProductFlowKind;
  ownerUserId: string;
  embeddings: readonly { flow_id?: string | null; source?: string | null; identity?: string | null }[];
}) {
  const flows =
    input.kind === "calibration"
      ? await listCalibrationFlowsForOwnerUserId(input.ownerUserId)
      : input.kind === "solve"
        ? await listSolveFlowsForOwnerUserId(input.ownerUserId)
        : await listVerificationFlowsForOwnerUserId(input.ownerUserId);
  const listed = [];
  for (const flow of flows) {
    listed.push({
      id: flow.id,
      name: flow.name,
      topic: "topic" in flow ? flow.topic : "goal" in flow ? flow.goal : "",
      questionCount: Math.max(1, problemsForSimulationFlow(flow).length),
      realSessionCount: await realSessionCountForFlow({
        kind: input.kind,
        flowId: flow.id,
        embeddings: input.embeddings,
      }),
    });
  }
  return listed;
}

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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const kind = simulationKind(new URL(req.url).searchParams.get("kind"));

    let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
    try {
      embeddings = await listFlowEmbeddingsForOwner({
        ownerUserId: auth.user.id,
        flowKind: productFlowEmbeddingKind(kind),
      });
    } catch {
      embeddings = [];
    }
    const listed = await listedSimulationFlows({
      kind,
      ownerUserId: auth.user.id,
      embeddings,
    });
    return NextResponse.json({
      kind,
      strategies: EXPLORATION_STRATEGIES.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
      })),
      defaultSamplesPerStrategy: REGION_SIMULATION_DEFAULT_SAMPLES,
      minSamplesPerStrategy: REGION_SIMULATION_MIN_SAMPLES,
      maxSamplesPerStrategy: REGION_SIMULATION_MAX_SAMPLES,
      flows: listed,
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
    const kind = simulationKind(body.kind);
    const name = String(body.name || "").trim();
    if (!name) return jsonError(400, "name is required");
    const flowIds = Array.isArray(body.flowIds)
      ? body.flowIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    if (!flowIds.length) return jsonError(400, "Select at least one flow");
    const strategyIds = parseExplorationStrategyIds(body.strategyIds);
    if (!strategyIds.length) return jsonError(400, "Select at least one exploration strategy");
    const samplesPerStrategy = clampSamplesPerStrategy(body.samplesPerStrategy);
    const includeHumanData = body.includeHumanData === true;

    const flows: Array<{
      id: string;
      name: string;
      workspaceId: string | null;
      problems: string[];
    }> = [];
    for (const flowId of flowIds) {
      const flow = await ownedSimulationFlow(kind, flowId, auth.user.id);
      if (!flow) return jsonError(404, "Flow not found");
      flows.push(flow);
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
            kind,
            flows,
            strategyIds,
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
