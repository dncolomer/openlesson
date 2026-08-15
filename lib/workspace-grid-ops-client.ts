/**
 * Single client for POST /api/workspace/grid-ops.
 * WorkspaceView and SessionList/map host both go through here.
 */

export const WORKSPACE_GRID_OPS_PATH = "/api/workspace/grid-ops";

export type WorkspaceGridOp =
  | "generate_shape"
  | "merge"
  | "split"
  | "move"
  | "relocate"
  | "resize"
  | "update_block"
  | "delete_block"
  | "delete_blocks"
  | "apply_dag"
  | "delete_dag"
  | string;

export type WorkspaceGridOpsRequestInput = {
  workspaceId: string;
  op: WorkspaceGridOp;
  ayclToken?: string | null;
  model?: string;
  locale?: string;
} & Record<string, unknown>;

export function withAyclToken<T extends Record<string, unknown>>(
  body: T,
  ayclToken?: string | null,
): T & { ayclToken?: string } {
  const token = typeof ayclToken === "string" ? ayclToken.trim() : "";
  if (!token) return body;
  return { ...body, ayclToken: token };
}

export function buildWorkspaceGridOpsBody(input: WorkspaceGridOpsRequestInput): Record<string, unknown> {
  const { ayclToken, ...rest } = input;
  return withAyclToken(
    {
      ...rest,
      workspaceId: String(input.workspaceId || "").trim(),
      op: input.op,
    },
    ayclToken,
  );
}

/** Happy-path mutate must not reload the whole workspace. */
export function shouldReloadWorkspaceAfterMutate(): boolean {
  return false;
}

export function applyWorkspaceGridOpsUpdatedNodes<T extends { id: string }>(
  current: T[],
  updated: T[] | null | undefined,
): T[] {
  if (!updated?.length) return current;
  const byId = new Map(current.map((node) => [node.id, node]));
  for (const node of updated) {
    byId.set(node.id, { ...(byId.get(node.id) as T | undefined), ...node });
  }
  const seen = new Set(current.map((n) => n.id));
  const next = current.map((n) => byId.get(n.id) ?? n);
  for (const node of updated) {
    if (!seen.has(node.id)) next.push(node);
  }
  return next;
}

export async function postWorkspaceGridOp(
  input: WorkspaceGridOpsRequestInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const body = buildWorkspaceGridOpsBody(input);
  const response = await fetchImpl(WORKSPACE_GRID_OPS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}
