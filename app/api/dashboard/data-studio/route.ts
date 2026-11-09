/**
 * Owner Data Studio: embeddings + overlay regions for Verification,
 * Calibration, or Solve.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  parseDataStudioProduct,
  presentDashboardDataStudio,
  type DataStudioEmbeddingRow,
} from "@/lib/data-studio-view";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import type { RegionCentroidInput } from "@/lib/knowledge-config";
import { regionMatchesFlowEmbeddingChannel } from "@/lib/flow-embedding-view";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const product = parseDataStudioProduct(new URL(req.url).searchParams.get("product"));
    if (!product) {
      return jsonError(400, "product must be verification, calibration, or solve");
    }

    const presentedEmpty = presentDashboardDataStudio({
      product,
      viewerUserId: auth.user.id,
      embeddings: [],
      regions: [],
    });

    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: auth.user.id,
      flowKind: presentedEmpty.flowKind,
    });
    const embeddings: DataStudioEmbeddingRow[] = stored.map((row) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      owner_user_id: row.owner_user_id,
      flow_kind: row.flow_kind,
      flow_id: row.flow_id,
      run_id: row.run_id,
      identity: row.identity,
      vector: row.vector,
      raw: row.raw,
      embedding_model_id: row.embedding_model_id,
      created_at: row.created_at,
      source: row.source,
    }));

    let regions: RegionCentroidInput[] = [];
    const admin = createAdminClient();
    const { data: regionRows } = await admin
      .from("knowledge_regions")
      .select(
        "id, name, centroid, mean_radius, cosine_threshold, embedding_model_id, workspace_id, owner_user_id, product",
      )
      .eq("owner_user_id", auth.user.id)
      .eq("product", product);
    for (const row of regionRows || []) {
      const centroid = Array.isArray(row.centroid)
        ? row.centroid.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
        : [];
      if (
        !regionMatchesFlowEmbeddingChannel(
          {
            embedding_model_id: String(row.embedding_model_id || ""),
            centroid,
          },
          "any",
        )
      ) {
        continue;
      }
      regions.push({
        id: String(row.id),
        name: String(row.name || "Region"),
        centroid,
        mean_radius:
          typeof row.mean_radius === "number" && Number.isFinite(row.mean_radius)
            ? row.mean_radius
            : undefined,
        cosine_threshold:
          typeof row.cosine_threshold === "number" && Number.isFinite(row.cosine_threshold)
            ? row.cosine_threshold
            : undefined,
        source: String(row.workspace_id || "") || null,
        embedding_model_id: String(row.embedding_model_id || ""),
      });
    }

    return NextResponse.json(
      presentDashboardDataStudio({
        product,
        viewerUserId: auth.user.id,
        embeddings,
        regions,
      }),
    );
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not load Data Studio",
    );
  }
}
