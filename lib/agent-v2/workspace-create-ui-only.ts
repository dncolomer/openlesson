/**
 * Programmatic workspace creation (REST POST /workspaces, MCP create_workspace)
 * is disabled. Workspaces must be created manually via the product UI.
 */

import type { ErrorCode } from "./types";

export const WORKSPACE_CREATE_UI_ONLY_MESSAGE =
  "Workspace creation is not available via API or MCP. Create workspaces manually in the product UI at /workspace/new.";

export const WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS = 403 as const;

export const WORKSPACE_CREATE_UI_ONLY_ERROR_CODE: ErrorCode = "forbidden";

/** Throws the shared UI-only create error (MCP handler and shared guards). */
export function rejectProgrammaticWorkspaceCreate(): never {
  throw new Error(WORKSPACE_CREATE_UI_ONLY_MESSAGE);
}

export function isProgrammaticWorkspaceCreateRejectedMessage(message: string): boolean {
  return message === WORKSPACE_CREATE_UI_ONLY_MESSAGE;
}
