/**
 * Durable workspace kind.
 * `standard` is a Learning workspace (map designer).
 * `knowledge_region` is a Verification workspace.
 * Neither product mints knowledge links. AYCL complimentary URLs are separate.
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

/**
 * Knowledge-link mint stays available on Learning workspaces for existing
 * session links and TAPBench. Verification workspaces use flows instead.
 * The learning workspace UI does not offer link settings.
 */
export function workspaceAllowsKnowledgeLinkMint(value?: unknown): boolean {
  return !isKnowledgeRegionWorkspace(value);
}

export function knowledgeLinkMintDeniedMessage(kind?: unknown): string {
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
