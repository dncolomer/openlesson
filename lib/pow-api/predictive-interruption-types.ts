/**
 * Fixed TIM intervention-type catalog. Consumers must handle these values;
 * unknown types normalize to `reflection_prompt`. This is the closed enum.
 * `consumer_action` is a free-form snake_case hint (not a closed catalog).
 */
export const TIM_INTERVENTION_TYPE_CATALOG = [
  "reflection_prompt",
  "checkpoint_probe",
  "coaching_nudge",
  "proof_of_work_reminder",
  "performance_review",
  "chapter_map_expand",
] as const;

/** Trace Interruption Model (TIM) — intervention types a consumer may trigger toward the user. */
export type InterruptionInterventionType = (typeof TIM_INTERVENTION_TYPE_CATALOG)[number];

export interface InterruptionChapterSuggestion {
  topic: string;
  title: string;
  description: string;
  /** ILE chapter that produced the chapter-complete PoW. */
  source_step_id?: string | null;
}

export interface InterruptionIntervention {
  type: InterruptionInterventionType;
  /** Message or prompt the consumer should present to the user. */
  message: string;
  /** Why this intervention is predicted at this moment. */
  rationale?: string;
  /** Machine-oriented hint for the consumer system (e.g. call_lwm_snapshot, expand_chapter_map). */
  consumer_action?: string;
  block_id?: string | null;
  /** When type is chapter_map_expand: first chapter to place (compat with a 1-item list). */
  chapter_suggestion?: InterruptionChapterSuggestion | null;
  /** When type is chapter_map_expand: one or more adjacent chapters to place at once. */
  chapter_suggestions?: InterruptionChapterSuggestion[] | null;
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
  | "upload_ile_chapter_done"
  | "lwm_snapshot"
  | "list_tap_links"
  | "create_tap_link"
  | "get_workspace_detail"
  | "get_world_model"
  | "get_knowledge_config"
  | "get_knowledge_config_trajectory"
  | "knowledge_distance"
  | "list_snapshot_history"
  | "list_custom_knowledge_regions"
  | "create_custom_knowledge_region"
  | "eval_custom_knowledge_region"
  | "buffer_proof_of_work"
  | "stash_proof_of_work"
  | "submit_stashed_proof_of_work";
