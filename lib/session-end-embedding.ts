/**
 * Where a Learn-canvas session writes its completed embedding.
 * Protocol runs parent on verify_flow_id with no workspace; map Learn uses workspace_id.
 */

export type SessionEndEmbeddingTarget =
  | { kind: "verify"; flowId: string; identity: string | null }
  | { kind: "learn"; workspaceId: string };

export function sessionEndEmbeddingTarget(session: {
  metadata?: unknown;
  identity?: unknown;
  verify_flow_id?: unknown;
  verifyFlowId?: unknown;
  solve_flow_id?: unknown;
  solveFlowId?: unknown;
  workspace_id?: unknown;
  workspaceId?: unknown;
} | null | undefined): SessionEndEmbeddingTarget | null {
  if (!session) return null;
  const meta =
    session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
      ? (session.metadata as Record<string, unknown>)
      : {};
  const verifyFlowId = String(
    session.verify_flow_id ??
      session.verifyFlowId ??
      meta.verify_flow_id ??
      meta.verifyFlowId ??
      session.solve_flow_id ??
      session.solveFlowId ??
      meta.solve_flow_id ??
      meta.solveFlowId ??
      "",
  ).trim();
  if (verifyFlowId) {
    const identity = String(session.identity ?? meta.identity ?? "").trim() || null;
    return { kind: "verify", flowId: verifyFlowId, identity };
  }
  const workspaceId = String(
    session.workspace_id ?? session.workspaceId ?? meta.workspace_id ?? meta.workspaceId ?? "",
  ).trim();
  if (workspaceId) return { kind: "learn", workspaceId };
  return null;
}
