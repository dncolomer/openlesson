export const TAP_POW_API_PATHS = {
  idle: "/api/workspace-tap-score/idle",
  speech: "/api/workspace-tap-score/speech",
} as const;

export const ILE_POW_API_PATHS = {
  idle: "/api/workspace-learn/idle",
  speech: "/api/workspace-learn/speech",
} as const;

export interface SessionPowContext {
  workspaceId?: string;
  sessionId?: string | null;
  blockId?: string;
  privateToken?: string;
  tapSessionId?: string | null;
  /** Share-link query params for param-scoped guest identity. */
  entryQueryParams?: Record<string, string | string[]>;
  /** TAP practice run — PoW is still recorded, flagged as Practice PoW. */
  practice?: boolean;
}