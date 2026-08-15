/**
 * Who writes PoW for a TAP/ILE session.
 *
 * Guest share links → always guest_user_id (never owner, never the browser's
 * logged-in account unless the link is assigned to that member).
 * Workspace map UI → always the active signed-in user (owner, org member, or
 * assigned member) with guest_user_id null.
 */

export type PowParticipantKind = "guest" | "signed_in";

export interface PowParticipantIdentity {
  kind: PowParticipantKind;
  userId: string | null;
  guestUserId: string | null;
  /** Short UI badge title, e.g. "Guest" or "Signed in". */
  badgeLabel: string;
  /** First 8 chars of the subject id for the badge, if any. */
  shortId: string | null;
}

function cleanId(value?: string | null): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  return t || null;
}

function shortId(id: string | null): string | null {
  return id && id.length >= 8 ? id.slice(0, 8) : id;
}

/**
 * Guest-link attribution: assigned member XOR anonymous/named guest.
 * Never falls back to the workspace owner.
 */
/**
 * ILE guest acting participant — assigned member or guest, never the owner
 * unless that is the only remaining identity (cookie owner path).
 */
export function resolveIleActingParticipantId(input: {
  ownerUserId: string;
  assignedUserId?: string | null;
  guestUserId?: string | null;
}): string {
  const assigned = cleanId(input.assignedUserId);
  if (assigned) return assigned;
  const guest = cleanId(input.guestUserId);
  if (guest) return guest;
  return cleanId(input.ownerUserId) || input.ownerUserId;
}

export function resolveGuestLinkAttribution(input: {
  guestUserId?: string | null;
  assignedUserId?: string | null;
}): { userId: string | null; guestUserId: string | null } {
  const assigned = cleanId(input.assignedUserId);
  if (assigned) {
    return { userId: assigned, guestUserId: null };
  }
  const guest = cleanId(input.guestUserId);
  if (guest) {
    return { userId: null, guestUserId: guest };
  }
  return { userId: null, guestUserId: null };
}

/** Map-UI / cookie session: signed-in participant (owner, member, or named user). */
export function resolveMapSessionAttribution(userId: string | null | undefined): {
  userId: string | null;
  guestUserId: null;
} {
  return { userId: cleanId(userId), guestUserId: null };
}

export function buildPowParticipantIdentity(input: {
  userId?: string | null;
  guestUserId?: string | null;
  assignedUserId?: string | null;
}): PowParticipantIdentity {
  const assigned = cleanId(input.assignedUserId);
  if (assigned) {
    return {
      kind: "signed_in",
      userId: assigned,
      guestUserId: null,
      badgeLabel: "Signed-in participant",
      shortId: shortId(assigned),
    };
  }
  const guest = cleanId(input.guestUserId);
  if (guest) {
    return {
      kind: "guest",
      userId: null,
      guestUserId: guest,
      badgeLabel: "Guest",
      shortId: shortId(guest),
    };
  }
  const user = cleanId(input.userId);
  if (user) {
    return {
      kind: "signed_in",
      userId: user,
      guestUserId: null,
      badgeLabel: "Signed in",
      shortId: shortId(user),
    };
  }
  return {
    kind: "guest",
    userId: null,
    guestUserId: null,
    badgeLabel: "Unknown participant",
    shortId: null,
  };
}

/** Columns for workspace_proof_of_work inserts — guest never dual-stamps owner user_id. */
export function powAttributionColumns(identity: PowParticipantIdentity): {
  user_id: string | null;
  guest_user_id: string | null;
} {
  if (identity.guestUserId) {
    return { user_id: null, guest_user_id: identity.guestUserId };
  }
  return { user_id: identity.userId, guest_user_id: null };
}

export function powAttributionColumnsFromIds(input: {
  userId?: string | null;
  guestUserId?: string | null;
}): { user_id: string | null; guest_user_id: string | null } {
  return powAttributionColumns(buildPowParticipantIdentity(input));
}

/** True when guest is present — forces user_id null for inserts. */
export function assertGuestDoesNotOwnUserId(columns: {
  user_id: string | null;
  guest_user_id: string | null;
}): { user_id: string | null; guest_user_id: string | null } {
  if (columns.guest_user_id) {
    return { user_id: null, guest_user_id: columns.guest_user_id };
  }
  return { user_id: columns.user_id, guest_user_id: null };
}
