/**
 * Map a WorkOS User Management authenticate result onto the app session identity
 * that dashboard guards (`requireAuthenticatedUser`) consume: email + stable user id.
 */

export type WorkOsUserProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organizationId: string | null;
};

export type WorkOsAppIdentity = {
  email: string;
  userId: string;
  workosUserId: string;
  organizationId: string | null;
  displayName: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function parseWorkOsUserProfile(value: unknown): WorkOsUserProfile | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "WorkOS user profile is required" };
  }
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const email = text(row.email).toLowerCase();
  if (!id) return { error: "WorkOS user id is required" };
  if (!email || !email.includes("@")) return { error: "WorkOS user email is required" };
  const organizationId =
    text(row.organizationId) || text(row.organization_id) || null;
  return {
    id,
    email,
    firstName: text(row.firstName) || text(row.first_name) || null,
    lastName: text(row.lastName) || text(row.last_name) || null,
    organizationId,
  };
}

export function workOsAppIdentityFromProfile(
  profile: WorkOsUserProfile,
  supabaseUserId?: string | null,
): WorkOsAppIdentity {
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  const userId = text(supabaseUserId) || profile.id;
  return {
    email: profile.email,
    userId,
    workosUserId: profile.id,
    organizationId: profile.organizationId,
    displayName: displayName || profile.email.split("@")[0] || profile.email,
  };
}

/**
 * Callback start state: authorization `code` plus the WorkOS user returned by
 * exchanging that code. Empty code is rejected so tests cannot skip the exchange.
 */
export function workOsAppIdentityFromCallbackInput(input: {
  code: string;
  user?: unknown;
  profile?: unknown;
  organizationId?: string | null;
  organization_id?: string | null;
}): WorkOsAppIdentity | { error: string } {
  if (!text(input.code)) return { error: "authorization code is required" };
  const parsed = parseWorkOsUserProfile(input.user ?? input.profile);
  if ("error" in parsed) return parsed;
  const organizationId =
    text(input.organizationId) || text(input.organization_id) || parsed.organizationId;
  return workOsAppIdentityFromProfile({ ...parsed, organizationId: organizationId || null });
}

export function workOsAppIdentityFromAuthenticatePayload(
  payload: unknown,
): WorkOsAppIdentity | { error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "WorkOS authenticate payload is required" };
  }
  const row = payload as Record<string, unknown>;
  return workOsAppIdentityFromCallbackInput({
    code: text(row.code) || "exchanged",
    user: row.user,
    organizationId: text(row.organizationId) || text(row.organization_id) || null,
  });
}

/** Shape `requireAuthenticatedUser` reads from `supabase.auth.getUser()`. */
export function sessionUserFromWorkOsIdentity(identity: WorkOsAppIdentity): {
  id: string;
  email: string;
} {
  return { id: identity.userId, email: identity.email };
}

export function workOsIdentitySatisfiesAuthUser(user: {
  id?: string | null;
  email?: string | null;
} | null): boolean {
  return Boolean(text(user?.id) && text(user?.email).includes("@"));
}

export function bindWorkOsIdentityToUserId(
  identity: WorkOsAppIdentity,
  supabaseUserId: string,
): WorkOsAppIdentity {
  return { ...identity, userId: text(supabaseUserId) || identity.userId };
}
