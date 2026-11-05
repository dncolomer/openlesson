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
import { parseProductFlowKind, type ProductFlowKind } from "@/lib/product-flow";
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
  duration_minutes: number | null;
  action_catalog: number | null;
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

function presentSolve(flow: {
  id: string;
  name: string;
  topic: string;
  durationMinutes: number;
  actionCatalog: number;
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
    duration_minutes: flow.durationMinutes,
    action_catalog: flow.actionCatalog,
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
  questions: unknown;
  durationMinutes: number;
  actionCatalog: number;
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
    topic: null,
    goal: flow.goal,
    questions: questionsFrom(flow.questions),
    duration_minutes: flow.durationMinutes,
    action_catalog: flow.actionCatalog,
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
  durationMinutes?: number;
  actionCatalog: number;
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
    duration_minutes: flow.durationMinutes ?? null,
    action_catalog: flow.actionCatalog,
    public_token: flow.publicToken,
    workspace_id: presentWorkspaceId(flow.workspaceId),
    owner_user_id: flow.ownerUserId || null,
    created_at: flow.createdAt,
    updated_at: flow.updatedAt,
  };
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
  const topic = String(body.topic || name).trim() || name;
  const goal = String(body.goal || topic).trim() || topic;
  const questions = questionsFrom(body.questions);
  const durationMinutes =
    typeof body.duration_minutes === "number"
      ? body.duration_minutes
      : typeof body.durationMinutes === "number"
        ? body.durationMinutes
        : undefined;
  const actionCatalog =
    typeof body.action_catalog === "number"
      ? body.action_catalog
      : typeof body.actionCatalog === "number"
        ? body.actionCatalog
        : undefined;

  if (kind === "solve") {
    if (!topic) throw new Error("topic is required for Solve flows");
    const created = await runSolveCommand({
      type: "create",
      ownerUserId: owner,
      workspaceId: mapId,
      name: name || topic,
      topic,
      durationMinutes,
      actionCatalog,
    });
    if (!created.ok || !created.flow) {
      throw new Error(created.ok ? "create_failed" : created.reason);
    }
    return presentSolve(created.flow);
  }

  if (kind === "calibration") {
    const pool = questions.length ? questions : [goal];
    if (!goal) throw new Error("goal is required for Calibration flows");
    const created = await runCalibrationCommand({
      type: "create",
      ownerUserId: owner,
      workspaceId: mapId,
      name: name || goal,
      goal,
      questions: pool,
      durationMinutes,
      actionCatalog,
    });
    if (!created.ok || !created.flow) {
      throw new Error(created.ok ? "create_failed" : created.reason);
    }
    return presentCalibration(created.flow);
  }

  const pool = questions.length ? questions : [topic];
  if (!topic) throw new Error("topic is required for Verification flows");
  const created = await runVerificationCommand({
    type: "create",
    ownerUserId: owner,
    workspaceId: mapId,
    name: name || topic,
    topic,
    questions: pool,
    durationMinutes,
    actionCatalog,
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
  const topic = body.topic === undefined ? undefined : String(body.topic || "").trim();
  const goal = body.goal === undefined ? undefined : String(body.goal || "").trim();
  const questions = body.questions === undefined ? undefined : questionsFrom(body.questions);
  const durationMinutes =
    body.duration_minutes === undefined && body.durationMinutes === undefined
      ? undefined
      : Number(body.duration_minutes ?? body.durationMinutes);
  const actionCatalog =
    body.action_catalog === undefined && body.actionCatalog === undefined
      ? undefined
      : Number(body.action_catalog ?? body.actionCatalog);

  if (existing.kind === "solve") {
    const updated = await runSolveCommand({
      type: "update",
      ownerUserId: owner,
      workspaceId: existing.workspace_id || undefined,
      flowId,
      name,
      topic,
      durationMinutes,
      actionCatalog,
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
      goal,
      questions,
      durationMinutes,
      actionCatalog,
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
    topic,
    questions,
    durationMinutes,
    actionCatalog,
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
