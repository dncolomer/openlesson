/**
 * Durable workspace kind.
 * Live rows are `standard` (Learning map). Leftover knowledge_region /
 * calibration payloads parse as Learning. Flows use POST /api/dashboard/flows.
 */

export const WORKSPACE_KIND_STANDARD = "standard";
/** @deprecated Leftover payloads parse as Learning. */
export const WORKSPACE_KIND_KNOWLEDGE_REGION = "knowledge_region";
/** @deprecated Leftover payloads parse as Learning. */
export const WORKSPACE_KIND_CALIBRATION = "calibration";

export const AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE =
  "Workspace create is Learning only. Use POST /api/dashboard/flows for verification or calibration.";

export type WorkspaceKind = typeof WORKSPACE_KIND_STANDARD;

export type WorkspaceProductShell = "learning";

export type WorkspaceKnowledgeFlowKind = "calibrate" | "verify";

export function parseWorkspaceKind(_value?: unknown): WorkspaceKind {
  return WORKSPACE_KIND_STANDARD;
}

export function isKnowledgeRegionWorkspace(_value?: unknown): boolean {
  return false;
}

export function isCalibrationWorkspace(_value?: unknown): boolean {
  return false;
}

export function isNoMapWorkspace(_value?: unknown): boolean {
  return false;
}

export function noMapWorkspaceDashboardHref(_kind?: unknown): string | null {
  return null;
}

export function workspaceProductShell(_value?: unknown): WorkspaceProductShell {
  return "learning";
}

/** Learning maps do not project Calibrate/Verify embeddings on the map shell. */
export function workspaceKnowledgeFlowKind(
  _value?: unknown,
): WorkspaceKnowledgeFlowKind | null {
  return null;
}

/**
 * Knowledge-link mint stays available on Learning workspaces for existing
 * session links and TAPBench. Verification and Calibration workspaces use flows.
 */
export function workspaceAllowsKnowledgeLinkMint(value?: unknown): boolean {
  return !isNoMapWorkspace(value);
}

export function knowledgeLinkMintDeniedMessage(kind?: unknown): string {
  if (isCalibrationWorkspace(kind)) {
    return "Calibration workspaces do not support knowledge links.";
  }
  return isKnowledgeRegionWorkspace(kind)
    ? "Verification workspaces do not support knowledge links."
    : "Learning workspaces do not support knowledge links.";
}

export function assertWorkspaceAllowsKnowledgeLinkMint(
  kind: unknown,
): { ok: true } | { ok: false; error: string; code: "forbidden" } {
  if (workspaceAllowsKnowledgeLinkMint(kind)) return { ok: true };
  return {
    ok: false,
    error: knowledgeLinkMintDeniedMessage(kind),
    code: "forbidden",
  };
}
