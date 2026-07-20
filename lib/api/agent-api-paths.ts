/**
 * Canonical public API bases (v3): Proof-of-Work + Evaluation + Stash (alaTAP).
 * Capture lives under POW; scores / LWM / knowledge-config under EVAL;
 * agent stash/submit buffering under STASH.
 */

export const POW_API_BASE = "/api/v3/pow" as const;
export const EVAL_API_BASE = "/api/v3/eval" as const;
export const STASH_API_BASE = "/api/v3/stash" as const;

export type PowEvalApiSurface = "pow" | "eval";
export type AgentApiSurface = PowEvalApiSurface | "stash";

export function agentApiBase(surface: PowEvalApiSurface): string {
  return surface === "pow" ? POW_API_BASE : EVAL_API_BASE;
}

export function stashWorkspacesPath(baseUrl?: string | null): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  return `${base}${STASH_API_BASE}/workspaces`;
}

export function stashWorkspaceResource(
  workspaceId: string,
  resource: string,
  baseUrl?: string | null,
): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  return `${base}${STASH_API_BASE}/workspaces/${workspaceId}/${resource.replace(/^\//, "")}`;
}

export function stashEndpointPattern(resource: string, method = "POST"): string {
  return `${method} ${STASH_API_BASE}/workspaces/{workspace_id}/${resource.replace(/^\//, "")}`;
}

/** Absolute or relative workspace collection under pow. */
export function powWorkspacesPath(baseUrl?: string | null): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  return `${base}${POW_API_BASE}/workspaces`;
}

export function powWorkspacePath(workspaceId: string, baseUrl?: string | null): string {
  return `${powWorkspacesPath(baseUrl)}/${workspaceId}`;
}

export function powWorkspaceResource(
  workspaceId: string,
  resource: string,
  baseUrl?: string | null,
): string {
  return `${powWorkspacePath(workspaceId, baseUrl)}/${resource.replace(/^\//, "")}`;
}

export function evalWorkspacePath(workspaceId: string, baseUrl?: string | null): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  return `${base}${EVAL_API_BASE}/workspaces/${workspaceId}`;
}

export function evalWorkspaceResource(
  workspaceId: string,
  resource: string,
  baseUrl?: string | null,
): string {
  return `${evalWorkspacePath(workspaceId, baseUrl)}/${resource.replace(/^\//, "")}`;
}

/** Contract pattern for docs / structured output (placeholder workspace id). */
export function evalScoreEndpointPattern(
  verticalPath: string,
  baseUrl?: string | null,
): string {
  const path = `${EVAL_API_BASE}/workspaces/{workspace_id}/${verticalPath}`;
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}${path}`;
  }
  return `POST ${path}`;
}

export function powEndpointPattern(resource: string, method = "POST"): string {
  return `${method} ${POW_API_BASE}/workspaces/{workspace_id}/${resource.replace(/^\//, "")}`;
}

export function evalEndpointPattern(resource: string, method = "GET"): string {
  return `${method} ${EVAL_API_BASE}/workspaces/{workspace_id}/${resource.replace(/^\//, "")}`;
}
