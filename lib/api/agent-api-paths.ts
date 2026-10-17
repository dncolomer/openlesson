/**
 * Public agent REST families (v3):
 *   - Workspace management  `/api/v3/workspaces` (+ `/api/v3/account`)
 *   - Headless proof-of-work `/api/v3/pow`
 *
 * Snapshot and Stash route trees may still exist for the product UI.
 * They are not public agent API families.
 */

export const WORKSPACE_API_BASE = "/api/v3/workspaces" as const;
export const ACCOUNT_API_BASE = "/api/v3/account" as const;
export const POW_API_BASE = "/api/v3/pow" as const;
/** Cookie-auth / internal Knowledge UI. Not a public agent family. */
export const SNAPSHOT_API_BASE = "/api/v3/snapshot" as const;
/** Cookie-auth TAP buffer. Not a public agent family. */
export const STASH_API_BASE = "/api/v3/stash" as const;

/** Public agent REST families. Snapshot / Stash are excluded. */
export const PUBLIC_AGENT_API_FAMILIES = ["workspace", "pow"] as const;
export type PublicAgentApiFamily = (typeof PUBLIC_AGENT_API_FAMILIES)[number];

/** @deprecated Use SNAPSHOT_API_BASE — former Evaluation API base name. */
export const EVAL_API_BASE = SNAPSHOT_API_BASE;

export type PowSnapshotApiSurface = "pow" | "snapshot";
/** @deprecated Use PowSnapshotApiSurface */
export type PowEvalApiSurface = PowSnapshotApiSurface | "eval";
export type AgentApiSurface = PowSnapshotApiSurface | "stash" | "workspace";

export function workspaceCollectionPath(baseUrl?: string | null): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  return `${base}${WORKSPACE_API_BASE}`;
}

export function workspacePath(workspaceId: string, baseUrl?: string | null): string {
  return `${workspaceCollectionPath(baseUrl)}/${workspaceId}`;
}

export function workspaceResource(
  workspaceId: string,
  resource: string,
  baseUrl?: string | null,
): string {
  return `${workspacePath(workspaceId, baseUrl)}/${resource.replace(/^\//, "")}`;
}

export function accountApiPath(baseUrl?: string | null): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  return `${base}${ACCOUNT_API_BASE}`;
}

export function powSessionPath(
  workspaceId: string,
  sessionId: string,
  resource?: string,
  baseUrl?: string | null,
): string {
  const root = powWorkspaceResource(workspaceId, `sessions/${sessionId}`, baseUrl);
  if (!resource) return root;
  return `${root}/${resource.replace(/^\//, "")}`;
}

export function agentApiBase(surface: PowSnapshotApiSurface | "eval"): string {
  if (surface === "pow") return POW_API_BASE;
  return SNAPSHOT_API_BASE;
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

export function snapshotWorkspacePath(workspaceId: string, baseUrl?: string | null): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  return `${base}${SNAPSHOT_API_BASE}/workspaces/${workspaceId}`;
}

/** @deprecated Use snapshotWorkspacePath */
export function evalWorkspacePath(workspaceId: string, baseUrl?: string | null): string {
  return snapshotWorkspacePath(workspaceId, baseUrl);
}

export function snapshotWorkspaceResource(
  workspaceId: string,
  resource: string,
  baseUrl?: string | null,
): string {
  return `${snapshotWorkspacePath(workspaceId, baseUrl)}/${resource.replace(/^\//, "")}`;
}

/** @deprecated Use snapshotWorkspaceResource */
export function evalWorkspaceResource(
  workspaceId: string,
  resource: string,
  baseUrl?: string | null,
): string {
  return snapshotWorkspaceResource(workspaceId, resource, baseUrl);
}

/** Contract pattern for docs / structured output (placeholder workspace id). */
export function snapshotScoreEndpointPattern(
  verticalPath: string,
  baseUrl?: string | null,
): string {
  const path = `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/${verticalPath}`;
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}${path}`;
  }
  return `POST ${path}`;
}

/** @deprecated Use snapshotScoreEndpointPattern */
export function evalScoreEndpointPattern(
  verticalPath: string,
  baseUrl?: string | null,
): string {
  return snapshotScoreEndpointPattern(verticalPath, baseUrl);
}

export function powEndpointPattern(resource: string, method = "POST"): string {
  return `${method} ${POW_API_BASE}/workspaces/{workspace_id}/${resource.replace(/^\//, "")}`;
}

export function snapshotEndpointPattern(resource: string, method = "GET"): string {
  return `${method} ${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/${resource.replace(/^\//, "")}`;
}

/** @deprecated Use snapshotEndpointPattern */
export function evalEndpointPattern(resource: string, method = "GET"): string {
  return snapshotEndpointPattern(resource, method);
}
