import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { parsePositiveInt } from "@/lib/admin/data-studio";
import {
  computeKnowledgeDistance,
  scoreAgainstCustomVerificationModel,
} from "@/lib/knowledge-config/custom-verification-model";
import { isKnowledgeConfigVector, KNOWLEDGE_CONFIG_DIM } from "@/lib/knowledge-config";

export const runtime = "nodejs";

/**
 * GET /api/admin/data-studio/regions
 * System-wide custom knowledge regions (custom_verification_models).
 *
 * Query: page, pageSize, workspaceId, search
 *
 * POST — eval a vector against a region (geometry only, no LLM).
 * Body: { action: "eval", regionId, vector: number[] }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1, 10_000);
    const pageSize = parsePositiveInt(params.get("pageSize"), 50, 100);
    const workspaceId = (params.get("workspaceId") || "").trim();
    const search = (params.get("search") || "").trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = adminClient
      .from("custom_verification_models")
      .select(
        "id, workspace_id, name, description, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, count, error } = await query.range(from, to);
    if (error) {
      console.error("[admin/data-studio/regions]", error);
      return NextResponse.json({ error: "Failed to load regions" }, { status: 500 });
    }

    const workspaceIds = [
      ...new Set((data || []).map((r) => r.workspace_id).filter(Boolean) as string[]),
    ];
    const workspaceTitles: Record<string, string> = {};
    if (workspaceIds.length > 0) {
      const { data: workspaces } = await adminClient
        .from("workspaces")
        .select("id, title, root_topic")
        .in("id", workspaceIds);
      for (const ws of workspaces || []) {
        workspaceTitles[ws.id] = (ws.title || ws.root_topic || ws.id) as string;
      }
    }

    const items = (data || []).map((row) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      workspace_title: workspaceTitles[row.workspace_id] || null,
      name: row.name,
      description: row.description,
      embedding_model_id: row.embedding_model_id,
      dim: row.dim,
      // Omit full centroid from list payload size; include length only
      centroid_dim: Array.isArray(row.centroid) ? row.centroid.length : 0,
      centroid: Array.isArray(row.centroid) ? row.centroid : [],
      cohort_cohesion: row.cohort_cohesion,
      mean_radius: row.mean_radius,
      cosine_threshold: row.cosine_threshold,
      subject_count: row.subject_count,
      subjects: row.subjects,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const total = count || 0;
    return NextResponse.json({
      items,
      page,
      pageSize,
      totalCount: total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      workspaceTitles,
    });
  } catch (error) {
    console.error("[admin/data-studio/regions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "eval";
    if (action !== "eval") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const regionId = typeof body.regionId === "string" ? body.regionId : "";
    if (!regionId) {
      return NextResponse.json({ error: "regionId is required" }, { status: 400 });
    }

    const vector = Array.isArray(body.vector) ? (body.vector as number[]) : null;
    if (!vector || !isKnowledgeConfigVector(vector, KNOWLEDGE_CONFIG_DIM)) {
      return NextResponse.json(
        { error: `vector must be a knowledgecfg-v1-d${KNOWLEDGE_CONFIG_DIM} unit vector` },
        { status: 400 },
      );
    }

    const { data: row, error } = await adminClient
      .from("custom_verification_models")
      .select(
        "id, workspace_id, name, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects",
      )
      .eq("id", regionId)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }

    const model = {
      name: String(row.name),
      embedding_model_id: String(row.embedding_model_id),
      dim: Number(row.dim) || KNOWLEDGE_CONFIG_DIM,
      centroid: Array.isArray(row.centroid) ? (row.centroid as number[]) : [],
      cohort_cohesion: Number(row.cohort_cohesion) || 0,
      mean_radius: Number(row.mean_radius) || 0,
      cosine_threshold: Number(row.cosine_threshold) || 0.5,
      subject_count: Number(row.subject_count) || 0,
      subjects: Array.isArray(row.subjects) ? row.subjects : [],
    };

    const score = scoreAgainstCustomVerificationModel(vector, model);
    const knowledge_distance = computeKnowledgeDistance(vector, model);

    return NextResponse.json({
      region: {
        id: row.id,
        workspace_id: row.workspace_id,
        name: row.name,
        subject_count: row.subject_count,
      },
      score,
      knowledge_distance,
      note: "Pure embedding-space geometry — not a vertical Eval and not written to history.",
    });
  } catch (error) {
    console.error("[admin/data-studio/regions] POST", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Region eval failed" },
      { status: 500 },
    );
  }
}
