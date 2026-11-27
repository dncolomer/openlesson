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
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
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
    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
    });
    if (!org.ok) return org.response;
    const organizationId = org.organizationId;

    const { data: row, error } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, workspace_id, owner_user_id, organization_id, name, description, subject_count, subjects, created_at, embedding_model_id, centroid, cosine_threshold, mean_radius, verify_flow_id",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return jsonError(404, "Region not found");
    const rowOrg = String(row.organization_id || "").trim();
    const owner = String(row.owner_user_id || "").trim();
    const inOrg = Boolean(organizationId && rowOrg && rowOrg === organizationId);
    if (!inOrg && owner !== auth.user.id) return jsonError(404, "Region not found");
    if (String(row.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
      return jsonError(404, "Region not found");
    }

    const presented = presentDashboardKnowledgeRegions([row], auth.user.id)[0];
    if (!presented) return jsonError(404, "Region not found");

    let siblingQuery = auth.supabase
      .from("knowledge_regions")
      .select(
        "id, name, description, owner_user_id, embedding_model_id, centroid, cosine_threshold, mean_radius, subject_count",
      );
    siblingQuery = organizationId
      ? siblingQuery.eq("organization_id", organizationId)
      : siblingQuery.eq("owner_user_id", auth.user.id);
    const { data: siblings } = await siblingQuery;

    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: owner || auth.user.id,
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
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
    });
    if (!org.ok) return org.response;
    const { id } = await context.params;
    const { data: row } = await auth.supabase
      .from("knowledge_regions")
      .select("id, owner_user_id, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!row) return jsonError(404, "Region not found");
    const rowOrg = String(row.organization_id || "").trim();
    const owner = String(row.owner_user_id || "").trim();
    const inOrg = Boolean(org.organizationId && rowOrg && rowOrg === org.organizationId);
    if (!inOrg && owner !== auth.user.id) return jsonError(404, "Region not found");
    const result = await trashRegionSimulation({
      ownerUserId: owner || auth.user.id,
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
