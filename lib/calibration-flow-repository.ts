/**
 * Persistence for calibration flows.
 * Supabase is used when the service role and the flows table are available.
 * Otherwise one process-wide reducer keeps the flows. Proof rows are calibration
 * canvas events, not verification-flow results.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyCalibrationCommand,
  completeCalibrationState,
  emptyCalibrationState,
  flowByPublicToken,
  type CalibrationCommand,
  type CalibrationCommandResult,
  type CalibrationFlow,
  type CalibrationProof,
  type CalibrationState,
} from "@/lib/calibration-flow";
import { normalizeCalibrateQuestions } from "@/lib/calibrate-session";

const CALIBRATION_FLOW_GLOBAL = "__openlessonCalibrationFlowRepository";

type CalibrationRepositoryGlobal = {
  memory: CalibrationState;
  backend: "unknown" | "supabase" | "memory";
};

function calibrationRepositoryGlobal(): CalibrationRepositoryGlobal {
  const scope = globalThis as typeof globalThis & {
    [CALIBRATION_FLOW_GLOBAL]?: CalibrationRepositoryGlobal;
  };
  if (!scope[CALIBRATION_FLOW_GLOBAL]) {
    scope[CALIBRATION_FLOW_GLOBAL] = {
      memory: emptyCalibrationState(),
      backend: "unknown",
    };
  }
  return scope[CALIBRATION_FLOW_GLOBAL];
}

export function resetCalibrationFlowRepository(): void {
  const store = calibrationRepositoryGlobal();
  store.memory = emptyCalibrationState();
  store.backend = "unknown";
}

function memoryState(): CalibrationState {
  const store = calibrationRepositoryGlobal();
  const current = store.memory;
  if (
    !current ||
    !Array.isArray(current.flows) ||
    !Array.isArray(current.identities) ||
    !Array.isArray(current.proofs)
  ) {
    store.memory = completeCalibrationState(current);
  }
  return store.memory;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function resolveBackend(): Promise<"supabase" | "memory"> {
  const store = calibrationRepositoryGlobal();
  if (store.backend !== "unknown") return store.backend;
  if (!supabaseConfigured()) {
    store.backend = "memory";
    return store.backend;
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("workspace_calibration_flows").select("id").limit(1);
    store.backend = error ? "memory" : "supabase";
  } catch {
    store.backend = "memory";
  }
  return store.backend;
}

function mapFlow(row: Record<string, unknown>): CalibrationFlow {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    goal: String(row.goal || ""),
    questions: normalizeCalibrateQuestions(row.questions),
    publicToken: String(row.public_token || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapProof(row: Record<string, unknown>): CalibrationProof {
  const events = Array.isArray(row.events) ? row.events : [];
  return {
    id: String(row.id),
    flowId: String(row.flow_id),
    workspaceId: String(row.workspace_id),
    identity: String(row.identity || ""),
    events: events as CalibrationProof["events"],
    createdAt: String(row.created_at || ""),
  };
}

async function loadSupabaseState(filter: {
  workspaceId?: string;
  flowId?: string;
  publicToken?: string;
}): Promise<CalibrationState> {
  const supabase = createAdminClient();
  let flowQuery = supabase.from("workspace_calibration_flows").select("*");
  if (filter.flowId) flowQuery = flowQuery.eq("id", filter.flowId);
  else if (filter.publicToken) flowQuery = flowQuery.eq("public_token", filter.publicToken);
  else if (filter.workspaceId) flowQuery = flowQuery.eq("workspace_id", filter.workspaceId);
  const { data: flowRows, error } = await flowQuery;
  if (error) throw new Error(error.message);
  const flows = (flowRows || []).map((row) => mapFlow(row as Record<string, unknown>));
  const ids = flows.map((flow) => flow.id);
  if (ids.length === 0) return emptyCalibrationState();
  const [{ data: identityRows }, { data: proofRows }] = await Promise.all([
    supabase.from("workspace_calibration_identities").select("*").in("flow_id", ids),
    supabase.from("workspace_calibration_proofs").select("*").in("flow_id", ids),
  ]);
  return {
    flows,
    identities: (identityRows || []).map((row) => ({
      flowId: String((row as { flow_id: string }).flow_id),
      identity: String((row as { identity: string }).identity),
    })),
    proofs: (proofRows || []).map((row) => mapProof(row as Record<string, unknown>)),
  };
}

async function persistCommand(
  command: CalibrationCommand,
  value: Extract<CalibrationCommandResult, { ok: true }>,
): Promise<void> {
  const supabase = createAdminClient();
  if (command.type === "create" && value.flow) {
    const { error } = await supabase.from("workspace_calibration_flows").insert({
      id: value.flow.id,
      workspace_id: value.flow.workspaceId,
      goal: value.flow.goal,
      questions: value.flow.questions,
      public_token: value.flow.publicToken,
      created_at: value.flow.createdAt,
      updated_at: value.flow.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "update" && value.flow) {
    const { error } = await supabase
      .from("workspace_calibration_flows")
      .update({
        goal: value.flow.goal,
        questions: value.flow.questions,
        updated_at: value.flow.updatedAt,
      })
      .eq("id", value.flow.id);
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "remove") {
    const { error } = await supabase.from("workspace_calibration_flows").delete().eq("id", command.flowId);
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "claim" && value.identity) {
    const { error } = await supabase.from("workspace_calibration_identities").insert({
      flow_id: command.flowId,
      identity: value.identity,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "addProof" && value.proof) {
    const { error } = await supabase.from("workspace_calibration_proofs").insert({
      id: value.proof.id,
      flow_id: value.proof.flowId,
      workspace_id: value.proof.workspaceId,
      identity: value.proof.identity,
      events: value.proof.events,
      created_at: value.proof.createdAt,
    });
    if (error) throw new Error(error.message);
  }
}

async function stateFor(command: CalibrationCommand): Promise<CalibrationState> {
  if ((await resolveBackend()) === "memory") return memoryState();
  if (command.type === "create") return loadSupabaseState({ workspaceId: command.workspaceId });
  if (command.type === "addProof") return loadSupabaseState({ flowId: command.flowId });
  return loadSupabaseState({ flowId: command.flowId });
}

export async function runCalibrationCommand(
  command: CalibrationCommand,
): Promise<CalibrationCommandResult> {
  const state = await stateFor(command);
  const next = applyCalibrationCommand(state, command);
  if (!next.ok) return next;
  if ((await resolveBackend()) === "memory") {
    calibrationRepositoryGlobal().memory = completeCalibrationState(next.state);
    return next;
  }
  await persistCommand(command, next);
  return next;
}

export async function listCalibrationFlows(workspaceId: string): Promise<CalibrationFlow[]> {
  if ((await resolveBackend()) === "memory") {
    return memoryState().flows.filter((flow) => flow.workspaceId === workspaceId);
  }
  const state = await loadSupabaseState({ workspaceId });
  return state.flows;
}

export async function getCalibrationFlowByToken(token: string): Promise<CalibrationFlow | null> {
  if ((await resolveBackend()) === "memory") {
    return flowByPublicToken(memoryState(), token);
  }
  const state = await loadSupabaseState({ publicToken: token });
  return flowByPublicToken(state, token);
}

export async function claimCalibrationIdentity(token: string, identity: string) {
  const flow = await getCalibrationFlowByToken(token);
  if (!flow) return { ok: false as const, reason: "not_found" };
  const claimed = await runCalibrationCommand({ type: "claim", flowId: flow.id, identity });
  if (!claimed.ok) return { ok: false as const, reason: claimed.reason };
  return { ok: true as const, flow, identity: claimed.identity };
}

export async function addCalibrationProof(token: string, events: unknown, identity: string) {
  const flow = await getCalibrationFlowByToken(token);
  if (!flow) return { ok: false as const, reason: "not_found" };
  return runCalibrationCommand({ type: "addProof", flowId: flow.id, identity, events });
}
