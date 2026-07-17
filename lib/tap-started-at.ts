/**
 * Decide whether a TAP session row should receive a new `started_at` timestamp.
 * Only the first transition into in_progress should set started_at.
 */
export function shouldSetTapStartedAt(session: {
  status?: string | null;
  started_at?: string | null;
} | null | undefined): boolean {
  if (!session) return true;
  if (session.started_at) return false;
  if (session.status === "in_progress" || session.status === "completed") {
    // Already advanced without started_at — do not invent a late start time on chat.
    return false;
  }
  return true;
}

/** Build the patch for moving a TAP session to in_progress without resetting started_at. */
export function buildTapInProgressPatch(session: {
  status?: string | null;
  started_at?: string | null;
} | null | undefined): { status: "in_progress"; started_at?: string } {
  const patch: { status: "in_progress"; started_at?: string } = { status: "in_progress" };
  if (shouldSetTapStartedAt(session)) {
    patch.started_at = new Date().toISOString();
  }
  return patch;
}
