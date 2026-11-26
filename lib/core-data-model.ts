/**
 * Canonical types for Learning Maps, knowledge verification protocols,
 * sessions, proof of work, embeddings, and knowledge regions.
 * Storage adapters and UI may use older names; this module is the contract.
 */

export const SESSION_KINDS = ["learn", "verify"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export const SESSION_STATUSES = ["pending", "in_progress", "completed", "revoked"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PROOF_OF_WORK_TYPES = ["tool", "screen", "video", "eeg"] as const;
export type ProofOfWorkType = (typeof PROOF_OF_WORK_TYPES)[number];

export const EMBEDDING_FAMILIES = ["verify"] as const;
export type EmbeddingFamily = (typeof EMBEDDING_FAMILIES)[number];

export const SOUNDING_BANDS = ["unranked", "lost", "localized", "coverage"] as const;
export type SoundingBand = (typeof SOUNDING_BANDS)[number];

export const SOUNDING_RELIABILITIES = ["high", "low"] as const;
export type SoundingReliability = (typeof SOUNDING_RELIABILITIES)[number];

export const EXPERT_PROOF_CHOICES = ["hit", "miss", "cant-tell"] as const;
export type ExpertProofChoice = (typeof EXPERT_PROOF_CHOICES)[number];

export const FLOW_EMBEDDING_ALGORITHM_V1 = "flowcfg-v1-d96" as const;
export const FLOW_EMBEDDING_DIM_V1 = 96 as const;

export const VERIFY_EMBEDDING_MODEL_ID = "verify-flowcfg-v1-d96" as const;

export const EMBEDDING_MODEL_IDS = [VERIFY_EMBEDDING_MODEL_ID] as const;
export type EmbeddingModelId = (typeof EMBEDDING_MODEL_IDS)[number];

export const POW_MODEL_VERSION = "pow-model-v1" as const;

export type FlowQuestion = {
  id: string;
  text: string;
};

export type ProjectedPolicy = {
  sequence: string[];
  steps: number;
  excess: number;
  distance: number;
};

export type SoundingClassification = {
  band: SoundingBand;
  coverageDepth: number;
  reliability: SoundingReliability;
  persistentTerritories: string[];
  falseCoverage: boolean;
};

export type LearnResult = {
  kind: "learn";
  projectedPolicy: ProjectedPolicy | null;
};

export type CalibrateExpertProof = {
  questionId: string;
  source: "gap" | "trusted";
  choice: ExpertProofChoice | null;
  transcript: string | null;
};

export type CalibrateResult = {
  kind: "calibrate";
  uncertainQuestionIds: string[];
  trustedQuestionIds: string[];
  classification: SoundingClassification;
  expertProof: CalibrateExpertProof | null;
};

export type VerifyAnswer = {
  id: string;
  identity: string;
  source: "runner" | "skill";
  questionId: string | null;
  prompt: string;
  createdAt: string;
};

export type VerifyResult = {
  kind: "verify";
  projectedPolicy: ProjectedPolicy | null;
  knowledgeRegionId: string | null;
  answers: VerifyAnswer[];
};

export type SolveResult = {
  kind: "solve";
  projectedPolicy: ProjectedPolicy | null;
};

export type SessionResult = LearnResult | CalibrateResult | VerifyResult | SolveResult;

export type EmbeddingModel = {
  id: EmbeddingModelId;
  family: EmbeddingFamily;
  version: string;
  algorithmId: typeof FLOW_EMBEDDING_ALGORITHM_V1;
  dim: typeof FLOW_EMBEDDING_DIM_V1;
};

export const EMBEDDING_MODELS_V1: readonly EmbeddingModel[] = [
  {
    id: VERIFY_EMBEDDING_MODEL_ID,
    family: "verify",
    version: "v1",
    algorithmId: FLOW_EMBEDDING_ALGORITHM_V1,
    dim: FLOW_EMBEDDING_DIM_V1,
  },
];

export function embeddingModelIdForFamily(_family?: EmbeddingFamily): EmbeddingModelId {
  return VERIFY_EMBEDDING_MODEL_ID;
}

/** Always false as a product. Leftover metadata may still carry a solve_flow_id. */
export function isSolveSession(row: {
  kind?: unknown;
  solve_flow_id?: unknown;
  solveFlowId?: unknown;
}): boolean {
  void row.kind;
  return Boolean(String(row.solve_flow_id ?? row.solveFlowId ?? "").trim());
}

/** Map Learn session: kind learn and no Solve parent. */
export function isMapLearnSession(row: {
  kind?: unknown;
  solve_flow_id?: unknown;
  solveFlowId?: unknown;
}): boolean {
  return parseSessionKind(row.kind) === "learn" && !isSolveSession(row);
}

export function solveFlowIdFromSession(row: {
  kind?: unknown;
  solve_flow_id?: unknown;
  solveFlowId?: unknown;
}): string | null {
  const id = String(row.solve_flow_id ?? row.solveFlowId ?? "").trim();
  return id || null;
}

export function parseSessionKind(value: unknown): SessionKind | null {
  return SESSION_KINDS.includes(value as SessionKind) ? (value as SessionKind) : null;
}

export function parseSoundingBand(value: unknown): SoundingBand | null {
  return SOUNDING_BANDS.includes(value as SoundingBand) ? (value as SoundingBand) : null;
}

export function parseProofOfWorkType(value: unknown): ProofOfWorkType | null {
  return PROOF_OF_WORK_TYPES.includes(value as ProofOfWorkType)
    ? (value as ProofOfWorkType)
    : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseProjectedPolicy(value: unknown): ProjectedPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sequence = asStringArray(record.sequence);
  if (!sequence.length) return null;
  return {
    sequence,
    steps: Math.max(0, Math.round(asFiniteNumber(record.steps, sequence.length))),
    excess: asFiniteNumber(record.excess),
    distance: asFiniteNumber(record.distance),
  };
}

export function parseSoundingClassification(value: unknown): SoundingClassification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const band = parseSoundingBand(record.band);
  if (!band) return null;
  const reliability = SOUNDING_RELIABILITIES.includes(record.reliability as SoundingReliability)
    ? (record.reliability as SoundingReliability)
    : "low";
  return {
    band,
    coverageDepth: Math.max(0, Math.round(asFiniteNumber(record.coverageDepth))),
    reliability,
    persistentTerritories: asStringArray(record.persistentTerritories),
    falseCoverage: record.falseCoverage === true,
  };
}

export function parseSessionResult(value: unknown): SessionResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = parseSessionKind(record.kind);
  if (kind === "learn") {
    return {
      kind: "learn",
      projectedPolicy: parseProjectedPolicy(record.projectedPolicy),
    };
  }
  if (kind === "verify") {
    const answers = Array.isArray(record.answers)
      ? record.answers.flatMap((item): VerifyAnswer[] => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const answer = item as Record<string, unknown>;
          const id = typeof answer.id === "string" ? answer.id.trim() : "";
          const identity = typeof answer.identity === "string" ? answer.identity.trim() : "";
          const prompt = typeof answer.prompt === "string" ? answer.prompt : "";
          if (!id || !identity) return [];
          return [
            {
              id,
              identity,
              source: answer.source === "skill" ? "skill" : "runner",
              questionId:
                typeof answer.questionId === "string" && answer.questionId.trim()
                  ? answer.questionId
                  : null,
              prompt,
              createdAt: typeof answer.createdAt === "string" ? answer.createdAt : "",
            },
          ];
        })
      : [];
    return {
      kind: "verify",
      projectedPolicy: parseProjectedPolicy(record.projectedPolicy),
      knowledgeRegionId:
        typeof record.knowledgeRegionId === "string" && record.knowledgeRegionId.trim()
          ? record.knowledgeRegionId
          : null,
      answers,
    };
  }
  return null;
}

/**
 * Staging stored Calibrate sounding as a JSON string inside events[0].text.
 * Recover a CalibrateResult from that blob or from a typed result.
 */
export function calibrateResultFromLegacyEvents(events: unknown): CalibrateResult | null {
  if (!Array.isArray(events) || events.length === 0) return null;
  const first = events[0];
  if (!first || typeof first !== "object") return null;
  const text = (first as { text?: unknown }).text;
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const classification = parseSoundingClassification({
      band: parsed.sounding_band,
      coverageDepth: parsed.sounding_coverage_depth,
      reliability: parsed.sounding_reliability,
      persistentTerritories: parsed.sounding_persistent_territories,
      falseCoverage: parsed.sounding_false_coverage,
    });
    if (!classification) return null;
    const taps = Array.isArray(parsed.sounding_taps) ? parsed.sounding_taps : [];
    const uncertainQuestionIds = [
      ...new Set(
        taps.flatMap((tap) =>
          tap && typeof tap === "object"
            ? asStringArray((tap as { tappedIds?: unknown }).tappedIds)
            : [],
        ),
      ),
    ];
    const shown = [
      ...new Set(
        taps.flatMap((tap) =>
          tap && typeof tap === "object"
            ? asStringArray((tap as { stillIds?: unknown }).stillIds)
            : [],
        ),
      ),
    ];
    const trustedQuestionIds = shown.filter((id) => !uncertainQuestionIds.includes(id));
    const still = parsed.sounding_proof_still;
    const questionId = typeof still === "string" && still.trim() ? still : null;
    const choice = EXPERT_PROOF_CHOICES.includes(parsed.sounding_proof_choice as ExpertProofChoice)
      ? (parsed.sounding_proof_choice as ExpertProofChoice)
      : null;
    return {
      kind: "calibrate",
      uncertainQuestionIds,
      trustedQuestionIds,
      classification,
      expertProof: questionId
        ? {
            questionId,
            source: "gap",
            choice,
            transcript:
              typeof parsed.sounding_proof_transcript === "string"
                ? parsed.sounding_proof_transcript
                : null,
          }
        : null,
    };
  } catch {
    return null;
  }
}
