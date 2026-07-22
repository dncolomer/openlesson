import type { AuthContext } from "./types";
import {
  subjectFromAuthAndParticipants,
  type SubjectRef,
} from "./learning-world-model-store";

/** Org admins and workspace owners may inspect / score other subjects. */
export function canInspectOtherSubjects(options: {
  isOrgAdmin?: boolean;
  isWorkspaceOwner?: boolean;
}): boolean {
  return Boolean(options.isOrgAdmin || options.isWorkspaceOwner);
}

/**
 * Cookie/web access to Knowledge eval APIs for a workspace.
 * - Owner: full access (self + others)
 * - Private personal workspace: owner only
 *
 * Group-mode participant access is retired (`isGroup` ignored).
 */
export function canAccessWorkspaceEval(options: {
  callerUserId: string;
  workspaceOwnerId: string | null | undefined;
  /** @deprecated Ignored — group mode no longer admits non-owners. */
  isGroup?: boolean | null;
}): { allowed: boolean; isOwner: boolean } {
  const ownerId = options.workspaceOwnerId?.trim() || null;
  const isOwner = Boolean(ownerId && ownerId === options.callerUserId);
  if (isOwner) return { allowed: true, isOwner: true };
  void options.isGroup;
  return { allowed: false, isOwner: false };
}

/**
 * After `canAccessWorkspaceEval`, web score/history routes must persist and list
 * learner rows with a privileged (service-role) client — same pattern as TAP/ILE
 * link routes. Cookie JWT alone cannot:
 * - INSERT eval_run_history / knowledge_config_snapshots for group members
 *   until subject self-write RLS is applied
 * - INSERT guest-subject rows (owner targets guest) without owner-only FOR ALL
 *   covering every edge (service role is the authoritative post-authz write path)
 *
 * Authz is always checked first with the user session; this only selects the
 * DB client for the trusted write/list phase.
 */
export function resolveEvalPersistenceClientMode(access: {
  allowed: boolean;
}): "privileged" | "deny" {
  return access.allowed ? "privileged" : "deny";
}

/** Tables that require subject self-write RLS for cookie JWT group self-eval. */
export const EVAL_SUBJECT_SELF_WRITE_TABLES = [
  "eval_run_history",
  "learning_world_models",
  "knowledge_config_snapshots",
] as const;

/**
 * Resolve subject for Snapshot API from query/body + auth.
 *
 * Always address subjects by unique IDs (`user_id` / `guest_user_id`).
 * There is no `subject=me` / `subject=self` token — omit IDs to default to the
 * authenticated caller's UUID (or pass that UUID explicitly as `user_id`).
 */
export function resolveEvaluationSubject(
  auth: AuthContext,
  params: {
    user_id?: string | null;
    guest_user_id?: string | null;
    /** @deprecated Ignored. Use `user_id` / `guest_user_id` unique IDs only. */
    subject?: string | null;
  },
  options?: {
    /** When true, caller is the workspace owner and may target other subjects. */
    isWorkspaceOwner?: boolean;
  },
): SubjectRef {
  const canInspect = canInspectOtherSubjects({
    isOrgAdmin: auth.is_org_admin,
    isWorkspaceOwner: options?.isWorkspaceOwner,
  });

  const requestedGuest = params.guest_user_id?.trim() || null;
  const requestedUser = params.user_id?.trim() || null;

  // Owners / org admins may inspect other participants by explicit unique id.
  if (canInspect) {
    if (requestedGuest) return { guest_user_id: requestedGuest };
    if (requestedUser) return { user_id: requestedUser };
  } else if (requestedGuest || requestedUser) {
    // Non-inspectors: only allow targeting own UUID(s); foreign ids ignored.
    if (requestedGuest && auth.guest_user_id && requestedGuest === auth.guest_user_id) {
      return { guest_user_id: requestedGuest };
    }
    if (requestedUser && auth.user_id && requestedUser === auth.user_id) {
      return { user_id: requestedUser };
    }
  }

  // Default: authenticated caller's unique identity (no me/self token).
  return subjectFromAuthAndParticipants({
    authUserId: auth.user_id,
    authGuestUserId: auth.guest_user_id,
  });
}

/**
 * Resolve participant overrides for score runs.
 * Non-inspectors always score themselves; owners/admins may pass user/guest ids.
 */
export function resolveScoreParticipantIds(options: {
  auth: AuthContext;
  isWorkspaceOwner?: boolean;
  requestedUserId?: string | null;
  requestedGuestUserId?: string | null;
}): {
  participantUserId: string | null;
  participantGuestUserId: string | null;
  subject: SubjectRef;
} {
  const canInspect = canInspectOtherSubjects({
    isOrgAdmin: options.auth.is_org_admin,
    isWorkspaceOwner: options.isWorkspaceOwner,
  });

  const guest =
    canInspect && options.requestedGuestUserId?.trim()
      ? options.requestedGuestUserId.trim()
      : null;
  const user =
    canInspect && !guest && options.requestedUserId?.trim()
      ? options.requestedUserId.trim()
      : null;

  const subject = subjectFromAuthAndParticipants({
    authUserId: options.auth.user_id,
    authGuestUserId: options.auth.guest_user_id,
    participantUserId: user,
    participantGuestUserId: guest,
  });

  return {
    participantUserId: user,
    participantGuestUserId: guest,
    subject,
  };
}

/** Stable label for history/UI rows (never collapses guests into owner). */
export function formatEvalSubjectLabel(subject: {
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
  user_id?: string | null;
  guest_user_id?: string | null;
}): string {
  const guest =
    subject.subject_guest_user_id?.trim() || subject.guest_user_id?.trim() || null;
  const user = subject.subject_user_id?.trim() || subject.user_id?.trim() || null;
  if (guest) {
    // Shorten UUID for display while keeping uniqueness visible.
    return guest.length > 12 ? `Guest ${guest.slice(0, 8)}…` : `Guest ${guest}`;
  }
  if (user) {
    return user.length > 12 ? `User ${user.slice(0, 8)}…` : `User ${user}`;
  }
  return "Unknown subject";
}
