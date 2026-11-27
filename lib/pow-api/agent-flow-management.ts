/**
 * Public agent protocol CRUD — same knowledge-verification store
 * as cookie `/api/dashboard/protocols`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { MAP_BLOCK_COLUMN, normalizeMapBlock, serializeMapBlock } from "@/lib/block-kind";
import {
  acceptProtocolPublish,
  emptyProtocolDraft,
  flowAuthoringSource,
  parseExactProblemOnCanvas,
  protocolChallengeFromUnknown,
  rejectedProtocolKind,
  type FlowAuthoringSource,
} from "@/lib/product-flow";
import {
  isProtocolSettingsError,
  parseProtocolSettingId,
} from "@/lib/organization/protocol-settings";
import { assertProtocolSettingInOrg } from "@/lib/organization/protocol-settings-store";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseFlowArtifacts,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import {
  resolveFlowArtifactsFromBody,
  uploadFlowArtifactBytes,
} from "@/lib/flow-artifact-upload";
import {
  parseFlowEnforcedChannels,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import {
  parseFlowCanvasCapture,
  type FlowCanvasCapture,
} from "@/lib/flow-canvas-capture";
import { parseFlowOpeningCanvasScene } from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import {
  flowUnsysSeedFromModel,
  serializeFlowUnsysSeed,
} from "@/lib/flow-unsys-seed";
import {
  generateFlowUnsysSeedFromBody,
  runProductFlowUnsysGenerate,
} from "@/lib/flow-unsys-generate";
import { requestHasUnsysSeed } from "@/lib/unsys-tree-spec";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import {
  getVerificationFlowById,
  listVerificationFlows,
  listVerificationFlowsForDashboard,
  listVerificationFlowsForOwnerUserId,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";
import type { AuthContext } from "./types";
import { listWorkspaceBlocks, loadManagedWorkspace } from "./workspace-management";

export type PresentedAgentProtocol = {
  id: string;
  name: string;
  challenge: string;
  questions: string[];
  artifacts: FlowArtifact[];
  duration_minutes: number | null;
  action_catalog: number | null;
  authoring_source: FlowAuthoringSource;
  exact_problem_on_canvas: boolean;
  generate_problem_on_open: boolean;
  opening_canvas_scene: IleWorkCanvasScene | null;
  answers_model_seed: Record<string, unknown> | null;
  enforced_channels: FlowEnforcedChannels;
  canvas_capture: FlowCanvasCapture;
  public_token: string;
  workspace_id: string | null;
  owner_user_id: string | null;
  organization_id: string | null;
  protocol_setting_id: string | null;
  created_at: string;
  updated_at: string;
};

/** @deprecated Use PresentedAgentProtocol. */
export type PresentedAgentFlow = PresentedAgentProtocol;

function ownerUserId(auth: AuthContext): string {
  const id = String(auth.user_id || "").trim();
  if (!id) throw new Error("No user available to own this protocol");
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
  challenge?: string | null;
  topic?: string | null;
  artifacts?: unknown;
  exactProblemOnCanvas?: boolean;
  generateProblemOnOpen?: boolean;
  openingCanvasScene?: unknown;
  answersModelSeed?: unknown;
  enforcedChannels?: unknown;
  canvasCapture?: unknown;
}): Pick<
  PresentedAgentProtocol,
  | "authoring_source"
  | "exact_problem_on_canvas"
  | "generate_problem_on_open"
  | "opening_canvas_scene"
  | "answers_model_seed"
  | "enforced_channels"
  | "canvas_capture"
> {
  const artifacts = parseFlowArtifacts(flow.artifacts);
  const openingCanvasScene = parseFlowOpeningCanvasScene(flow.openingCanvasScene);
  const generateProblemOnOpen = parseExactProblemOnCanvas(flow.generateProblemOnOpen);
  const authoring_source = flowAuthoringSource({
    challenge: flow.challenge,
    topic: flow.topic,
    generateProblemOnOpen,
    artifacts,
    openingCanvasScene,
  });
  return {
    authoring_source,
    exact_problem_on_canvas: parseExactProblemOnCanvas(flow.exactProblemOnCanvas),
    generate_problem_on_open: generateProblemOnOpen,
    opening_canvas_scene: openingCanvasScene,
    answers_model_seed: serializeFlowUnsysSeed(flow.answersModelSeed),
    enforced_channels: parseFlowEnforcedChannels(flow.enforcedChannels),
    canvas_capture: parseFlowCanvasCapture(flow.canvasCapture),
  };
}

export function presentAgentProtocol(flow: {
  id: string;
  name: string;
  topic: string;
  questions: unknown;
  artifacts?: FlowArtifact[];
  durationMinutes?: number;
  actionCatalog: number;
  exactProblemOnCanvas?: boolean;
  generateProblemOnOpen?: boolean;
  answersModelSeed?: unknown;
  enforcedChannels?: unknown;
  canvasCapture?: unknown;
  openingCanvasScene?: unknown;
  protocolSettingId?: string | null;
  publicToken: string;
  workspaceId: string;
  ownerUserId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}): PresentedAgentProtocol {
  const challenge = String(flow.topic || "").trim();
  return {
    id: flow.id,
    name: flow.name,
    challenge,
    questions: questionsFrom(flow.questions),
    artifacts: parseFlowArtifacts(flow.artifacts),
    duration_minutes: flow.durationMinutes ?? null,
    action_catalog: flow.actionCatalog,
    ...presentWizardFields({ ...flow, challenge, topic: challenge }),
    public_token: flow.publicToken,
    workspace_id: presentWorkspaceId(flow.workspaceId),
    owner_user_id: flow.ownerUserId || null,
    organization_id: presentWorkspaceId(flow.organizationId),
    protocol_setting_id: parseProtocolSettingId(flow.protocolSettingId),
    created_at: flow.createdAt,
    updated_at: flow.updatedAt,
  };
}

function publishReason(reason: string): string {
  if (reason === "name_required") return "name is required";
  if (reason === "challenge_required" || reason === "topic_required") {
    return "challenge is required";
  }
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

export function parseAgentFlowKind(value: unknown): null {
  void value;
  return null;
}

function assertNoRetiredKind(body: Record<string, unknown>): void {
  const kind = body.kind ?? body.type ?? body.product;
  if (rejectedProtocolKind(kind)) {
    throw new Error("Only knowledge verification protocols are supported");
  }
}

export type ListAgentProtocolsInput = {
  ownerUserId: string;
  workspaceId?: string;
  organizationId?: string | null;
};

export type ListAgentFlowsInput = ListAgentProtocolsInput & { kind?: unknown };

export async function listAgentProtocols(
  input: ListAgentProtocolsInput | string,
): Promise<PresentedAgentProtocol[]> {
  const filter: ListAgentProtocolsInput =
    typeof input === "string" ? { ownerUserId: "", workspaceId: input } : input;
  const workspaceId = optionalWorkspaceId(filter.workspaceId);
  const ownerUserId = String(filter.ownerUserId || "").trim();
  const organizationId = optionalWorkspaceId(filter.organizationId);
  const verification = workspaceId
    ? await listVerificationFlows(workspaceId)
    : organizationId
      ? await listVerificationFlowsForDashboard({
          ownerUserId,
          organizationId,
        })
      : await listVerificationFlowsForOwnerUserId(ownerUserId);
  const presented = verification.map(presentAgentProtocol);
  if (organizationId) {
    return presented.filter(
      (flow) => !flow.organization_id || flow.organization_id === organizationId,
    );
  }
  if (!ownerUserId) return presented;
  return presented.filter((flow) => flow.owner_user_id === ownerUserId);
}

export async function listAgentFlows(
  input: ListAgentFlowsInput | string,
): Promise<PresentedAgentProtocol[]> {
  if (typeof input !== "string" && rejectedProtocolKind(input.kind)) {
    throw new Error("Only knowledge verification protocols are supported");
  }
  return listAgentProtocols(input);
}

export async function getAgentProtocol(
  workspaceId: string | null | undefined,
  protocolId: string,
  ownerUserId?: string,
  organizationId?: string | null,
): Promise<PresentedAgentProtocol | null> {
  const mapId = optionalWorkspaceId(workspaceId);
  const owner = String(ownerUserId || "").trim();
  const org = optionalWorkspaceId(organizationId);
  const verification = await getVerificationFlowById(protocolId);
  const presented = verification ? presentAgentProtocol(verification) : null;
  if (!presented) return null;
  if (mapId && presented.workspace_id && presented.workspace_id !== mapId) return null;
  if (org) {
    if (presented.organization_id && presented.organization_id !== org) return null;
    if (!presented.organization_id && owner && presented.owner_user_id !== owner) return null;
    return presented;
  }
  if (owner && presented.owner_user_id !== owner) return null;
  return presented;
}

export async function getAgentFlow(
  workspaceId: string | null | undefined,
  flowId: string,
  ownerUserId?: string,
): Promise<PresentedAgentProtocol | null> {
  return getAgentProtocol(workspaceId, flowId, ownerUserId);
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

export async function createAgentProtocol(
  auth: AuthContext,
  workspaceId: string | null | undefined,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<PresentedAgentProtocol> {
  assertNoRetiredKind(body);
  const owner = ownerUserId(auth);
  const mapId =
    optionalWorkspaceId(workspaceId) ||
    optionalWorkspaceId(body.workspace_id || body.workspaceId);
  const name = String(body.name || "").trim();
  const challenge = protocolChallengeFromUnknown(body);
  const artifacts = await resolveFlowArtifactsFromBody({
    artifacts: body.artifacts,
    files: body.files,
    userId: owner,
    workspaceId: mapId,
  });
  const answersModelSeed = await generateFlowUnsysSeedFromBody({
    ...body,
    artifacts,
    problem: challenge || name,
    topic: challenge || name,
    challenge: challenge || name,
    name,
  });
  const draft = {
    ...emptyProtocolDraft(),
    name,
    challenge,
    artifacts,
    actionCatalog: optionalNumber(body.action_catalog, body.actionCatalog) ?? 4,
    durationMinutes: optionalNumber(body.duration_minutes, body.durationMinutes) ?? 15,
    exactProblemOnCanvas: parseExactProblemOnCanvas(
      body.exact_problem_on_canvas ?? body.exactProblemOnCanvas,
    ),
    openingCanvasScene: parseFlowOpeningCanvasScene(
      body.opening_canvas_scene ?? body.openingCanvasScene,
    ),
    generateProblemOnOpen: parseExactProblemOnCanvas(
      body.generate_problem_on_open ?? body.generateProblemOnOpen,
    ),
    answersModelSeed,
    enforcedChannels: parseFlowEnforcedChannels(
      body.enforced_channels ?? body.enforcedChannels,
    ),
    canvasCapture: parseFlowCanvasCapture(body.canvas_capture ?? body.canvasCapture),
    protocolSettingId: parseProtocolSettingId(
      body.protocol_setting_id ?? body.protocolSettingId,
    ),
  };
  const accepted = acceptProtocolPublish(draft);
  if (!accepted.ok) throw new Error(publishReason(accepted.reason));
  let protocolSettingId = accepted.protocolSettingId;
  try {
    protocolSettingId = await assertProtocolSettingInOrg(
      createAdminClient(),
      organizationId,
      accepted.protocolSettingId,
    );
  } catch (error) {
    if (isProtocolSettingsError(error)) throw new Error(error.message);
    throw error;
  }

  const created = await runVerificationCommand({
    type: "create",
    ownerUserId: owner,
    organizationId,
    workspaceId: mapId,
    name: accepted.name,
    topic: accepted.challenge,
    artifacts: accepted.artifacts,
    exactProblemOnCanvas: accepted.exactProblemOnCanvas,
    openingCanvasScene: accepted.openingCanvasScene,
    generateProblemOnOpen: accepted.generateProblemOnOpen,
    durationMinutes: accepted.durationMinutes,
    actionCatalog: accepted.actionCatalog,
    answersModelSeed: accepted.answersModelSeed,
    enforcedChannels: accepted.enforcedChannels,
    canvasCapture: accepted.canvasCapture,
    protocolSettingId,
  });
  if (!created.ok || !created.flow) {
    throw new Error(created.ok ? "create_failed" : created.reason);
  }
  return presentAgentProtocol(created.flow);
}

export async function createAgentFlow(
  auth: AuthContext,
  workspaceId: string | null | undefined,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<PresentedAgentProtocol> {
  return createAgentProtocol(auth, workspaceId, body, organizationId);
}

export async function updateAgentProtocol(
  auth: AuthContext,
  workspaceId: string | null | undefined,
  protocolId: string,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<PresentedAgentProtocol> {
  assertNoRetiredKind(body);
  const owner = ownerUserId(auth);
  const existing = await getAgentProtocol(workspaceId, protocolId, owner, organizationId);
  if (!existing) throw new Error("Protocol not found.");
  const name = body.name === undefined ? undefined : String(body.name || "").trim();
  const challenge =
    body.challenge === undefined &&
    body.problem === undefined &&
    body.topic === undefined &&
    body.goal === undefined
      ? undefined
      : protocolChallengeFromUnknown(body);
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
  const generateProblemOnOpen = optionalBoolean(
    body.generate_problem_on_open,
    body.generateProblemOnOpen,
  );
  const openingCanvasScene =
    body.opening_canvas_scene === undefined && body.openingCanvasScene === undefined
      ? undefined
      : parseFlowOpeningCanvasScene(
          body.opening_canvas_scene ?? body.openingCanvasScene,
        );
  const answersModelSeed =
    !requestHasUnsysSeed(body) && !wantsGenerateUnsys(body)
      ? undefined
      : await generateFlowUnsysSeedFromBody({
          ...body,
          artifacts: artifacts ?? existing.artifacts,
          problem: challenge || existing.challenge || existing.name,
          topic: challenge || existing.challenge || existing.name,
          challenge: challenge || existing.challenge || existing.name,
          name: name || existing.name,
        });
  const enforcedChannels =
    body.enforced_channels === undefined && body.enforcedChannels === undefined
      ? undefined
      : parseFlowEnforcedChannels(body.enforced_channels ?? body.enforcedChannels);
  const canvasCapture =
    body.canvas_capture === undefined && body.canvasCapture === undefined
      ? undefined
      : parseFlowCanvasCapture(body.canvas_capture ?? body.canvasCapture);
  const protocolSettingIdRaw =
    body.protocol_setting_id === undefined && body.protocolSettingId === undefined
      ? undefined
      : parseProtocolSettingId(body.protocol_setting_id ?? body.protocolSettingId);
  let protocolSettingId = protocolSettingIdRaw;
  if (protocolSettingIdRaw !== undefined) {
    try {
      protocolSettingId = await assertProtocolSettingInOrg(
        createAdminClient(),
        organizationId,
        protocolSettingIdRaw,
      );
    } catch (error) {
      if (isProtocolSettingsError(error)) throw new Error(error.message);
      throw error;
    }
  }

  const updated = await runVerificationCommand({
    type: "update",
    ownerUserId: owner,
    workspaceId: existing.workspace_id || undefined,
    flowId: protocolId,
    name,
    topic: challenge,
    artifacts,
    exactProblemOnCanvas,
    openingCanvasScene,
    generateProblemOnOpen,
    durationMinutes,
    actionCatalog,
    answersModelSeed,
    enforcedChannels,
    canvasCapture,
    protocolSettingId,
  });
  if (!updated.ok || !updated.flow) {
    throw new Error(updated.ok ? "update_failed" : updated.reason);
  }
  return presentAgentProtocol(updated.flow);
}

export async function updateAgentFlow(
  auth: AuthContext,
  workspaceId: string | null | undefined,
  flowId: string,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<PresentedAgentProtocol> {
  return updateAgentProtocol(auth, workspaceId, flowId, body, organizationId);
}

export async function deleteAgentProtocol(
  auth: AuthContext,
  protocolId: string,
  organizationId: string,
): Promise<{ deleted: true; protocol_id: string }> {
  const owner = ownerUserId(auth);
  const existing = await getAgentProtocol(undefined, protocolId, owner, organizationId);
  if (!existing) throw new Error("Protocol not found.");
  const removed = await runVerificationCommand({
    type: "remove",
    ownerUserId: owner,
    workspaceId: existing.workspace_id || undefined,
    flowId: protocolId,
  });
  if (!removed.ok) throw new Error(removed.reason);
  return { deleted: true, protocol_id: protocolId };
}

export async function deleteAgentFlow(
  auth: AuthContext,
  flowId: string,
  organizationId: string,
): Promise<{ deleted: true; protocol_id: string; flow_id: string }> {
  const result = await deleteAgentProtocol(auth, flowId, organizationId);
  return { ...result, flow_id: result.protocol_id };
}

export async function linkAgentFlowToBlock(
  supabase: SupabaseClient,
  auth: AuthContext,
  workspaceId: string,
  flowId: string,
  blockId: string,
): Promise<{
  protocol: PresentedAgentProtocol;
  flow: PresentedAgentProtocol;
  block_id: string;
  map_block: Record<string, unknown>;
}> {
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) throw new Error("Workspace not found.");
  const flow = await getAgentProtocol(undefined, flowId, ownerUserId(auth));
  if (!flow) throw new Error("Protocol not found.");
  const blockIdTrim = String(blockId || "").trim();
  if (!blockIdTrim) throw new Error("block_id is required.");
  const blocks = await listWorkspaceBlocks(supabase, workspaceId);
  const block = blocks.find((row) => String(row.id) === blockIdTrim);
  if (!block) throw new Error("Block not found in this workspace.");
  const href = verificationFlowPublicPath(flow.public_token);
  const mapBlock = normalizeMapBlock({
    kind: "verification",
    flowId: flow.id,
    flowPublicToken: flow.public_token,
    flowHref: href,
    attachments: [],
  });
  const serialized = serializeMapBlock(mapBlock);
  if (!serialized) throw new Error("Failed to serialize map block.");
  const { error } = await supabase
    .from("blocks")
    .update({ [MAP_BLOCK_COLUMN]: serialized })
    .eq("id", blockIdTrim)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return { protocol: flow, flow, block_id: blockIdTrim, map_block: serialized };
}
