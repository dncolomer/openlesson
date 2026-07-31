/**
 * Shared helpers for guest TAP/ILE links: entry query capture, param fingerprint
 * (guest identity), and Proof of Work source-link attribution.
 *
 * Share URLs stay listable via durable public_token (not one-shot client memory).
 * Bearer-in-URL remains the access mechanism. Query params on the share URL select
 * which guest subject receives PoW (order-independent; name+value identity).
 */

import crypto from "crypto";

export const GUEST_LINK_ACCESS_MODES = ["private", "public"] as const;
export type GuestLinkAccessMode = (typeof GUEST_LINK_ACCESS_MODES)[number];

export type GuestLinkKind = "tap" | "ile";

export type EntryQueryParamValue = string | string[];
export type EntryQueryParams = Record<string, EntryQueryParamValue>;

export type EntryQueryCapture = {
  at: string;
  params: EntryQueryParams;
};

/**
 * Guest links keep share URLs always visible to operators via public_token.
 * Access mode still accepts public/private from body (default private for auth
 * semantics); both modes store a durable public_token for list/copy.
 */
export function normalizeGuestLinkAccessMode(input?: {
  access_mode?: unknown;
  accessMode?: unknown;
  public?: unknown;
}): GuestLinkAccessMode {
  if (!input) return "private";
  if (input.public === true || input.public === "true") return "public";
  const raw = input.access_mode ?? input.accessMode;
  if (raw === "public") return "public";
  if (raw === "private") return "private";
  return "private";
}

/**
 * Always persist the bearer as public_token so list APIs can rebuild the share URL
 * after reload (links are not one-shot secrets for the workspace owner).
 */
export function durableGuestLinkPublicToken(sessionToken: string): string {
  return sessionToken;
}

/**
 * Canonical form for param identity: sorted keys, each multi-value sorted.
 * Order of query keys/values does not matter — only names and values.
 */
export function canonicalizeEntryQueryParams(
  params: EntryQueryParams,
): Array<[string, string[]]> {
  const keys = Object.keys(params)
    .map((k) => k.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return keys.map((key) => {
    const raw = params[key];
    const values = (Array.isArray(raw) ? raw : [raw])
      .map((v) => String(v))
      .sort((a, b) => a.localeCompare(b));
    return [key, values];
  });
}

/** SHA-256 hex of canonical params; empty string when no params. */
export function fingerprintEntryQueryParams(params: EntryQueryParams): string {
  const canonical = canonicalizeEntryQueryParams(params);
  if (canonical.length === 0) return "";
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Parse entryQueryParams / entry_query_params from API JSON bodies. */
export function entryQueryParamsFromBody(
  body: Record<string, unknown> | null | undefined,
): EntryQueryParams {
  if (!body || typeof body !== "object") return {};
  const raw = body.entryQueryParams ?? body.entry_query_params;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return collectEntryQueryParams(raw as Record<string, string | string[] | undefined | null>);
}

/**
 * Collect all query parameters from a URL / searchParams into a plain object.
 * Multi-value keys become string arrays. Empty keys are dropped.
 * Does not strip arbitrary campaign keys — "whatever is in the URL".
 */
export function collectEntryQueryParams(
  input:
    | URLSearchParams
    | Record<string, string | string[] | undefined | null>
    | Iterable<[string, string]>
    | null
    | undefined,
): EntryQueryParams {
  if (!input) return {};

  const out: EntryQueryParams = {};

  const add = (key: string, value: string) => {
    const k = key.trim();
    if (!k) return;
    const existing = out[k];
    if (existing === undefined) {
      out[k] = value;
      return;
    }
    if (Array.isArray(existing)) {
      existing.push(value);
      return;
    }
    out[k] = [existing, value];
  };

  if (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams) {
    for (const [key, value] of input.entries()) {
      add(key, value);
    }
    return out;
  }

  if (Symbol.iterator in Object(input) && !Array.isArray(input) && typeof input === "object") {
    try {
      for (const entry of input as Iterable<[string, string]>) {
        if (Array.isArray(entry) && entry.length >= 2) {
          add(String(entry[0]), String(entry[1]));
        }
      }
      if (Object.keys(out).length > 0) return out;
    } catch {
      // fall through to record handling
    }
  }

  const record = input as Record<string, string | string[] | undefined | null>;
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) add(key, String(v));
    } else {
      add(key, String(value));
    }
  }
  return out;
}

/** Append a capture event to history (immutable). Caps length to avoid unbounded growth. */
export function appendEntryQueryCapture(
  history: unknown,
  params: EntryQueryParams,
  at: string = new Date().toISOString(),
  maxEntries = 200,
): EntryQueryCapture[] {
  const prev: EntryQueryCapture[] = Array.isArray(history)
    ? history.filter(
        (item): item is EntryQueryCapture =>
          !!item &&
          typeof item === "object" &&
          typeof (item as EntryQueryCapture).at === "string" &&
          !!(item as EntryQueryCapture).params &&
          typeof (item as EntryQueryCapture).params === "object",
      )
    : [];
  const next = [...prev, { at, params }];
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
}

/** Uniform PoW / session metadata stamp for tracing artifacts back to a guest link. */
export function stampSourceLinkMetadata(
  metadata: Record<string, unknown> | null | undefined,
  source: { kind: GuestLinkKind; linkId: string },
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata } : {};
  const linkId = source.linkId.trim();
  if (!linkId) return base;
  base.source_link_kind = source.kind;
  base.source_link_id = linkId;
  if (source.kind === "tap") {
    // TAP link row id is also the historical tap_session_id on PoW metadata.
    if (base.tap_session_id === undefined || base.tap_session_id === null) {
      base.tap_session_id = linkId;
    }
  } else {
    base.ile_link_id = linkId;
  }
  return base;
}

export function sourceLinkFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): { kind: GuestLinkKind; linkId: string } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const kindRaw = metadata.source_link_kind;
  const idRaw = metadata.source_link_id;
  if ((kindRaw === "tap" || kindRaw === "ile") && typeof idRaw === "string" && idRaw.trim()) {
    return { kind: kindRaw, linkId: idRaw.trim() };
  }
  // Legacy fallbacks
  if (typeof metadata.tap_session_id === "string" && metadata.tap_session_id.trim()) {
    return { kind: "tap", linkId: metadata.tap_session_id.trim() };
  }
  if (typeof metadata.ile_link_id === "string" && metadata.ile_link_id.trim()) {
    return { kind: "ile", linkId: metadata.ile_link_id.trim() };
  }
  return null;
}

export function buildGuestLinkUrl(
  baseUrl: string,
  kind: GuestLinkKind,
  token: string,
): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = kind === "tap" ? "tap" : "ile";
  return `${base}/${path}/session/${token}`;
}

/**
 * Rebuild a listable share URL from a stored public_token (or null when missing).
 * Used by TAP/ILE list endpoints so owners always see copyable URLs.
 */
export function guestLinkUrlFromPublicToken(
  baseUrl: string,
  kind: GuestLinkKind,
  publicToken: string | null | undefined,
): string | null {
  const t = typeof publicToken === "string" ? publicToken.trim() : "";
  if (!t) return null;
  return buildGuestLinkUrl(baseUrl, kind, t);
}

export type GuestLinkTable = "workspace_tap_sessions" | "workspace_ile_links";

/**
 * Append entry query params on a guest link open. Returns the new history array.
 * Uses a read-modify-write; best-effort (does not throw on empty params).
 */
export async function recordGuestLinkEntryQueryParams(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  table: GuestLinkTable,
  linkId: string,
  params: EntryQueryParams,
): Promise<EntryQueryCapture[]> {
  if (!linkId.trim()) return [];
  if (Object.keys(params).length === 0) {
    // Still record empty captures? Skip empty to reduce noise.
    return [];
  }

  const { data: row } = await supabase
    .from(table)
    .select("entry_query_params")
    .eq("id", linkId)
    .maybeSingle();

  const next = appendEntryQueryCapture(row?.entry_query_params, params);
  await supabase.from(table).update({ entry_query_params: next }).eq("id", linkId);
  return next;
}

/** Shape returned on create/list for both modes. */
export type GuestLinkUrlFields = {
  access_mode: GuestLinkAccessMode;
  /** Always present: shareable session URL for this link (secret for private, stable for public). */
  url: string;
  /** @deprecated alias of url for private-era clients */
  private_url: string;
  public_token: string | null;
};
