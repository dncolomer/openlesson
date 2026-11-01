/**
 * Persistence for Solve flows. Supabase when the service role and table exist;
 * otherwise one process-wide memory store so public claim and owner APIs share state.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import { parseLearningModelSize } from "@/lib/learning-model";
import { SOLVE_FLOWS_TABLE } from "@/lib/core-tables";
import {
  applySolveCommand,
  emptySolveState,
  flowByPublicToken,
  type SolveCommand,
  type SolveCommandResult,
  type SolveFlow,
  type SolveState,
} from "@/lib/solve-flow";

const SOLVE_FLOW_GLOBAL = "__openlessonSolveFlowRepository";

type SolveRepositoryGlobal = {
  memory: SolveState;
  sessions: Record<string, Record<string, unknown>>;
  backend: "unknown" | "supabase" | "memory";
};

function solveRepositoryGlobal(): SolveRepositoryGlobal {
  const scope = globalThis as typeof globalThis & {
    [SOLVE_FLOW_GLOBAL]?: SolveRepositoryGlobal;
  };
  if (!scope[SOLVE_FLOW_GLOBAL]) {
    scope[SOLVE_FLOW_GLOBAL] = {
      memory: emptySolveState(),
      sessions: {},
      backend: "unknown",
    };
  }
  if (!scope[SOLVE_FLOW_GLOBAL].sessions) {
    scope[SOLVE_FLOW_GLOBAL].sessions = {};
  }
  return scope[SOLVE_FLOW_GLOBAL];
}

export function resetSolveFlowRepository(): void {
  const store = solveRepositoryGlobal();
  store.memory = emptySolveState();
  store.sessions = {};
  store.backend = "unknown";
}

export function solveSessionBelongsToFlow(
  session: Record<string, unknown> | null | undefined,
  flowId: string,
): boolean {
  if (!session) return false;
  const parent = String(session.solve_flow_id ?? session.solveFlowId ?? "").trim();
  return parent === String(flowId || "").trim();
}

function memorySolveSessionRow(input: {
  id: string;
  flow: SolveFlow;
  identity: string;
}): Record<string, unknown> {
  return {
    id: input.id,
    kind: "solve",
    problem: input.flow.topic || input.flow.name || "Solve",
    status: "pending",
    user_id: input.flow.ownerUserId,
    solve_flow_id: input.flow.id,
    identity: input.identity,
    duration_ms: 0,
    ended_at: null,
    planning_prompt: null,
    probes: [],
    metadata: {
      title: input.flow.topic || input.flow.name,
      solve_flow_id: input.flow.id,
      identity: input.identity,
    },
    created_at: new Date().toISOString(),
  };
}

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function resolveBackend(): Promise<"supabase" | "memory"> {
  const store = solveRepositoryGlobal();
  if (store.backend !== "unknown") return store.backend;
  if (!supabaseConfigured()) {
    store.backend = "memory";
    return store.backend;
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(SOLVE_FLOWS_TABLE).select("id").limit(1);
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

function mapFlow(row: Record<string, unknown>): SolveFlow {
  const topic = String(row.topic || "");
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id || ""),
    ownerUserId: String(row.owner_user_id || ""),
    name: String(row.name || "").trim() || topic,
    topic,
    durationMinutes: flowCountdownMinutes(row.duration_minutes),
    actionCatalog: parseLearningModelSize(row.action_catalog),
    publicToken: String(row.public_token || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

async function loadSupabaseState(filter: {
  ownerUserId?: string;
  flowId?: string;
  publicToken?: string;
}): Promise<SolveState> {
  const supabase = createAdminClient();
  let flowQuery = supabase.from(SOLVE_FLOWS_TABLE).select("*");
  if (filter.flowId) flowQuery = flowQuery.eq("id", filter.flowId);
  else if (filter.publicToken) flowQuery = flowQuery.eq("public_token", filter.publicToken);
  else if (filter.ownerUserId) flowQuery = flowQuery.eq("owner_user_id", filter.ownerUserId);
  const { data: flowRows, error } = await flowQuery;
  if (error) throw new Error(error.message);
  const flows = (flowRows || []).map((row) => mapFlow(row as Record<string, unknown>));
  const ids = flows.map((flow) => flow.id);
  if (ids.length === 0) return emptySolveState();
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, solve_flow_id, identity")
    .eq("kind", "solve")
    .in("solve_flow_id", ids);
  const identityRows = (sessionRows || [])
    .filter((row) => row.identity)
    .map((row) => ({ flow_id: row.solve_flow_id, identity: row.identity }));
  return {
    flows,
    identities: (identityRows || []).map((row) => ({
      flowId: String((row as { flow_id: string }).flow_id),
      identity: String((row as { identity: string }).identity),
    })),
  };
}

async function persistCommand(
  command: SolveCommand,
  value: Extract<SolveCommandResult, { ok: true }>,
): Promise<void> {
  const supabase = createAdminClient();
  if (command.type === "create" && value.flow) {
    const { error } = await writeSolveFlow(supabase, "insert", value.flow.id, {
      id: value.flow.id,
      owner_user_id: nullableId(value.flow.ownerUserId),
      name: value.flow.name,
      topic: value.flow.topic,
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
    const { error } = await writeSolveFlow(supabase, "update", value.flow.id, {
      name: value.flow.name,
      topic: value.flow.topic,
      duration_minutes: value.flow.durationMinutes,
      action_catalog: value.flow.actionCatalog,
      updated_at: value.flow.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "remove") {
    const { error } = await supabase.from(SOLVE_FLOWS_TABLE).delete().eq("id", command.flowId);
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "claim" && value.identity) {
    const { data: flow } = await supabase
      .from(SOLVE_FLOWS_TABLE)
      .select("owner_user_id, topic, name")
      .eq("id", command.flowId)
      .maybeSingle();
    const { debitClaimedFlowSession, refundClaimedFlowSession } = await import("@/lib/credits/claim-charge");
    const charged = await debitClaimedFlowSession({
      ownerUserId: flow?.owner_user_id,
      runnerUserId: command.runnerUserId,
      flowKind: "solve",
    });
    const topic = String(flow?.topic || flow?.name || "Solve");
    const { error } = await supabase.from("sessions").insert({
      kind: "solve",
      problem: topic,
      status: "pending",
      user_id: flow?.owner_user_id,
      solve_flow_id: command.flowId,
      identity: value.identity,
      result: {
        kind: "solve",
        projectedPolicy: null,
      },
      metadata: { title: topic, solve_flow_id: command.flowId },
    });
    if (error) {
      await refundClaimedFlowSession(charged?.billedUserId);
      throw new Error(error.message);
    }
  }
}

async function writeSolveFlow(
  supabase: ReturnType<typeof createAdminClient>,
  mode: "insert" | "update",
  id: string,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const run = (body: Record<string, unknown>) =>
    mode === "insert"
      ? supabase.from(SOLVE_FLOWS_TABLE).insert(body)
      : supabase.from(SOLVE_FLOWS_TABLE).update(body).eq("id", id);
  let current = row;
  for (const optional of ["action_catalog", "duration_minutes"] as const) {
    const result = await run(current);
    if (!result.error) return result;
    if (!String(result.error.message).includes(optional) || !(optional in current)) return result;
    const next = { ...current };
    delete next[optional];
    current = next;
  }
  return run(current);
}

async function stateFor(command: SolveCommand): Promise<SolveState> {
  if ((await resolveBackend()) === "memory") return solveRepositoryGlobal().memory;
  if (command.type === "create") {
    return loadSupabaseState({ ownerUserId: command.ownerUserId });
  }
  return loadSupabaseState({ flowId: command.flowId });
}

function presentFlow(flow: SolveFlow): SolveFlow {
  return {
    ...flow,
    durationMinutes: flowCountdownMinutes(flow.durationMinutes),
    actionCatalog: parseLearningModelSize(flow.actionCatalog),
  };
}

export async function runSolveCommand(command: SolveCommand): Promise<SolveCommandResult> {
  const state = await stateFor(command);
  const next = applySolveCommand(state, command);
  if (!next.ok) return next;
  if ((await resolveBackend()) === "memory") {
    solveRepositoryGlobal().memory = next.state;
    return next;
  }
  await persistCommand(command, next);
  return next;
}

export async function getSolveFlowById(flowId: string): Promise<SolveFlow | null> {
  const id = String(flowId || "").trim();
  if (!id) return null;
  if ((await resolveBackend()) === "memory") {
    const flow = solveRepositoryGlobal().memory.flows.find((item) => item.id === id);
    return flow ? presentFlow(flow) : null;
  }
  const state = await loadSupabaseState({ flowId: id });
  const flow = state.flows.find((item) => item.id === id);
  return flow ? presentFlow(flow) : null;
}

export async function listSolveFlowsForOwnerUserId(ownerUserId: string): Promise<SolveFlow[]> {
  const userId = String(ownerUserId || "").trim();
  if (!userId) return [];
  if ((await resolveBackend()) === "memory") {
    return solveRepositoryGlobal()
      .memory.flows.filter((flow) => flow.ownerUserId === userId)
      .map(presentFlow);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(SOLVE_FLOWS_TABLE)
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => presentFlow(mapFlow(row as Record<string, unknown>)));
}

export async function getSolveFlowByToken(token: string): Promise<SolveFlow | null> {
  const flow =
    (await resolveBackend()) === "memory"
      ? flowByPublicToken(solveRepositoryGlobal().memory, token)
      : flowByPublicToken(await loadSupabaseState({ publicToken: token }), token);
  return flow ? presentFlow(flow) : null;
}

export async function claimSolveIdentity(
  token: string,
  identity: string,
  opts?: { runnerUserId?: string | null },
) {
  const flow = await getSolveFlowByToken(token);
  if (!flow) return { ok: false as const, reason: "not_found" };
  const claimed = await runSolveCommand({
    type: "claim",
    flowId: flow.id,
    identity,
    runnerUserId: opts?.runnerUserId,
  });
  if (!claimed.ok) return { ok: false as const, reason: claimed.reason };
  let sessionId: string | null = null;
  if ((await resolveBackend()) === "supabase") {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("kind", "solve")
      .eq("solve_flow_id", flow.id)
      .eq("identity", claimed.identity)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sessionId = data?.id ? String(data.id) : null;
  } else {
    const claimedIdentity = claimed.identity || identity;
    sessionId = `mem_${flow.id}_${claimedIdentity}`;
    const store = solveRepositoryGlobal();
    store.sessions[sessionId] = memorySolveSessionRow({
      id: sessionId,
      flow,
      identity: claimedIdentity,
    });
  }
  return {
    ok: true as const,
    flow,
    identity: claimed.identity,
    sessionId,
  };
}

export async function getSolveSessionById(sessionId: string) {
  const id = String(sessionId || "").trim();
  if (!id) return null;
  if ((await resolveBackend()) === "memory") {
    return solveRepositoryGlobal().sessions[id] ?? null;
  }
  const supabase = createAdminClient();
  const { data } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function saveSolveSessionRow(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const id = String(sessionId || "").trim();
  if (!id) return null;
  const existing = await getSolveSessionById(id);
  if (!existing || typeof existing !== "object") return null;
  const current = existing as Record<string, unknown>;
  const nextMeta =
    patch.metadata && typeof patch.metadata === "object" && !Array.isArray(patch.metadata)
      ? {
          ...((current.metadata && typeof current.metadata === "object"
            ? current.metadata
            : {}) as Record<string, unknown>),
          ...(patch.metadata as Record<string, unknown>),
        }
      : current.metadata;
  const next: Record<string, unknown> = {
    ...current,
    ...patch,
    id,
    kind: "solve",
    solve_flow_id: current.solve_flow_id,
    identity: current.identity,
    user_id: current.user_id,
    metadata: nextMeta,
  };
  if ((await resolveBackend()) === "memory") {
    solveRepositoryGlobal().sessions[id] = next;
    return next;
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      status: next.status ?? current.status,
      duration_ms: next.duration_ms ?? current.duration_ms,
      ended_at: next.ended_at ?? current.ended_at,
      planning_prompt: next.planning_prompt ?? current.planning_prompt,
      metadata: next.metadata,
      problem: next.problem ?? current.problem,
    })
    .eq("id", id)
    .eq("kind", "solve");
  if (error) throw new Error(error.message);
  return next;
}
