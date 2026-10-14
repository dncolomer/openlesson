/**
 * Ask xAI which discrete policy action matches a batch of canvas proof,
 * or to rephrase the lowest-cost next action for the Learn sidebar.
 * Do not import this module from a "use client" file or from a test.
 */

import type { SessionMarkButtonId } from "@/lib/session-marks";
import type { SessionPolicyProofEvent } from "@/lib/session-policy-infer";
import { callXai, systemMessage, userMessage, type JsonSchema } from "@/lib/xai-client";

const CONFIDENCE_SCHEMA: JsonSchema = {
  name: "session_policy_confidence",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "close",
      "keep",
      "discard",
      "insight",
      "closeLine",
      "keepLine",
      "discardLine",
      "insightLine",
    ],
    properties: {
      close: { type: "number" },
      keep: { type: "number" },
      discard: { type: "number" },
      insight: { type: "number" },
      closeLine: { type: "string" },
      keepLine: { type: "string" },
      discardLine: { type: "string" },
      insightLine: { type: "string" },
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
  "You match a learner's canvas work to four internal actions.",
  "close: they are finishing this line and moving on.",
  "keep: they are staying with this line and opening it further.",
  "discard: they are setting this line aside.",
  "insight: they are stating a conclusion.",
  "Return a confidence from 0 to 1 for each action.",
  "Also write closeLine, keepLine, discardLine, and insightLine.",
  "Each line is one sentence a learner would recognize in this chapter, about the work just given.",
  "Address the learner as you. Do not use I, me, or my.",
  "Do not use the words Close, Keep, Discard, Insight, Forage, Exploit, Avoid, or Infer.",
  "Do not mention a price, a score, or a policy.",
  "Use only the chapter and the work given.",
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
  "Write one short sentence that tells the learner what to do next on the canvas.",
  "Address the learner as you. Do not use I, me, or my.",
  "Follow the intent. Use the canvas notes when they make the sentence more specific.",
  "Do not use the words Close, Keep, Discard, Insight, Forage, Exploit, Avoid, or Infer.",
  "Do not mention a price, a score, or a policy.",
].join("\n");

const PRIVATE_INTENT: Record<SessionMarkButtonId, string> = {
  try: "Finish this line and move to the next one.",
  hold: "Stay with this line and open it further.",
  drop: "Set this line aside.",
  insight: "State the conclusion this work is pointing at.",
};

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
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const events = input.events;
  if (!events.length) return { ok: false, error: "The policy could not be read." };
  const title = textOf(input.chapterTitle);
  const brief = textOf(input.chapterBrief).slice(0, 1500);
  const prompt = [
    title ? `Chapter: ${title}.` : "",
    brief ? `Material:\n${brief}` : "",
    `Work:\n${workLines(events)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const response = await callXai<Record<string, unknown>>(
    [systemMessage(INFER_SYSTEM), userMessage(prompt)],
    {
      maxTokens: 500,
      temperature: 0.2,
      responseFormat: "json_schema",
      jsonSchema: CONFIDENCE_SCHEMA,
      reasoningEffort: "low",
      fetchTimeout: 30_000,
      retries: 2,
    },
  );
  const data = response.success ? response.data : null;
  if (!data || typeof data !== "object") {
    return { ok: false, error: "The policy could not be read." };
  }
  return { ok: true, reply: JSON.stringify(data) };
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
  const response = await callXai<Record<string, unknown>>(
    [systemMessage(GAP_SYSTEM), userMessage(prompt)],
    {
      maxTokens: 200,
      temperature: 0.2,
      responseFormat: "json_schema",
      jsonSchema: GAP_SCHEMA,
      reasoningEffort: "low",
      fetchTimeout: 30_000,
      retries: 2,
    },
  );
  const data = response.success ? response.data : null;
  if (!data || typeof data !== "object") {
    return { ok: false, error: "The policy could not be read." };
  }
  return { ok: true, reply: JSON.stringify(data) };
}

export async function suggestSessionPolicyReply(input: {
  action: SessionMarkButtonId;
  nodeTitle: string;
  observation: string;
  intent: string;
  canvasNote: string;
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const intent = textOf(input.intent) || textOf(input.observation) || PRIVATE_INTENT[input.action];
  if (!intent) return { ok: false, error: "The policy could not be read." };
  const prompt = [
    textOf(input.nodeTitle) ? `Node: ${textOf(input.nodeTitle)}.` : "",
    textOf(input.observation) ? `Already written: ${textOf(input.observation)}.` : "",
    `Intent: ${intent}.`,
    textOf(input.canvasNote) ? `Recent work:\n${textOf(input.canvasNote)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const response = await callXai<{ text?: unknown }>(
    [systemMessage(SUGGEST_SYSTEM), userMessage(prompt)],
    {
      maxTokens: 180,
      temperature: 0.4,
      responseFormat: "json_schema",
      jsonSchema: SUGGESTION_SCHEMA,
      reasoningEffort: "low",
      fetchTimeout: 30_000,
      retries: 2,
    },
  );
  const text = textOf(response.success ? response.data?.text : "");
  if (!text) return { ok: false, error: "The policy could not be read." };
  return { ok: true, reply: text };
}
