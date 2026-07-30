import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { buildStudioProjectionView } from "@/lib/admin/data-studio";
import {
  loadKnowledgeConfigTrajectory,
} from "@/lib/pow-api/knowledge-config-store";
import {
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  parseProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import type { ProjectionDisplayMode } from "@/lib/knowledge-config/projection-view";

export const runtime = "nodejs";

/**
 * GET /api/admin/data-studio/projection
 *
 * Load trajectory + regions for a workspace and return studio projection layout.
 * Query:
 *   workspaceId= (required)
 *   algorithm=random|pca|classical_mds|smacof
 *   displayMode=trajectory|latest
 *   embeddingModelId=
 *   maxPoints=
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const params = request.nextUrl.searchParams;
    const workspaceId = (params.get("workspaceId") || "").trim();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const algorithm = parseProjectionAlgorithmId(params.get("algorithm"), "random");
    const displayModeRaw = params.get("displayMode") || "trajectory";
    const displayMode: ProjectionDisplayMode =
      displayModeRaw === "latest" ? "latest" : "trajectory";
    const embeddingModelId =
      (params.get("embeddingModelId") || "").trim() || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
    const maxPoints = Math.min(500, Math.max(10, Number(params.get("maxPoints")) || 120));

    const { data: workspace, error: wsError } = await adminClient
      .from("workspaces")
      .select("id, title, root_topic")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsError || !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const [trajectory, regionsRes] = await Promise.all([
      loadKnowledgeConfigTrajectory(adminClient, {
        workspaceId,
        subjectFilter: { kind: "all" },
        maxPoints,
        embeddingModelId,
      }),
      adminClient
        .from("custom_verification_models")
        .select(
          "id, name, centroid, mean_radius, cosine_threshold, embedding_model_id, dim, subject_count",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const points = trajectory
      .filter((p) => Array.isArray(p.vector) && p.vector.length > 0)
      .map((p) => ({
        t: p.t,
        as_of_ms: p.as_of_ms,
        vector: p.vector,
        confidence: p.confidence,
      }));

    const regions = (regionsRes.data || [])
      .filter((r) => Array.isArray(r.centroid) && r.centroid.length > 0)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name),
        centroid: r.centroid as number[],
        mean_radius: Number(r.mean_radius) || 0.4,
        cosine_threshold: Number(r.cosine_threshold) || 0.5,
        source: "custom_verification_model",
      }));

    const layout = buildStudioProjectionView({
      points,
      regions,
      algorithm,
      displayMode,
      screen: { width: 720, height: 420, margin: 40 },
    });

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        title: workspace.title || workspace.root_topic || workspace.id,
      },
      embedding_model_id: embeddingModelId,
      point_count: points.length,
      region_count: regions.length,
      regions: regions.map((r) => ({
        id: r.id,
        name: r.name,
        mean_radius: r.mean_radius,
        cosine_threshold: r.cosine_threshold,
        subject_count:
          (regionsRes.data || []).find((row) => row.id === r.id)?.subject_count ?? null,
      })),
      projection: {
        algorithm: layout.algorithm,
        frame_id: layout.frame_id,
        displayMode: layout.displayMode,
        bounds: layout.bounds,
        view: layout.view,
        coords: layout.coords,
        regionOverlays: layout.regionOverlays,
      },
    });
  } catch (error) {
    console.error("[admin/data-studio/projection]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build projection" },
      { status: 500 },
    );
  }
}
