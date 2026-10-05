/**
 * Persistence for verification flows.
 * Supabase is used when the service role and the flows table are available.
 * Otherwise the process keeps one reducer state on globalThis so every route
 * bundle sees the same flows. The public runner and owner APIs still work
 * without a live database.
 * Identity checks, question picks, and result attribution always go through
 * `applyVerificationCommand`.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import {
  applyVerificationCommand,
  emptyVerificationState,
  flowByPublicToken,
  normalizeQuestionPool,
  startChoicesForFlow,
  type VerificationCommand,
  type VerificationCommandResult,
  type VerificationFlow,
  type VerificationFlowResult,
  type VerificationState,
} from "@/lib/verification-flow";

const VERIFICATION_FLOW_GLOBAL = "__openlessonVerificationFlowRepository";

type VerificationRepositoryGlobal = {
  memory: VerificationState;
  backend: "unknown" | "supabase" | "memory";
};

/**
 * Route handlers are separate server bundles. A module-level `let` would give
 * the public claim route and the results route different flow lists, so End
 * session could not find the flow it just started. One process-wide record.
 */
function verificationRepositoryGlobal(): VerificationRepositoryGlobal {
  const scope = globalThis as typeof globalThis & {
    [VERIFICATION_FLOW_GLOBAL]?: VerificationRepositoryGlobal;
  };
  if (!scope[VERIFICATION_FLOW_GLOBAL]) {
    scope[VERIFICATION_FLOW_GLOBAL] = {
      memory: emptyVerificationState(),
      backend: "unknown",
    };
  }
  return scope[VERIFICATION_FLOW_GLOBAL];
}

export function resetVerificationFlowRepository(): void {
  const store = verificationRepositoryGlobal();
  store.memory = emptyVerificationState();
  store.backend = "unknown";
}

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function resolveBackend(): Promise<"supabase" | "memory"> {
  const store = verificationRepositoryGlobal();
  if (store.backend !== "unknown") return store.backend;
  if (!supabaseConfigured()) {
    store.backend = "memory";
    return store.backend;
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("workspace_verification_flows")
      .select("id")
      .limit(1);
    store.backend = error ? "memory" : "supabase";
  } catch {
    store.backend = "memory";
  }
  return store.backend;
}

function mapFlow(row: Record<string, unknown>): VerificationFlow {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    topic: String(row.topic || ""),
    questions: normalizeQuestionPool(row.questions),
    durationMinutes: flowCountdownMinutes(row.duration_minutes),
    publicToken: String(row.public_token || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapResult(row: Record<string, unknown>): VerificationFlowResult {
  const embedding = Array.isArray(row.embedding)
    ? row.embedding.filter((value): value is number => typeof value === "number")
    : null;
  const source = row.source === "skill" ? "skill" : "runner";
  return {
    id: String(row.id),
    flowId: String(row.flow_id),
    workspaceId: String(row.workspace_id),
    identity: String(row.identity || ""),
    source,
    questionId: row.question_id ? String(row.question_id) : null,
    prompt: String(row.prompt || ""),
    embedding,
    createdAt: String(row.created_at || ""),
  };
}

async function loadSupabaseState(filter: {
  workspaceId?: string;
  flowId?: string;
  publicToken?: string;
}): Promise<VerificationState> {
  const supabase = createAdminClient();
  let flowQuery = supabase.from("workspace_verification_flows").select("*");
  if (filter.flowId) flowQuery = flowQuery.eq("id", filter.flowId);
  else if (filter.publicToken) flowQuery = flowQuery.eq("public_token", filter.publicToken);
  else if (filter.workspaceId) flowQuery = flowQuery.eq("workspace_id", filter.workspaceId);
  const { data: flowRows, error } = await flowQuery;
  if (error) throw new Error(error.message);
  const flows = (flowRows || []).map((row) => mapFlow(row as Record<string, unknown>));
  const ids = flows.map((flow) => flow.id);
  if (ids.length === 0) return emptyVerificationState();
  const [{ data: identityRows }, { data: resultRows }] = await Promise.all([
    supabase.from("workspace_verification_identities").select("*").in("flow_id", ids),
    supabase.from("workspace_verification_results").select("*").in("flow_id", ids),
  ]);
  return {
    flows,
    identities: (identityRows || []).map((row) => ({
      flowId: String((row as { flow_id: string }).flow_id),
      identity: String((row as { identity: string }).identity),
    })),
    results: (resultRows || []).map((row) => mapResult(row as Record<string, unknown>)),
  };
}

async function persistCommand(
  command: VerificationCommand,
  value: Extract<VerificationCommandResult, { ok: true }>,
): Promise<void> {
  const supabase = createAdminClient();
  if (command.type === "create" && value.flow) {
    const { error } = await writeVerificationFlow(supabase, "insert", value.flow.id, {
      id: value.flow.id,
      workspace_id: value.flow.workspaceId,
      topic: value.flow.topic,
      questions: value.flow.questions,
      duration_minutes: value.flow.durationMinutes,
      public_token: value.flow.publicToken,
      created_at: value.flow.createdAt,
      updated_at: value.flow.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "update" && value.flow) {
    const { error } = await writeVerificationFlow(supabase, "update", value.flow.id, {
      topic: value.flow.topic,
      questions: value.flow.questions,
      duration_minutes: value.flow.durationMinutes,
      updated_at: value.flow.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "remove") {
    const { error } = await supabase
      .from("workspace_verification_flows")
      .delete()
      .eq("id", command.flowId);
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "claim" && value.identity) {
    const { error } = await supabase.from("workspace_verification_identities").insert({
      flow_id: command.flowId,
      identity: value.identity,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "addResult" && value.result) {
    const { error } = await supabase.from("workspace_verification_results").insert({
      id: value.result.id,
      flow_id: value.result.flowId,
      workspace_id: value.result.workspaceId,
      identity: value.result.identity,
      source: value.result.source,
      question_id: value.result.questionId,
      prompt: value.result.prompt,
      embedding: value.result.embedding,
      created_at: value.result.createdAt,
    });
    if (error) throw new Error(error.message);
  }
}

async function stateFor(command: VerificationCommand): Promise<VerificationState> {
  if ((await resolveBackend()) === "memory") return verificationRepositoryGlobal().memory;
  if (command.type === "create") return loadSupabaseState({ workspaceId: command.workspaceId });
  return loadSupabaseState({ flowId: command.flowId });
}

export async function runVerificationCommand(
  command: VerificationCommand,
): Promise<VerificationCommandResult> {
  const state = await stateFor(command);
  const next = applyVerificationCommand(state, command);
  if (!next.ok) return next;
  if ((await resolveBackend()) === "memory") {
    verificationRepositoryGlobal().memory = next.state;
    return next;
  }
  await persistCommand(command, next);
  return next;
}

function presentFlow(flow: VerificationFlow): VerificationFlow {
  return { ...flow, durationMinutes: flowCountdownMinutes(flow.durationMinutes) };
}

async function writeVerificationFlow(
  supabase: ReturnType<typeof createAdminClient>,
  mode: "insert" | "update",
  id: string,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const run = (body: Record<string, unknown>) =>
    mode === "insert"
      ? supabase.from("workspace_verification_flows").insert(body)
      : supabase.from("workspace_verification_flows").update(body).eq("id", id);
  const first = await run(row);
  if (!first.error || !String(first.error.message).includes("duration_minutes")) return first;
  const { duration_minutes: _duration, ...withoutDuration } = row;
  return run(withoutDuration);
}

export async function listVerificationFlows(workspaceId: string): Promise<VerificationFlow[]> {
  if ((await resolveBackend()) === "memory") {
    return verificationRepositoryGlobal().memory.flows
      .filter((flow) => flow.workspaceId === workspaceId)
      .map(presentFlow);
  }
  const state = await loadSupabaseState({ workspaceId });
  return state.flows.map(presentFlow);
}

export async function listVerificationResults(workspaceId: string): Promise<VerificationFlowResult[]> {
  if ((await resolveBackend()) === "memory") {
    return verificationRepositoryGlobal().memory.results.filter(
      (result) => result.workspaceId === workspaceId,
    );
  }
  const state = await loadSupabaseState({ workspaceId });
  return state.results;
}

export async function getVerificationFlowByToken(token: string): Promise<VerificationFlow | null> {
  const flow =
    (await resolveBackend()) === "memory"
      ? flowByPublicToken(verificationRepositoryGlobal().memory, token)
      : flowByPublicToken(await loadSupabaseState({ publicToken: token }), token);
  return flow ? presentFlow(flow) : null;
}

export async function claimPublicIdentity(token: string, identity: string) {
  const flow = await getVerificationFlowByToken(token);
  if (!flow) return { ok: false as const, reason: "not_found" };
  const claimed = await runVerificationCommand({ type: "claim", flowId: flow.id, identity });
  if (!claimed.ok) return { ok: false as const, reason: claimed.reason };
  const choices = startChoicesForFlow(flow);
  return { ok: true as const, flow, identity: claimed.identity, choices };
}

export async function addPublicFlowResult(input: {
  token: string;
  identity: string;
  source: "runner" | "skill";
  prompt: string;
  questionId?: string | null;
  embedding?: number[] | null;
}) {
  const flow = await getVerificationFlowByToken(input.token);
  if (!flow) return { ok: false as const, reason: "not_found" };
  return runVerificationCommand({
    type: "addResult",
    flowId: flow.id,
    identity: input.identity,
    source: input.source,
    prompt: input.prompt,
    questionId: input.questionId,
    embedding: input.embedding,
  });
}
