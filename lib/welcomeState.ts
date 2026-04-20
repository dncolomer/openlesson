/**
 * Per-session welcome & per-probe "already-typed" tracking.
 *
 * A "fresh" session is one the user has never clicked Play on. Once the
 * welcome Play button is clicked for a given session we mark it so page
 * refreshes don't replay the welcome experience.
 *
 * Probes are separately tracked: each probe id gets marked "typed" the
 * first time it finishes its reveal animation, so navigating back to an
 * older probe renders instantly.
 */

const WELCOME_PREFIX = "session-welcome-seen:";
const TYPED_PREFIX = "probe-typed-seen:";
const SPOKEN_PREFIX = "session-welcome-spoken:";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isSessionWelcomeSeen(sessionId: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(WELCOME_PREFIX + sessionId) === "1";
  } catch {
    return false;
  }
}

export function markSessionWelcomeSeen(sessionId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(WELCOME_PREFIX + sessionId, "1");
  } catch {
    /* quota */
  }
}

export function isSessionWelcomeSpoken(sessionId: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(SPOKEN_PREFIX + sessionId) === "1";
  } catch {
    return false;
  }
}

export function markSessionWelcomeSpoken(sessionId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SPOKEN_PREFIX + sessionId, "1");
  } catch {
    /* quota */
  }
}

export function isProbeTyped(probeId: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(TYPED_PREFIX + probeId) === "1";
  } catch {
    return false;
  }
}

export function markProbeTyped(probeId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(TYPED_PREFIX + probeId, "1");
  } catch {
    /* quota */
  }
}
