import type { TimFeatureEnvelopeV1 } from "./tim-feature-envelope";
import { TIM_SYSTEM_ROLE } from "@/lib/prompt-kernel/tim";
import { WORKSPACE_ONTOLOGY_COMPACT } from "@/lib/prompt-kernel/ontology";
import {
  callXaiWithSchema,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
  type Message,
} from "@/lib/xai-client";

export interface TimLlmRawPrediction {
  should_interrupt: boolean;
  delay_ms?: number;
  confidence?: "low" | "medium" | "high";
  intervention_type?: string;
  message?: string;
  rationale?: string;
  consumer_action?: string;
}

const TIM_LLM_SCHEMA = {
  name: "tim_interruption_prediction",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      should_interrupt: {
        type: "boolean",
        description:
          "True only when a timely learner intervention would meaningfully improve proof of work, exploration, conversion, or GHC signal quality.",
      },
      delay_ms: {
        type: "number",
        description:
          "Milliseconds before triggering the intervention (15000-600000). Ignored when should_interrupt is false.",
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "How strongly this intervention is warranted right now.",
      },
      intervention_type: {
        type: "string",
        enum: [
          "reflection_prompt",
          "checkpoint_probe",
          "coaching_nudge",
          "proof_of_work_reminder",
          "performance_review",
        ],
        description: "Category of intervention for the consumer system.",
      },
      message: {
        type: "string",
        description:
          "Short, specific prompt for the learner — grounded in the feature envelope, not generic boilerplate. Domain/task language for third-party consumers.",
      },
      rationale: {
        type: "string",
        description: "Brief explanation of why this intervention fits this moment.",
      },
      consumer_action: {
        type: "string",
        description:
          "Machine hint for the consumer (e.g. present_reflection_prompt, call_lwm_snapshot, present_verbal_probe).",
      },
    },
    required: ["should_interrupt"],
    additionalProperties: false,
  },
};

function truncate(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function buildTimPromptFromFeatures(features: TimFeatureEnvelopeV1): Message[] {
  const compact = {
    ...features,
    proof_of_work: {
      ...features.proof_of_work,
      artifact_summary: truncate(features.proof_of_work.artifact_summary, 2000) ?? null,
      recent_manifest: truncate(features.proof_of_work.recent_manifest, 1500) ?? null,
      speech_transcript: truncate(features.proof_of_work.speech_transcript, 2000) ?? null,
      artifact_metadata: features.proof_of_work.artifact_metadata
        ? truncate(JSON.stringify(features.proof_of_work.artifact_metadata), 3000)
        : null,
    },
  };

  return [
    systemMessage(`${WORKSPACE_ONTOLOGY_COMPACT}

${TIM_SYSTEM_ROLE}`),
    userMessage(`Evaluate whether to interrupt after this proof-of-work API event.

Feature envelope (schema_version ${features.schema_version}):
${JSON.stringify(compact, null, 2)}

Return should_interrupt: false unless a specific, contextual intervention would improve LWM Snapshot (lwm_snapshot), GHC signal quality, or fill evidence_appetite.want_more right now.`),
  ];
}

/**
 * Default Grok TIM path over the versioned feature envelope.
 * Returns raw prediction (not yet normalized to consumer interruption shape).
 */
export async function predictRawFromFeaturesWithLlm(
  features: TimFeatureEnvelopeV1,
): Promise<TimLlmRawPrediction | null> {
  if (!process.env.XAI_API_KEY) {
    return null;
  }

  try {
    const response = await callXaiWithSchema<TimLlmRawPrediction>(
      buildTimPromptFromFeatures(features),
      TIM_LLM_SCHEMA,
      {
        model: DEFAULT_MODEL,
        maxTokens: 600,
        temperature: 0.35,
      },
    );

    if (!response.success || !response.data) {
      return null;
    }

    return response.data;
  } catch (error) {
    console.error("[tim-llm-predictor] LLM prediction failed:", error);
    return null;
  }
}
