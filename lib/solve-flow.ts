/**
 * Owner-scoped Solve flows: name + topic, unique identity, then a Learn
 * work-canvas run attached to the flow.
 */

import { normalizeFlowName } from "@/lib/product-flow";
import {
  parseFlowArtifacts,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
import { acceptParticipantIdentity } from "@/lib/verification-flow";
import {
  isMapLearnSession,
  isSolveSession,
  parseSessionKind,
  parseSessionResult,
  type SessionResult,
} from "@/lib/core-data-model";
import { archiveFlowStamp, publicInviteClaimReason } from "@/lib/flow-archive";

export type SolveFlow = {
  id: string;
  workspaceId: string;
  ownerUserId?: string;
  name: string;
  topic: string;
  artifacts: FlowArtifact[];
  durationMinutes: number;
  actionCatalog: LearningModelSize;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  practiceProblemId?: string | null;
};

export type SolveIdentity = {
  flowId: string;
  identity: string;
};

export type SolveState = {
  flows: SolveFlow[];
  identities: SolveIdentity[];
};

export function emptySolveState(): SolveState {
  return { flows: [], identities: [] };
}

export function completeSolveState(state: Partial<SolveState> | null | undefined): SolveState {
  return {
    flows: Array.isArray(state?.flows) ? state.flows : [],
    identities: Array.isArray(state?.identities) ? state.identities : [],
  };
}

export function solveFlowPublicPath(token: string): string {
  return `/s/${encodeURIComponent(token)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `solve_${Math.random().toString(36).slice(2, 12)}`;
}

export function createSolvePublicToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function acceptSolveDraft(input: {
  name?: unknown;
  topic?: unknown;
  problem?: unknown;
  artifacts?: unknown;
}): { ok: true; name: string; topic: string; artifacts: FlowArtifact[] } | { ok: false; reason: string } {
  const topic = String(input.problem ?? input.topic ?? "").trim();
  if (!topic) return { ok: false, reason: "topic_required" };
  const name = normalizeFlowName(input.name, topic);
  if (!name) return { ok: false, reason: "name_required" };
  return { ok: true, name, topic, artifacts: parseFlowArtifacts(input.artifacts) };
}

function commandOwnsFlow(
  flow: { workspaceId: string; ownerUserId?: string },
  command: { workspaceId?: string | null; ownerUserId?: string | null },
): boolean {
  const owner = String(command.ownerUserId || "").trim();
  if (owner) return String(flow.ownerUserId || "").trim() === owner;
  const workspaceId = String(command.workspaceId || "").trim();
  return Boolean(workspaceId) && flow.workspaceId === workspaceId;
}

export type SolveCommand =
  | {
      type: "create";
      workspaceId?: string;
      ownerUserId?: string;
      name?: string;
      topic?: string;
      problem?: string;
      artifacts?: unknown;
      durationMinutes?: number;
      actionCatalog?: number;
      id?: string;
      publicToken?: string;
      practiceProblemId?: string | null;
    }
  | {
      type: "update";
      workspaceId?: string;
      ownerUserId?: string;
      flowId: string;
      name?: string;
      topic?: string;
      problem?: string;
      artifacts?: unknown;
      durationMinutes?: number;
      actionCatalog?: number;
    }
  | { type: "remove"; workspaceId?: string; ownerUserId?: string; flowId: string }
  | { type: "claim"; flowId: string; identity: string; runnerUserId?: string | null };

export type SolveCommandResult =
  | { ok: true; state: SolveState; flow?: SolveFlow; identity?: string }
  | { ok: false; reason: string; state: SolveState };

export function applySolveCommand(
  state: SolveState,
  command: SolveCommand,
): SolveCommandResult {
  if (command.type === "create") {
    const accepted = acceptSolveDraft({
      name: command.name,
      topic: command.topic,
      problem: command.problem,
      artifacts: command.artifacts,
    });
    if (!accepted.ok) return { ok: false, reason: accepted.reason, state };
    const ownerUserId = String(command.ownerUserId || "").trim();
    if (!ownerUserId && !String(command.workspaceId || "").trim()) {
      return { ok: false, reason: "owner_required", state };
    }
    const flow: SolveFlow = {
      id: command.id || makeId(),
      workspaceId: String(command.workspaceId || ""),
      ownerUserId: ownerUserId || undefined,
      name: accepted.name,
      topic: accepted.topic,
      artifacts: accepted.artifacts,
      durationMinutes: flowCountdownMinutes(command.durationMinutes),
      actionCatalog: parseLearningModelSize(command.actionCatalog),
      publicToken: command.publicToken || createSolvePublicToken(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      practiceProblemId: String(command.practiceProblemId || "").trim() || null,
    };
    return { ok: true, state: { ...state, flows: [...state.flows, flow] }, flow };
  }

  if (command.type === "update") {
    const current = state.flows.find((flow) => flow.id === command.flowId);
    if (!current) return { ok: false, reason: "not_found", state };
    if (!commandOwnsFlow(current, command)) {
      return { ok: false, reason: "wrong_workspace", state };
    }
    const topic =
      command.topic === undefined && command.problem === undefined
        ? current.topic
        : String(command.problem ?? command.topic ?? "").trim();
    if (!topic) return { ok: false, reason: "topic_required", state };
    const flow: SolveFlow = {
      ...current,
      name:
        command.name === undefined
          ? normalizeFlowName(current.name, topic)
          : normalizeFlowName(command.name, topic),
      topic,
      artifacts:
        command.artifacts === undefined
          ? parseFlowArtifacts(current.artifacts)
          : parseFlowArtifacts(command.artifacts),
      durationMinutes:
        command.durationMinutes === undefined
          ? flowCountdownMinutes(current.durationMinutes)
          : flowCountdownMinutes(command.durationMinutes),
      actionCatalog:
        command.actionCatalog === undefined
          ? parseLearningModelSize(current.actionCatalog)
          : parseLearningModelSize(command.actionCatalog),
      updatedAt: nowIso(),
    };
    return {
      ok: true,
      state: {
        ...state,
        flows: state.flows.map((item) => (item.id === flow.id ? flow : item)),
      },
      flow,
    };
  }

  if (command.type === "remove") {
    const current = state.flows.find((flow) => flow.id === command.flowId);
    if (!current) return { ok: false, reason: "not_found", state };
    if (!commandOwnsFlow(current, command)) {
      return { ok: false, reason: "wrong_workspace", state };
    }
    const flow: SolveFlow = {
      ...current,
      ...archiveFlowStamp(),
      updatedAt: nowIso(),
    };
    return {
      ok: true,
      flow,
      state: {
        ...state,
        flows: state.flows.map((item) => (item.id === flow.id ? flow : item)),
      },
    };
  }

  const flow = state.flows.find((item) => item.id === command.flowId);
  if (!flow) return { ok: false, reason: "not_found", state };
  const archived = publicInviteClaimReason(flow);
  if (archived) return { ok: false, reason: archived, state };
  const existing = state.identities
    .filter((item) => item.flowId === flow.id)
    .map((item) => item.identity);
  const decision = acceptParticipantIdentity(command.identity, existing);
  if (!decision.ok) return { ok: false, reason: decision.reason, state };
  return {
    ok: true,
    identity: decision.identity,
    state: {
      ...state,
      identities: [...state.identities, { flowId: flow.id, identity: decision.identity }],
    },
  };
}

export function flowByPublicToken(state: SolveState, token: string): SolveFlow | null {
  const value = String(token || "").trim();
  if (!value) return null;
  return state.flows.find((flow) => flow.publicToken === value) || null;
}

/**
 * Distinguish a Solve run from a map Learn session and from verify/calibrate.
 * Uses the shipped session kind + parent-id helpers.
 */
export function solveRunParent(row: {
  kind?: unknown;
  solve_flow_id?: unknown;
  solveFlowId?: unknown;
  calibrate_flow_id?: unknown;
  verify_flow_id?: unknown;
  result?: unknown;
}): {
  kind: "solve" | "learn" | "calibrate" | "verify" | null;
  solveFlowId: string | null;
} {
  const solveFlowId = String(row.solve_flow_id ?? row.solveFlowId ?? "").trim() || null;
  if (isSolveSession(row)) {
    return { kind: "solve", solveFlowId };
  }
  if (isMapLearnSession(row)) {
    return { kind: "learn", solveFlowId: null };
  }
  const parsed = parseSessionKind(row.kind);
  if (parsed === "calibrate" || parsed === "verify") {
    return { kind: parsed, solveFlowId: null };
  }
  const result = parseSessionResult(row.result) as SessionResult | null;
  if (result?.kind === "calibrate" || result?.kind === "verify" || result?.kind === "learn") {
    return { kind: result.kind, solveFlowId: null };
  }
  return { kind: parsed, solveFlowId };
}
