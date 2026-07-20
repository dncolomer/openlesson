import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  computeKnowledgeDistanceForSubject,
  createCustomVerificationModelFromSubjects,
  createSyntheticCustomVerificationModel,
  evalSubjectAgainstCustomVerificationModel,
  listCustomVerificationModels,
  listSubjectsWithKnowledgeConfig,
} from "@/lib/pow-api/custom-verification-model-store";
import { CustomVerificationModelError } from "@/lib/knowledge-config/custom-verification-model";

export const runtime = "nodejs";

/**
 * Cookie-auth surface for workspace custom knowledge regions (custom verification models).
 * GET  ?workspaceId=  → list regions + subjects with embeddings (includes centroids for overlay)
 * POST { action: "create" | "create_synthetic" | "eval" | "knowledge_distance", workspaceId, ... }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;

    const [models, subjects] = await Promise.all([
      listCustomVerificationModels(auth.supabase, workspaceId),
      listSubjectsWithKnowledgeConfig(auth.supabase, workspaceId),
    ]);

    return NextResponse.json({
      workspace_id: workspaceId,
      models,
      subjects,
    });
  } catch (error) {
    console.error("[workspace/custom-verification-models] GET failed:", error);
    return NextResponse.json({ error: "Failed to load custom verification models" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
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
        return NextResponse.json({ error: "modelId / regionId is required" }, { status: 400 });
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
      if (!name.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }
      if (!prompt.trim()) {
        return NextResponse.json(
          { error: "prompt is required for synthetic knowledge region generation" },
          { status: 400 },
        );
      }

      const { model, spec } = await createSyntheticCustomVerificationModel(auth.supabase, {
        workspaceId,
        name,
        prompt,
        description: typeof body.description === "string" ? body.description : null,
        createdBy: auth.user.id,
      });

      return NextResponse.json({
        workspace_id: workspaceId,
        model,
        source: "synthetic:grok-4.5",
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

    // create (cohort of user embeddings)
    const name = typeof body.name === "string" ? body.name : "";
    const subjects = Array.isArray(body.subjects) ? body.subjects : [];
    if (!name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!subjects.length) {
      return NextResponse.json({ error: "subjects array is required" }, { status: 400 });
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[workspace/custom-verification-models] POST failed:", error);
    return NextResponse.json({ error: "Failed to process custom knowledge region" }, { status: 500 });
  }
}
