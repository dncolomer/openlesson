/**
 * Browser helper: pass the sidebar org on dashboard fetches.
 */

import { ORGANIZATION_SWITCHED_EVENT } from "@/lib/organization/membership";

export const ACTIVE_ORGANIZATION_STORAGE_KEY = "openlesson.activeOrganizationId";

export function rememberActiveOrganizationId(organizationId: string): void {
  const id = String(organizationId || "").trim();
  if (!id || typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, id);
}

export function readActiveOrganizationId(event?: Event | null): string {
  if (event && "detail" in event) {
    const detail = (event as CustomEvent<{ organizationId?: string }>).detail;
    const fromEvent = String(detail?.organizationId || "").trim();
    if (fromEvent) return fromEvent;
  }
  if (typeof window === "undefined") return "";
  return String(window.sessionStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) || "").trim();
}

export function withOrganizationId(path: string, organizationId?: string): string {
  const id = String(organizationId || readActiveOrganizationId() || "").trim();
  if (!id) return path;
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const separator = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${separator}organization_id=${encodeURIComponent(id)}${hash}`;
}

export function organizationIdJsonBody(
  extra: Record<string, unknown> = {},
  organizationId?: string,
): Record<string, unknown> {
  const id = String(organizationId || readActiveOrganizationId() || "").trim();
  if (!id) return extra;
  return { ...extra, organization_id: id };
}

export function dispatchOrganizationSwitched(organizationId: string): void {
  const id = String(organizationId || "").trim();
  if (id) rememberActiveOrganizationId(id);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ORGANIZATION_SWITCHED_EVENT, {
      detail: { organizationId: id },
    }),
  );
}
