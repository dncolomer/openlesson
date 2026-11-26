import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { readLtiLaunchSession } from "@/lib/lti/request-session";
import { organizationMemberIds } from "@/lib/lti/store";
import { ownerInOrganization } from "@/lib/lti/resource-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { presentDashboardKnowledgeRegions } from "@/lib/dashboard-knowledge-regions";
import { presentKnowledgeRegionDetails } from "@/lib/knowledge-region-details";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import { productFlowEmbeddingKind } from "@/lib/product-flow";
import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import type { DataStudioEmbeddingRow } from "@/lib/data-studio-view";
import { ltiRosterNamesForIdentities } from "@/lib/lti/nrps-fetch";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  void req;
  try {
    const session = await readLtiLaunchSession();
    if (!session) return jsonError(401, "No LTI launch");
    const { id } = await context.params;
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("knowledge_regions")
      .select(
        "id, workspace_id, owner_user_id, name, description, subject_count, subjects, created_at, embedding_model_id, centroid, cosine_threshold, mean_radius, verify_flow_id",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return jsonError(404, "Region not found");
    if (String(row.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
      return jsonError(404, "Region not found");
    }
    const members = await organizationMemberIds(session.organizationId);
    if (!ownerInOrganization(String(row.owner_user_id || ""), members)) {
      return jsonError(403, "Region is not in this organization");
    }
    const ownerId = String(row.owner_user_id || "");
    const presented = presentDashboardKnowledgeRegions([row], ownerId)[0];
    if (!presented) return jsonError(404, "Region not found");
    const { data: siblings } = await admin
      .from("knowledge_regions")
      .select(
        "id, name, description, owner_user_id, embedding_model_id, centroid, cosine_threshold, mean_radius, subject_count",
      )
      .eq("owner_user_id", ownerId);
    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: ownerId,
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
    const ids = [
      seedFlowId,
      ...embeddings.map((item) => String(item.flow_id || "").trim()),
    ].filter(Boolean);
    const unique = [...new Set(ids)];
    const { data: flowRows } = unique.length
      ? await admin.from("verify_flows").select("id, name").in("id", unique)
      : { data: [] as Array<{ id: string; name: string }> };
    const flowNames: Record<string, string> = {};
    for (const flow of flowRows || []) {
      if (flow.id && flow.name) flowNames[String(flow.id)] = String(flow.name);
    }
    const details = presentKnowledgeRegionDetails({
      parent: row,
      clusters: siblings || [],
      embeddings,
      flowNames,
    });
    const identities = [
      session.identity,
      ...embeddings.map((item) => String(item.identity || "").trim()),
    ].filter(Boolean);
    const rosterNames = await ltiRosterNamesForIdentities({ session, identities });
    return NextResponse.json({
      region: presented,
      details,
      rosterNames,
      regionPath: `/lti/regions/${presented.id}`,
      workspaceId: presented.workspaceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load knowledge region";
    return jsonError(500, message);
  }
}
