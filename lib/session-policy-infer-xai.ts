/**
 * Ask xAI which hidden state matches a batch of canvas proof,
 * or to rephrase the cheapest next hidden state for the Learn sidebar.
 * Do not import this module from a "use client" file or from a test.
 */

import {
  sessionPolicyLocalSuggestion,
  type SessionPolicyProofEvent,
} from "@/lib/session-policy-infer";
import { callXai, systemMessage, userMessage, type JsonSchema, type Message } from "@/lib/xai-client";

/** Stay under the route maxDuration. json_schema plus one json fallback, each 12s. */
const POLICY_XAI_TIMEOUT_MS = 12_000;

async function callPolicyXai<T extends Record<string, unknown>>(
  messages: Message[],
  schema: JsonSchema,
  opts: { maxTokens: number; temperature: number },
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const schemaReply = await callXai<T>(messages, {
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    responseFormat: "json_schema",
    jsonSchema: schema,
    reasoningEffort: "low",
    fetchTimeout: POLICY_XAI_TIMEOUT_MS,
    retries: 1,
  });
  if (schemaReply.success && schemaReply.data && typeof schemaReply.data === "object") {
    return { ok: true, data: schemaReply.data };
  }
  console.error("[session-policy-infer-xai] json_schema failed", schemaReply.error);
  const looseReply = await callXai<T>(messages, {
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    responseFormat: "json",
    reasoningEffort: "low",
    fetchTimeout: POLICY_XAI_TIMEOUT_MS,
    retries: 1,
  });
  if (looseReply.success && looseReply.data && typeof looseReply.data === "object") {
    return { ok: true, data: looseReply.data };
  }
  console.error("[session-policy-infer-xai] json fallback failed", looseReply.error);
  return { ok: false, error: "The policy could not be read." };
}

const HIDDEN_STATE_SCHEMA: JsonSchema = {
  name: "session_policy_hidden_state",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["hiddenStateId", "confidence", "line"],
    properties: {
      hiddenStateId: { type: "string" },
      confidence: { type: "number" },
      line: { type: "string" },
    },
  },
};

const GAP_SCHEMA: JsonSchema = {
  name: "sounding_gap_project",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["candidateId", "confidence"],
    properties: {
      candidateId: { type: "string" },
      confidence: { type: "number" },
    },
  },
};

const SUGGESTION_SCHEMA: JsonSchema = {
  name: "session_policy_suggestion",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string" },
    },
  },
};

const INFER_SYSTEM = [
  "You match a learner's canvas work to one hidden state on a frozen map.",
  "Candidates are listed with id, title, question, observation, and price.",
  "Pick the candidate whose observation or question best matches the work.",
  "When several candidates match equally, pick the one marked cheapest.",
  "hiddenStateId must be one of the listed ids.",
  "Return confidence from 0 to 1.",
  "line is one sentence a learner would recognize in this chapter, about that hidden state and the work just given.",
  "Address the learner as you. Do not use I, me, or my.",
  "Do not use the words Close, Keep, Discard, Insight, Forage, Exploit, Avoid, or Infer.",
  "Do not mention a price, a score, or a policy.",
  "Use only the chapter, the candidates, and the work given.",
].join("\n");

const GAP_SYSTEM = [
  "You match a learner's spoken plan to one nearby node on a frozen map.",
  "The learner marked a gap and said what is uncertain and how they would look next.",
  "Pick the candidate whose title or observation best matches that plan.",
  "If none match, candidateId is none.",
  "Return confidence from 0 to 1.",
  "Use only the gap, the candidates, and the speech.",
].join("\n");

const SUGGEST_SYSTEM = [
  "Write one short sentence that points the learner at the next hidden state.",
  "That node is the cheapest outgoing hidden state from where they are. Stay on it.",
  "Address the learner as you. Do not use I, me, or my.",
  "Use that hidden state's question when it is a genuine question. Otherwise use its observation.",
  "Use the canvas notes when they make the sentence more specific.",
  "Do not pick a different node.",
  "Do not use the words Close, Keep, Discard, Insight, Forage, Exploit, Avoid, or Infer.",
  "Do not mention a price, a score, or a policy.",
].join("\n");

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function workLines(events: readonly SessionPolicyProofEvent[]): string {
  return events
    .slice(-40)
    .map((event) => (event.prompt ? `${event.action}: ${event.prompt}` : event.action))
    .join("\n");
}

export async function inferSessionPolicyReply(input: {
  events: readonly SessionPolicyProofEvent[];
  chapterTitle?: string | null;
  chapterBrief?: string | null;
  candidates?: string | null;
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const events = input.events;
  if (!events.length) return { ok: false, error: "The policy could not be read." };
  const title = textOf(input.chapterTitle);
  const brief = textOf(input.chapterBrief).slice(0, 1500);
  const prompt = [
    title ? `Chapter: ${title}.` : "",
    brief ? `Material:\n${brief}` : "",
    textOf(input.candidates) ? `Hidden states:\n${textOf(input.candidates)}` : "",
    `Work:\n${workLines(events)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const response = await callPolicyXai<Record<string, unknown>>(
    [systemMessage(INFER_SYSTEM), userMessage(prompt)],
    HIDDEN_STATE_SCHEMA,
    { maxTokens: 400, temperature: 0.2 },
  );
  if (!response.ok) return { ok: false, error: response.error };
  return { ok: true, reply: JSON.stringify(response.data) };
}

export async function inferSessionGapReply(input: {
  events: readonly SessionPolicyProofEvent[];
  chapterTitle?: string | null;
  nodeTitle?: string | null;
  candidates: readonly { id: string; title: string; observation: string }[];
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const events = input.events;
  if (!events.length || !input.candidates.length) {
    return { ok: false, error: "The policy could not be read." };
  }
  const title = textOf(input.chapterTitle);
  const node = textOf(input.nodeTitle);
  const lines = input.candidates.map(
    (row) => `${row.id}: ${textOf(row.title)} — ${textOf(row.observation)}`,
  );
  const prompt = [
    title ? `Chapter: ${title}.` : "",
    node ? `Gap: ${node}.` : "",
    `Candidates:\n${lines.join("\n")}`,
    `Speech:\n${workLines(events)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const response = await callPolicyXai<Record<string, unknown>>(
    [systemMessage(GAP_SYSTEM), userMessage(prompt)],
    GAP_SCHEMA,
    { maxTokens: 200, temperature: 0.2 },
  );
  if (!response.ok) return { ok: false, error: response.error };
  return { ok: true, reply: JSON.stringify(response.data) };
}

export async function suggestSessionPolicyReply(input: {
  nodeTitle: string;
  observation: string;
  intent: string;
  canvasNote: string;
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const intent = textOf(input.intent) || textOf(input.observation);
  if (!intent) return { ok: false, error: "The policy could not be read." };
  const prompt = [
    textOf(input.nodeTitle) ? `Node: ${textOf(input.nodeTitle)}.` : "",
    textOf(input.observation) ? `Already written: ${textOf(input.observation)}.` : "",
    `Intent: ${intent}.`,
    textOf(input.canvasNote) ? `Recent work:\n${textOf(input.canvasNote)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const response = await callPolicyXai<{ text?: unknown }>(
    [systemMessage(SUGGEST_SYSTEM), userMessage(prompt)],
    SUGGESTION_SCHEMA,
    { maxTokens: 180, temperature: 0.4 },
  );
  if (!response.ok) {
    const local = sessionPolicyLocalSuggestion({
      nodeTitle: input.nodeTitle,
      observation: input.observation,
      intent: input.intent,
    });
    if (local) return { ok: true, reply: local };
    return { ok: false, error: response.error };
  }
  const text = textOf(response.data.text);
  if (!text) {
    const local = sessionPolicyLocalSuggestion({
      nodeTitle: input.nodeTitle,
      observation: input.observation,
      intent: input.intent,
    });
    if (local) return { ok: true, reply: local };
    return { ok: false, error: "The policy could not be read." };
  }
  return { ok: true, reply: text };
}
