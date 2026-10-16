import type { FlowKind, FlowPowRow } from "@/lib/flow-embedding";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export async function postWorkspaceFlowEmbedding(input: {
  workspaceId: string;
  flowKind: FlowKind;
  flowId?: string | null;
  runId?: string | null;
  identity?: string | null;
  source?: string | null;
  model?: SessionBranchModel | null;
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
  sessionId?: string | null;
  ileToken?: string | null;
  privateToken?: string | null;
  tapSessionId?: string | null;
  entryQueryParams?: Record<string, string | string[]> | null;
}): Promise<{ ok: boolean; id?: string | null }> {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) return { ok: false };
  try {
    const response = await fetch("/api/workspace/flow-embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        flowKind: input.flowKind,
        flowId: input.flowId ?? null,
        runId: input.runId ?? null,
        identity: input.identity ?? null,
        source: input.source ?? null,
        model: input.model ?? null,
        catalogSize: input.catalogSize ?? input.model?.catalogSize ?? null,
        sequence: input.sequence ?? null,
        pow: input.pow ?? [],
        sessionId: input.sessionId ?? null,
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
