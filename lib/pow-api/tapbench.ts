/**
 * TAPBench — timed agent evaluation sessions via Stash/Submit.
 *
 * A TAPBench link mints an exercise (workspace- or block-scoped), duration, and
 * a session token. Agents use that token on the Stash API until the session expires.
 * Flushed PoW is flagged as tapbench pow (distinct from ordinary human TAP / agent stash).
 */

import crypto from "crypto";
import { buildExercisePromptText } from "@/lib/exercise-tap";
import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";

export const TAPBENCH_PRODUCT = {
  id: "tapbench",
  name: "TAPBench",
  tagline: "TAP for agents — timed exercise + Stash/Submit",
  description:
    "Mint a TAPBench link scoped to a workspace or block. The link resolves to an exercise, remaining time, and a session token used with the Stash/Submit API until expiry. Flushed proof of work is flagged as tapbench pow.",
} as const;

export const TAPBENCH_DEFAULT_DURATION_SECONDS = 15 * 60;
export const TAPBENCH_MIN_DURATION_SECONDS = 60;
export const TAPBENCH_MAX_DURATION_SECONDS = 3 * 60 * 60;

export const TAPBENCH_PUBLIC_PATH = "tapbench" as const;

/** Metadata keys used on flushed PoW and region-builder filters. */
export const TAPBENCH_POW_SOURCE = "tapbench" as const;
export const HUMAN_POW_SOURCE = "human" as const;

export type PowSourceKind = typeof TAPBENCH_POW_SOURCE | typeof HUMAN_POW_SOURCE;

export type TapbenchLinkStatus = "active" | "expired" | "revoked";

export interface TapbenchLinkRecord {
  id: string;
  workspace_id: string;
  block_id: string | null;
  /** Bearer token — always stored so list endpoints can rebuild the share URL. */
  public_token: string;
  private_token_hash: string;
  exercise: string;
  duration_seconds: number;
  /** Absolute expiry (ISO). Clock starts at mint. */
  expires_at: string;
  status: TapbenchLinkStatus;
  created_at: string;
  created_by: string | null;
  /**
   * Anonymous guest subject for all PoW under this session (UUID).
   * Required for guest-scoped knowledge-config / region-builder subjects.
   */
  guest_user_id: string | null;
}

export interface MintTapbenchLinkInput {
  workspaceId: string;
  blockId?: string | null;
  /** Total session length in seconds. */
  durationSeconds?: number;
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  rootTopic?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  /** Optional explicit exercise text; otherwise derived from workspace/block framing. */
  exerciseText?: string | null;
  createdBy?: string | null;
  /** Anonymous guest UUID provisioned at mint (or injected in tests). */
  guestUserId?: string | null;
  /** Inject now for tests. */
  nowMs?: number;
  /** Inject id for tests. */
  id?: string;
  /** Inject token for tests. */
  sessionToken?: string;
}

export interface MintTapbenchLinkResult {
  link: TapbenchLinkRecord;
  /** Session token agents pass to Stash/Submit (same as public_token). */
  session_token: string;
  exercise: string;
  duration_seconds: number;
  expires_at: string;
  remaining_ms: number;
  url: string;
}

export interface ResolveTapbenchSessionResult {
  ok: true;
  link: TapbenchLinkRecord;
  session_token: string;
  exercise: string;
  duration_seconds: number;
  expires_at: string;
  remaining_ms: number;
  valid: true;
  workspace_id: string;
  block_id: string | null;
  guest_user_id: string | null;
}

export type ResolveTapbenchSessionError =
  | { ok: false; code: "not_found"; message: string }
  | { ok: false; code: "session_expired"; message: string; expires_at: string; remaining_ms: 0 }
  | { ok: false; code: "session_revoked"; message: string };

export function createTapbenchSessionToken(): string {
  return createPrivateToken();
}

export function hashTapbenchToken(token: string): string {
  return hashPrivateToken(token);
}

export function normalizeTapbenchDurationSeconds(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim()
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return TAPBENCH_DEFAULT_DURATION_SECONDS;
  const rounded = Math.round(n);
  if (rounded < TAPBENCH_MIN_DURATION_SECONDS) return TAPBENCH_MIN_DURATION_SECONDS;
  if (rounded > TAPBENCH_MAX_DURATION_SECONDS) return TAPBENCH_MAX_DURATION_SECONDS;
  return rounded;
}

/**
 * Build exercise text from **explicit** exercise body only (model/stored).
 * Does not invent pure shells from title/goal. Empty if no explicit text.
 */
export function buildTapbenchExercise(input: {
  exerciseText?: string | null;
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  rootTopic?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  notes?: string | null;
  files?: import("@/lib/prompt-workspace-context").WorkspaceFileContextItem[] | null;
  blocks?: import("@/lib/prompt-workspace-context").PromptBlockInventoryItem[] | null;
  focusedBlockId?: string | null;
  blockLocalContext?: import("@/lib/prompt-workspace-context").BlockLocalContextInput | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
}): string {
  const explicit =
    typeof input.exerciseText === "string" ? input.exerciseText.trim() : "";
  if (!explicit) return "";
  return buildExercisePromptText({
    exerciseText: explicit,
    blockTitle: input.blockTitle,
    blockDescription: input.blockDescription,
    workspaceTitle: input.workspaceTitle || input.rootTopic || "this workspace",
    workspaceGoal: input.workspaceGoal,
    rootTopic: input.rootTopic,
    notes: input.notes,
    files: input.files,
    blocks: input.blocks,
    focusedBlockId: input.focusedBlockId,
    blockLocalContext: input.blockLocalContext,
    unusableCells: input.unusableCells,
  }).trim();
}

export function buildTapbenchShareUrl(baseUrl: string, token: string): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  const t = (token || "").trim();
  return `${base}/${TAPBENCH_PUBLIC_PATH}/${t}`;
}

export function remainingMsUntil(expiresAtIso: string, nowMs: number = Date.now()): number {
  const exp = Date.parse(expiresAtIso);
  if (!Number.isFinite(exp)) return 0;
  return Math.max(0, exp - nowMs);
}

export function isTapbenchSessionExpired(
  link: Pick<TapbenchLinkRecord, "expires_at" | "status">,
  nowMs: number = Date.now(),
): boolean {
  if (link.status === "revoked" || link.status === "expired") return true;
  return remainingMsUntil(link.expires_at, nowMs) <= 0;
}

/**
 * Mint a TAPBench link record (pure — no I/O). Caller persists and stores the record.
 */
export function mintTapbenchLink(
  input: MintTapbenchLinkInput,
  baseUrl: string = "https://uncertain.systems",
): MintTapbenchLinkResult {
  const nowMs = input.nowMs ?? Date.now();
  const duration_seconds = normalizeTapbenchDurationSeconds(input.durationSeconds);
  const session_token = input.sessionToken?.trim() || createTapbenchSessionToken();
  const id = input.id?.trim() || crypto.randomUUID();
  const expires_at = new Date(nowMs + duration_seconds * 1000).toISOString();
  const exercise = buildTapbenchExercise({
    exerciseText: input.exerciseText,
    workspaceTitle: input.workspaceTitle,
    workspaceGoal: input.workspaceGoal,
    rootTopic: input.rootTopic,
    blockTitle: input.blockTitle,
    blockDescription: input.blockDescription,
  });

  const link: TapbenchLinkRecord = {
    id,
    workspace_id: input.workspaceId,
    block_id: input.blockId?.trim() || null,
    public_token: session_token,
    private_token_hash: hashTapbenchToken(session_token),
    exercise,
    duration_seconds,
    expires_at,
    status: "active",
    created_at: new Date(nowMs).toISOString(),
    created_by: input.createdBy ?? null,
    guest_user_id:
      typeof input.guestUserId === "string" && input.guestUserId.trim()
        ? input.guestUserId.trim()
        : null,
  };

  return {
    link,
    session_token,
    exercise,
    duration_seconds,
    expires_at,
    remaining_ms: remainingMsUntil(expires_at, nowMs),
    url: buildTapbenchShareUrl(baseUrl, session_token),
  };
}

/**
 * Resolve a session token against a known link record.
 */
export function resolveTapbenchSession(
  link: TapbenchLinkRecord | null | undefined,
  sessionToken: string,
  nowMs: number = Date.now(),
): ResolveTapbenchSessionResult | ResolveTapbenchSessionError {
  const token = sessionToken.trim();
  if (!link || !token) {
    return { ok: false, code: "not_found", message: "TAPBench session not found" };
  }

  const hash = hashTapbenchToken(token);
  const tokenMatches =
    link.public_token === token || link.private_token_hash === hash;
  if (!tokenMatches) {
    return { ok: false, code: "not_found", message: "TAPBench session not found" };
  }

  if (link.status === "revoked") {
    return { ok: false, code: "session_revoked", message: "TAPBench session has been revoked" };
  }

  const remaining_ms = remainingMsUntil(link.expires_at, nowMs);
  if (link.status === "expired" || remaining_ms <= 0) {
    return {
      ok: false,
      code: "session_expired",
      message: "TAPBench session token is invalid — time has expired",
      expires_at: link.expires_at,
      remaining_ms: 0,
    };
  }

  return {
    ok: true,
    link,
    session_token: token,
    exercise: link.exercise,
    duration_seconds: link.duration_seconds,
    expires_at: link.expires_at,
    remaining_ms,
    valid: true,
    workspace_id: link.workspace_id,
    block_id: link.block_id,
    guest_user_id: link.guest_user_id ?? null,
  };
}

/** Attach to Stash/Submit JSON responses when a TAPBench session is active. */
export function tapbenchResponseFields(
  resolved: ResolveTapbenchSessionResult,
): {
  exercise: string;
  remaining_ms: number;
  expires_at: string;
  duration_seconds: number;
  session_token: string;
  tapbench: true;
  tapbench_link_id: string;
  block_id: string | null;
  guest_user_id: string | null;
} {
  return {
    exercise: resolved.exercise,
    remaining_ms: resolved.remaining_ms,
    expires_at: resolved.expires_at,
    duration_seconds: resolved.duration_seconds,
    session_token: resolved.session_token,
    tapbench: true,
    tapbench_link_id: resolved.link.id,
    block_id: resolved.block_id,
    guest_user_id: resolved.guest_user_id,
  };
}

/**
 * Classify PoW metadata as human vs tapbench for region-builder filters.
 */
export function classifyPowSource(
  metadata: Record<string, unknown> | null | undefined,
): PowSourceKind {
  if (!metadata || typeof metadata !== "object") return HUMAN_POW_SOURCE;
  if (metadata.tapbench === true) return TAPBENCH_POW_SOURCE;
  if (metadata.pow_source === TAPBENCH_POW_SOURCE) return TAPBENCH_POW_SOURCE;
  if (metadata.source === TAPBENCH_POW_SOURCE) return TAPBENCH_POW_SOURCE;
  if (metadata.source_link_kind === TAPBENCH_POW_SOURCE) return TAPBENCH_POW_SOURCE;
  return HUMAN_POW_SOURCE;
}

export function isTapbenchPowMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return classifyPowSource(metadata) === TAPBENCH_POW_SOURCE;
}

export function sourceLinkIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  if (typeof metadata.source_link_id === "string" && metadata.source_link_id.trim()) {
    return metadata.source_link_id.trim();
  }
  if (typeof metadata.tapbench_link_id === "string" && metadata.tapbench_link_id.trim()) {
    return metadata.tapbench_link_id.trim();
  }
  if (typeof metadata.tap_session_id === "string" && metadata.tap_session_id.trim()) {
    return metadata.tap_session_id.trim();
  }
  if (typeof metadata.ile_link_id === "string" && metadata.ile_link_id.trim()) {
    return metadata.ile_link_id.trim();
  }
  return null;
}

// ── Process-local store (tests + single-process resolve without DB) ─────────

const tapbenchByToken = new Map<string, TapbenchLinkRecord>();
const tapbenchById = new Map<string, TapbenchLinkRecord>();
const tapbenchByHash = new Map<string, TapbenchLinkRecord>();

export function resetAllTapbenchSessionsForTests(): void {
  tapbenchByToken.clear();
  tapbenchById.clear();
  tapbenchByHash.clear();
}

export function storeTapbenchLink(link: TapbenchLinkRecord): TapbenchLinkRecord {
  tapbenchByToken.set(link.public_token, link);
  tapbenchById.set(link.id, link);
  tapbenchByHash.set(link.private_token_hash, link);
  return link;
}

export function getTapbenchLinkByToken(token: string): TapbenchLinkRecord | null {
  const t = token.trim();
  if (!t) return null;
  return (
    tapbenchByToken.get(t) ??
    tapbenchByHash.get(hashTapbenchToken(t)) ??
    null
  );
}

export function getTapbenchLinkById(id: string): TapbenchLinkRecord | null {
  return tapbenchById.get(id) ?? null;
}

export function listStoredTapbenchLinks(workspaceId?: string): TapbenchLinkRecord[] {
  const all = [...tapbenchById.values()];
  const filtered = workspaceId
    ? all.filter((l) => l.workspace_id === workspaceId)
    : all;
  return filtered.sort(
    (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
  );
}

/**
 * Mint + store in process memory. Returns full mint payload including listable URL.
 */
export function mintAndStoreTapbenchLink(
  input: MintTapbenchLinkInput,
  baseUrl: string = "https://uncertain.systems",
): MintTapbenchLinkResult {
  const minted = mintTapbenchLink(input, baseUrl);
  storeTapbenchLink(minted.link);
  return minted;
}

/**
 * Resolve by session token from process store (and mark expired when time is up).
 */
export function resolveStoredTapbenchSession(
  sessionToken: string,
  nowMs: number = Date.now(),
): ResolveTapbenchSessionResult | ResolveTapbenchSessionError {
  const link = getTapbenchLinkByToken(sessionToken);
  const result = resolveTapbenchSession(link, sessionToken, nowMs);
  if (!result.ok && result.code === "session_expired" && link) {
    const expired: TapbenchLinkRecord = { ...link, status: "expired" };
    storeTapbenchLink(expired);
  }
  return result;
}

/** List row shape for Knowledge Regions / Settings UIs. */
export function toTapbenchListRow(
  link: TapbenchLinkRecord,
  baseUrl: string,
  nowMs: number = Date.now(),
): {
  id: string;
  workspace_id: string;
  block_id: string | null;
  status: TapbenchLinkStatus;
  exercise: string;
  duration_seconds: number;
  expires_at: string;
  remaining_ms: number;
  created_at: string;
  public_token: string;
  url: string;
} {
  const remaining_ms = remainingMsUntil(link.expires_at, nowMs);
  const status: TapbenchLinkStatus =
    link.status === "revoked"
      ? "revoked"
      : remaining_ms <= 0
        ? "expired"
        : link.status;
  return {
    id: link.id,
    workspace_id: link.workspace_id,
    block_id: link.block_id,
    status,
    exercise: link.exercise,
    duration_seconds: link.duration_seconds,
    expires_at: link.expires_at,
    remaining_ms,
    created_at: link.created_at,
    public_token: link.public_token,
    url: buildTapbenchShareUrl(baseUrl, link.public_token),
  };
}
