/**
 * Verification flows for Verification Workspaces (stored kind `knowledge_region`).
 * Question picking, identity uniqueness, flow membership, region embeddings,
 * synthetic proof-of-work requests, and Knowledge-subtab filtering are pure.
 * Callers (UI, routes) must use these functions — do not re-implement them.
 */

import { encodeKnowledgeConfig } from "@/lib/knowledge-config/encoder";
import {
  createCustomVerificationModelFromVectors,
  type CustomVerificationModelSpec,
} from "@/lib/knowledge-config/custom-verification-model";
import type { TapStartingTopic } from "@/lib/tap-score";

export const VERIFICATION_WORKSPACE_LABEL = "Verification Workspace";

/** Practice card opening. The question path uses the pooled question text instead. */
export const VERIFICATION_PRACTICE_OPENING = "Practice first. Talk through what you know.";

export type VerificationQuestion = {
  id: string;
  text: string;
};

export type VerificationFlow = {
  id: string;
  workspaceId: string;
  topic: string;
  questions: VerificationQuestion[];
  publicToken: string;
  createdAt: string;
  updatedAt: string;
};

export type VerificationFlowResultSource = "runner" | "skill";

export type VerificationFlowResult = {
  id: string;
  flowId: string;
  workspaceId: string;
  identity: string;
  source: VerificationFlowResultSource;
  questionId: string | null;
  prompt: string;
  embedding: number[] | null;
  createdAt: string;
};

export type VerificationIdentity = {
  flowId: string;
  identity: string;
};

export type VerificationState = {
  flows: VerificationFlow[];
  identities: VerificationIdentity[];
  results: VerificationFlowResult[];
};

export type VerificationKnowledgeRow = {
  id: string;
  flowId: string | null;
  label: string;
  detail?: string;
  source?: string | null;
};

export type SyntheticPowItem = {
  id: string;
  text: string;
  embedding: number[];
};

export type SyntheticPowRequest = {
  instructions: string;
  user: string;
  asksForProofOfWork: true;
  includesModifier: boolean;
  modifier: string;
};

export function emptyVerificationState(): VerificationState {
  return { flows: [], identities: [], results: [] };
}

export function normalizeQuestionPool(raw: unknown): VerificationQuestion[] {
  const list = Array.isArray(raw) ? raw : [];
  const questions: VerificationQuestion[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      const text = item.trim();
      if (!text) continue;
      questions.push({ id: `q-${questions.length + 1}`, text });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; text?: unknown };
    const text = String(record.text || "").trim();
    if (!text) continue;
    const id = String(record.id || "").trim() || `q-${questions.length + 1}`;
    questions.push({ id, text });
  }
  return questions;
}

export type PickedVerificationQuestion =
  | { ok: true; question: VerificationQuestion }
  | { ok: false; reason: "empty_pool" };

/**
 * Select exactly one question from the pool.
 * An empty pool is an explicit refusal — never padded to three and never
 * replaced with a generated TAP topic.
 */
export function pickVerificationFlowQuestion(
  pool: unknown,
  random: () => number = Math.random,
): PickedVerificationQuestion {
  const questions = normalizeQuestionPool(pool);
  if (questions.length === 0) return { ok: false, reason: "empty_pool" };
  const sample = random();
  const scaled = Number.isFinite(sample) ? sample : 0;
  const index = Math.min(
    questions.length - 1,
    Math.max(0, Math.floor(scaled * questions.length)),
  );
  return { ok: true, question: questions[index]! };
}

export type VerificationFlowStartChoices = {
  emptyPool: boolean;
  practice: boolean;
  question: VerificationQuestion | null;
  /** Tap-shaped card for the single pooled question. Empty when the pool is empty. */
  topics: TapStartingTopic[];
};

/** Practice, or the one picked question. Never three cards and never a generated topic. */
export function verificationFlowStartChoices(
  pool: unknown,
  random: () => number = Math.random,
): VerificationFlowStartChoices {
  const picked = pickVerificationFlowQuestion(pool, random);
  if (!picked.ok) {
    return { emptyPool: true, practice: false, question: null, topics: [] };
  }
  return {
    emptyPool: false,
    practice: true,
    question: picked.question,
    topics: [verificationQuestionAsTapTopic(picked.question)],
  };
}

export function verificationQuestionAsTapTopic(
  question: VerificationQuestion,
): TapStartingTopic {
  const text = question.text.trim();
  return {
    id: question.id,
    title: text,
    subtitle: "Starting prompt",
    openingQuestion: text,
  };
}

/** On the question path the canvas opening line is the pooled question text. */
export function verificationQuestionStartingPrompt(question: {
  text: string;
}): string {
  return question.text.trim();
}

export function acceptParticipantIdentity(
  raw: string,
  existing: readonly string[],
): { ok: true; identity: string } | { ok: false; reason: "empty" | "duplicate" } {
  const identity = String(raw || "").trim();
  if (!identity) return { ok: false, reason: "empty" };
  if (existing.some((value) => value.trim() === identity)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true, identity };
}

export function verificationFlowPublicPath(token: string): string {
  return `/v/${encodeURIComponent(token)}`;
}

export function resultsForFlow<T extends { flowId: string }>(
  items: readonly T[],
  flowId: string,
): T[] {
  return items.filter((item) => item.flowId === flowId);
}

export function embeddingsForRegionFromFlow(
  items: readonly { flowId: string; embedding?: number[] | null }[],
  flowId: string,
): number[][] {
  return resultsForFlow(items, flowId)
    .map((item) => item.embedding)
    .filter((vector): vector is number[] => Array.isArray(vector) && vector.length > 0);
}

export function buildRegionFromFlowEmbeddings(input: {
  name: string;
  flowId: string;
  items: readonly { flowId: string; embedding?: number[] | null; id?: string }[];
}): CustomVerificationModelSpec {
  const vectors = embeddingsForRegionFromFlow(input.items, input.flowId);
  return createCustomVerificationModelFromVectors({
    name: input.name,
    vectors,
    subjects: vectors.map(() => ({ label: input.flowId })),
  });
}

export function buildSyntheticAgentPowRequest(input: {
  topic: string;
  promptModifier?: string | null;
}): SyntheticPowRequest {
  const topic = input.topic.trim() || "verification topic";
  const modifier = String(input.promptModifier || "").trim();
  const instructions = [
    "Generate proof of work items that demonstrate this topic.",
    `Topic: ${topic}`,
    modifier ? `Prompt modifier: ${modifier}` : "Prompt modifier: (none)",
    'Return JSON { "items": [ { "text": string } ] }.',
    "Each item is proof of work captured from a person, not a quiz score.",
  ].join("\n");
  return {
    instructions,
    user: `Generate proof of work for ${topic}.${modifier ? ` ${modifier}` : ""}`,
    asksForProofOfWork: true,
    includesModifier: modifier.length > 0,
    modifier,
  };
}

export function parseSyntheticPowModelOutput(raw: unknown): SyntheticPowItem[] {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const list = Array.isArray(raw)
    ? raw
    : record && Array.isArray(record.items)
      ? record.items
      : [];
  const items: SyntheticPowItem[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = String(row.text || row.prompt || "").trim();
    if (!text) continue;
    items.push({
      id: String(row.id || "").trim() || `synthetic-${index + 1}`,
      text,
      embedding: [],
    });
  }
  return items;
}

/**
 * knowledgecfg vector for one proof text.
 * `evaluatedGoalsText` is what moves the vector. Model-supplied coordinates are ignored.
 */
export function verificationProofEmbedding(input: {
  prompt: string;
  source?: "runner" | "skill" | "synthetic";
  workspaceId?: string;
}): number[] {
  const source = input.source ?? "runner";
  return encodeKnowledgeConfig({
    workspaceId: input.workspaceId || "verification-flow",
    totalBlocks: 0,
    evaluatedGoalsText: input.prompt,
    powRows: [
      {
        proof_of_work_type: source === "runner" ? "speech" : "tool",
        timestamp_ms: 1,
      },
    ],
  }).vector;
}

/** Opening line the TAP canvas shows for this run. Empty when the pool refused a question. */
export function localVerificationOpening(input: {
  practice: boolean;
  openingQuestion?: string | null;
  practicePrompt?: string | null;
}): string {
  if (input.practice) {
    return String(input.practicePrompt || VERIFICATION_PRACTICE_OPENING).trim();
  }
  return String(input.openingQuestion || "").trim();
}

/** Embeddings of generated proof text, in returned order. Invented coordinates are not used. */
export function regionEmbeddingsFromSyntheticItems(
  items: readonly { text?: string | null }[],
): number[][] {
  return items
    .map((item) => String(item.text || "").trim())
    .filter((text) => text.length > 0)
    .map((text) =>
      verificationProofEmbedding({
        prompt: text,
        source: "synthetic",
        workspaceId: "synthetic-agents",
      }),
    );
}

export async function generateSyntheticPowItems(input: {
  topic: string;
  promptModifier?: string | null;
  complete: (request: SyntheticPowRequest) => Promise<unknown>;
}): Promise<{
  request: SyntheticPowRequest;
  items: SyntheticPowItem[];
  embeddings: number[][];
}> {
  const request = buildSyntheticAgentPowRequest(input);
  const raw = await input.complete(request);
  const items = parseSyntheticPowModelOutput(raw);
  return {
    request,
    items,
    embeddings: regionEmbeddingsFromSyntheticItems(items),
  };
}

export function buildRegionFromSyntheticItems(input: {
  name: string;
  items: readonly SyntheticPowItem[];
}): CustomVerificationModelSpec {
  return createCustomVerificationModelFromVectors({
    name: input.name,
    vectors: regionEmbeddingsFromSyntheticItems(input.items),
    subjects: input.items.map((item) => ({ label: item.text.slice(0, 80) })),
  });
}

export function filterKnowledgeRowsByVerificationFlow<T extends { flowId?: string | null }>(
  rows: readonly T[],
  flowId: string | null | undefined,
): T[] {
  if (flowId == null || String(flowId).trim() === "") return rows.slice();
  const selected = String(flowId);
  return rows.filter((row) => row.flowId === selected);
}

export function knowledgeRowsFromFlowResults(
  results: readonly VerificationFlowResult[],
): VerificationKnowledgeRow[] {
  return results.map((result) => ({
    id: result.id,
    flowId: result.flowId,
    label: result.identity,
    detail: result.prompt,
    source: result.source,
  }));
}

/** Download name for a flow skill, e.g. "limits-skill.md". */
export function verificationFlowSkillFilename(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "verification-flow"}-skill.md`;
}

export function buildVerificationFlowSkillMarkdown(input: {
  workspaceId: string;
  flowId: string;
  topic: string;
  questions: readonly { text: string }[];
  publicToken: string;
  baseUrl?: string;
}): string {
  const origin = (input.baseUrl || "https://uncertain.systems").replace(/\/$/, "");
  const upload = `${origin}/api/verification-flow/public/${encodeURIComponent(input.publicToken)}/results`;
  const pool = input.questions.map((question, index) => `${index + 1}. ${question.text}`).join("\n");
  return [
    `# ${input.topic} — verification flow skill`,
    "",
    "Generate proof of work for this verification flow and store it on the flow.",
    "This skill is the flow's agent integration, in the same role as the workspace Settings → Integration skill.",
    "Snapshot scoring and embedding geometry are unchanged. Do not mint TAP, ILE, or TAPBench knowledge links.",
    "",
    `Workspace: ${input.workspaceId}`,
    `Verification flow: ${input.flowId}`,
    `Topic: ${input.topic}`,
    "",
    "## Starting question pool",
    pool || "(empty)",
    "",
    "## Upload",
    `POST ${upload}`,
    'JSON body: { "identity": "agent name", "source": "skill", "prompt": "proof of work text", "questionId": "optional" }',
    "The server attributes the item to this flow. Items from another flow are not accepted on this URL.",
    "",
  ].join("\n");
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function createVerificationPublicToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export type VerificationCommand =
  | {
      type: "create";
      workspaceId: string;
      topic: string;
      questions: unknown;
      id?: string;
      publicToken?: string;
    }
  | {
      type: "update";
      workspaceId: string;
      flowId: string;
      topic?: string;
      questions?: unknown;
    }
  | { type: "remove"; workspaceId: string; flowId: string }
  | { type: "claim"; flowId: string; identity: string }
  | {
      type: "addResult";
      flowId: string;
      identity: string;
      source: VerificationFlowResultSource;
      prompt: string;
      questionId?: string | null;
      embedding?: number[] | null;
      id?: string;
    };

export type VerificationCommandResult =
  | {
      ok: true;
      state: VerificationState;
      flow?: VerificationFlow;
      identity?: string;
      result?: VerificationFlowResult;
      choices?: VerificationFlowStartChoices;
    }
  | { ok: false; reason: string; state: VerificationState };

export function applyVerificationCommand(
  state: VerificationState,
  command: VerificationCommand,
): VerificationCommandResult {
  if (command.type === "create") {
    const topic = command.topic.trim();
    if (!topic) return { ok: false, reason: "topic_required", state };
    const token = (command.publicToken || createVerificationPublicToken()).trim();
    if (!token) return { ok: false, reason: "token_required", state };
    if (state.flows.some((flow) => flow.publicToken === token)) {
      return { ok: false, reason: "token_taken", state };
    }
    const stamp = nowIso();
    const flow: VerificationFlow = {
      id: command.id || makeId("vf"),
      workspaceId: command.workspaceId,
      topic,
      questions: normalizeQuestionPool(command.questions),
      publicToken: token,
      createdAt: stamp,
      updatedAt: stamp,
    };
    return { ok: true, state: { ...state, flows: [...state.flows, flow] }, flow };
  }

  if (command.type === "update") {
    const current = state.flows.find((flow) => flow.id === command.flowId);
    if (!current) return { ok: false, reason: "not_found", state };
    if (!command.workspaceId || current.workspaceId !== command.workspaceId) {
      return { ok: false, reason: "wrong_workspace", state };
    }
    const topic = command.topic === undefined ? current.topic : command.topic.trim();
    if (!topic) return { ok: false, reason: "topic_required", state };
    const flow: VerificationFlow = {
      ...current,
      topic,
      questions:
        command.questions === undefined
          ? current.questions
          : normalizeQuestionPool(command.questions),
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
    if (!command.workspaceId || current.workspaceId !== command.workspaceId) {
      return { ok: false, reason: "wrong_workspace", state };
    }
    return {
      ok: true,
      state: {
        flows: state.flows.filter((flow) => flow.id !== command.flowId),
        identities: state.identities.filter((item) => item.flowId !== command.flowId),
        results: state.results.filter((item) => item.flowId !== command.flowId),
      },
    };
  }

  if (command.type === "claim") {
    const flow = state.flows.find((item) => item.id === command.flowId);
    if (!flow) return { ok: false, reason: "not_found", state };
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

  const flow = state.flows.find((item) => item.id === command.flowId);
  if (!flow) return { ok: false, reason: "not_found", state };
  const identity = command.identity.trim();
  const prompt = command.prompt.trim();
  if (!identity) return { ok: false, reason: "identity_required", state };
  if (!prompt) return { ok: false, reason: "prompt_required", state };
  if (command.source !== "runner" && command.source !== "skill") {
    return { ok: false, reason: "source_required", state };
  }
  const result: VerificationFlowResult = {
    id: command.id || makeId("vr"),
    flowId: flow.id,
    workspaceId: flow.workspaceId,
    identity,
    source: command.source,
    questionId: command.questionId ? String(command.questionId) : null,
    prompt,
    embedding: Array.isArray(command.embedding) ? command.embedding : null,
    createdAt: nowIso(),
  };
  return {
    ok: true,
    result,
    state: { ...state, results: [...state.results, result] },
  };
}

export function flowByPublicToken(
  state: VerificationState,
  token: string,
): VerificationFlow | null {
  const needle = token.trim();
  return state.flows.find((flow) => flow.publicToken === needle) || null;
}

/** Public start: claim is separate. This only picks the question for an existing identity. */
export function startChoicesForFlow(
  flow: VerificationFlow,
  random: () => number = Math.random,
): VerificationFlowStartChoices {
  return verificationFlowStartChoices(flow.questions, random);
}
