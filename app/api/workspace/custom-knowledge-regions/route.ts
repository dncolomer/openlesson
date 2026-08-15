import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  computeKnowledgeDistanceForSubject,
  createCustomVerificationModelFromSubjects,
  createSyntheticCustomVerificationModel,
  deleteCustomVerificationModel,
  evalSubjectAgainstCustomVerificationModel,
  listCustomVerificationModels,
  listSubjectsWithKnowledgeConfig,
} from "@/lib/pow-api/custom-verification-model-store";
import { CustomVerificationModelError } from "@/lib/knowledge-config/custom-verification-model";

export const runtime = "nodejs";

/**
 * Cookie-auth surface for workspace custom knowledge regions (custom knowledge regions).
 * GET  ?workspaceId=  → list regions + subjects with embeddings (includes centroids for overlay)
 * POST { action: "create" | "create_synthetic" | "delete" | "eval" | "knowledge_distance", workspaceId, ... }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    const [models, subjects] = await Promise.all([
      listCustomVerificationModels(auth.supabase, workspaceId),
      listSubjectsWithKnowledgeConfig(auth.supabase, workspaceId, { baseUrl }),
    ]);

    return NextResponse.json({
      workspace_id: workspaceId,
      models,
      subjects,
    });
  } catch (error) {
    console.error("[workspace/custom-knowledge-regions] GET failed:", error);
    return jsonError(500, "Failed to load custom knowledge regions");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const action = typeof body.action === "string" ? body.action : "create";

    if (action === "list") {
      const [models, subjects] = await Promise.all([
        listCustomVerificationModels(auth.supabase, workspaceId),
        listSubjectsWithKnowledgeConfig(auth.supabase, workspaceId),
      ]);
      return NextResponse.json({ workspace_id: workspaceId, models, subjects });
    }

    if (action === "eval" || action === "knowledge_distance") {
      const modelId =
        typeof body.modelId === "string"
          ? body.modelId
          : typeof body.regionId === "string"
            ? body.regionId
            : typeof body.region_id === "string"
              ? body.region_id
              : "";
      if (!modelId) {
        return jsonError(400, "modelId / regionId is required");
      }
      const subject = {
        user_id: typeof body.user_id === "string" ? body.user_id : auth.user.id,
        guest_user_id: typeof body.guest_user_id === "string" ? body.guest_user_id : null,
        label: typeof body.label === "string" ? body.label : null,
      };

      if (action === "knowledge_distance") {
        const result = await computeKnowledgeDistanceForSubject(auth.supabase, {
          workspaceId,
          regionId: modelId,
          subject,
        });
        return NextResponse.json({
          workspace_id: workspaceId,
          computation: "knowledge_distance",
          note: "Pure embedding-space geometry — not a vertical Eval and not written to eval history.",
          region: {
            id: result.region.id,
            name: result.region.name,
            subject_count: result.region.subject_count,
          },
          subject: result.subject,
          knowledge_distance: result.knowledge_distance,
        });
      }

      const result = await evalSubjectAgainstCustomVerificationModel(auth.supabase, {
        workspaceId,
        modelId,
        subject,
      });
      return NextResponse.json({
        workspace_id: workspaceId,
        model: {
          id: result.model.id,
          name: result.model.name,
          subject_count: result.model.subject_count,
        },
        score: result.score,
        knowledge_distance: {
          knowledge_distance: result.score.knowledge_distance,
          l2_distance: result.score.l2_distance,
          cosine_similarity: result.score.cosine_similarity,
          cosine_distance: result.score.cosine_distance,
          in_region: result.score.in_region,
          embedding_model_id: result.score.embedding_model_id,
          region_name: result.score.model_name,
        },
      });
    }

    if (action === "create_synthetic") {
      const name = typeof body.name === "string" ? body.name : "";
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      const rawFiles = Array.isArray(body.files) ? body.files : [];
      const files = rawFiles
        .map((f: Record<string, unknown>) => {
          const fileName = typeof f.name === "string" ? f.name : "";
          const mimeType =
            typeof f.mimeType === "string"
              ? f.mimeType
              : typeof f.mime_type === "string"
                ? f.mime_type
                : "";
          const data = typeof f.data === "string" ? f.data : "";
          if (!fileName.trim() || !mimeType || !data) return null;
          return { name: fileName.trim(), mimeType, data };
        })
        .filter(
          (f: { name: string; mimeType: string; data: string } | null): f is {
            name: string;
            mimeType: string;
            data: string;
          } => Boolean(f),
        )
        .slice(0, 5);
      const fileIds = Array.isArray(body.fileIds)
        ? body.fileIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : Array.isArray(body.file_ids)
          ? body.file_ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
          : [];

      if (!name.trim()) {
        return jsonError(400, "name is required");
      }
      if (!prompt.trim() && files.length === 0 && fileIds.length === 0) {
        return jsonError(400, "prompt or files are required for synthetic knowledge region generation",);
      }

      const { model, spec } = await createSyntheticCustomVerificationModel(auth.supabase, {
        workspaceId,
        name,
        prompt,
        files,
        fileIds,
        description: typeof body.description === "string" ? body.description : null,
        createdBy: auth.user.id,
      });

      return NextResponse.json({
        workspace_id: workspaceId,
        model,
        source: "synthetic:grok-4.5",
        files_used: files.length + fileIds.length,
        spec: {
          name: spec.name,
          subject_count: spec.subject_count,
          cosine_threshold: spec.cosine_threshold,
          cohort_cohesion: spec.cohort_cohesion,
          embedding_model_id: spec.embedding_model_id,
          dim: spec.dim,
        },
      });
    }

    if (action === "delete") {
      const modelId =
        typeof body.modelId === "string"
          ? body.modelId
          : typeof body.regionId === "string"
            ? body.regionId
            : typeof body.region_id === "string"
              ? body.region_id
              : typeof body.model_id === "string"
                ? body.model_id
                : "";
      if (!modelId.trim()) {
        return jsonError(400, "modelId / regionId is required");
      }

      const deleted = await deleteCustomVerificationModel(auth.supabase, {
        workspaceId,
        modelId,
      });

      return NextResponse.json({
        workspace_id: workspaceId,
        deleted: true,
        model: {
          id: deleted.id,
          name: deleted.name,
        },
      });
    }

    // create (cohort of user embeddings)
    const name = typeof body.name === "string" ? body.name : "";
    const subjects = Array.isArray(body.subjects) ? body.subjects : [];
    if (!name.trim()) {
      return jsonError(400, "name is required");
    }
    if (!subjects.length) {
      return jsonError(400, "subjects array is required");
    }

    const { model, spec } = await createCustomVerificationModelFromSubjects(auth.supabase, {
      workspaceId,
      name,
      description: typeof body.description === "string" ? body.description : null,
      subjects: subjects.map((s: Record<string, unknown>) => ({
        user_id: typeof s.user_id === "string" ? s.user_id : null,
        guest_user_id: typeof s.guest_user_id === "string" ? s.guest_user_id : null,
        label: typeof s.label === "string" ? s.label : null,
      })),
      createdBy: auth.user.id,
    });

    return NextResponse.json({
      workspace_id: workspaceId,
      model,
      source: "cohort",
      spec: {
        name: spec.name,
        subject_count: spec.subject_count,
        cosine_threshold: spec.cosine_threshold,
        cohort_cohesion: spec.cohort_cohesion,
        embedding_model_id: spec.embedding_model_id,
        dim: spec.dim,
      },
    });
  } catch (error) {
    if (error instanceof CustomVerificationModelError) {
      return jsonError(400, error.message);
    }
    console.error("[workspace/custom-knowledge-regions] POST failed:", error);
    return jsonError(500, "Failed to process custom knowledge region");
  }
}
