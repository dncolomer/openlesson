/**
 * Learner-chosen ILE session name (Previous Sessions list).
 * Blank keeps the session id as the display name.
 */
export const ILE_SESSION_NAME_META_KEY = "session_name" as const;
export const ILE_SESSION_NAME_MAX = 80;

export function normalizeIleSessionName(raw: unknown): string | null {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  return name.slice(0, ILE_SESSION_NAME_MAX);
}

export function ileSessionNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const rec = metadata as Record<string, unknown>;
  return normalizeIleSessionName(rec[ILE_SESSION_NAME_META_KEY] ?? rec.sessionName);
}

export function applyIleSessionNameToMetadata<T extends Record<string, unknown>>(
  metadata: T | null | undefined,
  rawName: unknown,
): T {
  const next = { ...(metadata || {}) } as T;
  const named = normalizeIleSessionName(rawName);
  if (named) {
    (next as Record<string, unknown>)[ILE_SESSION_NAME_META_KEY] = named;
  }
  return next;
}

/** Named session, else the default session id. */
export function ileSessionListDisplayName(input: {
  name?: string | null;
  sessionId: string;
}): string {
  const named = normalizeIleSessionName(input.name);
  if (named) return named;
  const id = String(input.sessionId || "").trim();
  return id || "Session";
}

/**
 * Exit-without-saving: hide from Previous Sessions. Proof of Work is stored
 * independently (`workspace_proof_of_work`) and must not be deleted.
 */
export const ILE_SESSION_UNSAVED_EXIT_META_KEY = "unsaved_exit" as const;

export function isIleSessionUnsavedExit(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (
    (metadata as Record<string, unknown>)[ILE_SESSION_UNSAVED_EXIT_META_KEY] ===
    true
  );
}

export function applyIleUnsavedExitToMetadata<T extends Record<string, unknown>>(
  metadata: T | null | undefined,
): T {
  return {
    ...(metadata || {}),
    [ILE_SESSION_UNSAVED_EXIT_META_KEY]: true,
  } as T;
}
