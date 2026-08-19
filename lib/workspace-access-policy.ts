/**
 * One workspace principal + policy. Token guests are never the owner User.
 */

export const WORKSPACE_PRINCIPAL_KINDS = [
  "cookie_user",
  "aycl",
  "ile_guest",
  "tap_guest",
  "api_key",
  "tapbench",
] as const;

export type WorkspacePrincipalKind = (typeof WORKSPACE_PRINCIPAL_KINDS)[number];

export type WorkspacePrincipal = {
  kind: WorkspacePrincipalKind;
  /** Attribution subject — never the workspace owner for token guests. */
  subjectId: string;
  ownerUserId?: string | null;
  guestUserId?: string | null;
  organizationId?: string | null;
  isOrgAdmin?: boolean;
};

export type WorkspacePolicyAction =
  | "read"
  | "author"
  | "eval"
  | "link_admin"
  | "pow_write"
  | "score_performance";

export type WorkspacePolicyInput = {
  principal: WorkspacePrincipal;
  workspaceOwnerId: string;
  workspaceOrgId?: string | null;
  isGroup?: boolean;
  evalAllowed?: boolean;
  canAuthor?: boolean;
  isSessionParticipant?: boolean;
  action: WorkspacePolicyAction;
};

export type WorkspacePolicyResult =
  | { ok: true; subjectId: string; attributeAsOwner: boolean }
  | { ok: false; reason: "deny" };

export function cookieUserPrincipal(
  userId: string,
  extras?: Partial<Pick<WorkspacePrincipal, "organizationId" | "isOrgAdmin">>,
): WorkspacePrincipal {
  return {
    kind: "cookie_user",
    subjectId: userId,
    organizationId: extras?.organizationId ?? null,
    isOrgAdmin: extras?.isOrgAdmin === true,
  };
}

export function ayclSubjectId(purchaseId: string): string {
  const id = String(purchaseId || "").trim();
  return id ? `aycl:${id}` : "aycl:unknown";
}

/**
 * UUID for auth.users FK columns (sessions.user_id, workspaces.user_id, …).
 * Token subjects (`aycl:{purchaseId}`, guests) are never this value.
 */
export function persistableOwnerUserId(
  principal: WorkspacePrincipal,
): string | null {
  if (principal.kind === "cookie_user" || principal.kind === "api_key") {
    const id = String(principal.subjectId || "").trim();
    if (!id || id.startsWith("aycl:")) return null;
    return id;
  }
  const owner = String(principal.ownerUserId || "").trim();
  if (!owner || owner.startsWith("aycl:")) return null;
  return owner;
}

export function ayclPrincipal(input: {
  purchaseId: string;
  ownerUserId: string;
}): WorkspacePrincipal {
  const ownerUserId = String(input.ownerUserId || "").trim();
  return {
    kind: "aycl",
    subjectId: ayclSubjectId(input.purchaseId),
    ownerUserId,
  };
}

/** Actor a token route must use: purchase subject, never owner, never inspect-others. */
export function ayclNonOwnerActor(input: {
  purchaseId: string;
  ownerUserId: string;
}): {
  principal: WorkspacePrincipal;
  subjectId: string;
  isOwner: false;
  attributeAsOwner: false;
} {
  const principal = ayclPrincipal(input);
  return {
    principal,
    subjectId: principal.subjectId,
    isOwner: false,
    attributeAsOwner: false,
  };
}

export function ileGuestPrincipal(input: {
  assignedUserId?: string | null;
  guestUserId?: string | null;
  ownerUserId: string;
}): WorkspacePrincipal | { error: "guest_missing" } {
  const assigned = String(input.assignedUserId || "").trim() || null;
  const guest = String(input.guestUserId || "").trim() || null;
  const subjectId = assigned || guest;
  if (!subjectId) return { error: "guest_missing" };
  return {
    kind: "ile_guest",
    subjectId,
    ownerUserId: String(input.ownerUserId || "").trim() || null,
    guestUserId: assigned ? null : guest,
  };
}

export function tapGuestPrincipal(input: {
  tapSessionId: string;
  subjectId: string;
}): WorkspacePrincipal {
  return {
    kind: "tap_guest",
    subjectId: String(input.subjectId || "").trim() || `tap:${input.tapSessionId}`,
  };
}

export function tokenPrincipalIsOwner(principal: WorkspacePrincipal): boolean {
  if (principal.kind === "cookie_user" || principal.kind === "api_key") {
    return false;
  }
  const owner = String(principal.ownerUserId || "").trim();
  if (!owner) return false;
  return principal.subjectId === owner;
}

export function allowCookieWorkspacePerformance(input: {
  callerUserId: string;
  workspaceOwnerId: string;
  isSessionParticipant?: boolean;
  isOrgMemberOfGroup?: boolean;
}): boolean {
  const caller = String(input.callerUserId || "").trim();
  const owner = String(input.workspaceOwnerId || "").trim();
  if (!caller) return false;
  if (caller && owner && caller === owner) return true;
  if (input.isSessionParticipant) return true;
  if (input.isOrgMemberOfGroup) return true;
  return false;
}

/** TAP / ILE / portal link mint: owner or org-admin of the workspace. */
export function allowProductWorkspaceLinkAccess(input: {
  isOwner: boolean;
  isOrgAdmin: boolean;
}): boolean {
  return input.isOwner || input.isOrgAdmin;
}

/** Cookie Knowledge-config / snapshot-history: owner or eval member. AYCL is not this helper. */
export function allowProductWorkspaceEvalAccess(input: {
  isOwner: boolean;
  evalAllowed: boolean;
}): boolean {
  return input.isOwner || input.evalAllowed;
}

export function assertWorkspacePolicy(
  input: WorkspacePolicyInput,
): WorkspacePolicyResult {
  const { principal, action } = input;
  const owner = String(input.workspaceOwnerId || "").trim();
  const subjectId = principal.subjectId;
  const isOwner =
    principal.kind === "cookie_user" && !!owner && subjectId === owner;

  if (principal.kind === "aycl") {
    if (action === "link_admin") return { ok: false, reason: "deny" };
    if (action === "author" && input.canAuthor === false) {
      return { ok: false, reason: "deny" };
    }
    return { ok: true, subjectId, attributeAsOwner: false };
  }

  if (principal.kind === "ile_guest" || principal.kind === "tap_guest") {
    if (action === "link_admin" || action === "author" || action === "eval") {
      return { ok: false, reason: "deny" };
    }
    if (tokenPrincipalIsOwner(principal)) {
      return { ok: false, reason: "deny" };
    }
    return { ok: true, subjectId, attributeAsOwner: false };
  }

  if (principal.kind === "tapbench") {
    if (action === "pow_write" || action === "read") {
      return { ok: true, subjectId, attributeAsOwner: false };
    }
    return { ok: false, reason: "deny" };
  }

  if (principal.kind === "api_key") {
    return { ok: true, subjectId, attributeAsOwner: isOwner };
  }

  // cookie_user
  if (action === "score_performance" || action === "pow_write") {
    const allowed = allowCookieWorkspacePerformance({
      callerUserId: subjectId,
      workspaceOwnerId: owner,
      isSessionParticipant: input.isSessionParticipant === true,
      isOrgMemberOfGroup:
        input.isGroup === true &&
        !!input.workspaceOrgId &&
        principal.organizationId === input.workspaceOrgId,
    });
    if (!allowed) return { ok: false, reason: "deny" };
    return { ok: true, subjectId, attributeAsOwner: isOwner };
  }

  if (action === "link_admin") {
    if (
      !allowProductWorkspaceLinkAccess({
        isOwner,
        isOrgAdmin: principal.isOrgAdmin === true,
      })
    ) {
      return { ok: false, reason: "deny" };
    }
    return { ok: true, subjectId, attributeAsOwner: isOwner };
  }

  if (action === "eval") {
    if (
      !allowProductWorkspaceEvalAccess({
        isOwner,
        evalAllowed: input.evalAllowed === true,
      })
    ) {
      return { ok: false, reason: "deny" };
    }
    return { ok: true, subjectId, attributeAsOwner: isOwner };
  }

  if (action === "author") {
    if (!isOwner && input.canAuthor !== true) {
      return { ok: false, reason: "deny" };
    }
    return { ok: true, subjectId, attributeAsOwner: isOwner };
  }

  if (!isOwner && principal.isOrgAdmin !== true && input.evalAllowed !== true) {
    return { ok: false, reason: "deny" };
  }
  return { ok: true, subjectId, attributeAsOwner: isOwner };
}
