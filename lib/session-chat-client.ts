/**
 * One ILE session-chat POST used by send, Work canvas turns, and chapter reload.
 */

import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  serializeIleWorkCanvasScene,
  type IleWorkCanvasScene,
  type IleWorkCanvasWorkspaceInput,
} from "@/lib/ile-work-canvas";

export type StuckAction = "ask" | "theory" | "practice" | "break";

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
  workCanvasScene?: IleWorkCanvasScene | null;
  workspaceContext?: IleWorkCanvasWorkspaceInput | null;
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
  if (input.workCanvasScene != null) {
    body.workCanvasScene = serializeIleWorkCanvasScene(input.workCanvasScene);
  }
  if (input.workspaceContext != null) {
    body.workspaceContext = input.workspaceContext;
  }
  return body;
}

export async function postIleSessionChat(
  input: IleSessionChatRequestInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  errorMessage: string;
}> {
  const response = await fetchImpl(ILE_SESSION_CHAT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildIleSessionChatBody(input)),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: response.ok,
    status: response.status,
    data,
    errorMessage: errorMessageFromBody(data, "Session chat failed"),
  };
}
