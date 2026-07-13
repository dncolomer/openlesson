export const TAP_POW_API_PATHS = {
  idle: "/api/workspace-tap-score/idle",
  speech: "/api/workspace-tap-score/speech",
} as const;

export const ILE_POW_API_PATHS = {
  idle: "/api/workspace-ile/idle",
  speech: "/api/workspace-ile/speech",
} as const;

export interface SessionPowContext {
  workspaceId?: string;
  sessionId?: string | null;
  blockId?: string;
  privateToken?: string;
  tapSessionId?: string | null;
}