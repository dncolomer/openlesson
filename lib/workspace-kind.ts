/**
 * Durable workspace kind.
 * Live rows are `standard` (Learning map). parseWorkspaceKind still maps
 * knowledge_region / calibration aliases for reads.
 * Agent/MCP create is Learning only; flows use POST /api/dashboard/flows.
 */

export const WORKSPACE_KIND_STANDARD = "standard";
export const WORKSPACE_KIND_KNOWLEDGE_REGION = "knowledge_region";
export const WORKSPACE_KIND_CALIBRATION = "calibration";

export const AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE =
  "Workspace create is Learning only. Use POST /api/dashboard/flows for verification or calibration.";

export type WorkspaceKind =
  | typeof WORKSPACE_KIND_STANDARD
  | typeof WORKSPACE_KIND_KNOWLEDGE_REGION
  | typeof WORKSPACE_KIND_CALIBRATION;

export type WorkspaceProductShell = "learning" | "verification" | "calibration";

export type WorkspaceKnowledgeFlowKind = "calibrate" | "verify";

export function parseWorkspaceKind(value: unknown): WorkspaceKind {
  if (value === WORKSPACE_KIND_KNOWLEDGE_REGION) return WORKSPACE_KIND_KNOWLEDGE_REGION;
  if (value === "knowledge-region" || value === "knowledgeRegion") {
    return WORKSPACE_KIND_KNOWLEDGE_REGION;
  }
  if (
    value === WORKSPACE_KIND_CALIBRATION ||
    value === "calibrate" ||
    value === "calibration_workspace"
  ) {
    return WORKSPACE_KIND_CALIBRATION;
  }
  return WORKSPACE_KIND_STANDARD;
}

export function isKnowledgeRegionWorkspace(value: unknown): boolean {
  return parseWorkspaceKind(value) === WORKSPACE_KIND_KNOWLEDGE_REGION;
}

export function isCalibrationWorkspace(value: unknown): boolean {
  return parseWorkspaceKind(value) === WORKSPACE_KIND_CALIBRATION;
}

/**
 * Verification and Calibration share the Goals / Context / Knowledge /
 * Settings shell and have no map designer.
 */
export function isNoMapWorkspace(value: unknown): boolean {
  const kind = parseWorkspaceKind(value);
  return (
    kind === WORKSPACE_KIND_KNOWLEDGE_REGION || kind === WORKSPACE_KIND_CALIBRATION
  );
}

export function noMapWorkspaceDashboardHref(kind: unknown): string | null {
  const parsed = parseWorkspaceKind(kind);
  if (parsed === WORKSPACE_KIND_KNOWLEDGE_REGION) return "/dashboard?tab=verification";
  if (parsed === WORKSPACE_KIND_CALIBRATION) return "/dashboard?tab=calibration";
  return null;
}

export function workspaceProductShell(value: unknown): WorkspaceProductShell {
  const kind = parseWorkspaceKind(value);
  if (kind === WORKSPACE_KIND_CALIBRATION) return "calibration";
  if (kind === WORKSPACE_KIND_KNOWLEDGE_REGION) return "verification";
  return "learning";
}

/** Flow embeddings Knowledge projects for this product. */
export function workspaceKnowledgeFlowKind(
  value: unknown,
): WorkspaceKnowledgeFlowKind | null {
  const kind = parseWorkspaceKind(value);
  if (kind === WORKSPACE_KIND_CALIBRATION) return "calibrate";
  if (kind === WORKSPACE_KIND_KNOWLEDGE_REGION) return "verify";
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
