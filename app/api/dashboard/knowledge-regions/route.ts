/**
 * Owner dashboard: Knowledge regions for Verification or Calibration flows.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  parseDashboardKnowledgeRegionKind,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";
import { flowOwnedByUser, parseProductFlowKind, productRegionPagePath } from "@/lib/product-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildRegionFromFlowEmbeddings,
  buildVoiceRegionFromFlowRaws,
} from "@/lib/verification-flow";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import { getCalibrationFlowById } from "@/lib/calibration-flow-repository";
import {
  getVerificationFlowById,
  listVerificationResultsForFlowId,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const kind = parseDashboardKnowledgeRegionKind(
      new URL(req.url).searchParams.get("kind"),
    );
    if (!kind) return jsonError(400, "kind must be verification or calibration");

    const { data: rows, error } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, workspace_id, owner_user_id, product, name, description, subject_count, created_at, embedding_model_id",
      )
      .eq("owner_user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ kind, regions: [] });
    }

    return NextResponse.json({
      kind,
      regions: presentDashboardKnowledgeRegions(rows || [], kind, auth.user.id),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load knowledge regions";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    const kind = parseProductFlowKind(body.kind) || parseDashboardKnowledgeRegionKind(body.kind);
    if (!kind) return jsonError(400, "kind must be verification or calibration");
    const name = String(body.name || "").trim();
    if (!name) return jsonError(400, "name is required");
    const flowId = String(body.flowId || "").trim();
    if (!flowId) return jsonError(400, "flowId is required");

    const flow =
      kind === "calibration"
        ? await getCalibrationFlowById(flowId)
        : await getVerificationFlowById(flowId);
    if (!flow || !flowOwnedByUser(flow, auth.user.id)) {
      return jsonError(404, "Flow not found");
    }

    const stored = await listFlowEmbeddingsForOwner({
      ownerUserId: auth.user.id,
      flowId,
      flowKind: kind === "calibration" ? "calibrate" : "verify",
    });
    let items: { flowId: string; embedding?: number[] | null; id?: string }[] = stored.map(
      (row) => ({
        flowId: row.flow_id || flowId,
        embedding: row.vector,
        id: row.id,
      }),
    );
    if (kind === "verification" && items.length === 0) {
      items = await listVerificationResultsForFlowId(flow.id);
    }
    let spec: ReturnType<typeof buildRegionFromFlowEmbeddings>;
    try {
      spec = buildRegionFromFlowEmbeddings({
        name,
        flowId,
        items,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create knowledge region";
      return jsonError(400, message);
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        kind,
        persisted: false,
        spec,
        regionPath: productRegionPagePath(kind, ""),
      });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_regions")
      .insert({
        workspace_id: flow.workspaceId || null,
        owner_user_id: auth.user.id,
        product: kind,
        name: spec.name,
        description: `${kind}-flow:${flowId}`,
        embedding_model_id: spec.embedding_model_id,
        dim: spec.dim,
        centroid: spec.centroid,
        cohort_cohesion: spec.cohort_cohesion,
        mean_radius: spec.mean_radius,
        cosine_threshold: spec.cosine_threshold,
        subject_count: spec.subject_count,
        subjects: spec.subjects,
        created_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error || !data?.id) {
      return jsonError(500, error?.message || "Failed to create knowledge region");
    }
    const id = String(data.id);
    try {
      const voiceSpec = buildVoiceRegionFromFlowRaws({ name, embeddings: stored });
      if (voiceSpec) {
        await supabase.from("knowledge_regions").insert({
          workspace_id: flow.workspaceId || null,
          owner_user_id: auth.user.id,
          product: kind,
          name: voiceSpec.name,
          description: `${kind}-flow:${flowId}`,
          embedding_model_id: voiceSpec.embedding_model_id,
          dim: voiceSpec.dim,
          centroid: voiceSpec.centroid,
          cohort_cohesion: voiceSpec.cohort_cohesion,
          mean_radius: voiceSpec.mean_radius,
          cosine_threshold: voiceSpec.cosine_threshold,
          subject_count: voiceSpec.subject_count,
          subjects: voiceSpec.subjects,
          created_by: auth.user.id,
          updated_at: new Date().toISOString(),
        });
      }
    } catch {
      /* Path region is already saved. */
    }
    return NextResponse.json({
      kind,
      persisted: true,
      id,
      regionPath: productRegionPagePath(kind, id),
      subject_count: spec.subject_count,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create knowledge region";
    return jsonError(500, message);
  }
}
