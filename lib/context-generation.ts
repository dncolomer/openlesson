/**
 * Generate Goals or a verification-flow topic and questions from workspace Context.
 * Each call appends to a pool; earlier candidates stay selectable.
 */

import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";

export type ContextGoalCandidate = {
  id: string;
  text: string;
};

export type ContextFlowDraft = {
  topic: string;
  questions: string[];
};

export type ContextFlowCandidate = ContextFlowDraft & {
  id: string;
};

export type ContextGenerationKind = "goals" | "verification_flow" | "calibration_flow";

export type ContextGenerationRequest = {
  kind: ContextGenerationKind;
  instructions: string;
  user: string;
  avoid: string[];
  /** Trimmed optional steer. Empty when the author left the field blank. */
  modifier: string;
};

export type ContextGenerationSource = {
  title?: string | null;
  topic?: string | null;
  description?: string | null;
  notes?: string | null;
  goal?: string | null;
  resources?: readonly {
    title?: string | null;
    url?: string | null;
    description?: string | null;
  }[];
  files?: readonly { name?: string | null }[];
};

function clip(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function textList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const texts: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) texts.push(text);
      continue;
    }
    const record = asRecord(item);
    if (record && typeof record.text === "string" && record.text.trim()) {
      texts.push(record.text.trim());
    }
  }
  return texts;
}

/** Notes, links, and file names the model should read. Empty when Context has no material. */
export function formatContextGenerationSource(source: ContextGenerationSource): string {
  const lines: string[] = [];
  const title = clip(String(source.title || source.topic || ""), 200);
  const topic = clip(String(source.topic || ""), 200);
  const description = clip(String(source.description || ""), 1000);
  const goal = clip(String(source.goal || ""), 500);
  const notes = clip(String(source.notes || ""), 6000);
  if (title) lines.push(`Title: ${title}`);
  if (topic && topic !== title) lines.push(`Topic: ${topic}`);
  if (description) lines.push(`Description: ${description}`);
  if (goal) lines.push(`Existing goal: ${goal}`);
  if (notes) lines.push(`Notes:\n${notes}`);
  for (const resource of source.resources || []) {
    const label = clip(String(resource.title || resource.url || ""), 200);
    if (!label) continue;
    const detail = clip(String(resource.description || ""), 400);
    const url = clip(String(resource.url || ""), 300);
    lines.push(`Link: ${label}${url && url !== label ? ` (${url})` : ""}${detail ? ` — ${detail}` : ""}`);
  }
  for (const file of source.files || []) {
    const name = clip(String(file.name || ""), 200);
    if (name) lines.push(`File: ${name}`);
  }
  return lines.join("\n");
}

export function buildContextGenerationRequest(input: {
  kind: ContextGenerationKind;
  contextText: string;
  avoid?: readonly string[];
  modifier?: string | null;
}): ContextGenerationRequest {
  const avoid = (input.avoid || []).map((item) => item.trim()).filter(Boolean);
  const avoided = avoid.length ? avoid.map((item) => `- ${item}`).join("\n") : "(none)";
  const modifier = clip(String(input.modifier || ""), 500);
  const steer = modifier ? `Modifier prompt:\n${modifier}` : "";
  const shared = [
    "When a modifier prompt is included, follow it without leaving the Context materials.",
  ];
  if (input.kind === "goals") {
    return {
      kind: "goals",
      avoid,
      modifier,
      instructions: [
        "Generate new workspace goals from the Context materials.",
        "Return JSON { \"goals\": string[] } with 4 short natural-language goals.",
        "Do not repeat goals listed under Already generated.",
        "Use only the Context materials. Do not invent a map, TAP session, or knowledge link.",
        ...shared,
      ].join(" "),
      user: [`Context:\n${input.contextText}`, `Already generated:\n${avoided}`, steer]
        .filter(Boolean)
        .join("\n\n"),
    };
  }
  if (input.kind === "calibration_flow") {
    return {
      kind: "calibration_flow",
      avoid,
      modifier,
      instructions: [
        "Generate a calibration question pool from the Context materials.",
        "Return JSON { \"flows\": [ { \"topic\": string, \"questions\": string[] } ] } with one pool.",
        "The topic is the calibration goal, named the way a teacher would introduce it.",
        "Include at least 5 questions. Each question is what a learner reads before deciding whether they could answer it: two or three unhurried sentences, specific to the Context, and free of headings.",
        "This pool is for calibration. It is not a verification flow and it is not one pooled verification question.",
        TUTOR_CANVAS_VOICE,
        "Do not repeat topics listed under Already generated.",
        "Use only the Context materials.",
        ...shared,
      ].join(" "),
      user: [`Context:\n${input.contextText}`, `Already generated:\n${avoided}`, steer]
        .filter(Boolean)
        .join("\n\n"),
    };
  }
  return {
    kind: "verification_flow",
    avoid,
    modifier,
    instructions: [
      "Generate a verification-flow topic and starting questions from the Context materials.",
      "Return JSON { \"flows\": [ { \"topic\": string, \"questions\": string[] } ] } with one flow.",
      "The topic is one subject, named the way a teacher would introduce it, not as a syllabus label.",
      "Include 3 to 5 starting questions. Each question is what a person reads before they answer: two or three unhurried sentences, easy to warm up to, specific to the Context, and free of headings or stacked demands.",
      TUTOR_CANVAS_VOICE,
      "Do not repeat topics listed under Already generated.",
      "Use only the Context materials.",
      ...shared,
    ].join(" "),
    user: [`Context:\n${input.contextText}`, `Already generated:\n${avoided}`, steer]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export function parseContextGoalGeneration(raw: unknown): string[] {
  const record = asRecord(raw);
  return textList(record ? record.goals : raw);
}

export function parseContextFlowGeneration(raw: unknown): ContextFlowDraft[] {
  const record = asRecord(raw);
  const list = record && Array.isArray(record.flows)
    ? record.flows
    : record && (typeof record.topic === "string" || Array.isArray(record.questions))
      ? [record]
      : [];
  const drafts: ContextFlowDraft[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const topic = typeof row.topic === "string" ? row.topic.trim() : "";
    const questions = textList(row.questions);
    if (!topic || questions.length === 0) continue;
    drafts.push({ topic, questions });
  }
  return drafts;
}

export function appendGeneratedGoals(
  pool: readonly ContextGoalCandidate[],
  texts: readonly string[],
): ContextGoalCandidate[] {
  const next = pool.slice();
  for (const raw of texts) {
    const text = raw.trim();
    if (!text) continue;
    next.push({ id: `goal-${next.length + 1}`, text });
  }
  return next;
}

export function appendGeneratedFlows(
  pool: readonly ContextFlowCandidate[],
  drafts: readonly ContextFlowDraft[],
): ContextFlowCandidate[] {
  const next = pool.slice();
  for (const draft of drafts) {
    const topic = draft.topic.trim();
    const questions = draft.questions.map((question) => question.trim()).filter(Boolean);
    if (!topic || questions.length === 0) continue;
    next.push({ id: `flow-${next.length + 1}`, topic, questions });
  }
  return next;
}

export async function generateContextCandidates(input: {
  kind: ContextGenerationKind;
  contextText: string;
  avoid?: readonly string[];
  modifier?: string | null;
  complete: (request: ContextGenerationRequest) => Promise<unknown>;
}): Promise<{ goals: string[]; flows: ContextFlowDraft[] }> {
  const request = buildContextGenerationRequest(input);
  const raw = await input.complete(request);
  if (input.kind === "goals") {
    return { goals: parseContextGoalGeneration(raw), flows: [] };
  }
  return { goals: [], flows: parseContextFlowGeneration(raw) };
}
