export type SessionPowSurface = "verify" | "learn";

const LEARN_SESSION_BASE = "/api/workspace-learn";
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

export const VERIFY_POW_API_PATHS = tapSessionVerbs(VERIFY_SESSION_BASE);

/** TAP idle/speech — verification session kernel. */
export const TAP_POW_API_PATHS = {
  idle: VERIFY_POW_API_PATHS.idle,
  speech: VERIFY_POW_API_PATHS.speech,
} as const;

/** Learn canvas idle/speech. */
export const ILE_POW_API_PATHS = {
  idle: `${LEARN_SESSION_BASE}/idle`,
  speech: `${LEARN_SESSION_BASE}/speech`,
} as const;

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
