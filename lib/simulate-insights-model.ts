/**
 * One model call for a single Simulate Insights step.
 * The job runner calls this twice, in order. It does not return the finished list.
 */

import {
  callXaiJSON,
  parseJsonLoose,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";
import { DEFAULT_MODEL } from "@/lib/xai-models";

export async function callSimulateInsightsModelStep(input: {
  step: 1 | 2;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}): Promise<unknown> {
  const ai = await callXaiJSON<Record<string, unknown>>(
    [systemMessage(input.systemPrompt), userMessage(input.userPrompt)],
    {
      model: input.model || DEFAULT_MODEL,
      maxTokens: input.step === 1 ? 700 : 1200,
      temperature: 0.55,
      retries: 1,
      fetchTimeout: 45_000,
    },
  );
  if (ai.success && ai.data) return ai.data;
  if (ai.rawContent) {
    const recovered = parseJsonLoose<Record<string, unknown>>(ai.rawContent);
    if (recovered.ok) return recovered.data;
  }
  throw new Error(ai.error || `Simulate Insights step ${input.step} failed`);
}
