/**
 * Owner dashboard: one Knowledge region, including details (clusters + samples).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  dashboardKnowledgeRegionHref,
  parseDashboardKnowledgeRegionKind,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";
import { presentKnowledgeRegionDetails } from "@/lib/knowledge-region-details";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import { productFlowEmbeddingKind } from "@/lib/product-flow";
import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import type { DataStudioEmbeddingRow } from "@/lib/data-studio-view";

export const runtime = "nodejs";

const FLOW_TABLE: Record<"verification" | "calibration" | "solve", string> = {
  verification: "verify_flows",
  calibration: "calibrate_flows",
  solve: "solve_flows",
};

async function flowNamesForIds(
  supabase: { from: (table: string) => any },
  kind: "verification" | "calibration" | "solve",
  ids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.from(FLOW_TABLE[kind]).select("id, name").in("id", unique);
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
    const requested = parseDashboardKnowledgeRegionKind(
      req.nextUrl.searchParams.get("kind"),
    );

    const { data: row, error } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, workspace_id, owner_user_id, product, name, description, subject_count, subjects, created_at, embedding_model_id, centroid, cosine_threshold, mean_radius, verify_flow_id, calibrate_flow_id, solve_flow_id",
      )
      .eq("id", id)
      .eq("owner_user_id", auth.user.id)
      .maybeSingle();
    if (error || !row) return jsonError(404, "Region not found");
    if (String(row.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
      return jsonError(404, "Region not found");
    }

    const kind =
      requested ||
      parseDashboardKnowledgeRegionKind(row.product) ||
      "verification";
    const presented = presentDashboardKnowledgeRegions([row], kind, auth.user.id)[0];
    if (!presented) return jsonError(404, "Region not found");

    const { data: siblings } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, name, description, product, owner_user_id, embedding_model_id, centroid, cosine_threshold, mean_radius, subject_count",
      )
      .eq("owner_user_id", auth.user.id)
      .eq("product", kind);

    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: auth.user.id,
      flowKind: productFlowEmbeddingKind(kind),
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

    const seedFlowId =
      kind === "calibration"
        ? String(row.calibrate_flow_id || "").trim()
        : kind === "solve"
          ? String(row.solve_flow_id || "").trim()
          : String(row.verify_flow_id || "").trim();
    const flowIds = [
      seedFlowId,
      ...embeddings.map((item) => String(item.flow_id || "").trim()),
    ].filter(Boolean);
    const flowNames = await flowNamesForIds(auth.supabase, kind, flowIds);

    const details = presentKnowledgeRegionDetails({
      parent: row,
      clusters: siblings || [],
      embeddings,
      flowNames,
      kind,
    });

    return NextResponse.json({
      kind,
      region: presented,
      details,
      regionPath: dashboardKnowledgeRegionHref(kind, presented.id),
      studioPath: details?.studioPath ?? null,
      workspaceId: presented.workspaceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load knowledge region";
    return jsonError(500, message);
  }
}
