/**
 * Persist / load TAPBench links (DB + process store mirror for resolve).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTapbenchShareUrl,
  getTapbenchLinkByToken,
  hashTapbenchToken,
  listStoredTapbenchLinks,
  mintTapbenchLink,
  remainingMsUntil,
  resolveTapbenchSession,
  storeTapbenchLink,
  toTapbenchListRow,
  type MintTapbenchLinkInput,
  type MintTapbenchLinkResult,
  type ResolveTapbenchSessionError,
  type ResolveTapbenchSessionResult,
  type TapbenchLinkRecord,
  type TapbenchLinkStatus,
} from "./tapbench";

export class TapbenchStoreError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly code: string = "internal_error",
  ) {
    super(message);
    this.name = "TapbenchStoreError";
  }
}

function rowToRecord(raw: Record<string, unknown>): TapbenchLinkRecord {
  return {
    id: String(raw.id),
    workspace_id: String(raw.workspace_id),
    block_id: (raw.block_id as string | null) ?? null,
    public_token: String(raw.public_token),
    private_token_hash: String(raw.private_token_hash),
    exercise: String(raw.exercise_text ?? raw.exercise ?? ""),
    duration_seconds: Number(raw.duration_seconds) || 0,
    expires_at: String(raw.expires_at),
    status: (String(raw.status || "active") as TapbenchLinkStatus) || "active",
    created_at: String(raw.created_at || ""),
    created_by: (raw.created_by as string | null) ?? null,
    guest_user_id: (raw.guest_user_id as string | null) ?? null,
  };
}

/**
 * Mint a TAPBench link, provision anonymous guest when possible, persist to DB,
 * always mirror to process store.
 */
export async function mintTapbenchLinkPersisted(
  options: {
    supabase?: SupabaseClient | null;
    baseUrl: string;
    input: MintTapbenchLinkInput;
    /** Workspace org id for guest provisioning. */
    organizationId?: string | null;
  },
): Promise<MintTapbenchLinkResult> {
  let guestUserId = options.input.guestUserId ?? null;

  // Always create a durable anonymous guest so PoW is guest-scoped like human TAP.
  if (options.supabase && options.input.createdBy && !guestUserId) {
    try {
      const { createAnonymousTapGuest } = await import("./anonymous-tap-guest");
      const guest = await createAnonymousTapGuest(options.supabase, {
        workspaceId: options.input.workspaceId,
        organizationId: options.organizationId ?? null,
        createdByUserId: options.input.createdBy,
        guestType: "anonymous_tapbench_link",
      });
      guestUserId = guest.id;
    } catch (err) {
      console.warn(
        "[tapbench-store] anonymous guest provision failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const minted = mintTapbenchLink(
    { ...options.input, guestUserId },
    options.baseUrl,
  );
  storeTapbenchLink(minted.link);

  if (options.supabase) {
    const { data, error } = await options.supabase
      .from("workspace_tapbench_links")
      .insert({
        id: minted.link.id,
        workspace_id: minted.link.workspace_id,
        block_id: minted.link.block_id,
        public_token: minted.link.public_token,
        private_token_hash: minted.link.private_token_hash,
        exercise_text: minted.link.exercise,
        duration_seconds: minted.link.duration_seconds,
        expires_at: minted.link.expires_at,
        status: minted.link.status,
        created_by: minted.link.created_by,
        created_at: minted.link.created_at,
        guest_user_id: minted.link.guest_user_id,
      })
      .select(
        "id, workspace_id, block_id, public_token, private_token_hash, exercise_text, duration_seconds, expires_at, status, created_at, created_by, guest_user_id",
      )
      .single();

    if (error) {
      // Table may not exist yet in some envs — process store still works for resolve.
      console.warn("[tapbench-store] insert failed (using process store):", error.message);
    } else if (data) {
      const record = rowToRecord(data as Record<string, unknown>);
      storeTapbenchLink(record);
      return {
        ...minted,
        link: record,
        exercise: record.exercise,
        expires_at: record.expires_at,
        url: buildTapbenchShareUrl(options.baseUrl, record.public_token),
      };
    }
  }

  return minted;
}

export async function listTapbenchLinksPersisted(
  supabase: SupabaseClient | null | undefined,
  workspaceId: string,
  baseUrl: string,
  nowMs: number = Date.now(),
): Promise<ReturnType<typeof toTapbenchListRow>[]> {
  const fromMemory = listStoredTapbenchLinks(workspaceId).map((l) =>
    toTapbenchListRow(l, baseUrl, nowMs),
  );

  if (!supabase) return fromMemory;

  const { data, error } = await supabase
    .from("workspace_tapbench_links")
    .select(
      "id, workspace_id, block_id, public_token, private_token_hash, exercise_text, duration_seconds, expires_at, status, created_at, created_by, guest_user_id",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) {
      console.warn("[tapbench-store] list failed (using process store):", error.message);
    }
    return fromMemory;
  }

  const rows = (data as Record<string, unknown>[]).map((raw) => {
    const record = rowToRecord(raw);
    storeTapbenchLink(record);
    return toTapbenchListRow(record, baseUrl, nowMs);
  });

  // Merge any process-only mints not yet in DB.
  const seen = new Set(rows.map((r) => r.id));
  for (const mem of fromMemory) {
    if (!seen.has(mem.id)) rows.push(mem);
  }
  return rows.sort(
    (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
  );
}

/**
 * Resolve a TAPBench session token: process store first, then DB by hash/public_token.
 */
export async function resolveTapbenchSessionToken(
  supabase: SupabaseClient | null | undefined,
  sessionToken: string,
  nowMs: number = Date.now(),
): Promise<ResolveTapbenchSessionResult | ResolveTapbenchSessionError> {
  const token = sessionToken.trim();
  if (!token) {
    return { ok: false, code: "not_found", message: "TAPBench session not found" };
  }

  let link = getTapbenchLinkByToken(token);

  if (!link && supabase) {
    const hash = hashTapbenchToken(token);
    const { data } = await supabase
      .from("workspace_tapbench_links")
      .select(
        "id, workspace_id, block_id, public_token, private_token_hash, exercise_text, duration_seconds, expires_at, status, created_at, created_by, guest_user_id",
      )
      .or(`public_token.eq.${token},private_token_hash.eq.${hash}`)
      .maybeSingle();

    if (data) {
      link = rowToRecord(data as Record<string, unknown>);
      storeTapbenchLink(link);
    }
  }

  const result = resolveTapbenchSession(link, token, nowMs);

  // Best-effort mark expired in DB
  if (!result.ok && result.code === "session_expired" && link && supabase) {
    void supabase
      .from("workspace_tapbench_links")
      .update({ status: "expired" })
      .eq("id", link.id)
      .then(() => undefined);
    storeTapbenchLink({ ...link, status: "expired" });
  }

  return result;
}

/** Extract session token from Authorization Bearer, X-Tapbench-Session, or body.session_token. */
export function extractTapbenchSessionToken(input: {
  authorizationHeader?: string | null;
  tapbenchHeader?: string | null;
  bodySessionToken?: unknown;
}): string | null {
  const fromHeader = input.tapbenchHeader?.trim();
  if (fromHeader) return fromHeader;

  const body =
    typeof input.bodySessionToken === "string" ? input.bodySessionToken.trim() : "";
  if (body) return body;

  const auth = input.authorizationHeader?.trim() || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const bearer = auth.slice(7).trim();
    // API keys are typically longer opaque strings; TAPBench tokens are base64url (~43 chars).
    // Callers that pass TAPBench as Bearer still work when resolve succeeds.
    if (bearer) return bearer;
  }
  return null;
}

export function remainingForLink(
  link: Pick<TapbenchLinkRecord, "expires_at">,
  nowMs: number = Date.now(),
): number {
  return remainingMsUntil(link.expires_at, nowMs);
}
