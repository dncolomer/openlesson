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
import { parseLearningModelSize } from "@/lib/learning-model";
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
      .from("verify_flows")
      .select("id")
      .limit(1);
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

function mapFlow(row: Record<string, unknown>): VerificationFlow {
  const topic = String(row.topic || "");
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id || ""),
    ownerUserId: String(row.owner_user_id || ""),
    name: String(row.name || "").trim() || topic,
    topic,
    questions: normalizeQuestionPool(row.questions),
    durationMinutes: flowCountdownMinutes(row.duration_minutes),
    actionCatalog: parseLearningModelSize(row.action_catalog),
    publicToken: String(row.public_token || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapResultFromAnswer(
  flowId: string,
  workspaceId: string,
  answer: Record<string, unknown>,
  embedding: number[] | null,
): VerificationFlowResult {
  const source = answer.source === "skill" ? "skill" : "runner";
  return {
    id: String(answer.id || ""),
    flowId,
    workspaceId,
    identity: String(answer.identity || ""),
    source,
    questionId: answer.questionId ? String(answer.questionId) : null,
    prompt: String(answer.prompt || ""),
    embedding,
    createdAt: String(answer.createdAt || ""),
  };
}

async function loadSupabaseState(filter: {
  workspaceId?: string;
  ownerUserId?: string;
  flowId?: string;
  publicToken?: string;
}): Promise<VerificationState> {
  const supabase = createAdminClient();
  if (filter.workspaceId && !filter.flowId && !filter.publicToken && !filter.ownerUserId) {
    return emptyVerificationState();
  }
  let flowQuery = supabase.from("verify_flows").select("*");
  if (filter.flowId) flowQuery = flowQuery.eq("id", filter.flowId);
  else if (filter.publicToken) flowQuery = flowQuery.eq("public_token", filter.publicToken);
  else if (filter.ownerUserId) flowQuery = flowQuery.eq("owner_user_id", filter.ownerUserId);
  const { data: flowRows, error } = await flowQuery;
  if (error) throw new Error(error.message);
  const flows = (flowRows || []).map((row) => mapFlow(row as Record<string, unknown>));
  const ids = flows.map((flow) => flow.id);
  if (ids.length === 0) return emptyVerificationState();
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, verify_flow_id, identity, result, workspace_id")
    .eq("kind", "verify")
    .in("verify_flow_id", ids);
  const identityRows = (sessionRows || [])
    .filter((row) => row.identity)
    .map((row) => ({ flow_id: row.verify_flow_id, identity: row.identity }));
  const results: VerificationFlowResult[] = [];
  for (const row of sessionRows || []) {
    const parsed = row.result && typeof row.result === "object" ? (row.result as Record<string, unknown>) : null;
    const answers = Array.isArray(parsed?.answers) ? parsed.answers : [];
    for (const answer of answers) {
      if (!answer || typeof answer !== "object") continue;
      results.push(
        mapResultFromAnswer(
          String(row.verify_flow_id || ""),
          String(row.workspace_id || ""),
          answer as Record<string, unknown>,
          null,
        ),
      );
    }
  }
  return {
    flows,
    identities: (identityRows || []).map((row) => ({
      flowId: String((row as { flow_id: string }).flow_id),
      identity: String((row as { identity: string }).identity),
    })),
    results,
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
      owner_user_id: nullableId(value.flow.ownerUserId),
      name: value.flow.name,
      topic: value.flow.topic,
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
    const { error } = await writeVerificationFlow(supabase, "update", value.flow.id, {
      name: value.flow.name,
      topic: value.flow.topic,
      questions: value.flow.questions,
      duration_minutes: value.flow.durationMinutes,
      action_catalog: value.flow.actionCatalog,
      updated_at: value.flow.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "remove") {
    const { error } = await supabase
      .from("verify_flows")
      .delete()
      .eq("id", command.flowId);
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "claim" && value.identity) {
    const { data: flow } = await supabase
      .from("verify_flows")
      .select("owner_user_id")
      .eq("id", command.flowId)
      .maybeSingle();
    const { error } = await supabase.from("sessions").insert({
      kind: "verify",
      problem: "Verify",
      status: "pending",
      user_id: flow?.owner_user_id,
      verify_flow_id: command.flowId,
      identity: value.identity,
      result: {
        kind: "verify",
        projectedPolicy: null,
        knowledgeRegionId: null,
        answers: [],
      },
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (command.type === "addResult" && value.result) {
    const answer = {
      id: value.result.id,
      identity: value.result.identity,
      source: value.result.source,
      questionId: value.result.questionId,
      prompt: value.result.prompt,
      createdAt: value.result.createdAt,
    };
    const { data: existing } = await supabase
      .from("sessions")
      .select("id, result, user_id")
      .eq("kind", "verify")
      .eq("verify_flow_id", value.result.flowId)
      .eq("identity", value.result.identity)
      .maybeSingle();
    const previous =
      existing?.result && typeof existing.result === "object"
        ? (existing.result as Record<string, unknown>)
        : {};
    const answers = Array.isArray(previous.answers) ? [...previous.answers, answer] : [answer];
    const result = {
      kind: "verify",
      projectedPolicy: previous.projectedPolicy ?? null,
      knowledgeRegionId: previous.knowledgeRegionId ?? null,
      answers,
    };
    if (existing?.id) {
      const { error } = await supabase.from("sessions").update({ result }).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: flow } = await supabase
        .from("verify_flows")
        .select("owner_user_id")
        .eq("id", value.result.flowId)
        .maybeSingle();
      const { error } = await supabase.from("sessions").insert({
        kind: "verify",
        problem: "Verify",
        status: "completed",
        user_id: flow?.owner_user_id,
        verify_flow_id: value.result.flowId,
        identity: value.result.identity,
        result,
      });
      if (error) throw new Error(error.message);
    }
    if (Array.isArray(value.result.embedding) && value.result.embedding.length > 0) {
      const sessionId = existing?.id;
      const ownerUserId = existing?.user_id;
      await supabase.from("session_embeddings").insert({
        flow_kind: "verify",
        flow_id: value.result.flowId,
        run_id: sessionId || value.result.id,
        identity: value.result.identity,
        source: value.result.source,
        embedding_model_id: "flowcfg-v1-d96",
        dim: value.result.embedding.length,
        vector: value.result.embedding,
        raw: { prompt: value.result.prompt, questionId: value.result.questionId },
        owner_user_id: ownerUserId || null,
        session_id: sessionId || null,
      });
    }
  }
}

async function stateFor(command: VerificationCommand): Promise<VerificationState> {
  if ((await resolveBackend()) === "memory") return verificationRepositoryGlobal().memory;
  if (command.type === "create") {
    return loadSupabaseState({
      ownerUserId: command.ownerUserId,
      workspaceId: command.workspaceId,
    });
  }
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
  return {
    ...flow,
    durationMinutes: flowCountdownMinutes(flow.durationMinutes),
    actionCatalog: parseLearningModelSize(flow.actionCatalog),
  };
}

async function writeVerificationFlow(
  supabase: ReturnType<typeof createAdminClient>,
  mode: "insert" | "update",
  id: string,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const run = (body: Record<string, unknown>) =>
    mode === "insert"
      ? supabase.from("verify_flows").insert(body)
      : supabase.from("verify_flows").update(body).eq("id", id);
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

export async function getVerificationFlowById(flowId: string): Promise<VerificationFlow | null> {
  const id = String(flowId || "").trim();
  if (!id) return null;
  if ((await resolveBackend()) === "memory") {
    const flow = verificationRepositoryGlobal().memory.flows.find((item) => item.id === id);
    return flow ? presentFlow(flow) : null;
  }
  const state = await loadSupabaseState({ flowId: id });
  const flow = state.flows.find((item) => item.id === id);
  return flow ? presentFlow(flow) : null;
}

export async function listVerificationFlowsForOwnerUserId(
  ownerUserId: string,
): Promise<VerificationFlow[]> {
  const userId = String(ownerUserId || "").trim();
  if (!userId) return [];
  if ((await resolveBackend()) === "memory") {
    return verificationRepositoryGlobal()
      .memory.flows.filter((flow) => flow.ownerUserId === userId)
      .map(presentFlow);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("verify_flows")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => presentFlow(mapFlow(row as Record<string, unknown>)));
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

export async function listVerificationResultsForFlowId(
  flowId: string,
): Promise<VerificationFlowResult[]> {
  const id = String(flowId || "").trim();
  if (!id) return [];
  if ((await resolveBackend()) === "memory") {
    return verificationRepositoryGlobal().memory.results.filter((result) => result.flowId === id);
  }
  const state = await loadSupabaseState({ flowId: id });
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
