/**
 * Public agent flow CRUD — same Solve / Calibration / Verification stores
 * as cookie `/api/dashboard/flows`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAP_BLOCK_COLUMN,
  isFlowMapBlockKind,
  serializeMapBlock,
  type AuthoringMapBlockKind,
} from "@/lib/block-kind";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import {
  getCalibrationFlowById,
  listCalibrationFlows,
  listCalibrationFlowsForOwnerUserId,
  runCalibrationCommand,
} from "@/lib/calibration-flow-repository";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  parseExactProblemOnCanvas,
  parseProductFlowKind,
  type ProductFlowKind,
} from "@/lib/product-flow";
import {
  parseFlowArtifacts,
  flowProblemFromUnknown,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import {
  resolveFlowArtifactsFromBody,
  uploadFlowArtifactBytes,
} from "@/lib/flow-artifact-upload";
import {
  OPTIONAL_FLOW_ENFORCED_CHANNELS,
  parseFlowEnforcedChannels,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import { parseFlowOpeningCanvasSceneForKind } from "@/lib/flow-opening-canvas";
import {
  flowUnsysSeedFromModel,
  serializeFlowUnsysSeed,
} from "@/lib/flow-unsys-seed";
import {
  generateFlowUnsysSeedFromBody,
  runProductFlowUnsysGenerate,
} from "@/lib/flow-unsys-generate";
import { requestHasUnsysSeed } from "@/lib/unsys-tree-spec";
import { solveFlowPublicPath } from "@/lib/solve-flow";
import {
  getSolveFlowById,
  listSolveFlows,
  listSolveFlowsForOwnerUserId,
  runSolveCommand,
} from "@/lib/solve-flow-repository";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import {
  getVerificationFlowById,
  listVerificationFlows,
  listVerificationFlowsForOwnerUserId,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";
import type { AuthContext } from "./types";
import { listWorkspaceBlocks, loadManagedWorkspace } from "./workspace-management";

export type AgentFlowKind = ProductFlowKind;

export type PresentedAgentFlow = {
  id: string;
  kind: AgentFlowKind;
  name: string;
  topic: string | null;
  goal: string | null;
  questions: string[];
  artifacts: FlowArtifact[];
  duration_minutes: number | null;
  action_catalog: number | null;
  /** Solve / Verification: seed the Work canvas with the Problem as written. */
  exact_problem_on_canvas: boolean;
  /** Author Unsys seed used when a learner runs this flow. */
  answers_model_seed: Record<string, unknown> | null;
  /** Channels the run requires. Calibration is always all-off. */
  enforced_channels: FlowEnforcedChannels;
  public_token: string;
  workspace_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function ownerUserId(auth: AuthContext): string {
  const id = String(auth.user_id || "").trim();
  if (!id) throw new Error("No user available to own this flow");
  return id;
}

function optionalWorkspaceId(value: unknown): string | undefined {
  const id = String(value || "").trim();
  return id || undefined;
}

function presentWorkspaceId(value: string | null | undefined): string | null {
  const id = String(value || "").trim();
  return id || null;
}

function questionsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text?: unknown }).text || "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function presentWizardFields(flow: {
  kind: AgentFlowKind;
  exactProblemOnCanvas?: boolean;
  answersModelSeed?: unknown;
  enforcedChannels?: unknown;
}): Pick<
  PresentedAgentFlow,
  "exact_problem_on_canvas" | "answers_model_seed" | "enforced_channels"
> {
  return {
    exact_problem_on_canvas:
      flow.kind === "calibration"
        ? false
        : parseExactProblemOnCanvas(flow.exactProblemOnCanvas),
    answers_model_seed: serializeFlowUnsysSeed(flow.answersModelSeed),
    enforced_channels:
      flow.kind === "calibration"
        ? { ...OPTIONAL_FLOW_ENFORCED_CHANNELS }
        : parseFlowEnforcedChannels(flow.enforcedChannels),
  };
}

function presentSolve(flow: {
  id: string;
  name: string;
  topic: string;
  artifacts?: FlowArtifact[];
  durationMinutes: number;
  actionCatalog: number;
  exactProblemOnCanvas?: boolean;
  answersModelSeed?: unknown;
  enforcedChannels?: unknown;
  publicToken: string;
  workspaceId: string;
  ownerUserId?: string;
  createdAt: string;
  updatedAt: string;
}): PresentedAgentFlow {
  return {
    id: flow.id,
    kind: "solve",
    name: flow.name,
    topic: flow.topic,
    goal: null,
    questions: [],
    artifacts: parseFlowArtifacts(flow.artifacts),
    duration_minutes: flow.durationMinutes,
    action_catalog: flow.actionCatalog,
    ...presentWizardFields({ kind: "solve", ...flow }),
    public_token: flow.publicToken,
    workspace_id: presentWorkspaceId(flow.workspaceId),
    owner_user_id: flow.ownerUserId || null,
    created_at: flow.createdAt,
    updated_at: flow.updatedAt,
  };
}

function presentCalibration(flow: {
  id: string;
  name: string;
  goal: string;
  topic?: string;
  questions: unknown;
  artifacts?: FlowArtifact[];
  durationMinutes: number;
  actionCatalog: number;
  answersModelSeed?: unknown;
  enforcedChannels?: unknown;
  publicToken: string;
  workspaceId: string;
  ownerUserId?: string;
  createdAt: string;
  updatedAt: string;
}): PresentedAgentFlow {
  return {
    id: flow.id,
    kind: "calibration",
    name: flow.name,
    topic: flow.topic || flow.goal,
    goal: flow.goal,
    questions: questionsFrom(flow.questions),
    artifacts: parseFlowArtifacts(flow.artifacts),
    duration_minutes: flow.durationMinutes,
    action_catalog: flow.actionCatalog,
    ...presentWizardFields({ kind: "calibration", ...flow }),
    public_token: flow.publicToken,
    workspace_id: presentWorkspaceId(flow.workspaceId),
    owner_user_id: flow.ownerUserId || null,
    created_at: flow.createdAt,
    updated_at: flow.updatedAt,
  };
}

function presentVerification(flow: {
  id: string;
  name: string;
  topic: string;
  questions: unknown;
  artifacts?: FlowArtifact[];
  durationMinutes?: number;
  actionCatalog: number;
  exactProblemOnCanvas?: boolean;
  answersModelSeed?: unknown;
  enforcedChannels?: unknown;
  publicToken: string;
  workspaceId: string;
  ownerUserId?: string;
  createdAt: string;
  updatedAt: string;
}): PresentedAgentFlow {
  return {
    id: flow.id,
    kind: "verification",
    name: flow.name,
    topic: flow.topic,
    goal: null,
    questions: questionsFrom(flow.questions),
    artifacts: parseFlowArtifacts(flow.artifacts),
    duration_minutes: flow.durationMinutes ?? null,
    action_catalog: flow.actionCatalog,
    ...presentWizardFields({ kind: "verification", ...flow }),
    public_token: flow.publicToken,
    workspace_id: presentWorkspaceId(flow.workspaceId),
    owner_user_id: flow.ownerUserId || null,
    created_at: flow.createdAt,
    updated_at: flow.updatedAt,
  };
}

function publishReason(reason: string): string {
  if (reason === "name_required") return "name is required";
  if (reason === "topic_required") return "topic is required";
  return reason;
}

function optionalNumber(primary: unknown, fallback: unknown): number | undefined {
  if (primary === undefined && fallback === undefined) return undefined;
  const value = Number(primary ?? fallback);
  return Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(primary: unknown, fallback: unknown): boolean | undefined {
  if (primary === undefined && fallback === undefined) return undefined;
  return parseExactProblemOnCanvas(primary ?? fallback);
}

function wantsGenerateUnsys(body: Record<string, unknown>): boolean {
  const raw = body.generate_unsys ?? body.generateUnsys;
  if (raw === true || raw === 1) return true;
  if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
  return false;
}

export function parseAgentFlowKind(value: unknown): AgentFlowKind | null {
  return parseProductFlowKind(value);
}

export type ListAgentFlowsInput = {
  ownerUserId: string;
  workspaceId?: string;
  kind?: AgentFlowKind;
};

export async function listAgentFlows(
  input: ListAgentFlowsInput | string,
): Promise<PresentedAgentFlow[]> {
  const filter: ListAgentFlowsInput =
    typeof input === "string"
      ? { ownerUserId: "", workspaceId: input }
      : input;
  const workspaceId = optionalWorkspaceId(filter.workspaceId);
  const ownerUserId = String(filter.ownerUserId || "").trim();
  const kind = filter.kind;
  const [solve, calibration, verification] = await Promise.all([
    !kind || kind === "solve"
      ? workspaceId
        ? listSolveFlows(workspaceId)
        : listSolveFlowsForOwnerUserId(ownerUserId)
      : [],
    !kind || kind === "calibration"
      ? workspaceId
        ? listCalibrationFlows(workspaceId)
        : listCalibrationFlowsForOwnerUserId(ownerUserId)
      : [],
    !kind || kind === "verification"
      ? workspaceId
        ? listVerificationFlows(workspaceId)
        : listVerificationFlowsForOwnerUserId(ownerUserId)
      : [],
  ]);
  const presented = [
    ...solve.map(presentSolve),
    ...calibration.map(presentCalibration),
    ...verification.map(presentVerification),
  ];
  if (!ownerUserId) return presented;
  return presented.filter((flow) => flow.owner_user_id === ownerUserId);
}

export async function getAgentFlow(
  workspaceId: string | null | undefined,
  flowId: string,
  ownerUserId?: string,
): Promise<PresentedAgentFlow | null> {
  const mapId = optionalWorkspaceId(workspaceId);
  const owner = String(ownerUserId || "").trim();
  const solve = await getSolveFlowById(flowId);
  const calibration = await getCalibrationFlowById(flowId);
  const verification = await getVerificationFlowById(flowId);
  const presented = solve
    ? presentSolve(solve)
    : calibration
      ? presentCalibration(calibration)
      : verification
        ? presentVerification(verification)
        : null;
  if (!presented) return null;
  if (mapId && presented.workspace_id && presented.workspace_id !== mapId) return null;
  if (owner && presented.owner_user_id !== owner) return null;
  return presented;
}

export async function uploadAgentFlowFile(
  auth: AuthContext,
  body: Record<string, unknown>,
): Promise<FlowArtifact> {
  const owner = ownerUserId(auth);
  const workspaceId = optionalWorkspaceId(body.workspace_id || body.workspaceId);
  return uploadFlowArtifactBytes({
    fileName: String(body.fileName ?? body.file_name ?? body.name ?? ""),
    mimeType: String(body.mimeType ?? body.mime_type ?? ""),
    data: String(body.data ?? body.base64 ?? ""),
    userId: owner,
    workspaceId,
  });
}

export async function generateAgentFlowUnsysSeed(
  body: Record<string, unknown>,
): Promise<{ model: unknown; answers_model_seed: Record<string, unknown> | null }> {
  const result = await runProductFlowUnsysGenerate(body);
  if (!result.ok) throw new Error(result.error);
  return {
    model: result.model,
    answers_model_seed: serializeFlowUnsysSeed(flowUnsysSeedFromModel(result.model)),
  };
}

export async function createAgentFlow(
  auth: AuthContext,
  workspaceId: string | null | undefined,
  body: Record<string, unknown>,
): Promise<PresentedAgentFlow> {
  const kind = parseAgentFlowKind(body.kind);
  if (!kind) {
    throw new Error("kind must be solve, calibration, or verification");
  }
  const owner = ownerUserId(auth);
  const mapId =
    optionalWorkspaceId(workspaceId) ||
    optionalWorkspaceId(body.workspace_id || body.workspaceId);
  const name = String(body.name || "").trim();
  const problem = flowProblemFromUnknown(body);
  const artifacts = await resolveFlowArtifactsFromBody({
    artifacts: body.artifacts,
    files: body.files,
    userId: owner,
    workspaceId: mapId,
  });
  const answersModelSeed = await generateFlowUnsysSeedFromBody({
    ...body,
    kind,
    artifacts,
    problem: problem || name,
    topic: problem || name,
    goal: problem || name,
    name,
  });
  const draft = {
    ...emptyProductFlowDraft(kind),
    name,
    topic: problem,
    goal: problem,
    artifacts,
    actionCatalog: optionalNumber(body.action_catalog, body.actionCatalog) ?? 4,
    durationMinutes: optionalNumber(body.duration_minutes, body.durationMinutes) ?? 15,
    exactProblemOnCanvas: parseExactProblemOnCanvas(
      body.exact_problem_on_canvas ?? body.exactProblemOnCanvas,
    ),
    openingCanvasScene: parseFlowOpeningCanvasSceneForKind(
      kind,
      body.opening_canvas_scene ?? body.openingCanvasScene,
    ),
    answersModelSeed,
    enforcedChannels: parseFlowEnforcedChannels(
      body.enforced_channels ?? body.enforcedChannels,
    ),
  };
  const accepted = acceptProductFlowPublish(draft);
  if (!accepted.ok) throw new Error(publishReason(accepted.reason));

  if (kind === "solve") {
    const created = await runSolveCommand({
      type: "create",
      ownerUserId: owner,
      workspaceId: mapId,
      name: accepted.name,
      topic: accepted.topic,
      artifacts: accepted.artifacts,
      exactProblemOnCanvas: accepted.exactProblemOnCanvas,
      openingCanvasScene: accepted.openingCanvasScene,
      durationMinutes: accepted.durationMinutes,
      actionCatalog: accepted.actionCatalog,
      answersModelSeed: accepted.answersModelSeed,
      enforcedChannels: accepted.enforcedChannels,
    });
    if (!created.ok || !created.flow) {
      throw new Error(created.ok ? "create_failed" : created.reason);
    }
    return presentSolve(created.flow);
  }

  if (kind === "calibration") {
    const created = await runCalibrationCommand({
      type: "create",
      ownerUserId: owner,
      workspaceId: mapId,
      name: accepted.name,
      goal: accepted.goal,
      topic: accepted.topic,
      artifacts: accepted.artifacts,
      durationMinutes: accepted.durationMinutes,
      actionCatalog: accepted.actionCatalog,
      answersModelSeed: accepted.answersModelSeed,
      enforcedChannels: accepted.enforcedChannels,
    });
    if (!created.ok || !created.flow) {
      throw new Error(created.ok ? "create_failed" : created.reason);
    }
    return presentCalibration(created.flow);
  }

  const created = await runVerificationCommand({
    type: "create",
    ownerUserId: owner,
    workspaceId: mapId,
    name: accepted.name,
    topic: accepted.topic,
    artifacts: accepted.artifacts,
    exactProblemOnCanvas: accepted.exactProblemOnCanvas,
    openingCanvasScene: accepted.openingCanvasScene,
    durationMinutes: accepted.durationMinutes,
    actionCatalog: accepted.actionCatalog,
    answersModelSeed: accepted.answersModelSeed,
    enforcedChannels: accepted.enforcedChannels,
  });
  if (!created.ok || !created.flow) {
    throw new Error(created.ok ? "create_failed" : created.reason);
  }
  return presentVerification(created.flow);
}

export async function updateAgentFlow(
  auth: AuthContext,
  workspaceId: string | null | undefined,
  flowId: string,
  body: Record<string, unknown>,
): Promise<PresentedAgentFlow> {
  const owner = ownerUserId(auth);
  const existing = await getAgentFlow(workspaceId, flowId, owner);
  if (!existing) throw new Error("Flow not found.");
  const name = body.name === undefined ? undefined : String(body.name || "").trim();
  const problem =
    body.problem === undefined && body.topic === undefined && body.goal === undefined
      ? undefined
      : flowProblemFromUnknown(body);
  const artifacts =
    body.artifacts === undefined && body.files === undefined
      ? undefined
      : await resolveFlowArtifactsFromBody({
          artifacts: body.artifacts !== undefined ? body.artifacts : existing.artifacts,
          files: body.files,
          userId: owner,
          workspaceId: existing.workspace_id,
        });
  const durationMinutes = optionalNumber(body.duration_minutes, body.durationMinutes);
  const actionCatalog = optionalNumber(body.action_catalog, body.actionCatalog);
  const exactProblemOnCanvas = optionalBoolean(
    body.exact_problem_on_canvas,
    body.exactProblemOnCanvas,
  );
  const openingCanvasScene =
    body.opening_canvas_scene === undefined && body.openingCanvasScene === undefined
      ? undefined
      : parseFlowOpeningCanvasSceneForKind(
          existing.kind,
          body.opening_canvas_scene ?? body.openingCanvasScene,
        );
  const answersModelSeed =
    !requestHasUnsysSeed(body) && !wantsGenerateUnsys(body)
      ? undefined
      : await generateFlowUnsysSeedFromBody({
          ...body,
          kind: existing.kind,
          artifacts: artifacts ?? existing.artifacts,
          problem: problem || existing.topic || existing.goal || existing.name,
          topic: problem || existing.topic || existing.name,
          goal: problem || existing.goal || existing.topic || existing.name,
          name: name || existing.name,
        });
  const enforcedChannels =
    body.enforced_channels === undefined && body.enforcedChannels === undefined
      ? undefined
      : parseFlowEnforcedChannels(body.enforced_channels ?? body.enforcedChannels);

  if (existing.kind === "solve") {
    const updated = await runSolveCommand({
      type: "update",
      ownerUserId: owner,
      workspaceId: existing.workspace_id || undefined,
      flowId,
      name,
      topic: problem,
      artifacts,
      exactProblemOnCanvas,
      openingCanvasScene,
      durationMinutes,
      actionCatalog,
      answersModelSeed,
      enforcedChannels,
    });
    if (!updated.ok || !updated.flow) {
      throw new Error(updated.ok ? "update_failed" : updated.reason);
    }
    return presentSolve(updated.flow);
  }

  if (existing.kind === "calibration") {
    const updated = await runCalibrationCommand({
      type: "update",
      ownerUserId: owner,
      workspaceId: existing.workspace_id || undefined,
      flowId,
      name,
      goal: problem,
      topic: problem,
      artifacts,
      durationMinutes,
      actionCatalog,
      answersModelSeed,
      enforcedChannels,
    });
    if (!updated.ok || !updated.flow) {
      throw new Error(updated.ok ? "update_failed" : updated.reason);
    }
    return presentCalibration(updated.flow);
  }

  const updated = await runVerificationCommand({
    type: "update",
    ownerUserId: owner,
    workspaceId: existing.workspace_id || undefined,
    flowId,
    name,
    topic: problem,
    artifacts,
    exactProblemOnCanvas,
    openingCanvasScene,
    durationMinutes,
    actionCatalog,
    answersModelSeed,
    enforcedChannels,
  });
  if (!updated.ok || !updated.flow) {
    throw new Error(updated.ok ? "update_failed" : updated.reason);
  }
  return presentVerification(updated.flow);
}

function flowTileKind(kind: AgentFlowKind): AuthoringMapBlockKind {
  return kind;
}

export async function deleteAgentFlow(
  auth: AuthContext,
  flowId: string,
): Promise<{ deleted: true; flow_id: string; kind: AgentFlowKind }> {
  const owner = ownerUserId(auth);
  const existing = await getAgentFlow(undefined, flowId, owner);
  if (!existing) throw new Error("Flow not found.");
  if (existing.kind === "solve") {
    const removed = await runSolveCommand({
      type: "remove",
      ownerUserId: owner,
      workspaceId: existing.workspace_id || undefined,
      flowId,
    });
    if (!removed.ok) throw new Error(removed.reason);
  } else if (existing.kind === "calibration") {
    const removed = await runCalibrationCommand({
      type: "remove",
      ownerUserId: owner,
      workspaceId: existing.workspace_id || undefined,
      flowId,
    });
    if (!removed.ok) throw new Error(removed.reason);
  } else {
    const removed = await runVerificationCommand({
      type: "remove",
      ownerUserId: owner,
      workspaceId: existing.workspace_id || undefined,
      flowId,
    });
    if (!removed.ok) throw new Error(removed.reason);
  }
  return { deleted: true, flow_id: flowId, kind: existing.kind };
}

export async function linkAgentFlowToBlock(
  supabase: SupabaseClient,
  auth: AuthContext,
  workspaceId: string,
  flowId: string,
  blockId: string,
): Promise<{ flow: PresentedAgentFlow; block_id: string; map_block: Record<string, unknown> }> {
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) throw new Error("Workspace not found.");
  const flow = await getAgentFlow(undefined, flowId, ownerUserId(auth));
  if (!flow) throw new Error("Flow not found.");
  const blockIdTrim = String(blockId || "").trim();
  if (!blockIdTrim) throw new Error("block_id is required.");
  const blocks = await listWorkspaceBlocks(supabase, workspaceId);
  const block = blocks.find((row) => String(row.id) === blockIdTrim);
  if (!block) throw new Error("Block not found in this workspace.");
  const kind = flowTileKind(flow.kind);
  if (!isFlowMapBlockKind(kind)) throw new Error("Flow kind cannot be placed on a map tile.");
  const href =
    kind === "calibration"
      ? calibrationFlowPublicPath(flow.public_token)
      : kind === "verification"
        ? verificationFlowPublicPath(flow.public_token)
        : solveFlowPublicPath(flow.public_token);
  const mapBlock = {
    kind,
    flowId: flow.id,
    flowPublicToken: flow.public_token,
    flowHref: href,
    attachments: [],
  };
  const serialized = serializeMapBlock(mapBlock);
  if (!serialized) throw new Error("Failed to serialize map block.");
  const { error } = await supabase
    .from("blocks")
    .update({ [MAP_BLOCK_COLUMN]: serialized })
    .eq("id", blockIdTrim)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return { flow, block_id: blockIdTrim, map_block: serialized };
}
