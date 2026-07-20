import type {
  InterruptionInterventionType,
  ProofOfWorkApiEndpoint,
  ProofOfWorkApiInterruption,
} from "./predictive-interruption-types";

export type {
  InterruptionInterventionType,
  ProofOfWorkApiEndpoint,
  ProofOfWorkApiInterruption,
} from "./predictive-interruption-types";

function createInterruptionId(endpoint: ProofOfWorkApiEndpoint, workspaceId?: string): string {
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
  fallbackEndpoint: ProofOfWorkApiEndpoint,
  workspaceId?: string,
): ProofOfWorkApiInterruption {
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
    "proof_of_work_reminder",
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
