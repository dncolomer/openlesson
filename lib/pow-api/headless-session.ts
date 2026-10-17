/**
 * Headless proof-of-work sessions: start, ingest PoW, infer path on the
 * prepared answers-model tree, enforce the session clock, end.
 * Calibrate / Learn / Verify share this entry.
 */

import { randomUUID } from "node:crypto";
import {
  persistCompletedFlowEmbedding,
  type StoredFlowEmbedding,
} from "@/lib/flow-embedding-store";
import type { FlowKind, FlowPowRow } from "@/lib/flow-embedding";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
import {
  sessionBranchById,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import {
  applyPolicyInference,
  sessionPolicyProofFromCanvas,
  type SessionPolicyInference,
  type SessionPolicyProofEvent,
} from "@/lib/session-policy-infer";
import { generateSessionBranchModel } from "@/lib/session-branch-model-generate";
import { inferSessionPolicyReply } from "@/lib/session-policy-infer-xai";
import { scorePolicySequence } from "@/lib/session-policy-score";
import type { SessionMarkButtonId } from "@/lib/session-marks";
import {
  TAP_LINK_DEFAULT_MINUTES,
  TAP_LINK_MAX_MINUTES,
  TAP_LINK_MIN_MINUTES,
  normalizeTapLinkMinutes,
} from "./tap-link-config";
import {
  listHeadlessSessionRecords,
  loadHeadlessSessionRecord,
  resetHeadlessSessionStore,
  saveHeadlessSessionRecord,
  setHeadlessSessionDurableBackendForTests,
} from "./headless-session-store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import {
  uploadWorkspaceProofOfWork,
  type UploadWorkspaceProofOfWorkWorkspace,
} from "./upload-workspace-proof-of-work";

export {
  setHeadlessSessionDurableBackendForTests,
} from "./headless-session-store";
export type { HeadlessSessionDurableBackend } from "./headless-session-store";

export const HEADLESS_FLOW_KINDS = ["calibrate", "learn", "verify"] as const;
export type HeadlessFlowKind = (typeof HEADLESS_FLOW_KINDS)[number];

export const HEADLESS_SESSION_EXPIRED_CODE = "session_expired" as const;
export const HEADLESS_SESSION_ENDED_CODE = "session_ended" as const;

const DEPS_KEY = "__openlessonHeadlessSessionDeps";

export type HeadlessSessionRecord = {
  id: string;
  workspace_id: string;
  block_id: string | null;
  flow_kind: HeadlessFlowKind;
  catalog_size: LearningModelSize;
  chapter_title: string;
  chapter_brief: string;
  started_at_ms: number;
  duration_ms: number;
  expires_at_ms: number;
  status: "in_progress" | "ended" | "expired";
  prepared: SessionBranchModel;
  model: SessionBranchModel;
  sequence: SessionMarkButtonId[];
  inferences: SessionPolicyInference[];
  proof: FlowPowRow[];
  source: "agent";
  embedding: StoredFlowEmbedding | null;
};

export type HeadlessSessionDeps = {
  nowMs?: () => number;
  generateModel?: typeof generateSessionBranchModel;
  inferPolicy?: typeof inferSessionPolicyReply;
};

type DepsStore = {
  deps: HeadlessSessionDeps;
};

function depsStore(): DepsStore {
  const scope = globalThis as typeof globalThis & { [DEPS_KEY]?: DepsStore };
  if (!scope[DEPS_KEY]) {
    scope[DEPS_KEY] = { deps: {} };
  }
  return scope[DEPS_KEY];
}

export function resetHeadlessSessionsForTests(): void {
  depsStore().deps = {};
  resetHeadlessSessionStore("unknown");
}

export function setHeadlessSessionDepsForTests(deps: HeadlessSessionDeps): void {
  depsStore().deps = { ...depsStore().deps, ...deps };
}

function nowMs(): number {
  return depsStore().deps.nowMs?.() ?? Date.now();
}

function generateModel(): typeof generateSessionBranchModel {
  return depsStore().deps.generateModel ?? generateSessionBranchModel;
}

function inferPolicy(): typeof inferSessionPolicyReply {
  return depsStore().deps.inferPolicy ?? inferSessionPolicyReply;
}

export function parseHeadlessFlowKind(value: unknown): HeadlessFlowKind | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "scout") return "calibrate";
  if (trimmed === "explore") return "learn";
  if (trimmed === "verification") return "verify";
  return (HEADLESS_FLOW_KINDS as readonly string[]).includes(trimmed)
    ? (trimmed as HeadlessFlowKind)
    : null;
}

export function flowKindForEmbedding(kind: HeadlessFlowKind): FlowKind {
  return kind;
}

export function remainingMs(session: HeadlessSessionRecord, atMs = nowMs()): number {
  if (session.status === "ended" || session.status === "expired") return 0;
  return Math.max(0, session.expires_at_ms - atMs);
}

export function clockExpired(session: HeadlessSessionRecord, atMs = nowMs()): boolean {
  if (session.status === "ended") return false;
  return atMs >= session.expires_at_ms;
}

function markExpiredIfNeeded(session: HeadlessSessionRecord, atMs = nowMs()): HeadlessSessionRecord {
  if (session.status === "in_progress" && clockExpired(session, atMs)) {
    session.status = "expired";
  }
  return session;
}

function presentFocus(model: SessionBranchModel) {
  const focus = sessionBranchById(model, model.focusId) ?? model.branches[0] ?? null;
  return focus
    ? {
        id: focus.id,
        title: focus.title,
        question: focus.question,
        territory: focus.territory,
        observation: focus.observation,
        depth: focus.depth,
        status: focus.status,
      }
    : null;
}

export function presentHeadlessSession(session: HeadlessSessionRecord, atMs = nowMs()) {
  markExpiredIfNeeded(session, atMs);
  return {
    session_id: session.id,
    workspace_id: session.workspace_id,
    block_id: session.block_id,
    flow_kind: session.flow_kind,
    catalog_size: session.catalog_size,
    chapter_title: session.chapter_title,
    status: session.status,
    started_at: new Date(session.started_at_ms).toISOString(),
    expires_at: new Date(session.expires_at_ms).toISOString(),
    remaining_ms: remainingMs(session, atMs),
    duration_ms: session.duration_ms,
    source: session.source,
    proof_count: session.proof.length,
    proof_file_ids: session.proof
      .map((row) => row.xai_file_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
    sequence: session.sequence,
    inferences: session.inferences,
    focus: presentFocus(session.model),
    answers_model: {
      catalog_size: session.prepared.catalogSize,
      chapter_title: session.prepared.chapterTitle,
      root_id: session.prepared.rootId,
      focus_id: session.model.focusId,
      step: session.model.step,
      branch_count: session.prepared.branches.length,
    },
    embedding: session.embedding
      ? {
          id: session.embedding.id,
          flow_kind: session.embedding.flow_kind,
          vector: session.embedding.vector,
          raw: session.embedding.raw,
        }
      : null,
  };
}

export type StartHeadlessSessionInput = {
  workspaceId: string;
  blockId?: string | null;
  flowKind: HeadlessFlowKind;
  catalogSize?: unknown;
  durationMinutes?: unknown;
  chapterTitle?: string | null;
  chapterBrief?: string | null;
  preparedModel?: SessionBranchModel | null;
};

export async function startHeadlessSession(
  input: StartHeadlessSessionInput,
): Promise<HeadlessSessionRecord> {
  const flowKind = parseHeadlessFlowKind(input.flowKind);
  if (!flowKind) {
    throw new Error("flow_kind must be calibrate, learn, or verify.");
  }
  const chapterTitle = (input.chapterTitle || "").trim() || "Session";
  const chapterBrief = (input.chapterBrief || "").trim();
  const catalogSize = parseLearningModelSize(input.catalogSize);
  const minutes = normalizeTapLinkMinutes(
    input.durationMinutes,
    TAP_LINK_DEFAULT_MINUTES,
  );
  const clamped = Math.min(TAP_LINK_MAX_MINUTES, Math.max(TAP_LINK_MIN_MINUTES, minutes));
  const durationMs = clamped * 60_000;
  const started = nowMs();

  let prepared = input.preparedModel ?? null;
  if (!prepared) {
    const generated = await generateModel()({
      chapterTitle,
      chapterBrief,
      catalogSize,
    });
    if (!generated.ok) {
      throw new Error(generated.error || "Failed to prepare the answers model.");
    }
    prepared = generated.model;
  }

  const record: HeadlessSessionRecord = {
    id: randomUUID(),
    workspace_id: input.workspaceId,
    block_id: input.blockId?.trim() || null,
    flow_kind: flowKind,
    catalog_size: prepared.catalogSize || catalogSize,
    chapter_title: chapterTitle,
    chapter_brief: chapterBrief,
    started_at_ms: started,
    duration_ms: durationMs,
    expires_at_ms: started + durationMs,
    status: "in_progress",
    prepared,
    model: prepared,
    sequence: [],
    inferences: [],
    proof: [],
    source: "agent",
    embedding: null,
  };
  await saveHeadlessSessionRecord(record);
  return record;
}

export async function getHeadlessSession(
  sessionId: string,
): Promise<HeadlessSessionRecord | null> {
  const record = await loadHeadlessSessionRecord(sessionId);
  if (!record) return null;
  const marked = markExpiredIfNeeded(record);
  if (marked.status !== "in_progress") {
    await saveHeadlessSessionRecord(marked);
  }
  return marked;
}

export class HeadlessSessionError extends Error {
  code: string;
  details: Record<string, unknown>;
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export type HeadlessProofEventInput = {
  type?: string | null;
  tool_name?: string | null;
  tool_action?: string | null;
  toolAction?: string | null;
  payload?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp_ms?: number | null;
};

function asPowRow(event: HeadlessProofEventInput, index: number): FlowPowRow {
  const toolAction =
    (typeof event.tool_action === "string" && event.tool_action.trim()) ||
    (typeof event.toolAction === "string" && event.toolAction.trim()) ||
    "";
  return {
    type: typeof event.type === "string" && event.type.trim() ? event.type.trim() : "tool",
    tool_name: typeof event.tool_name === "string" ? event.tool_name : "headless_session",
    tool_action: toolAction || "event",
    timestamp_ms: event.timestamp_ms ?? nowMs() + index,
    payload: event.payload ?? null,
    metadata: event.metadata ?? null,
  };
}

async function rejectIfClosed(session: HeadlessSessionRecord): Promise<void> {
  const at = nowMs();
  markExpiredIfNeeded(session, at);
  if (session.status === "ended") {
    await saveHeadlessSessionRecord(session);
    throw new HeadlessSessionError(
      HEADLESS_SESSION_ENDED_CODE,
      "This session has already ended.",
      { session_id: session.id, remaining_ms: 0 },
    );
  }
  if (session.status === "expired" || remainingMs(session, at) <= 0) {
    session.status = "expired";
    await saveHeadlessSessionRecord(session);
    throw new HeadlessSessionError(
      HEADLESS_SESSION_EXPIRED_CODE,
      "This session has expired. Further proof of work is rejected.",
      {
        session_id: session.id,
        expires_at: new Date(session.expires_at_ms).toISOString(),
        remaining_ms: 0,
      },
    );
  }
}

export async function ingestHeadlessProofOfWork(input: {
  sessionId: string;
  events?: HeadlessProofEventInput[] | null;
  persistFiles?: {
    supabase: SupabaseClient;
    auth: AuthContext;
    workspace: UploadWorkspaceProofOfWorkWorkspace;
  } | null;
}): Promise<HeadlessSessionRecord> {
  const session = await getHeadlessSession(input.sessionId);
  if (!session) {
    throw new HeadlessSessionError("session_not_found", "Session not found.");
  }
  await rejectIfClosed(session);

  const events = Array.isArray(input.events) ? input.events : [];
  if (!events.length) {
    throw new HeadlessSessionError("validation_error", "proof of work events are required.");
  }

  const rows = events.map((event, index) => asPowRow(event, index));
  if (input.persistFiles) {
    const { supabase, auth, workspace } = input.persistFiles;
    for (const row of rows) {
      const payload = {
        type: row.type,
        tool_name: row.tool_name,
        tool_action: row.tool_action,
        timestamp_ms: row.timestamp_ms,
        payload: row.payload ?? null,
        metadata: row.metadata ?? null,
        flow_kind: session.flow_kind,
        headless_session_id: session.id,
      };
      const uploaded = await uploadWorkspaceProofOfWork(supabase, auth, workspace, {
        workspaceId: session.workspace_id,
        type: row.type || "tool",
        mime_type: "application/json",
        data: Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64"),
        block_id: session.block_id,
        session_id: session.id,
        file_name: `headless-${session.flow_kind}-${row.tool_action || "event"}-${row.timestamp_ms || Date.now()}.json`,
        timestamp_ms: typeof row.timestamp_ms === "number" ? row.timestamp_ms : Date.now(),
        tool_name: row.tool_name || "headless_session",
        tool_action: row.tool_action || "event",
        metadata: {
          ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
          flow_kind: session.flow_kind,
          headless_session_id: session.id,
        },
      });
      row.xai_file_id =
        typeof uploaded.xai_file_id === "string" ? uploaded.xai_file_id : null;
    }
  }
  session.proof.push(...rows);

  const proofEvents: SessionPolicyProofEvent[] = sessionPolicyProofFromCanvas(
    rows.map((row) => ({
      toolAction: row.tool_action,
      metadata: row.metadata,
    })),
  );

  if (proofEvents.length) {
    const inferred = await inferPolicy()({
      events: proofEvents,
      chapterTitle: session.chapter_title,
      chapterBrief: session.chapter_brief,
    });
    if (inferred.ok) {
      const applied = applyPolicyInference(session.model, inferred.reply);
      if (applied) {
        session.model = applied.model;
        session.inferences = [...session.inferences, applied.entry];
        session.sequence = [...session.sequence, applied.entry.action];
      }
    }
  }

  await saveHeadlessSessionRecord(session);
  return session;
}

export async function endHeadlessSession(sessionId: string): Promise<HeadlessSessionRecord> {
  const session = await getHeadlessSession(sessionId);
  if (!session) {
    throw new HeadlessSessionError("session_not_found", "Session not found.");
  }
  if (session.status === "ended" && session.embedding) {
    return session;
  }

  const score = scorePolicySequence(session.prepared, session.sequence);
  const embedding = await persistCompletedFlowEmbedding({
    workspaceId: session.workspace_id,
    flowKind: flowKindForEmbedding(session.flow_kind),
    runId: session.id,
    source: "headless",
    model: session.prepared,
    catalogSize: session.catalog_size,
    sequence: session.sequence,
    pow: session.proof,
  });
  session.embedding = embedding;
  session.status = session.status === "expired" ? "expired" : "ended";
  void score;
  await saveHeadlessSessionRecord(session);
  return session;
}

export async function listHeadlessSessionsForWorkspace(
  workspaceId: string,
): Promise<HeadlessSessionRecord[]> {
  return listHeadlessSessionRecords(workspaceId);
}
