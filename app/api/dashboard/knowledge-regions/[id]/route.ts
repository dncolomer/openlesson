/**
 * Owner dashboard: one Knowledge region, including details (clusters + samples).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  dashboardKnowledgeRegionHref,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";
import { presentKnowledgeRegionDetails } from "@/lib/knowledge-region-details";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import { productFlowEmbeddingKind } from "@/lib/product-flow";
import { trashRegionSimulation } from "@/lib/region-simulation-run";
import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import type { DataStudioEmbeddingRow } from "@/lib/data-studio-view";

export const runtime = "nodejs";

const FLOW_TABLE = "verify_flows";

async function flowNamesForIds(
  supabase: { from: (table: string) => any },
  ids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.from(FLOW_TABLE).select("id, name").in("id", unique);
  const names: Record<string, string> = {};
  for (const row of data || []) {
    const id = String(row.id || "").trim();
    const name = String(row.name || "").trim();
    if (id && name) names[id] = name;
  }
  return names;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;

    const { data: row, error } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, workspace_id, owner_user_id, name, description, subject_count, subjects, created_at, embedding_model_id, centroid, cosine_threshold, mean_radius, verify_flow_id",
      )
      .eq("id", id)
      .eq("owner_user_id", auth.user.id)
      .maybeSingle();
    if (error || !row) return jsonError(404, "Region not found");
    if (String(row.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
      return jsonError(404, "Region not found");
    }

    const presented = presentDashboardKnowledgeRegions([row], auth.user.id)[0];
    if (!presented) return jsonError(404, "Region not found");

    const { data: siblings } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, name, description, owner_user_id, embedding_model_id, centroid, cosine_threshold, mean_radius, subject_count",
      )
      .eq("owner_user_id", auth.user.id);

    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: auth.user.id,
      flowKind: productFlowEmbeddingKind(),
    });
    const embeddings: DataStudioEmbeddingRow[] = stored.map((item) => ({
      id: item.id,
      workspace_id: item.workspace_id,
      owner_user_id: item.owner_user_id,
      flow_kind: item.flow_kind,
      flow_id: item.flow_id,
      run_id: item.run_id,
      identity: item.identity,
      vector: item.vector,
      raw: item.raw,
      embedding_model_id: item.embedding_model_id,
      created_at: item.created_at,
      source: item.source,
    }));

    const seedFlowId = String(row.verify_flow_id || "").trim();
    const flowIds = [
      seedFlowId,
      ...embeddings.map((item) => String(item.flow_id || "").trim()),
    ].filter(Boolean);
    const flowNames = await flowNamesForIds(auth.supabase, flowIds);

    const details = presentKnowledgeRegionDetails({
      parent: row,
      clusters: siblings || [],
      embeddings,
      flowNames,
    });

    return NextResponse.json({
      region: presented,
      details,
      regionPath: dashboardKnowledgeRegionHref(presented.id),
      workspaceId: presented.workspaceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load knowledge region";
    return jsonError(500, message);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const result = await trashRegionSimulation({
      ownerUserId: auth.user.id,
      regionId: id,
    });
    return NextResponse.json({
      id: result.id,
      deletedIds: result.deletedIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to trash knowledge region";
    const status = /not found/i.test(message) ? 404 : 500;
    return jsonError(status, message);
  }
}
