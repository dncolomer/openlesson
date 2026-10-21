/**
 * Distance of a person's hidden-state path from the prepared tree's prices.
 * The cheapest outgoing edge at each step is the prepared policy. xAI writes those prices.
 * The embedding is the knowledgecfg vector of that distance plus the proof already captured.
 */

import type { IleProofOfWorkUploadItem } from "@/lib/learn-evidence-buffer";
import { encodeKnowledgeConfig, type PowFeatureRow } from "@/lib/knowledge-config/encoder";
import { KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID } from "@/lib/knowledge-config/types";
import {
  advanceSessionBranchModel,
  recommendSessionBranchAction,
  sessionBranchById,
  sessionBranchEdgeBetween,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

export const SESSION_POLICY_TOOL_NAME = "session_policy";
export const SESSION_POLICY_TOOL_ACTION = "policy_score";

export type PolicyScore = {
  steps: number;
  excess: number;
  distance: number;
  sequence: string[];
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
  presses: readonly { hiddenStateId?: string; button?: string }[] | null | undefined,
): {
  prepared: SessionBranchModel | null;
  snapshot: { model: SessionBranchModel | null; sequence: string[] };
} {
  const model = rememberPreparedSessionModel(prepared, slot);
  return {
    prepared: model,
    snapshot: {
      model,
      sequence: (presses ?? [])
        .map((press) => String(press.hiddenStateId || press.button || "").trim())
        .filter(Boolean),
    },
  };
}

/** The end screen reads the same snapshot the upload scored. No model means there is no score yet. */
export function policyScoreFromSnapshot(
  snapshot:
    | {
        model?: SessionBranchModel | null;
        sequence?: readonly string[] | null;
      }
    | null
    | undefined,
): PolicyScore | null {
  if (!snapshot?.model) return null;
  return scorePolicySequence(snapshot.model, snapshot.sequence ?? []);
}

/** Replay the prepared tree. Excess is how much dearer each choice was than the lowest price. */
export function scorePolicySequence(
  model: SessionBranchModel,
  sequence: readonly string[],
): PolicyScore {
  let cursor = model;
  let excess = 0;
  const taken: string[] = [];
  for (const hiddenStateId of sequence) {
    const focus = sessionBranchById(cursor, cursor.focusId);
    if (!focus) break;
    const target = sessionBranchById(cursor, hiddenStateId);
    if (!target) break;
    const best = recommendSessionBranchAction(cursor, cursor.focusId);
    const chosen = sessionBranchEdgeBetween(cursor, cursor.focusId, target.id);
    const chosenPrice = chosen?.price ?? 0;
    const bestPrice = best?.price ?? chosenPrice;
    excess += Math.max(0, chosenPrice - bestPrice);
    taken.push(target.id);
    const next = advanceSessionBranchModel(cursor, { toId: target.id, fromId: cursor.focusId });
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
  sequence: readonly string[];
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
): { model: SessionBranchModel; sequence: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { model?: unknown; sequence?: unknown };
  const model = record.model;
  if (!model || typeof model !== "object" || Array.isArray(model)) return null;
  const branches = (model as SessionBranchModel).branches;
  if (!Array.isArray(branches) || branches.length === 0) return null;
  if (!Array.isArray(record.sequence)) return null;
  const sequence = record.sequence.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
  return { model: model as SessionBranchModel, sequence };
}
