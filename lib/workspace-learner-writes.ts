/**
 * Learner launch / prompt-save / Done go through token-aware APIs.
 * Never write the `blocks` table from the browser client on AYCL/guest.
 */

export const WORKSPACE_LEARNER_LAUNCH_PATH = "/api/workspace/learner-launch";
export const WORKSPACE_LEARNER_PROMPT_PATH = "/api/workspace/learner-prompt";
export { WORKSPACE_BLOCK_SESSIONS_PATH } from "@/lib/block-previous-sessions";

export function buildLearnerLaunchBody(input: {
  workspaceId: string;
  blockId: string;
  sessionMode?: "learning" | "project" | string;
  planningPrompt?: string | null;
  ayclToken?: string | null;
  ileToken?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    workspaceId: String(input.workspaceId || "").trim(),
    blockId: String(input.blockId || "").trim(),
    sessionMode: input.sessionMode === "project" ? "project" : "learning",
    session_mode: input.sessionMode === "project" ? "project" : "learning",
  };
  if (input.planningPrompt != null) body.planningPrompt = input.planningPrompt;
  if (input.ayclToken) body.ayclToken = input.ayclToken;
  if (input.ileToken) body.ileToken = input.ileToken;
  return body;
}

export function buildLearnerPromptSaveBody(input: {
  workspaceId: string;
  blockId: string;
  planningPrompt: string;
  ayclToken?: string | null;
  ileToken?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    workspaceId: String(input.workspaceId || "").trim(),
    blockId: String(input.blockId || "").trim(),
    planningPrompt: input.planningPrompt,
  };
  if (input.ayclToken) body.ayclToken = input.ayclToken;
  if (input.ileToken) body.ileToken = input.ileToken;
  return body;
}
