/**
 * xAI writes the first Learn Work-canvas prompt from the opening field.
 * Server-only. Client components import helpers from learn-opening-work.ts.
 */

import {
  learnOpeningWorkScopeText,
  resolveLearnOpeningWork,
} from "@/lib/learn-opening-work";
import { composePrompt } from "@/lib/prompt-kernel/compose";
import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import { callXai, systemMessage, userMessage, type JsonSchema } from "@/lib/xai-client";

const SCHEMA: JsonSchema = {
  name: "learn_opening_work",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["workPrompt"],
    properties: {
      workPrompt: { type: "string" },
    },
  },
};

const SYSTEM = composePrompt({
  ontology: "none",
  surface: TUTOR_CANVAS_VOICE,
  task: `Write the first Work canvas prompt for a Learn session.
The learner just opened this hidden-state field. Put them to work inside it.
Reply as JSON with workPrompt: two or three unhurried sentences.
Set a concrete situation from the field, leave room to begin, and invite one try.
Do not write only the chapter title. Do not wrap the title into a stock sentence.
Do not name hidden states, the field, the canvas, or product terms.
Vary the situation so a later session on the same field feels fresh.`,
});

export async function generateLearnOpeningWorkPrompt(
  model: SessionBranchModel,
): Promise<string> {
  const response = await callXai<{ workPrompt?: unknown }>(
    [systemMessage(SYSTEM), userMessage(learnOpeningWorkScopeText(model))],
    {
      maxTokens: 400,
      temperature: 0.75,
      responseFormat: "json_schema",
      jsonSchema: SCHEMA,
      reasoningEffort: "low",
      fetchTimeout: 30_000,
      retries: 1,
    },
  );
  if (!response.success || !response.data || typeof response.data !== "object") return "";
  return typeof response.data.workPrompt === "string" ? response.data.workPrompt.trim() : "";
}

export async function openingWorkForSessionField(
  model: SessionBranchModel,
  salt?: string | null,
): Promise<string> {
  try {
    const generated = await generateLearnOpeningWorkPrompt(model);
    return resolveLearnOpeningWork(model, generated, salt);
  } catch {
    return resolveLearnOpeningWork(model, null, salt);
  }
}
