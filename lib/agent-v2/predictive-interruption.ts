import type { PerformanceReport } from "./performance-report";

/** Trace Interruption Model (TIM) — intervention types a consumer may trigger toward the user. */
export type InterruptionInterventionType =
  | "reflection_prompt"
  | "checkpoint_probe"
  | "coaching_nudge"
  | "evidence_reminder"
  | "performance_review";

export interface InterruptionIntervention {
  type: InterruptionInterventionType;
  /** Message or prompt the consumer should present to the user. */
  message: string;
  /** Why this intervention is predicted at this moment. */
  rationale?: string;
  /** Machine-oriented hint for the consumer system (e.g. call analyze_performance). */
  consumer_action?: string;
  block_id?: string | null;
}

export interface PredictiveInterruption {
  /** Unique id for this prediction. A newer response supersedes any pending timer with a different id. */
  interruption_id: string;
  /** Milliseconds to wait before triggering the intervention unless superseded. */
  delay_ms: number;
  intervention: InterruptionIntervention;
  confidence: "low" | "medium" | "high";
  /** ISO-8601 timestamp when this prediction was issued. */
  predicted_at: string;
}

/** null = no interruption predicted (empty interruption). */
export type EvidenceApiInterruption = PredictiveInterruption | null;

export interface InterruptionContract {
  description: string;
  empty_value: null;
  consumer_obligations: string[];
  fields: {
    interruption_id: string;
    delay_ms: string;
    intervention: string;
    confidence: string;
    predicted_at: string;
  };
  supersession_rule: string;
  intervention_types: InterruptionInterventionType[];
  example_active: PredictiveInterruption;
  example_empty: null;
}

export type EvidenceApiEndpoint =
  | "create_workspace"
  | "list_workspaces"
  | "get_workspace"
  | "list_blocks"
  | "generate_evidence_schema"
  | "generate_integration_skill"
  | "upload_evidence"
  | "analyze_performance"
  | "get_learning_progress"
  | "list_tap_links"
  | "get_tap_results"
  | "create_tap_link"
  | "get_workspace_detail";

export interface InterruptionContext {
  endpoint: EvidenceApiEndpoint;
  workspace_id?: string;
  evidence_artifacts?: number;
  block_id?: string | null;
  mode?: "report" | "chat";
  report?: PerformanceReport | null;
  /** Workspace- or LLM-authored interruption candidate from evidence spec generation. */
  llm_interruption?: EvidenceApiInterruption;
  tool_name?: string | null;
  tap_minutes?: number;
}

const DEFAULT_EXAMPLE: PredictiveInterruption = {
  interruption_id: "int_example_001",
  delay_ms: 90_000,
  intervention: {
    type: "reflection_prompt",
    message: "Before moving on, articulate the tradeoff you considered in your last action.",
    rationale: "Recent tool trace shows a decision point without recorded rationale.",
    consumer_action: "present_modal_reflection",
  },
  confidence: "medium",
  predicted_at: "2026-07-10T12:00:00.000Z",
};

export function buildInterruptionContract(): InterruptionContract {
  return {
    description:
      "Every Evidence API success response includes an interruption field powered by the Trace Interruption Model (TIM). When non-null, schedule the intervention after delay_ms unless a later Evidence API response supersedes it.",
    empty_value: null,
    consumer_obligations: [
      "Read interruption on every Evidence API response (REST and MCP).",
      "When interruption is null, do not schedule a new TIM intervention from this response.",
      "When interruption is non-null, schedule consumer_action after delay_ms.",
      "If another Evidence API call returns before the timer fires, cancel the pending timer and apply the newest interruption (or clear if null).",
      "Never stack duplicate timers for the same workspace session — always supersede.",
    ],
    fields: {
      interruption_id: "Stable id for deduplication and supersession tracking.",
      delay_ms: "Non-negative milliseconds before the consumer should trigger the intervention.",
      intervention:
        "type (reflection_prompt | checkpoint_probe | coaching_nudge | evidence_reminder | performance_review), message, optional rationale, consumer_action, optional block_id.",
      confidence: "low | medium | high — how strongly TIM predicts this intervention.",
      predicted_at: "ISO-8601 timestamp when the prediction was issued.",
    },
    supersession_rule:
      "Any subsequent Evidence API response replaces the previous pending interruption. A new non-null interruption cancels the prior timer; null means no new intervention is predicted from that response.",
    intervention_types: [
      "reflection_prompt",
      "checkpoint_probe",
      "coaching_nudge",
      "evidence_reminder",
      "performance_review",
    ],
    example_active: DEFAULT_EXAMPLE,
    example_empty: null,
  };
}

function createInterruptionId(endpoint: EvidenceApiEndpoint, workspaceId?: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  const scope = workspaceId ? workspaceId.slice(0, 8) : "global";
  return `int_${endpoint}_${scope}_${suffix}`;
}

function clampDelayMs(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function normalizePredictedInterruption(
  raw: unknown,
  fallbackEndpoint: EvidenceApiEndpoint,
  workspaceId?: string
): EvidenceApiInterruption {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const interventionRaw = record.intervention;
  if (!interventionRaw || typeof interventionRaw !== "object" || Array.isArray(interventionRaw)) {
    return null;
  }

  const intervention = interventionRaw as Record<string, unknown>;
  const type = intervention.type;
  const message = typeof intervention.message === "string" ? intervention.message.trim() : "";
  if (!message) return null;

  const allowedTypes: InterruptionInterventionType[] = [
    "reflection_prompt",
    "checkpoint_probe",
    "coaching_nudge",
    "evidence_reminder",
    "performance_review",
  ];
  const interventionType = allowedTypes.includes(type as InterruptionInterventionType)
    ? (type as InterruptionInterventionType)
    : "reflection_prompt";

  const confidenceRaw = record.confidence;
  const confidence =
    confidenceRaw === "low" || confidenceRaw === "medium" || confidenceRaw === "high"
      ? confidenceRaw
      : "medium";

  return {
    interruption_id:
      typeof record.interruption_id === "string" && record.interruption_id.trim()
        ? record.interruption_id.trim()
        : createInterruptionId(fallbackEndpoint, workspaceId),
    delay_ms: clampDelayMs(Number(record.delay_ms), 15_000, 600_000),
    intervention: {
      type: interventionType,
      message: message.slice(0, 2000),
      rationale:
        typeof intervention.rationale === "string" ? intervention.rationale.trim().slice(0, 2000) : undefined,
      consumer_action:
        typeof intervention.consumer_action === "string"
          ? intervention.consumer_action.trim().slice(0, 500)
          : undefined,
      block_id:
        typeof intervention.block_id === "string"
          ? intervention.block_id
          : intervention.block_id === null
            ? null
            : undefined,
    },
    confidence,
    predicted_at: new Date().toISOString(),
  };
}

function interruptionFromPerformanceReport(
  report: PerformanceReport | null | undefined,
  context: InterruptionContext
): EvidenceApiInterruption {
  if (!report) return null;

  const topGap = report.gap_analysis?.gaps?.find((gap) => gap.severity === "high") ||
    report.gap_analysis?.gaps?.find((gap) => gap.severity === "medium") ||
    report.gap_analysis?.gaps?.[0];

  if (topGap) {
    return {
      interruption_id: createInterruptionId("analyze_performance", context.workspace_id),
      delay_ms: topGap.severity === "high" ? 45_000 : 90_000,
      intervention: {
        type: "coaching_nudge",
        message: topGap.suggested_repair || `Address: ${topGap.title}`,
        rationale: topGap.evidence || report.gap_analysis.summary,
        consumer_action: "surface_coaching_nudge",
        block_id: context.block_id ?? null,
      },
      confidence: topGap.severity === "high" ? "high" : "medium",
      predicted_at: new Date().toISOString(),
    };
  }

  if (report.overall_score < 60) {
    return {
      interruption_id: createInterruptionId("analyze_performance", context.workspace_id),
      delay_ms: 120_000,
      intervention: {
        type: "reflection_prompt",
        message: "What part of this workflow felt least confident before your last action?",
        rationale: report.summary || "Readiness score suggests a reflection checkpoint would help.",
        consumer_action: "present_reflection_prompt",
        block_id: context.block_id ?? null,
      },
      confidence: "medium",
      predicted_at: new Date().toISOString(),
    };
  }

  return null;
}

export function predictInterruption(context: InterruptionContext): EvidenceApiInterruption {
  if (context.llm_interruption) {
    return context.llm_interruption;
  }

  const evidenceCount = context.evidence_artifacts ?? 0;

  switch (context.endpoint) {
    case "create_workspace":
      return {
        interruption_id: createInterruptionId("create_workspace", context.workspace_id),
        delay_ms: 60_000,
        intervention: {
          type: "evidence_reminder",
          message: "Generate an evidence schema and upload your first tool trace for this workspace.",
          rationale: "New workspaces need initial evidence before learning verification can begin.",
          consumer_action: "call_generate_evidence_schema",
        },
        confidence: "high",
        predicted_at: new Date().toISOString(),
      };

    case "generate_evidence_schema":
      if (evidenceCount === 0) {
        return {
          interruption_id: createInterruptionId("generate_evidence_schema", context.workspace_id),
          delay_ms: 30_000,
          intervention: {
            type: "evidence_reminder",
            message: "Upload your first evidence artifact using the tool_submissions contract.",
            rationale: "Evidence spec is ready; verification improves once tool traces arrive.",
            consumer_action: "call_upload_evidence",
            block_id: context.block_id ?? null,
          },
          confidence: "high",
          predicted_at: new Date().toISOString(),
        };
      }
      if (evidenceCount > 0 && evidenceCount % 5 === 0) {
        return {
          interruption_id: createInterruptionId("generate_evidence_schema", context.workspace_id),
          delay_ms: 90_000,
          intervention: {
            type: "performance_review",
            message: "Request a refreshed performance scorecard after this evidence milestone.",
            rationale: `${evidenceCount} artifacts accumulated — scores may have shifted.`,
            consumer_action: "call_analyze_performance",
            block_id: context.block_id ?? null,
          },
          confidence: "medium",
          predicted_at: new Date().toISOString(),
        };
      }
      return null;

    case "generate_integration_skill":
      return {
        interruption_id: createInterruptionId("generate_integration_skill", context.workspace_id),
        delay_ms: 45_000,
        intervention: {
          type: "evidence_reminder",
          message: "Begin uploading evidence per the integration skill and live evidence spec.",
          rationale: "Integration skill is a snapshot — proof-of-work uploads activate continuous evaluation.",
          consumer_action: "call_upload_evidence",
          block_id: context.block_id ?? null,
        },
        confidence: "medium",
        predicted_at: new Date().toISOString(),
      };

    case "upload_evidence":
      if (evidenceCount > 0 && evidenceCount % 5 === 0) {
        return {
          interruption_id: createInterruptionId("upload_evidence", context.workspace_id),
          delay_ms: 60_000,
          intervention: {
            type: "performance_review",
            message: "Run a performance report to see updated marker scores and gaps.",
            rationale: `Reached ${evidenceCount} evidence artifacts — good checkpoint for scoring.`,
            consumer_action: "call_analyze_performance",
            block_id: context.block_id ?? null,
          },
          confidence: "high",
          predicted_at: new Date().toISOString(),
        };
      }
      if (context.tool_name) {
        return {
          interruption_id: createInterruptionId("upload_evidence", context.workspace_id),
          delay_ms: 75_000,
          intervention: {
            type: "reflection_prompt",
            message: "Briefly note why you chose that action before continuing the workflow.",
            rationale: `Tool trace from ${context.tool_name} benefits from explicit rationale.`,
            consumer_action: "present_reflection_prompt",
            block_id: context.block_id ?? null,
          },
          confidence: "low",
          predicted_at: new Date().toISOString(),
        };
      }
      return null;

    case "analyze_performance":
      if (context.mode === "chat") {
        return {
          interruption_id: createInterruptionId("analyze_performance", context.workspace_id),
          delay_ms: 120_000,
          intervention: {
            type: "checkpoint_probe",
            message: "Apply one coaching suggestion from the last answer in your next product action.",
            rationale: "Chat coaching is most effective when followed by observable practice.",
            consumer_action: "prompt_apply_coaching",
            block_id: context.block_id ?? null,
          },
          confidence: "medium",
          predicted_at: new Date().toISOString(),
        };
      }
      return interruptionFromPerformanceReport(context.report, context);

    case "get_learning_progress":
      if (evidenceCount === 0) {
        return {
          interruption_id: createInterruptionId("get_learning_progress", context.workspace_id),
          delay_ms: 20_000,
          intervention: {
            type: "evidence_reminder",
            message: "Call generate_evidence_schema, then upload your first tool evidence.",
            rationale: "No artifacts yet — progress tracking needs proof-of-work uploads.",
            consumer_action: "call_generate_evidence_schema",
          },
          confidence: "high",
          predicted_at: new Date().toISOString(),
        };
      }
      if (evidenceCount >= 3) {
        return {
          interruption_id: createInterruptionId("get_learning_progress", context.workspace_id),
          delay_ms: 90_000,
          intervention: {
            type: "performance_review",
            message: "Request analyze_performance for an updated readiness scorecard.",
            rationale: `${evidenceCount} artifacts provide enough signal for meaningful scoring.`,
            consumer_action: "call_analyze_performance",
          },
          confidence: "medium",
          predicted_at: new Date().toISOString(),
        };
      }
      return null;

    case "create_tap_link":
      return {
        interruption_id: createInterruptionId("create_tap_link", context.workspace_id),
        delay_ms: clampDelayMs((context.tap_minutes ?? 15) * 60_000 * 0.25, 60_000, 300_000),
        intervention: {
          type: "checkpoint_probe",
          message: "Before the TAP session, state your hypothesis for this block out loud.",
          rationale: "Think Aloud Protocol works best when the learner enters with a clear prediction.",
          consumer_action: "present_pre_tap_probe",
          block_id: context.block_id ?? null,
        },
        confidence: "medium",
        predicted_at: new Date().toISOString(),
      };

    case "list_workspaces":
    case "get_workspace":
    case "get_workspace_detail":
    case "list_blocks":
    case "list_tap_links":
    case "get_tap_results":
    default:
      return null;
  }
}

export function withEvidenceApiResponse<T extends Record<string, unknown>>(
  payload: T,
  context: InterruptionContext
): T & { interruption: EvidenceApiInterruption } {
  return {
    ...payload,
    interruption: predictInterruption(context),
  };
}

export function formatInterruptionContractForSkillPrompt(): string {
  const contract = buildInterruptionContract();
  return `Predictive interruptions (TIM — Trace Interruption Model):
${contract.description}

Consumer obligations:
${contract.consumer_obligations.map((line) => `- ${line}`).join("\n")}

Supersession: ${contract.supersession_rule}

Intervention types: ${contract.intervention_types.join(", ")}

Example active interruption:
${JSON.stringify(contract.example_active, null, 2)}

Empty interruption (no prediction): null`;
}