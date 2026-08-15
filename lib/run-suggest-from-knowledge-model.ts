/**
 * Shared xAI call for Suggest from Knowledge and Suggest from Simulation.
 * Routes stay corpus adapters; this is the only model producer.
 */

import {
  callXaiJSON,
  DEFAULT_MODEL,
  parseJsonLoose,
  systemMessage,
  userMessage,
  type Message,
  type XaiResponse,
} from "@/lib/xai-client";

export type SuggestFromKnowledgeModelPayload = {
  suggestions?: Array<{
    id?: string;
    label?: string;
    prompt?: string;
    rationale?: string;
  }>;
  prompts?: string[];
};

export type SuggestFromKnowledgeModelResult =
  | { ok: true; data: SuggestFromKnowledgeModelPayload }
  | { ok: false; error: string };

export type SuggestFromKnowledgeModelCaller = (
  messages: Message[],
  opts: {
    model: string;
    maxTokens: number;
    temperature: number;
    retries: number;
  },
) => Promise<XaiResponse<SuggestFromKnowledgeModelPayload>>;

export function resolveSuggestModelName(model?: string): string {
  if (typeof model === "string" && model.trim()) {
    return model.replace(/^x-ai\//, "").trim();
  }
  return DEFAULT_MODEL;
}

export async function runSuggestFromKnowledgeModel(
  assembled: { systemPrompt: string; userPrompt: string },
  input: {
    model?: string;
    callModel?: SuggestFromKnowledgeModelCaller;
  } = {},
): Promise<SuggestFromKnowledgeModelResult> {
  const userModel = resolveSuggestModelName(input.model);
  const callModel = input.callModel ?? callXaiJSON<SuggestFromKnowledgeModelPayload>;
  const ai = await callModel(
    [systemMessage(assembled.systemPrompt), userMessage(assembled.userPrompt)],
    {
      model: userModel,
      maxTokens: 1400,
      temperature: 0.55,
      retries: 2,
    },
  );

  let modelPayload: SuggestFromKnowledgeModelPayload | null =
    ai.success && ai.data ? ai.data : null;
  if (!modelPayload && ai.rawContent) {
    const recovered = parseJsonLoose<SuggestFromKnowledgeModelPayload>(ai.rawContent);
    if (recovered.ok) modelPayload = recovered.data;
  }

  if (!modelPayload) {
    return {
      ok: false,
      error:
        ai.error ||
        "Failed to generate suggestions (xAI unavailable or empty response)",
    };
  }
  return { ok: true, data: modelPayload };
}
