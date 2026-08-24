/**
 * Durable workspace kind: standard (Blank / Template / Files+Goal) vs
 * Knowledge Region (Goals / Knowledge / Settings shell; PoW is external).
 */

export const WORKSPACE_KIND_STANDARD = "standard";
export const WORKSPACE_KIND_KNOWLEDGE_REGION = "knowledge_region";

export type WorkspaceKind =
  | typeof WORKSPACE_KIND_STANDARD
  | typeof WORKSPACE_KIND_KNOWLEDGE_REGION;

export function parseWorkspaceKind(value: unknown): WorkspaceKind {
  if (value === WORKSPACE_KIND_KNOWLEDGE_REGION) return WORKSPACE_KIND_KNOWLEDGE_REGION;
  if (value === "knowledge-region" || value === "knowledgeRegion") {
    return WORKSPACE_KIND_KNOWLEDGE_REGION;
  }
  return WORKSPACE_KIND_STANDARD;
}

export function isKnowledgeRegionWorkspace(value: unknown): boolean {
  return parseWorkspaceKind(value) === WORKSPACE_KIND_KNOWLEDGE_REGION;
}

/** TAP / ILE / TAPBench mint is only for standard (map) workspaces. */
export function workspaceAllowsKnowledgeLinkMint(value: unknown): boolean {
  return !isKnowledgeRegionWorkspace(value);
}

export function knowledgeLinkMintDeniedMessage(): string {
  return "Knowledge Region workspaces do not support knowledge links";
}

export function assertWorkspaceAllowsKnowledgeLinkMint(
  kind: unknown,
): { ok: true } | { ok: false; error: string; code: "forbidden" } {
  if (workspaceAllowsKnowledgeLinkMint(kind)) return { ok: true };
  return {
    ok: false,
    error: knowledgeLinkMintDeniedMessage(),
    code: "forbidden",
  };
}
