/**
 * One ILE session-chat POST used by send, canvas/notebook submit, and chapter reload.
 */

export type StuckAction = "ask" | "theory" | "practice" | "canvas" | "notebook" | "break";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
  pending?: boolean;
}

export interface PendingChatMessage {
  text: string;
  imageDataUrl?: string;
}

export const ILE_SESSION_CHAT_PATH = "/api/session-chat";

export type IleSessionChatRequestInput = {
  problem: string;
  messages: Array<{ role: string; content: string; imageDataUrl?: string }>;
  sessionId?: string | null;
  model?: string;
  tutoringLanguage?: string | null;
  ayclToken?: string | null;
  ileToken?: string | null;
  sessionPlan?: unknown;
  activeStepIndex?: number;
  activeStepId?: string;
  activeStepDescription?: string;
  sessionMode?: string;
} & Record<string, unknown>;

export function buildIleSessionChatBody(input: IleSessionChatRequestInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    problem: input.problem,
    messages: input.messages,
  };
  if (input.sessionId) body.sessionId = input.sessionId;
  if (input.model) body.model = input.model;
  if (input.tutoringLanguage) body.tutoringLanguage = input.tutoringLanguage;
  if (input.ayclToken) body.ayclToken = input.ayclToken;
  if (input.ileToken) body.ileToken = input.ileToken;
  if (input.sessionPlan) body.sessionPlan = input.sessionPlan;
  if (input.activeStepIndex != null) body.activeStepIndex = input.activeStepIndex;
  if (input.activeStepId) body.activeStepId = input.activeStepId;
  if (input.activeStepDescription) body.activeStepDescription = input.activeStepDescription;
  if (input.sessionMode) body.session_mode = input.sessionMode;
  return body;
}

export async function postIleSessionChat(
  input: IleSessionChatRequestInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchImpl(ILE_SESSION_CHAT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildIleSessionChatBody(input)),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}
