import type { FlowKind, FlowPowRow } from "@/lib/flow-embedding";
import { solvePublicApiPath } from "@/lib/session-pow-api-paths";
import type { FlowEmbeddingViewRow } from "@/lib/flow-embedding-view";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export async function postSolveFlowEmbedding(input: {
  solveToken: string;
  sessionId: string;
  flowId?: string | null;
  identity?: string | null;
  model?: SessionBranchModel | null;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
}): Promise<{ ok: boolean; id?: string | null }> {
  const solveToken = input.solveToken.trim();
  const sessionId = input.sessionId.trim();
  if (!solveToken || !sessionId) return { ok: false };
  try {
    const response = await fetch(
      `${solvePublicApiPath(solveToken)}/embed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          flowId: input.flowId ?? null,
          identity: input.identity ?? null,
          model: input.model ?? null,
          sequence: input.sequence ?? null,
          pow: input.pow ?? [],
        }),
      },
    );
    if (!response.ok) return { ok: false };
    const payload = (await response.json().catch(() => ({}))) as { id?: unknown };
    return { ok: true, id: typeof payload.id === "string" ? payload.id : null };
  } catch {
    return { ok: false };
  }
}

export async function postWorkspaceFlowEmbedding(input: {
  workspaceId?: string;
  flowKind: FlowKind;
  flowId?: string | null;
  runId?: string | null;
  identity?: string | null;
  source?: string | null;
  model?: SessionBranchModel | null;
  /** Ignored. Catalog size is no longer part of the gen model. */
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
  sessionId?: string | null;
  solveToken?: string | null;
  ileToken?: string | null;
  privateToken?: string | null;
  tapSessionId?: string | null;
  entryQueryParams?: Record<string, string | string[]> | null;
}): Promise<{ ok: boolean; id?: string | null }> {
  const sessionId = String(input.sessionId || input.runId || "").trim();
  const tapSessionId = String(input.tapSessionId || "").trim();
  if (!sessionId && !tapSessionId && !input.solveToken && !input.privateToken && !input.ileToken) {
    return { ok: false };
  }
  try {
    const response = await fetch("/api/session/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: input.workspaceId?.trim() || null,
        flowKind: input.flowKind,
        flowId: input.flowId ?? null,
        runId: input.runId ?? null,
        identity: input.identity ?? null,
        source: input.source ?? null,
        model: input.model ?? null,
        sequence: input.sequence ?? null,
        pow: input.pow ?? [],
        sessionId: input.sessionId ?? null,
        solveToken: input.solveToken ?? null,
        ileToken: input.ileToken ?? null,
        privateToken: input.privateToken ?? null,
        tapSessionId: input.tapSessionId ?? null,
        entryQueryParams: input.entryQueryParams ?? null,
      }),
    });
    if (!response.ok) return { ok: false };
    const payload = (await response.json().catch(() => ({}))) as { id?: unknown };
    return { ok: true, id: typeof payload.id === "string" ? payload.id : null };
  } catch {
    return { ok: false };
  }
}

export async function listWorkspaceFlowEmbeddings(_input: {
  workspaceId: string;
  ayclToken?: string;
  flowId?: string | null;
  flowKind?: FlowKind | string | null;
}): Promise<FlowEmbeddingViewRow[]> {
  return [];
}
