/**
 * Stash API (TAP) — temporary PoW buffer + Stash (System 1) / Submit (System 2) flush.
 *
 * Agents stream the same PoW types as the Proof-of-Work API into a short-lived buffer.
 * A Stash or Submit decision drains the buffer into the regular PoW upload path with
 * workspace + user refs and System 1 / System 2 intent metadata, then resets memory.
 *
 * TAPBench sessions attach a timed exercise + session token; flushed PoW is flagged
 * as tapbench pow until the token expires.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import {
  checkProofOfWorkSchema,
  type WorkspaceProofOfWorkType,
  WORKSPACE_PROOF_OF_WORK_WIRE_TYPES,
} from "./workspace-proof-of-work";
import {
  uploadWorkspaceProofOfWork,
  type UploadWorkspaceProofOfWorkInput,
} from "./upload-workspace-proof-of-work";
import {
  TAPBENCH_POW_SOURCE,
  type ResolveTapbenchSessionResult,
} from "./tapbench";
import { alignStashUnitToTapThoughtTrace } from "./tapbench-pow-align";

export const STASH_API_PRODUCT = {
  id: "stash-api",
  name: "Stash API",
  tagline: "TAP — evaluate Agents the same way we evaluate humans with TAP",
  description:
    "Agentic Stash/Submit (TAP): pure-API Think Aloud for agents. Buffer proof of work, then Stash (System 1) or Submit (System 2) into the regular PoW stack. With a TAPBench session token, responses include the exercise and remaining time; flushed PoW is flagged as tapbench pow.",
} as const;

/** Stash = System 1 (fast / parked intent); Submit = System 2 (deliberate commit). */
export type StashDecision = "stash" | "submit";

export type StashSystemFlag = 1 | 2;

export function systemFlagForDecision(decision: StashDecision): StashSystemFlag {
  return decision === "stash" ? 1 : 2;
}

export function traceTypeForDecision(decision: StashDecision): "system1" | "system2" {
  return decision === "stash" ? "system1" : "system2";
}

export interface StashBufferedUnit {
  id: string;
  type: WorkspaceProofOfWorkType;
  /** Original client type alias if provided (e.g. screenshot). */
  type_raw: string;
  mime_type: string;
  /** Base64 payload — same contract as PoW API `data`. */
  data: string;
  block_id: string | null;
  session_id: string | null;
  file_name?: string;
  timestamp_ms: number;
  tool_name: string | null;
  tool_action: string | null;
  metadata: Record<string, unknown>;
  band_powers: Record<string, number> | null;
  device_name: string | null;
  sample_count: number | null;
  pow_model_version: string;
  buffered_at: number;
}

/** Loose body shape from HTTP JSON — all fields unknown until validated. */
export type StashIngestInput = Record<string, unknown> & {
  type?: unknown;
  mime_type?: unknown;
  data?: unknown;
  block_id?: unknown;
  session_id?: unknown;
  file_name?: unknown;
  timestamp_ms?: unknown;
  tool_name?: unknown;
  tool_action?: unknown;
  metadata?: unknown;
  band_powers?: unknown;
  device_name?: unknown;
  sample_count?: unknown;
};

export type StashIngestResult =
  | { ok: true; unit: StashBufferedUnit }
  | { ok: false; code: "validation_error"; message: string };

/** Shared allowed PoW type surface — same wire list as the schema check. */
export const STASH_ALLOWED_POW_TYPES = WORKSPACE_PROOF_OF_WORK_WIRE_TYPES;

export function bufferSubjectId(
  auth: Pick<AuthContext, "user_id" | "guest_user_id" | "key_id" | "auth_method">,
): string {
  if (auth.auth_method === "tapbench_key" && auth.guest_user_id) {
    return `tapbench-guest:${auth.guest_user_id}`;
  }
  if (auth.auth_method === "tapbench_key" && auth.key_id) {
    return `tapbench-key:${auth.key_id}`;
  }
  return auth.user_id || auth.guest_user_id || auth.key_id || "anonymous";
}

export function stashBufferKey(workspaceId: string, subjectId: string): string {
  return `${workspaceId}::${subjectId}`;
}

/**
 * Process-local temporary memory — must be shared across Next.js route module
 * instances (each route bundle can evaluate this file separately). Use globalThis.
 */
type StashGlobal = {
  __openlessonStashBuffers?: Map<string, StashBufferedUnit[]>;
  __openlessonStashUnitSeq?: number;
};

const stashGlobal = globalThis as typeof globalThis & StashGlobal;

function getStashBuffers(): Map<string, StashBufferedUnit[]> {
  if (!stashGlobal.__openlessonStashBuffers) {
    stashGlobal.__openlessonStashBuffers = new Map();
  }
  return stashGlobal.__openlessonStashBuffers;
}

function nextUnitId(): string {
  stashGlobal.__openlessonStashUnitSeq = (stashGlobal.__openlessonStashUnitSeq ?? 0) + 1;
  return `stash_${Date.now()}_${stashGlobal.__openlessonStashUnitSeq}`;
}

/** Test helper: wipe all buffers. */
export function resetAllStashBuffersForTests(): void {
  getStashBuffers().clear();
  stashGlobal.__openlessonStashUnitSeq = 0;
}

export function getStashBufferSize(workspaceId: string, subjectId: string): number {
  return getStashBuffers().get(stashBufferKey(workspaceId, subjectId))?.length ?? 0;
}

export function peekStashBuffer(workspaceId: string, subjectId: string): readonly StashBufferedUnit[] {
  return getStashBuffers().get(stashBufferKey(workspaceId, subjectId)) ?? [];
}

export function clearStashBuffer(workspaceId: string, subjectId: string): void {
  getStashBuffers().delete(stashBufferKey(workspaceId, subjectId));
}

/**
 * Validate a PoW-shaped ingest body without side effects.
 * Reuses PoW type + mime rules so the Stash surface stays aligned.
 */
export function parseStashIngestInput(body: StashIngestInput): StashIngestResult {
  const typeRaw = typeof body.type === "string" ? body.type : "";
  const schema = checkProofOfWorkSchema({
    type: body.type,
    mime_type: body.mime_type,
    data: body.data,
    pow_model_version: body.pow_model_version,
  });
  if (!schema.ok) {
    return {
      ok: false,
      code: "validation_error",
      message: schema.message,
    };
  }

  const rawMetadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  const unit: StashBufferedUnit = {
    id: nextUnitId(),
    type: schema.type,
    type_raw: typeRaw || schema.type,
    mime_type: schema.mime_type,
    data: schema.data,
    block_id: typeof body.block_id === "string" ? body.block_id : null,
    session_id: typeof body.session_id === "string" ? body.session_id : null,
    file_name: typeof body.file_name === "string" ? body.file_name : undefined,
    timestamp_ms: typeof body.timestamp_ms === "number" ? body.timestamp_ms : Date.now(),
    tool_name: typeof body.tool_name === "string" ? body.tool_name : null,
    tool_action: typeof body.tool_action === "string" ? body.tool_action : null,
    metadata: rawMetadata,
    band_powers:
      body.band_powers && typeof body.band_powers === "object" && !Array.isArray(body.band_powers)
        ? (body.band_powers as Record<string, number>)
        : null,
    device_name: typeof body.device_name === "string" ? body.device_name : null,
    sample_count: typeof body.sample_count === "number" ? body.sample_count : null,
    pow_model_version: schema.pow_model_version,
    buffered_at: Date.now(),
  };

  return { ok: true, unit };
}

/** Append a validated unit to temporary memory. */
export function appendToStashBuffer(
  workspaceId: string,
  subjectId: string,
  unit: StashBufferedUnit,
): StashBufferedUnit {
  const key = stashBufferKey(workspaceId, subjectId);
  const buffers = getStashBuffers();
  const list = buffers.get(key) ?? [];
  list.push(unit);
  buffers.set(key, list);
  return unit;
}

/**
 * Ingest + buffer one PoW-shaped unit. Does not call the durable PoW API yet.
 */
export function ingestStashUnit(
  workspaceId: string,
  subjectId: string,
  body: StashIngestInput,
): StashIngestResult {
  const parsed = parseStashIngestInput(body);
  if (!parsed.ok) return parsed;
  appendToStashBuffer(workspaceId, subjectId, parsed.unit);
  return parsed;
}

/** Optional TAPBench context applied on flush / response shaping. */
export interface StashTapbenchContext {
  linkId: string;
  exercise: string;
  expires_at: string;
  remaining_ms: number;
  duration_seconds: number;
  session_token: string;
  block_id: string | null;
  workspace_id: string;
  /** Anonymous guest UUID — all flushed PoW attributed to this subject. */
  guest_user_id: string | null;
}

export function stashTapbenchContextFromResolved(
  resolved: ResolveTapbenchSessionResult,
): StashTapbenchContext {
  return {
    linkId: resolved.link.id,
    exercise: resolved.exercise,
    expires_at: resolved.expires_at,
    remaining_ms: resolved.remaining_ms,
    duration_seconds: resolved.duration_seconds,
    session_token: resolved.session_token,
    block_id: resolved.block_id,
    workspace_id: resolved.workspace_id,
    guest_user_id: resolved.guest_user_id ?? resolved.link.guest_user_id ?? null,
  };
}

/**
 * Metadata attached on flush so scoring / knowledge-config see System 1 vs System 2
 * the same way TAP stash/submit traces do. When tapbench context is present, PoW is
 * flagged as tapbench pow and aligned with human TAP thought-trace metadata (incl. text).
 */
export function buildStashDecisionMetadata(
  decision: StashDecision,
  existing: Record<string, unknown> = {},
  tapbench?: StashTapbenchContext | null,
): Record<string, unknown> {
  const system = systemFlagForDecision(decision);
  const traceType = traceTypeForDecision(decision);
  const base: Record<string, unknown> = {
    ...existing,
    source: tapbench ? TAPBENCH_POW_SOURCE : "stash_api",
    decision,
    system,
    system_n: system,
    stash: decision === "stash",
    submit: decision === "submit",
    trace_type: traceType,
    agentic_product: "stash_api",
  };

  if (tapbench) {
    base.tapbench = true;
    base.pow_source = TAPBENCH_POW_SOURCE;
    base.source_link_kind = TAPBENCH_POW_SOURCE;
    base.source_link_id = tapbench.linkId;
    base.tapbench_link_id = tapbench.linkId;
    // Parity with human TAP metadata.tap_session_id (session-scoped PoW queries)
    base.tap_session_id = tapbench.linkId;
    base.selective_thought = true;
    base.thought_trace = true;
    if (tapbench.guest_user_id) {
      base.guest_user_id = tapbench.guest_user_id;
      base.tapbench_guest_id = tapbench.guest_user_id;
    }
    if (tapbench.block_id && base.block_id === undefined) {
      base.block_id = tapbench.block_id;
    }
  }

  return base;
}

export function unitToPowUploadInput(
  unit: StashBufferedUnit,
  decision: StashDecision,
  tapbench?: StashTapbenchContext | null,
): UploadWorkspaceProofOfWorkInput {
  // TAPBench: rewrite to human TAP thought-trace shape (text + tool_name/action).
  if (tapbench) {
    const aligned = alignStashUnitToTapThoughtTrace(unit, decision, tapbench);
    return {
      workspaceId: "", // filled by caller
      type: aligned.type,
      mime_type: aligned.mime_type,
      data: aligned.data,
      block_id: aligned.block_id,
      session_id: unit.session_id,
      file_name: aligned.file_name,
      timestamp_ms: aligned.timestamp_ms,
      tool_name: aligned.tool_name,
      tool_action: aligned.tool_action,
      metadata: aligned.metadata,
      pow_model_version: unit.pow_model_version,
    };
  }

  const blockId = unit.block_id ?? null;
  return {
    workspaceId: "", // filled by caller
    type: unit.type,
    mime_type: unit.mime_type,
    data: unit.data,
    block_id: blockId,
    session_id: unit.session_id,
    file_name: unit.file_name,
    timestamp_ms: unit.timestamp_ms,
    tool_name: unit.tool_name ?? undefined,
    tool_action: unit.tool_action ?? undefined,
    metadata: buildStashDecisionMetadata(decision, unit.metadata, null),
    pow_model_version: unit.pow_model_version,
  };
}

export type StashPowFlushUploader = (input: {
  unit: StashBufferedUnit;
  decision: StashDecision;
  workspaceId: string;
  auth: AuthContext;
  workspace: { id: string; user_id: string; organization_id: string | null };
  supabase: SupabaseClient;
  tapbench?: StashTapbenchContext | null;
}) => Promise<unknown>;

export interface FlushStashBufferOptions {
  workspaceId: string;
  subjectId: string;
  decision: StashDecision;
  auth: AuthContext;
  workspace: { id: string; user_id: string; organization_id: string | null };
  supabase: SupabaseClient;
  /** When set, flushed PoW is flagged as tapbench pow and block_id may be filled. */
  tapbench?: StashTapbenchContext | null;
  /** Inject for tests — defaults to real uploadWorkspaceProofOfWork. */
  uploader?: StashPowFlushUploader;
}

export type FlushStashBufferResult =
  | {
      ok: true;
      decision: StashDecision;
      system: StashSystemFlag;
      flushed: number;
      empty: boolean;
      proof_of_work: unknown[];
      buffer_remaining: number;
      tapbench: StashTapbenchContext | null;
    }
  | {
      ok: false;
      decision: StashDecision;
      system: StashSystemFlag;
      flushed: number;
      error: string;
      /** Buffer left intact (or with only successfully flushed units removed on partial — we keep all on failure). */
      buffer_remaining: number;
      tapbench: StashTapbenchContext | null;
    };

const defaultUploader: StashPowFlushUploader = async ({
  unit,
  decision,
  workspaceId,
  auth,
  workspace,
  supabase,
  tapbench,
}) => {
  const input = unitToPowUploadInput(unit, decision, tapbench);
  input.workspaceId = workspaceId;
  return uploadWorkspaceProofOfWork(supabase, auth, workspace, input);
};

/**
 * Drain temporary buffer → regular PoW API with System 1 (stash) or System 2 (submit).
 * Empty buffer no-ops cleanly (ok, flushed: 0). Buffer resets only after full success.
 * When tapbench context is provided, each unit is stamped as tapbench pow.
 */
export async function flushStashBuffer(
  options: FlushStashBufferOptions,
): Promise<FlushStashBufferResult> {
  const {
    workspaceId,
    subjectId,
    decision,
    auth,
    workspace,
    supabase,
    tapbench = null,
    uploader = defaultUploader,
  } = options;
  const system = systemFlagForDecision(decision);
  const key = stashBufferKey(workspaceId, subjectId);
  const units = getStashBuffers().get(key) ?? [];

  if (units.length === 0) {
    return {
      ok: true,
      decision,
      system,
      flushed: 0,
      empty: true,
      proof_of_work: [],
      buffer_remaining: 0,
      tapbench,
    };
  }

  // Snapshot then clear only after full success (no half-flushed reset).
  const snapshot = [...units];
  const uploaded: unknown[] = [];

  try {
    for (const unit of snapshot) {
      const row = await uploader({
        unit,
        decision,
        workspaceId,
        auth,
        workspace,
        supabase,
        tapbench,
      });
      uploaded.push(row);
    }
  } catch (error) {
    return {
      ok: false,
      decision,
      system,
      flushed: uploaded.length,
      error: error instanceof Error ? error.message : "Failed to flush stash buffer to PoW API",
      buffer_remaining: getStashBufferSize(workspaceId, subjectId),
      tapbench,
    };
  }

  clearStashBuffer(workspaceId, subjectId);

  return {
    ok: true,
    decision,
    system,
    flushed: uploaded.length,
    empty: false,
    proof_of_work: uploaded,
    buffer_remaining: 0,
    tapbench,
  };
}

/** Shape exercise + timing fields for stash/submit/ingest HTTP responses. */
export function stashExerciseResponseFields(
  tapbench: StashTapbenchContext | null | undefined,
): Record<string, unknown> {
  if (!tapbench) return {};
  return {
    exercise: tapbench.exercise,
    remaining_ms: tapbench.remaining_ms,
    expires_at: tapbench.expires_at,
    duration_seconds: tapbench.duration_seconds,
    session_token: tapbench.session_token,
    tapbench: true,
    tapbench_link_id: tapbench.linkId,
    block_id: tapbench.block_id,
    guest_user_id: tapbench.guest_user_id,
  };
}

/** Decision helpers used by HTTP handlers and tests. */
export async function stashBufferedProofOfWork(
  options: Omit<FlushStashBufferOptions, "decision">,
): Promise<FlushStashBufferResult> {
  return flushStashBuffer({ ...options, decision: "stash" });
}

export async function submitBufferedProofOfWork(
  options: Omit<FlushStashBufferOptions, "decision">,
): Promise<FlushStashBufferResult> {
  return flushStashBuffer({ ...options, decision: "submit" });
}
