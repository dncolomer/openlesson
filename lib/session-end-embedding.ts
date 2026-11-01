/**
 * Where a Learn-canvas session writes its completed embedding.
 * Solve runs parent on solve_flow_id with no workspace; map Learn uses workspace_id.
 */

export type SessionEndEmbeddingTarget =
  | { kind: "solve"; flowId: string; identity: string | null }
  | { kind: "learn"; workspaceId: string };

export function sessionEndEmbeddingTarget(session: {
  metadata?: unknown;
  identity?: unknown;
} | null | undefined): SessionEndEmbeddingTarget | null {
  if (!session) return null;
  const meta =
    session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
      ? (session.metadata as Record<string, unknown>)
      : {};
  const solveFlowId = String(meta.solve_flow_id ?? meta.solveFlowId ?? "").trim();
  if (solveFlowId) {
    const identity = String(session.identity ?? meta.identity ?? "").trim() || null;
    return { kind: "solve", flowId: solveFlowId, identity };
  }
  const workspaceId = String(meta.workspace_id ?? meta.workspaceId ?? "").trim();
  if (workspaceId) return { kind: "learn", workspaceId };
  return null;
}
