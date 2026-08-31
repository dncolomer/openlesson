/**
 * xAI-driven ILE gather: epistemic forage at the edge of current PoW,
 * persist block-scoped planned resources.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardSessionRoute,
} from "@/lib/api/require-auth";
import {
  callXaiJSON,
  systemMessage,
  userMessage,
  DEFAULT_MODEL,
} from "@/lib/xai-client";
import {
  buildIleGatherForageInput,
  decideIleGatherResources,
  ileGatherForageSystemPrompt,
  ileGatherForageUserPrompt,
  ileGatherResourceMeta,
  ILE_GATHER_SESSION_PERSIST_SELECT,
  parseIleGatherForageResponse,
  resolveIleGatherPersistWorkspaceId,
  toIleGatherExternalCreate,
  type IleGatheredResourceDraft,
} from "@/lib/ile-gather-resources";
import {
  emptyIlePowTypeCounts,
  type IlePowCounterArtifact,
  type IlePowTypeCounts,
} from "@/lib/ile-pow-counters";
import {
  normalizeExternalResourceList,
  type WorkspaceExternalResource,
} from "@/lib/workspace-external-resources";

export const runtime = "nodejs";

function asCounts(raw: unknown): IlePowTypeCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  return {
    tool: n(r.tool),
    screen: n(r.screen),
    video: n(r.video),
    eeg: n(r.eeg),
  };
}

function asArtifacts(raw: unknown): IlePowCounterArtifact[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === "object") as IlePowCounterArtifact[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const blockId = typeof body.blockId === "string" ? body.blockId.trim() : "";
    const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
    if (!sessionId || !blockId || !chapterId) {
      return jsonError(400, "sessionId, blockId, and chapterId are required");
    }

    const auth = await guardSessionRoute(sessionId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const artifacts = asArtifacts(body.artifacts);
    const spent = asCounts(body.spent) ?? emptyIlePowTypeCounts();
    const decision = decideIleGatherResources({
      artifacts,
      spent,
      lastGatherAt: typeof body.lastGatherAt === "number" ? body.lastGatherAt : null,
      gatherCount: typeof body.gatherCount === "number" ? body.gatherCount : 0,
      now: typeof body.now === "number" ? body.now : Date.now(),
    });
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.reason, warning: decision.warning, allowed: false },
        { status: 400 },
      );
    }

    const forage = buildIleGatherForageInput({
      artifacts,
      promptModifier: typeof body.promptModifier === "string" ? body.promptModifier : "",
      chapter: {
        id: chapterId,
        description: typeof body.chapterDescription === "string" ? body.chapterDescription : "",
      },
      blockId,
    });

    const ai = await callXaiJSON<{ resources?: IleGatheredResourceDraft[] }>(
      [
        systemMessage(ileGatherForageSystemPrompt()),
        userMessage(ileGatherForageUserPrompt(forage)),
      ],
      { model: DEFAULT_MODEL, maxTokens: 1200, temperature: 0.2 },
    );
    if (!ai.success || !ai.data) {
      return jsonError(502, ai.error || "Gather forage failed");
    }

    const drafts = parseIleGatherForageResponse(ai.data);
    const jobId =
      typeof body.jobId === "string" && body.jobId.trim()
        ? body.jobId.trim()
        : `ile-gather-${Date.now()}`;
    const meta = ileGatherResourceMeta({
      blockId,
      jobId,
      chapterId,
    });

    const { data: session } = await auth.supabase
      .from("sessions")
      .select(ILE_GATHER_SESSION_PERSIST_SELECT)
      .eq("id", sessionId)
      .single();
    const workspaceId = resolveIleGatherPersistWorkspaceId({
      sessionRow: session,
      bodyWorkspaceId:
        typeof body.workspaceId === "string" ? body.workspaceId : "",
    });

    const creates = drafts
      .map((draft) => toIleGatherExternalCreate(draft, meta))
      .filter((row): row is NonNullable<typeof row> => row != null);

    let persisted: WorkspaceExternalResource[] = [];
    if (workspaceId && creates.length > 0) {
      const rows = creates.map((normalized, i) => ({
        workspace_id: workspaceId,
        user_id: auth.persistUserId,
        ...normalized,
        sort_order: normalized.sort_order || i,
      }));
      const { data, error } = await auth.supabase
        .from("workspace_external_resources")
        .insert(rows)
        .select("*");
      if (error) {
        console.error("[ile-gather-resources] persist", error);
      } else {
        persisted = normalizeExternalResourceList(data || []);
      }
    }

    return NextResponse.json({
      allowed: true,
      consume: decision.consume,
      policy: forage.policy,
      policyId: forage.policyId,
      resources: persisted.length > 0 ? persisted : creates.map((row, i) => ({
        id: `${jobId}-${i}`,
        workspace_id: workspaceId,
        title: row.title,
        url: row.url,
        resource_type: row.resource_type,
        description: row.description,
        source: row.source,
        dantes_topic_slug: row.dantes_topic_slug,
        meta: row.meta,
        sort_order: row.sort_order,
        created_at: new Date().toISOString(),
      })),
    });
  } catch (err) {
    console.error("[ile-gather-resources]", err);
    return jsonError(500, "Internal error");
  }
}
