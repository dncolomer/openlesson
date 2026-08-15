/**
 * ILE session-chat PoW persist decision — used by /api/session-chat.
 */

export function resolveIleSessionChatPowUpload(input: {
  sessionId?: string | null;
  workspaceId?: string | null;
}):
  | { persist: true; sessionId: string; workspaceId: string }
  | { persist: false } {
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.trim() : "";
  const workspaceId =
    typeof input.workspaceId === "string" ? input.workspaceId.trim() : "";
  if (!sessionId || !workspaceId) return { persist: false };
  return { persist: true, sessionId, workspaceId };
}

export const ILE_SESSION_CHAT_POW_TOOL_NAME = "helios";
export const ILE_SESSION_CHAT_POW_TOOL_ACTION = "chat_exchange";

export function buildIleSessionChatPowFile(input: {
  sessionId: string;
  workspaceId: string;
  learnerText: string;
  assistantText: string;
  timestampMs?: number;
}): { fileName: string; base64: string; timestampMs: number } {
  const timestampMs = input.timestampMs ?? Date.now();
  const payload = {
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    learnerText: input.learnerText,
    assistantText: input.assistantText,
    timestampMs,
  };
  return {
    fileName: `ile-chat-${input.sessionId}-${timestampMs}.json`,
    base64: Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64"),
    timestampMs,
  };
}
