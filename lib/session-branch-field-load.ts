/**
 * One opening request per session slice.
 * The tips screen awaits that opening. The rest of the field keeps arriving
 * on the same cache entry while the session is already on.
 */

import { resolveLearnOpeningWork } from "@/lib/learn-opening-work";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import {
  planSessionBranchPrepare,
  sessionBranchPrepareRequest,
  type SessionBranchPrepareInput,
} from "@/lib/session-branch-prepare";

export type SessionBranchContinuation = {
  root: Record<string, unknown>;
  regions: Record<string, unknown>[];
  avenues: Record<string, unknown>[];
  inquiries: Record<string, unknown>[];
  regionFailures: number;
  failed: string[];
  settled?: string[];
  seedModel?: unknown;
};

export type SessionBranchFieldLoadResult =
  | { ok: true; model: SessionBranchModel; key: string; openingWork: string }
  | { ok: false; error: string; key: string | null };

export type SessionBranchFieldCacheStatus = "preparing" | "ready" | "failed";

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

type CacheEntry = {
  token: object;
  status: SessionBranchFieldCacheStatus;
  model: SessionBranchModel | null;
  birth: SessionBranchModel | null;
  openingWork: string;
  error: string | null;
  promise: Promise<SessionBranchModel>;
  listeners: Set<(entry: CacheEntry) => void>;
};

const CONTINUATION_ROUNDS = 20;

const cache = new Map<string, CacheEntry>();
const pendingListeners = new Map<string, CacheEntry["listeners"]>();
const FIELD_ERROR = "The field could not be prepared.";

export function sessionBranchFieldRequestKey(
  input: SessionBranchPrepareInput | null | undefined,
): string | null {
  if (!input) return null;
  const request = sessionBranchPrepareRequest(planSessionBranchPrepare(input));
  if (!request) return null;
  return JSON.stringify({ scope: input.scope || "", body: request });
}

export function readSessionBranchFieldCache(key: string | null | undefined): CacheEntry | undefined {
  if (!key) return undefined;
  return cache.get(key);
}

export function clearSessionBranchFieldCache(): void {
  cache.clear();
  pendingListeners.clear();
}

/** A ready key is reused. A request still in flight is joined. Anything else fetches. */
export function sessionBranchFieldLoadDecision(
  entry: { status?: SessionBranchFieldCacheStatus | null } | null | undefined,
): "reuse" | "join" | "fetch" {
  if (entry?.status === "ready") return "reuse";
  if (entry?.status === "preparing") return "join";
  return "fetch";
}

/**
 * Learn, Calibrate, and Verification start the clock once the opening is ready.
 * The rest of the field arrives after that. Conversational TAP and the exercise
 * shell have no tree.
 */
export function sessionClockMayStart(input: {
  mode: "learn" | "calibrate" | "verification" | "tap" | "exercise";
  fieldReady: boolean;
}): boolean {
  if (input.mode === "tap" || input.mode === "exercise") return true;
  return input.fieldReady;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : FIELD_ERROR;
}

function isModel(value: unknown): value is SessionBranchModel {
  return Boolean(value && typeof value === "object" && Array.isArray((value as SessionBranchModel).branches));
}

function isContinuation(value: unknown): value is SessionBranchContinuation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as SessionBranchContinuation;
  if (record.seedModel && typeof record.seedModel === "object") return true;
  return Array.isArray(record.regions) && record.regions.length > 0;
}

function openingWorkOf(model: SessionBranchModel, value: unknown, salt: string): string {
  const generated = typeof value === "string" ? value : "";
  return resolveLearnOpeningWork(model, generated, salt);
}

async function readPayload(
  response: Response,
  salt: string,
): Promise<{
  model: SessionBranchModel;
  continuation: SessionBranchContinuation | null;
  done: boolean;
  openingWork: string;
}> {
  const payload = (await response.json().catch(() => null)) as {
    model?: unknown;
    continuation?: unknown;
    done?: unknown;
    openingWork?: unknown;
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "";
    throw new Error(message || FIELD_ERROR);
  }
  if (!isModel(payload?.model)) throw new Error(FIELD_ERROR);
  return {
    model: payload.model,
    continuation: isContinuation(payload.continuation) ? payload.continuation : null,
    done: payload.done === true,
    openingWork: openingWorkOf(payload.model, payload.openingWork, salt),
  };
}

function publishGrowth(key: string, token: object, model: SessionBranchModel) {
  const entry = cache.get(key);
  if (!entry || entry.token !== token) return;
  if (entry.model && model.branches.length < entry.model.branches.length) return;
  entry.status = "ready";
  entry.model = model;
  entry.birth = model;
  entry.error = null;
  for (const listener of entry.listeners) listener(entry);
}

async function finishSessionBranchField(
  key: string,
  token: object,
  body: Record<string, unknown>,
  continuation: SessionBranchContinuation,
  fetchImpl: FetchLike,
) {
  let next: SessionBranchContinuation | null = continuation;
  for (let round = 0; round < CONTINUATION_ROUNDS && next; round += 1) {
    if (cache.get(key)?.token !== token) return;
    try {
      const response = await fetchImpl("/api/learn/session-branch-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, phase: "continue", continuation: next }),
      });
      const payload = await readPayload(response, key);
      publishGrowth(key, token, payload.model);
      if (payload.done || !payload.continuation) return;
      next = payload.continuation;
    } catch {
      return;
    }
  }
}

export async function loadSessionBranchField(
  input: SessionBranchPrepareInput,
  options?: { fetchImpl?: FetchLike; signal?: AbortSignal },
): Promise<SessionBranchFieldLoadResult> {
  const key = sessionBranchFieldRequestKey(input);
  if (!key) return { ok: false, error: FIELD_ERROR, key: null };
  const existing = cache.get(key);
  const decision = sessionBranchFieldLoadDecision(existing);
  if (decision === "reuse" && existing?.model) {
    return {
      ok: true,
      model: existing.model,
      key,
      openingWork:
        existing.openingWork || openingWorkOf(existing.model, existing.openingWork, key),
    };
  }
  if (decision === "join" && existing) {
    try {
      const model = await existing.promise;
      const ready = cache.get(key);
      return {
        ok: true,
        model,
        key,
        openingWork:
          ready?.openingWork || openingWorkOf(model, ready?.openingWork, key),
      };
    } catch (error) {
      return { ok: false, error: messageOf(error), key };
    }
  }

  const token = {};
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (options?.signal?.aborted) controller.abort();
  else options?.signal?.addEventListener("abort", onAbort);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const body = (JSON.parse(key) as { body: Record<string, unknown> }).body;
  const promise = fetchImpl("/api/learn/session-branch-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({ ...body, phase: "opening" }),
  }).then((response) => readPayload(response, key));
  const entry: CacheEntry = {
    token,
    status: "preparing",
    model: null,
    birth: null,
    openingWork: "",
    error: null,
    promise: promise.then((payload) => payload.model),
    listeners: pendingListeners.get(key) ?? new Set(),
  };
  entry.promise.catch(() => {});
  pendingListeners.delete(key);
  cache.set(key, entry);
  try {
    const payload = await promise;
    if (cache.get(key)?.token === token) {
      entry.status = "ready";
      entry.model = payload.model;
      entry.birth = payload.model;
      entry.openingWork = payload.openingWork;
      entry.error = null;
      for (const listener of entry.listeners) listener(entry);
    }
    if (payload.continuation && !payload.done && cache.get(key)?.token === token) {
      void finishSessionBranchField(key, token, body, payload.continuation, fetchImpl);
    }
    return { ok: true, model: payload.model, key, openingWork: payload.openingWork };
  } catch (error) {
    if (cache.get(key)?.token === token) cache.delete(key);
    return { ok: false, error: messageOf(error), key };
  } finally {
    options?.signal?.removeEventListener("abort", onAbort);
  }
}

/** Fires when a later batch adds branches. The opening result does not wait for it. */
export function subscribeSessionBranchField(
  key: string | null | undefined,
  listener: (entry: CacheEntry) => void,
): () => void {
  if (!key) return () => {};
  const entry = cache.get(key);
  const listeners = entry?.listeners ?? pendingListeners.get(key) ?? new Set();
  if (!entry) pendingListeners.set(key, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!cache.has(key) && listeners.size === 0) pendingListeners.delete(key);
  };
}
