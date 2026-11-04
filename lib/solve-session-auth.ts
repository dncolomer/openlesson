/**
 * Public Solve-flow guest access: token + claimed session, never cookie auth.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getSolveFlowByToken, getSolveSessionById } from "@/lib/solve-flow-repository";
import type { SolveFlow } from "@/lib/solve-flow";

export type ResolvedSolveSessionAccess = {
  supabase: ReturnType<typeof createAdminClient>;
  flow: SolveFlow;
  session: Record<string, unknown>;
  ownerUserId: string;
  runOwnerUserId: string;
  workspaceId: string;
  identity: string | null;
};

export async function resolveSolveFlowAccess(
  token: string,
): Promise<
  | { flow: SolveFlow; ownerUserId: string }
  | { error: string; status: number }
> {
  const flow = await getSolveFlowByToken(token);
  if (!flow) return { error: "Solve flow not found", status: 404 };
  return { flow, ownerUserId: String(flow.ownerUserId || "").trim() };
}

export async function resolveSolveSessionAccess(
  token: string,
  sessionId: string,
): Promise<ResolvedSolveSessionAccess | { error: string; status: number }> {
  const base = await resolveSolveFlowAccess(token);
  if ("error" in base) return base;
  const id = String(sessionId || "").trim();
  if (!id) return { error: "sessionId is required", status: 400 };
  const session = await getSolveSessionById(id);
  if (!session || typeof session !== "object") {
    return { error: "Session not found", status: 404 };
  }
  const row = session as Record<string, unknown>;
  const kind = String(row.kind || "").trim();
  if (kind && kind !== "solve") return { error: "Session not found", status: 404 };
  const parent = String(row.solve_flow_id ?? row.solveFlowId ?? "").trim();
  if (parent !== base.flow.id) return { error: "Session not found", status: 404 };
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const runOwnerUserId = String(row.user_id || "").trim() || base.ownerUserId;
  const workspaceId = String(row.workspace_id || meta.workspace_id || "").trim();
  return {
    supabase: createAdminClient(),
    flow: base.flow,
    session: row,
    ownerUserId: base.ownerUserId,
    runOwnerUserId,
    workspaceId,
    identity: String(row.identity || "").trim() || null,
  };
}
