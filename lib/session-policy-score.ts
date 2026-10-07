/**
 * Distance of a person's action sequence from the prepared tree's prices.
 * The lowest-priced action at each step is the prepared policy. xAI writes those prices.
 * The embedding is the knowledgecfg vector of that distance plus the proof already captured.
 */

import type { IleProofOfWorkUploadItem } from "@/lib/ile-evidence-buffer";
import { encodeKnowledgeConfig, type PowFeatureRow } from "@/lib/knowledge-config/encoder";
import { KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID } from "@/lib/knowledge-config/types";
import {
  advanceSessionBranchModel,
  recommendSessionBranchAction,
  sessionBranchById,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import type { SessionMarkButtonId } from "@/lib/session-marks";

export const SESSION_POLICY_TOOL_NAME = "session_policy";
export const SESSION_POLICY_TOOL_ACTION = "policy_score";

export type PolicyScore = {
  steps: number;
  excess: number;
  distance: number;
  sequence: SessionMarkButtonId[];
};

export type PolicyScoreEmbedding = {
  score: PolicyScore;
  embedding: number[];
  embedding_model_id: typeof KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  text: string;
  toolName: typeof SESSION_POLICY_TOOL_NAME;
  toolAction: typeof SESSION_POLICY_TOOL_ACTION;
  metadata: Record<string, unknown>;
};

const BUTTONS = new Set<SessionMarkButtonId>(["try", "hold", "drop", "insight"]);

/**
 * The first ready model is the tree the session was prepared with.
 * Later publishes are that same tree after a press, and scoring must not start there.
 */
export function rememberPreparedSessionModel(
  prepared: SessionBranchModel | null,
  slot: {
    status?: string | null;
    model?: SessionBranchModel | null;
    birth?: SessionBranchModel | null;
  } | null | undefined,
): SessionBranchModel | null {
  if (slot?.status !== "ready" || !slot.model) return null;
  const birth = slot.birth;
  if (
    birth &&
    birth.step === 0 &&
    birth.rootId === (prepared?.rootId ?? slot.model.rootId) &&
    (!prepared || birth.branches.length > prepared.branches.length)
  ) {
    return birth;
  }
  return prepared ?? slot.model;
}

/** Snapshot the end path scores: the prepared tree, and the presses since it was prepared. */
export function sessionPolicySnapshot(
  prepared: SessionBranchModel | null,
  slot: {
    status?: string | null;
    model?: SessionBranchModel | null;
    birth?: SessionBranchModel | null;
  } | null | undefined,
  presses: readonly { button: SessionMarkButtonId }[] | null | undefined,
): {
  prepared: SessionBranchModel | null;
  snapshot: { model: SessionBranchModel | null; sequence: SessionMarkButtonId[] };
} {
  const model = rememberPreparedSessionModel(prepared, slot);
  return {
    prepared: model,
    snapshot: {
      model,
      sequence: (presses ?? []).map((press) => press.button),
    },
  };
}

/** Replay the prepared tree. Excess is how much dearer each choice was than the lowest price. */
export function scorePolicySequence(
  model: SessionBranchModel,
  sequence: readonly SessionMarkButtonId[],
): PolicyScore {
  let cursor = model;
  let excess = 0;
  const taken: SessionMarkButtonId[] = [];
  for (const action of sequence) {
    const focus = sessionBranchById(cursor, cursor.focusId);
    if (!focus) break;
    const best = recommendSessionBranchAction(cursor, cursor.focusId);
    const chosen = focus.actions.find((row) => row.id === action);
    const chosenPrice = chosen?.price ?? 0;
    const bestPrice = best?.price ?? chosenPrice;
    excess += Math.max(0, chosenPrice - bestPrice);
    taken.push(action);
    const next = advanceSessionBranchModel(cursor, { action, branchId: cursor.focusId });
    if (next === cursor) break;
    cursor = next;
  }
  const steps = taken.length;
  return {
    steps,
    excess,
    distance: excess / Math.max(1, steps),
    sequence: taken,
  };
}

export function embedPolicyScore(input: {
  model: SessionBranchModel;
  sequence: readonly SessionMarkButtonId[];
  workspaceId?: string | null;
  proofRows?: readonly PowFeatureRow[];
  note?: string | null;
}): PolicyScoreEmbedding {
  const score = scorePolicySequence(input.model, input.sequence);
  const text = [
    `policy distance ${score.distance}`,
    `policy excess ${score.excess}`,
    `policy steps ${score.steps}`,
    `policy sequence ${score.sequence.join(" ")}`,
    input.note?.trim() || "",
  ]
    .filter(Boolean)
    .join("\n");
  const actionRows: PowFeatureRow[] = score.sequence.map((action, index) => ({
    proof_of_work_type: "tool",
    timestamp_ms: index + 1,
    tool_name: SESSION_POLICY_TOOL_NAME,
    tool_action: action,
  }));
  const encoded = encodeKnowledgeConfig({
    workspaceId: input.workspaceId?.trim() || "session-policy",
    totalBlocks: 0,
    evaluatedGoalsText: text,
    asOfMs: 1,
    powRows: [...actionRows, ...(input.proofRows ?? [])],
  });
  return {
    score,
    embedding: encoded.vector,
    embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    text,
    toolName: SESSION_POLICY_TOOL_NAME,
    toolAction: SESSION_POLICY_TOOL_ACTION,
    metadata: {
      policy_distance: score.distance,
      policy_excess: score.excess,
      policy_steps: score.steps,
      policy_sequence: score.sequence,
      embedding: encoded.vector,
      embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    },
  };
}

export function policyScoreUploadItem(scored: PolicyScoreEmbedding): IleProofOfWorkUploadItem {
  return {
    kind: "tool",
    mimeType: "application/json",
    fileName: "session-policy-score.json",
    payload: scored.text,
    timestampMs: 1,
    toolName: scored.toolName,
    toolAction: scored.toolAction,
    metadata: scored.metadata,
  };
}

/** A policy-only calibration proof. The embedding rides in the stored events. */
export function policyScoreProofEvent(scored: PolicyScoreEmbedding): {
  type: "policy_score";
  questionId: "policy";
  text: string;
  source: "typed";
} {
  return {
    type: "policy_score",
    questionId: "policy",
    text: scored.text,
    source: "typed",
  };
}

export function policyScoreFromUnknown(
  raw: unknown,
): { model: SessionBranchModel; sequence: SessionMarkButtonId[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { model?: unknown; sequence?: unknown };
  const model = record.model;
  if (!model || typeof model !== "object" || Array.isArray(model)) return null;
  const branches = (model as SessionBranchModel).branches;
  if (!Array.isArray(branches) || branches.length === 0) return null;
  if (!Array.isArray(record.sequence)) return null;
  const sequence = record.sequence.filter((id): id is SessionMarkButtonId =>
    typeof id === "string" && BUTTONS.has(id as SessionMarkButtonId),
  );
  return { model: model as SessionBranchModel, sequence };
}
