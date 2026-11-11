export type SessionPowSurface = "solve" | "calibrate" | "verify";

const SOLVE_SESSION_BASE = "/api/solve/session";
const CALIBRATE_SESSION_BASE = "/api/calibrate/session";
const VERIFY_SESSION_BASE = "/api/verify/session";

function tapSessionVerbs(base: string) {
  return {
    start: `${base}/start`,
    complete: `${base}/complete`,
    speech: `${base}/speech`,
    idle: `${base}/idle`,
    canvas: `${base}/canvas`,
    scoutQuestions: `${base}/scout-questions`,
    chat: `${base}/chat`,
    trace: `${base}/trace`,
    topics: `${base}/topics`,
  } as const;
}

export const SOLVE_POW_API_PATHS = {
  idle: `${SOLVE_SESSION_BASE}/idle`,
  speech: `${SOLVE_SESSION_BASE}/speech`,
} as const;

export const CALIBRATE_POW_API_PATHS = tapSessionVerbs(CALIBRATE_SESSION_BASE);
export const VERIFY_POW_API_PATHS = tapSessionVerbs(VERIFY_SESSION_BASE);

/** Calibrate idle/speech — former TAP_POW_API_PATHS. */
export const TAP_POW_API_PATHS = {
  idle: CALIBRATE_POW_API_PATHS.idle,
  speech: CALIBRATE_POW_API_PATHS.speech,
} as const;

/** Solve idle/speech — former Learn canvas ILE_POW_API_PATHS. */
export const ILE_POW_API_PATHS = {
  idle: SOLVE_POW_API_PATHS.idle,
  speech: SOLVE_POW_API_PATHS.speech,
} as const;

export function solvePublicApiPath(token: string): string {
  return `/api/solve/public/${encodeURIComponent(token)}`;
}

export interface SessionPowContext {
  workspaceId?: string;
  sessionId?: string | null;
  blockId?: string;
  privateToken?: string;
  solveToken?: string;
  tapSessionId?: string | null;
  /** Share-link query params for param-scoped guest identity. */
  entryQueryParams?: Record<string, string | string[]>;
  /** TAP practice run — PoW is still recorded, flagged as Practice PoW. */
  practice?: boolean;
}
