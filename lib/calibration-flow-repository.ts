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
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import { parseLearningModelSize } from "@/lib/learning-model";

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
    const { error } = await supabase.from("calibrate_flows").select("id").limit(1);
    store.backend = error ? "memory" : "supabase";
  } catch {
    store.backend = "memory";
  }
  return store.backend;
}

function nullableId(value: unknown): string | null {
  const id = String(value || "").trim();
  return id || null;
}

function mapFlow(row: Record<string, unknown>): CalibrationFlow {
  const goal = String(row.goal || "");
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id || ""),
    ownerUserId: String(row.owner_user_id || ""),
    name: String(row.name || "").trim() || goal,
    goal,
    questions: normalizeCalibrateQuestions(row.questions),
    durationMinutes: flowCountdownMinutes(row.duration_minutes),
    actionCatalog: parseLearningModelSize(row.action_catalog),
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
    workspaceId: String(row.workspace_id || ""),
    identity: String(row.identity || ""),
    events: events as CalibrationProof["events"],
    createdAt: String(row.created_at || ""),
  };
}

async function loadSupabaseState(filter: {
  workspaceId?: string;
  ownerUserId?: string;
  flowId?: string;
  publicToken?: string;
}): Promise<CalibrationState> {
  const supabase = createAdminClient();
  let flowQuery = supabase.from("calibrate_flows").select("*");
  if (filter.flowId) flowQuery = flowQuery.eq("id", filter.flowId);
  else if (filter.publicToken) flowQuery = flowQuery.eq("public_token", filter.publicToken);
  else if (filter.ownerUserId) flowQuery = flowQuery.eq("owner_user_id", filter.ownerUserId);
  else if (filter.workspaceId) return emptyCalibrationState();
  const { data: flowRows, error } = await flowQuery;
  if (error) throw new Error(error.message);
  const flows = (flowRows || []).map((row) => mapFlow(row as Record<string, unknown>));
  const ids = flows.map((flow) => flow.id);
  if (ids.length === 0) return emptyCalibrationState();
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, calibrate_flow_id, identity, result, guest_link, created_at, workspace_id")
    .eq("kind", "calibrate")
    .in("calibrate_flow_id", ids);
  const identityRows = (sessionRows || [])
    .filter((row) => row.identity)
    .map((row) => ({ flow_id: row.calibrate_flow_id, identity: row.identity }));
  const proofRows = (sessionRows || [])
    .filter((row) => row.guest_link || row.result)
    .map((row) => ({
      id: row.id,
      flow_id: row.calibrate_flow_id,
      workspace_id: row.workspace_id,
      identity: row.identity,
      events:
        (row.guest_link as { events?: unknown } | null)?.events ||
        (row.result as { legacyEvents?: unknown } | null)?.legacyEvents ||
        [],
      created_at: row.created_at,
    }));
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
    const { error } = await insertFlowRow(supabase, "calibrate_flows", {
      id: value.flow.id,
      owner_user_id: nullableId(value.flow.ownerUserId),
      name: value.flow.name,
      goal: value.flow.goal,
      questions: value.flow.questions,
      duration_minutes: value.flow.durationMinutes,
      action_catalog: value.flow.actionCatalog,
      public_token: value.flow.publicToken,
      created_at: value.flow.createdAt,
      updated_at: value.flow.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "update" && value.flow) {
    const { error } = await updateFlowRow(supabase, "calibrate_flows", value.flow.id, {
      name: value.flow.name,
      goal: value.flow.goal,
      questions: value.flow.questions,
      duration_minutes: value.flow.durationMinutes,
      action_catalog: value.flow.actionCatalog,
      updated_at: value.flow.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "remove") {
    const { error } = await supabase.from("calibrate_flows").delete().eq("id", command.flowId);
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "claim" && value.identity) {
    const { data: flow } = await supabase
      .from("calibrate_flows")
      .select("owner_user_id")
      .eq("id", command.flowId)
      .maybeSingle();
    const { error } = await supabase.from("sessions").insert({
      kind: "calibrate",
      problem: "Calibrate",
      status: "pending",
      user_id: flow?.owner_user_id,
      calibrate_flow_id: command.flowId,
      identity: value.identity,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "addProof" && value.proof) {
    const { data: flow } = await supabase
      .from("calibrate_flows")
      .select("owner_user_id")
      .eq("id", value.proof.flowId)
      .maybeSingle();
    const { error } = await supabase.from("sessions").insert({
      id: value.proof.id,
      user_id: flow?.owner_user_id,
      problem: "Calibrate",
      status: "completed",
      kind: "calibrate",
      calibrate_flow_id: value.proof.flowId,
      identity: value.proof.identity,
      result: { kind: "calibrate", legacyEvents: value.proof.events },
      guest_link: { events: value.proof.events, source: "calibration_proof" },
      created_at: value.proof.createdAt,
    });
    if (error) throw new Error(error.message);
  }
}

async function stateFor(command: CalibrationCommand): Promise<CalibrationState> {
  if ((await resolveBackend()) === "memory") return memoryState();
  if (command.type === "create") {
    return loadSupabaseState({
      ownerUserId: command.ownerUserId,
      workspaceId: command.workspaceId,
    });
  }
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

function presentFlow(flow: CalibrationFlow): CalibrationFlow {
  return {
    ...flow,
    durationMinutes: flowCountdownMinutes(flow.durationMinutes),
    actionCatalog: parseLearningModelSize(flow.actionCatalog),
  };
}

async function updateFlowRow(
  supabase: ReturnType<typeof createAdminClient>,
  table: "calibrate_flows",
  id: string,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  return writeFlowRowWithOptionalColumns((body) => supabase.from(table).update(body).eq("id", id), row);
}

async function insertFlowRow(
  supabase: ReturnType<typeof createAdminClient>,
  table: "calibrate_flows",
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  return writeFlowRowWithOptionalColumns((body) => supabase.from(table).insert(body), row);
}

async function writeFlowRowWithOptionalColumns(
  run: (body: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  let current = row;
  for (const optional of ["name", "action_catalog", "duration_minutes", "owner_user_id"] as const) {
    const result = await run(current);
    if (!result.error) return result;
    if (!String(result.error.message).includes(optional) || !(optional in current)) return result;
    const next = { ...current };
    delete next[optional];
    current = next;
  }
  return run(current);
}

export async function getCalibrationFlowById(flowId: string): Promise<CalibrationFlow | null> {
  const id = String(flowId || "").trim();
  if (!id) return null;
  if ((await resolveBackend()) === "memory") {
    const flow = memoryState().flows.find((item) => item.id === id);
    return flow ? presentFlow(flow) : null;
  }
  const state = await loadSupabaseState({ flowId: id });
  const flow = state.flows.find((item) => item.id === id);
  return flow ? presentFlow(flow) : null;
}

export async function listCalibrationFlowsForOwnerUserId(
  ownerUserId: string,
): Promise<CalibrationFlow[]> {
  const userId = String(ownerUserId || "").trim();
  if (!userId) return [];
  if ((await resolveBackend()) === "memory") {
    return memoryState()
      .flows.filter((flow) => flow.ownerUserId === userId)
      .map(presentFlow);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calibrate_flows")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => presentFlow(mapFlow(row as Record<string, unknown>)));
}

export async function listCalibrationFlows(workspaceId: string): Promise<CalibrationFlow[]> {
  if ((await resolveBackend()) === "memory") {
    return memoryState().flows.filter((flow) => flow.workspaceId === workspaceId).map(presentFlow);
  }
  const state = await loadSupabaseState({ workspaceId });
  return state.flows.map(presentFlow);
}

export async function getCalibrationFlowByToken(token: string): Promise<CalibrationFlow | null> {
  const flow =
    (await resolveBackend()) === "memory"
      ? flowByPublicToken(memoryState(), token)
      : flowByPublicToken(await loadSupabaseState({ publicToken: token }), token);
  return flow ? presentFlow(flow) : null;
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
