/**
 * TAPBench 64D snapshot from streamed Stash/Submit traces.
 * One run writes a snapshot. Region construction is a later multi-run step.
 */

import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  encodeKnowledgeConfig,
  type PowFeatureRow,
} from "@/lib/knowledge-config";
import { emptyLearningWorldModel } from "@/lib/prompt-kernel/world-model";
import { TAPBENCH_POW_WRAP_SOURCE } from "./constants";
import {
  parseTapbenchTooling,
  TapbenchToolingError,
  type TapbenchToolingDescription,
} from "./tooling";
import { type TapbenchIssuedKey, type TapbenchKeyStore } from "./keys";

export class TapbenchWrapError extends Error {
  constructor(
    public code:
      | "unauthorized"
      | "forbidden"
      | "validation_error"
      | "not_found"
      | "workspace_not_found"
      | "key_revoked"
      | "key_expired",
    message: string,
  ) {
    super(message);
    this.name = "TapbenchWrapError";
  }
}

export interface TapbenchPowUploadInput {
  type: string;
  mime_type: string;
  data: string;
  block_id?: string | null;
  file_name?: string;
  timestamp_ms?: number;
  tool_name?: string;
  tool_action?: string;
  metadata?: Record<string, unknown>;
}

export interface TapbenchOwnerEmbedding {
  vector: number[];
  as_of_ms: number;
  embedding_model_id?: string;
}

export interface TapbenchWrapIo {
  keyStore?: TapbenchKeyStore;
  persistEmbedding?: (options: {
    workspaceId: string;
    vector: number[];
    key: TapbenchIssuedKey;
  }) => Promise<void>;
  nowMs?: number;
}

export interface TapbenchWrapResult {
  tooling: TapbenchToolingDescription;
  key_id: string;
  snapshot: {
    embedding_model_id: typeof KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
    dim: typeof KNOWLEDGE_CONFIG_DIM;
    pow_event_count: number;
    generated: true;
  };
}

export function powFeatureRowsFromTapbenchUpload(
  input: TapbenchPowUploadInput,
): PowFeatureRow[] {
  const timestamp_ms =
    typeof input.timestamp_ms === "number" && Number.isFinite(input.timestamp_ms)
      ? input.timestamp_ms
      : Date.now();
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {};
  metadata.tapbench = true;
  metadata.pow_source = TAPBENCH_POW_WRAP_SOURCE;
  return [
    {
      proof_of_work_type: input.type,
      type: input.type,
      block_id: input.block_id ?? null,
      timestamp_ms,
      tool_name: input.tool_name ?? null,
      tool_action: input.tool_action ?? null,
      metadata,
    },
  ];
}

/** Persist a 64D knowledge-config snapshot from streamed TAP. Does not build a region. */
export async function snapshotTapbenchPowPayload(
  options: {
    key: TapbenchIssuedKey;
    workspaceId: string;
    proofOfWork: TapbenchPowUploadInput;
    tooling: unknown;
    powRows?: PowFeatureRow[];
  },
  io: TapbenchWrapIo,
): Promise<TapbenchWrapResult> {
  const workspaceId = options.workspaceId;
  const nowMs = io.nowMs ?? Date.now();

  let tooling: TapbenchToolingDescription;
  try {
    tooling = parseTapbenchTooling(options.tooling);
  } catch (err) {
    const message = err instanceof TapbenchToolingError ? err.message : "Invalid tooling";
    throw new TapbenchWrapError("validation_error", message);
  }

  const powRows =
    options.powRows && options.powRows.length > 0
      ? options.powRows
      : powFeatureRowsFromTapbenchUpload(options.proofOfWork);
  const embedding = encodeKnowledgeConfig({
    workspaceId,
    powRows,
    worldModel: emptyLearningWorldModel(workspaceId),
    asOfMs: nowMs,
  });

  if (io.persistEmbedding) {
    await io.persistEmbedding({
      workspaceId,
      vector: embedding.vector,
      key: options.key,
    });
  }

  return {
    tooling,
    key_id: options.key.id,
    snapshot: {
      embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
      dim: KNOWLEDGE_CONFIG_DIM,
      pow_event_count: embedding.pow_event_count,
      generated: true,
    },
  };
}

/** @deprecated Use snapshotTapbenchPowPayload. One flush is a snapshot, not a region. */
export const scoreTapbenchPowPayload = snapshotTapbenchPowPayload;
