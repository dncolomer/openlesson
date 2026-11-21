import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { readLtiLaunchSession } from "@/lib/lti/request-session";
import { bindContextRegion, organizationAdminUserId } from "@/lib/lti/store";
import { flowOwnedByUser, parseProductFlowKind, productFlowEmbeddingKind, type ProductFlowKind } from "@/lib/product-flow";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import {
  clampSamplesPerStrategy,
  EXPLORATION_STRATEGIES,
  isSimulatedEmbedding,
  parseSimulationStrategies,
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

async function requireInstructorOwner() {
  const session = await readLtiLaunchSession();
  if (!session?.instructor) return { error: jsonError(403, "Instructor launch required") as NextResponse };
  const ownerUserId = await organizationAdminUserId(session.organizationId);
  if (!ownerUserId) return { error: jsonError(400, "Organization has no owner") as NextResponse };
  return { session, ownerUserId };
}

async function realSessionCountForFlow(input: {
  kind: ProductFlowKind;
  flowId: string;
  embeddings: readonly { flow_id?: string | null; source?: string | null }[];
}): Promise<number> {
  const fromEmbeddings = input.embeddings.filter(
    (row) => String(row.flow_id || "") === input.flowId && !isSimulatedEmbedding(row),
  ).length;
  if (fromEmbeddings > 0 || input.kind !== "verification") return fromEmbeddings;
  const results = await listVerificationResultsForFlowId(input.flowId);
  return results.filter((row) => row.source !== "skill" || Boolean(row.identity)).length;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructorOwner();
    if ("error" in auth) return auth.error;
    const kind = simulationKind(new URL(req.url).searchParams.get("kind"));
    let embeddings: Awaited<ReturnType<typeof listFlowEmbeddingsForOwner>> = [];
    try {
      embeddings = await listFlowEmbeddingsForOwner({
        ownerUserId: auth.ownerUserId,
        flowKind: productFlowEmbeddingKind(kind),
      });
    } catch {
      embeddings = [];
    }
    const flows =
      kind === "calibration"
        ? await listCalibrationFlowsForOwnerUserId(auth.ownerUserId)
        : kind === "solve"
          ? await listSolveFlowsForOwnerUserId(auth.ownerUserId)
          : await listVerificationFlowsForOwnerUserId(auth.ownerUserId);
    const listed = [];
    for (const flow of flows) {
      listed.push({
        id: flow.id,
        name: flow.name,
        topic: flow.topic,
        questionCount: Math.max(1, problemsForSimulationFlow(flow).length),
        realSessionCount: await realSessionCountForFlow({
          kind,
          flowId: flow.id,
          embeddings,
        }),
      });
    }
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
    const message = error instanceof Error ? error.message : "Failed to load simulation setup";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireInstructorOwner();
    if ("error" in auth) return auth.error;
    const body = (await req.json()) as Record<string, unknown>;
    const kind = simulationKind(body.kind);
    const name = String(body.name || "").trim();
    if (!name) return jsonError(400, "name is required");
    const flowIds = Array.isArray(body.flowIds)
      ? body.flowIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    if (!flowIds.length) return jsonError(400, "Select at least one flow");
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
    }> = [];
    for (const flowId of flowIds) {
      const flow =
        kind === "calibration"
          ? await getCalibrationFlowById(flowId)
          : kind === "solve"
            ? await getSolveFlowById(flowId)
            : await getVerificationFlowById(flowId);
      if (!flow || !flowOwnedByUser(flow, auth.ownerUserId)) return jsonError(404, "Flow not found");
      flows.push({
        id: flow.id,
        name: flow.name,
        workspaceId: flow.workspaceId || null,
        problems: problemsForSimulationFlow(flow),
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
            kind,
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
