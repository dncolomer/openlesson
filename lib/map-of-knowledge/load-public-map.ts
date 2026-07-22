import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMapOfKnowledgePayload,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  mapDotKindFromParticipant,
  mergeEmbeddingModelCatalog,
  resolveSelectedEmbeddingModelId,
  type MapOfKnowledgePayload,
  type PublicPowWorkspaceStatsRaw,
  type PublicRegionRaw,
  type PublicUserPointRaw,
} from "./index";
import { aggregateProofOfWorkStats } from "@/lib/pow-api/proof-of-work-stats";

const POW_SAMPLE_LIMIT = 500;

export type LoadPublicMapOptions = {
  /** Filter user points + regions to this embedding model id. */
  embeddingModelId?: string | null;
};

/**
 * Load public Map of Knowledge data (safe read model).
 * Only includes is_public workspaces; embeddings filtered by model id.
 */
export async function loadPublicMapOfKnowledge(
  supabase: SupabaseClient,
  options: LoadPublicMapOptions = {},
): Promise<MapOfKnowledgePayload> {
  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, description, cover_image_url, is_public")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(80);

  if (wsError) {
    console.error("[map-of-knowledge] workspaces:", wsError.message);
    throw new Error(wsError.message || "Failed to load public workspaces");
  }

  const publicWs = (workspaces || []).map((w) => ({
    id: w.id as string,
    title: (w.title as string) || null,
    root_topic: (w.root_topic as string) || null,
    description: (w.description as string | null) ?? null,
    cover_image_url: (w.cover_image_url as string | null) ?? null,
    is_public: true as const,
  }));

  if (publicWs.length === 0) {
    return buildMapOfKnowledgePayload({
      workspaces: [],
      blocks: [],
      regions: [],
      userPoints: [],
      powStats: [],
      embeddingModelId: options.embeddingModelId,
    });
  }

  const ids = publicWs.map((w) => w.id);

  const [blocksRes, regionsRes, snapsRes] = await Promise.all([
    supabase
      .from("blocks")
      .select("id, workspace_id, title, is_start")
      .in("workspace_id", ids)
      .order("created_at", { ascending: true }),
    supabase
      .from("custom_verification_models")
      .select("id, workspace_id, name, centroid, mean_radius, embedding_model_id, dim")
      .in("workspace_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("knowledge_config_snapshots")
      .select(
        "id, workspace_id, subject_user_id, subject_guest_user_id, vector, confidence, as_of_ms, embedding_model_id, dim",
      )
      .in("workspace_id", ids)
      .order("as_of_ms", { ascending: false })
      .limit(400),
  ]);

  if (blocksRes.error) {
    console.warn("[map-of-knowledge] blocks:", blocksRes.error.message);
  }
  if (regionsRes.error) {
    console.warn("[map-of-knowledge] regions:", regionsRes.error.message);
  }
  if (snapsRes.error) {
    console.warn("[map-of-knowledge] snapshots:", snapsRes.error.message);
  }

  const blocks = (blocksRes.data || []).map((b) => ({
    id: b.id as string,
    workspace_id: b.workspace_id as string,
    title: (b.title as string) || null,
    is_start: Boolean(b.is_start),
  }));

  const allRegions: PublicRegionRaw[] = (regionsRes.data || []).map((r) => ({
    id: r.id as string,
    workspace_id: r.workspace_id as string,
    name: (r.name as string) || "Region",
    centroid: Array.isArray(r.centroid) ? (r.centroid as number[]) : [],
    mean_radius: typeof r.mean_radius === "number" ? r.mean_radius : null,
    embedding_model_id:
      (r.embedding_model_id as string) || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    dim:
      typeof r.dim === "number"
        ? r.dim
        : Array.isArray(r.centroid)
          ? (r.centroid as number[]).length
          : null,
  }));

  // Latest snapshot per (workspace, subject, embedding_model) pair
  const seenSubjects = new Set<string>();
  const allUserPoints: PublicUserPointRaw[] = [];
  for (const row of snapsRes.data || []) {
    const wsId = row.workspace_id as string;
    const userId = (row.subject_user_id as string | null) || null;
    const guestId = (row.subject_guest_user_id as string | null) || null;
    const modelId =
      ((row.embedding_model_id as string) || "").trim() ||
      KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
    const key = `${wsId}:${userId || ""}:${guestId || ""}:${modelId}`;
    if (seenSubjects.has(key)) continue;
    seenSubjects.add(key);
    const vector = Array.isArray(row.vector) ? (row.vector as number[]) : [];
    if (vector.length === 0) continue;

    let kind: string | null = null;
    if (guestId) {
      kind = "tap";
    }

    allUserPoints.push({
      id: row.id as string,
      workspace_id: wsId,
      subject_user_id: userId,
      subject_guest_user_id: guestId,
      vector,
      confidence: typeof row.confidence === "number" ? row.confidence : 0.5,
      kind: mapDotKindFromParticipant(kind),
      embedding_model_id: modelId,
      dim: typeof row.dim === "number" ? row.dim : vector.length,
    });
  }

  // Enrich guest kinds from organization_guest_users metadata when available
  const guestIds = allUserPoints
    .map((p) => p.subject_guest_user_id)
    .filter((id): id is string => Boolean(id));
  if (guestIds.length > 0) {
    const { data: guests } = await supabase
      .from("organization_guest_users")
      .select("id, metadata, email")
      .in("id", guestIds);
    const kindByGuest = new Map<string, string>();
    for (const g of guests || []) {
      const meta = (g.metadata || {}) as { type?: string };
      const email = (g.email as string) || "";
      const type =
        meta.type ||
        (email.includes("ile-link")
          ? "ile"
          : email.includes("tap-link")
            ? "tap"
            : "standard");
      kindByGuest.set(g.id as string, type);
    }
    for (const p of allUserPoints) {
      if (p.subject_guest_user_id && kindByGuest.has(p.subject_guest_user_id)) {
        p.kind = mapDotKindFromParticipant(kindByGuest.get(p.subject_guest_user_id));
      }
    }
  }

  // Catalog across all models (before filter) so the dropdown lists every available frame
  const counts = new Map<
    string,
    { dim: number; point_count: number; region_count: number }
  >();
  for (const p of allUserPoints) {
    const id = p.embedding_model_id || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
    const cur = counts.get(id) || { dim: 0, point_count: 0, region_count: 0 };
    cur.point_count += 1;
    if (typeof p.dim === "number" && p.dim > 0) cur.dim = p.dim;
    else if (p.vector?.length) cur.dim = p.vector.length;
    counts.set(id, cur);
  }
  for (const r of allRegions) {
    const id = r.embedding_model_id || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
    const cur = counts.get(id) || { dim: 0, point_count: 0, region_count: 0 };
    cur.region_count += 1;
    if (typeof r.dim === "number" && r.dim > 0) cur.dim = r.dim;
    else if (r.centroid?.length) cur.dim = r.centroid.length;
    counts.set(id, cur);
  }
  const embeddingModels = mergeEmbeddingModelCatalog(
    Array.from(counts.entries()).map(([id, c]) => ({
      id,
      dim: c.dim,
      point_count: c.point_count,
      region_count: c.region_count,
    })),
  );
  const selectedModelId = resolveSelectedEmbeddingModelId(
    options.embeddingModelId,
    embeddingModels,
  );

  const powStats: PublicPowWorkspaceStatsRaw[] = [];
  const powWs = ids.slice(0, 24);
  for (const workspaceId of powWs) {
    try {
      const { count } = await supabase
        .from("workspace_proof_of_work")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      const { data: rows } = await supabase
        .from("workspace_proof_of_work")
        .select(
          "proof_of_work_type, tool_name, tool_action, block_id, session_id, file_size, mime_type, device_name, timestamp_ms, created_at",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(POW_SAMPLE_LIMIT);

      const stats = aggregateProofOfWorkStats(
        workspaceId,
        count ?? 0,
        (rows || []) as Parameters<typeof aggregateProofOfWorkStats>[2],
      );
      powStats.push({
        workspace_id: workspaceId,
        total_artifacts: stats.total_artifacts,
        unique_sessions: stats.unique_sessions,
        unique_blocks: stats.unique_blocks,
        last_24h: stats.last_24h,
        last_7d: stats.last_7d,
        by_type: stats.by_type.map((t) => ({ type: t.type, count: t.count })),
      });
    } catch (err) {
      console.warn("[map-of-knowledge] pow stats for", workspaceId, err);
    }
  }

  return buildMapOfKnowledgePayload({
    workspaces: publicWs,
    blocks,
    regions: allRegions,
    userPoints: allUserPoints,
    powStats,
    embeddingModelId: selectedModelId,
    embeddingModels,
  });
}
