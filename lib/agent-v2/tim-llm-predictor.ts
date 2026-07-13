import type { PerformanceReport } from "./performance-report";
import type { InterruptionContext } from "./predictive-interruption";
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

export type TimLlmPredictor = (context: InterruptionContext) => Promise<TimLlmRawPrediction | null>;

let timLlmPredictorOverride: TimLlmPredictor | null = null;

export function setTimLlmPredictorForTests(predictor: TimLlmPredictor | null): void {
  timLlmPredictorOverride = predictor;
}

const TIM_LLM_SCHEMA = {
  name: "tim_interruption_prediction",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      should_interrupt: {
        type: "boolean",
        description: "True only when a timely learner intervention would meaningfully improve proof of work or learning.",
      },
      delay_ms: {
        type: "number",
        description: "Milliseconds before triggering the intervention (15000-600000). Ignored when should_interrupt is false.",
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
          "Short, specific prompt for the learner — grounded in the artifact context, not generic boilerplate.",
      },
      rationale: {
        type: "string",
        description: "Brief explanation of why this intervention fits this moment.",
      },
      consumer_action: {
        type: "string",
        description:
          "Machine hint for the consumer (e.g. present_reflection_prompt, call_analyze_performance, present_verbal_probe).",
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

function summarizeReport(report: PerformanceReport | null | undefined): string | undefined {
  if (!report) return undefined;
  const gaps = report.gap_analysis?.gaps?.slice(0, 3).map((gap) => ({
    title: gap.title,
    severity: gap.severity,
    suggested_repair: gap.suggested_repair,
  }));
  return truncate(
    JSON.stringify(
      {
        overall_score: report.overall_score,
        conversion_score: report.conversion_score,
        conversion_goal: report.conversion_goal,
        summary: report.summary,
        top_gaps: gaps,
      },
      null,
      2,
    ),
    4000,
  );
}

function buildTimPrompt(context: InterruptionContext): Message[] {
  const artifactMeta =
    context.artifact_metadata && Object.keys(context.artifact_metadata).length > 0
      ? truncate(JSON.stringify(context.artifact_metadata, null, 2), 3000)
      : undefined;

  const contextBlock = {
    endpoint: context.endpoint,
    workspace_id: context.workspace_id,
    block_id: context.block_id ?? null,
    proof_of_work_artifacts: context.proof_of_work_artifacts ?? 0,
    tool_name: context.tool_name ?? null,
    tap_action: context.tap_action ?? null,
    mode: context.mode ?? null,
    tap_minutes: context.tap_minutes ?? null,
    workspace_title: context.workspace_title ?? null,
    conversion_goal: context.conversion_goal ?? null,
    artifact_summary: truncate(context.artifact_summary, 2000) ?? null,
    artifact_metadata: artifactMeta ?? null,
    recent_pow_manifest: truncate(context.recent_pow_manifest, 1500) ?? null,
    idle_duration_ms: context.idle_duration_ms ?? null,
    speech_transcript: truncate(context.speech_transcript, 2000) ?? null,
    performance_report: summarizeReport(context.report) ?? null,
  };

  return [
    systemMessage(`You are the Trace Interruption Model (TIM) for OpenLesson proof-of-work APIs.

Your job: decide whether the consumer should schedule a learner intervention after this API response, and if so, what intervention fits semantically.

Rules:
- Prefer null (should_interrupt: false) when the moment is low-signal, routine, or interrupting would break flow.
- Ground message and rationale in the provided artifact_summary, metadata, and session context — never use canned templates.
- Interventions support think-aloud learning (TAP/ILE): reflection, verbal rehearsal, synthesis, metacognitive probes, proof-of-work reminders, performance checkpoints.
- delay_ms: shorter (15-45s) for urgent nudges (idle, hesitation); longer (60-180s) for reflection after deliberate actions; up to 600s for performance reviews.
- consumer_action should be a short snake_case hint for integrators.
- Be conservative: one well-timed nudge beats frequent noise.`),
    userMessage(`Evaluate whether to interrupt after this proof-of-work API event:

${JSON.stringify(contextBlock, null, 2)}

Return should_interrupt: false unless a specific, contextual intervention would help learning verification right now.`),
  ];
}

async function defaultTimLlmPredictor(context: InterruptionContext): Promise<TimLlmRawPrediction | null> {
  if (!process.env.XAI_API_KEY) {
    return null;
  }

  try {
    const response = await callXaiWithSchema<TimLlmRawPrediction>(buildTimPrompt(context), TIM_LLM_SCHEMA, {
      model: DEFAULT_MODEL,
      maxTokens: 600,
      temperature: 0.35,
    });

    if (!response.success || !response.data) {
      return null;
    }

    return response.data;
  } catch (error) {
    console.error("[tim-llm-predictor] LLM prediction failed:", error);
    return null;
  }
}

export async function predictInterruptionWithLlm(
  context: InterruptionContext,
): Promise<TimLlmRawPrediction | null> {
  const predictor = timLlmPredictorOverride ?? defaultTimLlmPredictor;
  return predictor(context);
}