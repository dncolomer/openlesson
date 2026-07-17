/** Trace Interruption Model (TIM) — intervention types a consumer may trigger toward the user. */
export type InterruptionInterventionType =
  | "reflection_prompt"
  | "checkpoint_probe"
  | "coaching_nudge"
  | "proof_of_work_reminder"
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
export type ProofOfWorkApiInterruption = PredictiveInterruption | null;

export type ProofOfWorkApiEndpoint =
  | "create_workspace"
  | "list_workspaces"
  | "get_workspace"
  | "list_blocks"
  | "generate_proof_of_work_schema"
  | "generate_integration_skill"
  | "upload_proof_of_work"
  | "upload_tap_trace"
  | "upload_tap_chat"
  | "upload_tap_idle"
  | "upload_tap_speech"
  | "upload_ile_trace"
  | "upload_ile_chat"
  | "upload_ile_idle"
  | "upload_ile_speech"
  | "analyze_performance"
  | "get_learning_progress"
  | "list_tap_links"
  | "create_tap_link"
  | "get_workspace_detail";
