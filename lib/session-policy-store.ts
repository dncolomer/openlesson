/**
 * The policy snapshot stored on a Learn session.
 * Autosave writes it as the field moves. Naming a session only sets the display name.
 * Resume opens this snapshot instead of asking for a new field.
 */

import { parseLearningModelSize } from "@/lib/learning-model";
import {
  SESSION_BRANCH_ACTION_ORDER,
  type SessionBranch,
  type SessionBranchAction,
  type SessionBranchModel,
  type SessionBranchStatus,
} from "@/lib/session-branch-model";
import {
  policySuggestionIsRawLabel,
  type SessionPolicyInference,
} from "@/lib/session-policy-infer";
import type { SessionMarkButtonId } from "@/lib/session-marks";

export const SESSION_POLICY_META_KEY = "session_policy" as const;
export const SESSION_POLICY_RECORD_VERSION = 1;

const MAX_BRANCHES = 120;
const MAX_NOTES = 400;
const MAX_INFERENCES = 500;
const MAX_TEXT = 20_000;

const STATUSES = new Set<SessionBranchStatus>(["open", "closed", "latent"]);
const ACTION_IDS = new Set<string>(SESSION_BRANCH_ACTION_ORDER);

export type SessionPolicyRecord = {
  version: typeof SESSION_POLICY_RECORD_VERSION;
  model: SessionBranchModel;
  birth: SessionBranchModel;
  inferences: SessionPolicyInference[];
  suggestion: string | null;
};

/**
 * Latest snapshot per session id.
 * Some session writes copy the React session and would drop the autosaved policy.
 * Those writes merge this back in.
 */
const remembered = new Map<string, SessionPolicyRecord>();

export function clearRememberedSessionPolicies(): void {
  remembered.clear();
}

export function forgetSessionPolicy(sessionId: string): void {
  const id = sessionId.trim();
  if (!id) return;
  remembered.delete(id);
}

export function rememberSessionPolicy(sessionId: string, record: SessionPolicyRecord): void {
  const id = sessionId.trim();
  if (!id) return;
  remembered.set(id, record);
}

function titleOf(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function textOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length > MAX_TEXT) return null;
  return value.trim();
}

function priceOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseAction(value: unknown): SessionBranchAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !ACTION_IDS.has(raw.id)) return null;
  const price = priceOf(raw.price);
  const leads = textOf(raw.leads);
  const observation = textOf(raw.observation);
  if (price == null || leads == null || observation == null) return null;
  return { id: raw.id as SessionMarkButtonId, price, leads, observation };
}

function parseActions(value: unknown): SessionBranchAction[] | null {
  if (!Array.isArray(value) || value.length !== SESSION_BRANCH_ACTION_ORDER.length) return null;
  const actions: SessionBranchAction[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const action = parseAction(item);
    if (!action || seen.has(action.id)) return null;
    seen.add(action.id);
    actions.push(action);
  }
  return actions;
}

function parseBranch(value: unknown): SessionBranch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const id = textOf(raw.id);
  const title = textOf(raw.title);
  const territory = textOf(raw.territory);
  const observation = textOf(raw.observation);
  const actions = parseActions(raw.actions);
  const parentId = raw.parentId == null ? null : textOf(raw.parentId);
  if (!id || id.length > 80 || title == null || territory == null || observation == null || !actions) {
    return null;
  }
  if (raw.parentId != null && !parentId) return null;
  if (typeof raw.depth !== "number" || !Number.isInteger(raw.depth) || raw.depth < 0 || raw.depth > 8) {
    return null;
  }
  if (typeof raw.status !== "string" || !STATUSES.has(raw.status as SessionBranchStatus)) return null;
  return {
    id,
    parentId,
    title,
    territory,
    observation,
    depth: raw.depth,
    status: raw.status as SessionBranchStatus,
    actions,
  };
}

function parseModel(value: unknown, birth: boolean): SessionBranchModel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const chapterTitle = textOf(raw.chapterTitle);
  const rootId = textOf(raw.rootId);
  const focusId = textOf(raw.focusId);
  if (!chapterTitle || !rootId || !focusId) return null;
  if (typeof raw.step !== "number" || !Number.isInteger(raw.step) || raw.step < 0) return null;
  if (birth && raw.step !== 0) return null;
  if (!Array.isArray(raw.branches) || raw.branches.length < 1 || raw.branches.length > MAX_BRANCHES) {
    return null;
  }
  if (!Array.isArray(raw.boardNotes) || raw.boardNotes.length > MAX_NOTES) return null;
  const branches: SessionBranch[] = [];
  const ids = new Set<string>();
  for (const item of raw.branches) {
    const branch = parseBranch(item);
    if (!branch || ids.has(branch.id)) return null;
    ids.add(branch.id);
    branches.push(branch);
  }
  if (!ids.has(rootId) || !ids.has(focusId)) return null;
  const boardNotes: SessionBranchModel["boardNotes"] = [];
  const noteIds = new Set<string>();
  for (const item of raw.boardNotes) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const note = item as Record<string, unknown>;
    const key = textOf(note.key);
    const text = textOf(note.text);
    if (!key || text == null || noteIds.has(key)) return null;
    noteIds.add(key);
    if (text) boardNotes.push({ key, text });
  }
  return {
    chapterTitle,
    rootId,
    focusId,
    step: raw.step,
    catalogSize: parseLearningModelSize(raw.catalogSize),
    branches,
    boardNotes,
  };
}

function parseInferences(value: unknown): SessionPolicyInference[] | null {
  if (!Array.isArray(value) || value.length > MAX_INFERENCES) return null;
  const inferences: SessionPolicyInference[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const raw = item as Record<string, unknown>;
    if (typeof raw.action !== "string" || !ACTION_IDS.has(raw.action)) return null;
    if (typeof raw.confidence !== "number" || !Number.isFinite(raw.confidence)) return null;
    if (raw.confidence < 0 || raw.confidence > 1) return null;
    const action = raw.action as SessionMarkButtonId;
    const stored = typeof raw.label === "string" ? raw.label.replace(/\s+/g, " ").trim() : "";
    inferences.push({
      action,
      confidence: raw.confidence,
      label: stored && stored.length <= 1000 && !policySuggestionIsRawLabel(stored) ? stored : "",
    });
  }
  return inferences;
}

function parseSuggestion(value: unknown): string | null {
  if (value == null) return null;
  const text = textOf(value);
  if (!text || text.length > 1000 || policySuggestionIsRawLabel(text)) return null;
  return text;
}

function metadataRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

/** A stored snapshot, or null when the row has none or the blob cannot be read. */
export function readSessionPolicyRecord(metadata: unknown): SessionPolicyRecord | null {
  const rec = metadataRecord(metadata);
  if (!rec) return null;
  let raw = rec[SESSION_POLICY_META_KEY];
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (body.version !== SESSION_POLICY_RECORD_VERSION) return null;
  const model = parseModel(body.model, false);
  const birth = parseModel(body.birth, true);
  const inferences = parseInferences(body.inferences);
  if (!model || !birth || !inferences) return null;
  if (birth.rootId !== model.rootId) return null;
  if (titleOf(birth.chapterTitle) !== titleOf(model.chapterTitle)) return null;
  return {
    version: SESSION_POLICY_RECORD_VERSION,
    model,
    birth,
    inferences,
    suggestion: parseSuggestion(body.suggestion),
  };
}

/** Null until the live field has a step-0 birth tree worth restoring. */
export function sessionPolicyRecordFromLive(input: {
  model?: SessionBranchModel | null;
  birth?: SessionBranchModel | null;
  inferences?: readonly SessionPolicyInference[] | null;
  suggestion?: string | null;
}): SessionPolicyRecord | null {
  return readSessionPolicyRecord({
    [SESSION_POLICY_META_KEY]: {
      version: SESSION_POLICY_RECORD_VERSION,
      model: input.model ?? null,
      birth: input.birth ?? null,
      inferences: input.inferences ?? [],
      suggestion: input.suggestion ?? null,
    },
  });
}

export function sessionPolicyRecordKey(record: SessionPolicyRecord): string {
  const closed = record.model.branches.filter((branch) => branch.status === "closed").length;
  return [
    record.model.chapterTitle,
    record.model.step,
    record.model.focusId,
    record.model.branches.length,
    record.birth.branches.length,
    record.model.boardNotes.length,
    closed,
    record.inferences.map((entry) => `${entry.action}:${entry.confidence}:${entry.label}`).join(","),
    record.suggestion ?? "",
  ].join("\n");
}

export function sessionPolicyMatchesChapter(
  record: SessionPolicyRecord | null | undefined,
  chapterTitle: string | null | undefined,
): record is SessionPolicyRecord {
  const title = typeof chapterTitle === "string" ? titleOf(chapterTitle) : "";
  return Boolean(record && title && titleOf(record.model.chapterTitle) === title);
}

/**
 * The opening Learn call may skip xAI when this chapter was already stored.
 * Remembering the snapshot lets a later save put it back if another write dropped it.
 */
export function learnFieldFromStoredPolicy(
  metadata: unknown,
  fieldInput: {
    chapterTitle?: string | null;
    scope?: string | null;
    sessionId?: string | null;
  } | null | undefined,
): { ok: true; model: SessionBranchModel; key: string } | null {
  if (!fieldInput) return null;
  const record = readSessionPolicyRecord(metadata);
  if (!sessionPolicyMatchesChapter(record, fieldInput.chapterTitle)) return null;
  const sessionId = typeof fieldInput.sessionId === "string" ? fieldInput.sessionId.trim() : "";
  if (sessionId) rememberSessionPolicy(sessionId, record);
  const scope = typeof fieldInput.scope === "string" ? fieldInput.scope.trim() : "";
  return { ok: true, model: record.model, key: scope || record.model.chapterTitle };
}

/** Same metadata reference when the stored snapshot is already this record. */
export function applySessionPolicyToMetadata<T extends Record<string, unknown>>(
  metadata: T | null | undefined,
  record: SessionPolicyRecord,
): T {
  const stored = {
    version: record.version,
    model: record.model,
    birth: record.birth,
    inferences: record.inferences,
    suggestion: record.suggestion,
  };
  if (metadata && JSON.stringify(metadata[SESSION_POLICY_META_KEY]) === JSON.stringify(stored)) {
    return metadata;
  }
  const next = { ...(metadata || {}) } as T;
  (next as Record<string, unknown>)[SESSION_POLICY_META_KEY] = stored;
  return next;
}

/** Put the remembered snapshot back onto a session write that did not carry it. */
export function mergeRememberedSessionPolicy<T extends Record<string, unknown>>(
  metadata: T | null | undefined,
  sessionId: string,
): T {
  const record = remembered.get(sessionId.trim());
  if (!record) return (metadata || {}) as T;
  return applySessionPolicyToMetadata(metadata, record);
}
