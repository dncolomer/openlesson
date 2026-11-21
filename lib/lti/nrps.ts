import type { LtiNrpsEndpoint } from "@/lib/lti/claims";
import { ltiSubjectFromIdentity } from "@/lib/lti/identity";

export const LTI_NRPS_ACCEPT =
  "application/vnd.ims.lti-nrps.v2.membershipcontainer+json";

export type LtiNrpsMember = {
  userId: string;
  name: string;
  email: string;
  roles: string[];
};

export function nrpsMembershipsUrl(endpoint: LtiNrpsEndpoint | null | undefined): string {
  return String(endpoint?.context_memberships_url || "").trim();
}

export function parseNrpsMembers(payload: unknown): LtiNrpsMember[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const members = (payload as { members?: unknown }).members;
  if (!Array.isArray(members)) return [];
  return members
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const item = row as Record<string, unknown>;
      const userId = String(item.user_id || item.userId || "").trim();
      if (!userId) return null;
      const name = String(item.name || "").trim();
      const email = String(item.email || "").trim();
      const roles = Array.isArray(item.roles)
        ? item.roles.map((role) => String(role || "").trim()).filter(Boolean)
        : [];
      return { userId, name, email, roles };
    })
    .filter((row): row is LtiNrpsMember => !!row);
}

export function nrpsDisplayName(
  members: readonly LtiNrpsMember[],
  userId: string,
): string {
  const id = String(userId || "").trim();
  const match = members.find((row) => row.userId === id);
  return match?.name || match?.email || "";
}

export function seedLtiRosterNames(session: {
  identity?: string | null;
  displayName?: string | null;
}): Record<string, string> {
  const identity = String(session.identity || "").trim();
  const name = String(session.displayName || "").trim();
  return identity && name ? { [identity]: name } : {};
}

export function parseLtiRosterNames(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const identity = String(key || "").trim();
    const name = String(raw || "").trim();
    if (identity && name) out[identity] = name;
  }
  return out;
}

export function nrpsNamesForIdentities(input: {
  members: readonly LtiNrpsMember[];
  identities: readonly string[];
  issuer: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const identity of input.identities) {
    const key = String(identity || "").trim();
    if (!key) continue;
    const sub = ltiSubjectFromIdentity(key, input.issuer);
    const name = nrpsDisplayName(input.members, sub);
    if (name) out[key] = name;
  }
  return out;
}
