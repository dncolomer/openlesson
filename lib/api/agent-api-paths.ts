/**
 * Canonical public API bases (v3): Proof-of-Work + Snapshot + Stash (TAP).
 * Capture lives under POW; LWM Snapshot / world model / knowledge-config under SNAPSHOT;
 * agent stash/submit buffering under STASH.
 */

export const POW_API_BASE = "/api/v3/pow" as const;
export const SNAPSHOT_API_BASE = "/api/v3/snapshot" as const;
export const STASH_API_BASE = "/api/v3/stash" as const;
/** TAPBench catalog, goals, keys, skill, and results (live traces go through Stash). */
export const TAPBENCH_API_BASE = "/api/v3/tapbench" as const;

/** @deprecated Use SNAPSHOT_API_BASE — former Evaluation API base name. */
export const EVAL_API_BASE = SNAPSHOT_API_BASE;

export type PowSnapshotApiSurface = "pow" | "snapshot";
/** @deprecated Use PowSnapshotApiSurface */
export type PowEvalApiSurface = PowSnapshotApiSurface | "eval";
export type AgentApiSurface = PowSnapshotApiSurface | "stash";

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
