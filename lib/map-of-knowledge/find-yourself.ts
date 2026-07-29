/**
 * Pure helpers for Map of Knowledge “Find yourself” from a saved placement link.
 */

import type { MapRegion, MapUserLocation } from "./index";
import { MAP_NOT_ON_MAP_MESSAGE } from "./map-ready-notify";

/** Extract session token from a full placement URL or bare token string. */
export function parsePlacementLinkToken(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  // Bare token (no path) — allow UUID-ish or opaque tokens
  if (!/[\s/]/.test(raw) && raw.length >= 8 && !raw.includes("://")) {
    return raw;
  }

  try {
    const withScheme = raw.includes("://") ? raw : `https://placeholder.local${raw.startsWith("/") ? "" : "/"}${raw}`;
    const url = new URL(withScheme);
    const parts = url.pathname.split("/").filter(Boolean);
    // …/tap/session/<token> or …/ile/session/<token>
    const sessionIdx = parts.findIndex((p) => p === "session");
    if (sessionIdx >= 0 && parts[sessionIdx + 1]) {
      const token = decodeURIComponent(parts[sessionIdx + 1]).trim();
      return token || null;
    }
    // last path segment fallback
    const last = parts[parts.length - 1];
    if (last && last.length >= 8) return decodeURIComponent(last).trim() || null;
  } catch {
    // fall through
  }

  // Last resort: strip query/hash and take final segment
  const cleaned = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  const seg = cleaned.split("/").filter(Boolean).pop();
  if (seg && seg.length >= 8) return decodeURIComponent(seg).trim() || null;
  return null;
}

export type FindYourselfResolveOk = {
  ok: true;
  guest_user_id: string;
  workspace_id: string;
  block_id: string | null;
  link_kind: "tap" | "ile";
};

export type FindYourselfResolveErr = {
  ok: false;
  error: string;
  code: "empty" | "invalid_link" | "not_found" | "not_on_map" | "server_error";
};

/**
 * Match a public map user location to a guest subject from a resolved placement link.
 * Prefers full guest UUID when present on map rows; falls back to id_preview prefix.
 */
export function findMapUserForGuestSubject(
  users: readonly MapUserLocation[],
  guestUserId: string,
  workspaceId?: string | null,
): MapUserLocation | null {
  const gid = (guestUserId || "").trim().toLowerCase();
  if (!gid || !users.length) return null;
  const cleaned = gid.replace(/-/g, "");
  const preview = cleaned.slice(0, 6);

  const inWs = (u: MapUserLocation) =>
    !workspaceId || !workspaceId.trim() || u.workspace_id === workspaceId;

  // Exact guest id field when payload includes it
  for (const u of users) {
    if (!inWs(u)) continue;
    const ug =
      typeof (u as MapUserLocation & { subject_guest_user_id?: string | null })
        .subject_guest_user_id === "string"
        ? String(
            (u as MapUserLocation & { subject_guest_user_id?: string | null })
              .subject_guest_user_id,
          )
            .trim()
            .toLowerCase()
        : "";
    if (ug && ug === gid) return u;
  }

  // Preview match (legacy / short labels)
  for (const u of users) {
    if (!inWs(u)) continue;
    const p = (u.id_preview || "").toLowerCase();
    if (p && p === preview) return u;
    if (u.subject_label?.toLowerCase().includes(preview)) return u;
  }
  return null;
}

/**
 * Enable all regions in a workspace for Local Map focus after Find yourself.
 * Pure — used by Map of Knowledge client.
 */
export function enabledRegionsForFindYourself(
  regions: readonly Pick<MapRegion, "id" | "workspace_id">[],
  workspaceId: string,
): string[] {
  const ws = (workspaceId || "").trim();
  if (!ws) return [];
  return regions.filter((r) => r.workspace_id === ws).map((r) => r.id);
}

/**
 * Build Local Map focus intent after resolving a placement subject on the map.
 */
export function buildFindYourselfMapFocus(input: {
  users: readonly MapUserLocation[];
  regions: readonly Pick<MapRegion, "id" | "workspace_id">[];
  guest_user_id: string;
  workspace_id: string;
}):
  | {
      ok: true;
      focused_user_id: string;
      workspace_id: string;
      enabled_region_ids: string[];
      map_scope: "local";
    }
  | FindYourselfResolveErr {
  const guest = (input.guest_user_id || "").trim();
  const ws = (input.workspace_id || "").trim();
  if (!guest) {
    return { ok: false, error: "Missing guest identity on the link", code: "invalid_link" };
  }
  if (!ws) {
    return { ok: false, error: "Missing workspace on the link", code: "invalid_link" };
  }
  const user = findMapUserForGuestSubject(input.users, guest, ws);
  if (!user) {
    return {
      ok: false,
      error: MAP_NOT_ON_MAP_MESSAGE,
      code: "not_on_map",
    };
  }
  const enabled = enabledRegionsForFindYourself(input.regions, ws);
  return {
    ok: true,
    focused_user_id: user.id,
    workspace_id: ws,
    enabled_region_ids: enabled.length > 0 ? enabled : [],
    map_scope: "local",
  };
}
