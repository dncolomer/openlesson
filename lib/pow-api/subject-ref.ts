/**
 * Subject identity for Knowledge / region evaluation (user or guest).
 */

export interface SubjectRef {
  user_id?: string | null;
  guest_user_id?: string | null;
}

export interface KnowledgeConfigSubject {
  user_id?: string | null;
  guest_user_id?: string | null;
}

export function normalizeSubject(subject?: SubjectRef | null): {
  subject_user_id: string | null;
  subject_guest_user_id: string | null;
  subject: KnowledgeConfigSubject | undefined;
} {
  const user_id = subject?.user_id?.trim() || null;
  const guest_user_id = subject?.guest_user_id?.trim() || null;
  if (guest_user_id) {
    return {
      subject_user_id: null,
      subject_guest_user_id: guest_user_id,
      subject: { guest_user_id },
    };
  }
  if (user_id) {
    return {
      subject_user_id: user_id,
      subject_guest_user_id: null,
      subject: { user_id },
    };
  }
  return {
    subject_user_id: null,
    subject_guest_user_id: null,
    subject: undefined,
  };
}

/** Resolve subject from score participant overrides or auth context. */
export function subjectFromAuthAndParticipants(options: {
  authUserId?: string | null;
  authGuestUserId?: string | null;
  participantUserId?: string | null;
  participantGuestUserId?: string | null;
}): SubjectRef {
  if (options.participantGuestUserId) {
    return { guest_user_id: options.participantGuestUserId };
  }
  if (options.participantUserId) {
    return { user_id: options.participantUserId };
  }
  if (options.authGuestUserId) {
    return { guest_user_id: options.authGuestUserId };
  }
  if (options.authUserId) {
    return { user_id: options.authUserId };
  }
  return {};
}

export function subjectIdentityKey(subject?: SubjectRef | null): string | null {
  const guest = subject?.guest_user_id?.trim() || null;
  const user = subject?.user_id?.trim() || null;
  return guest || user || null;
}
