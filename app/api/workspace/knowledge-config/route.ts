import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import { ayclTokenFromBody } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadLatestKnowledgeConfig,
  loadLatestKnowledgeConfigAnySubject,
  loadLatestKnowledgeConfigForSubjects,
  loadKnowledgeConfigTrajectory,
  projectTrajectory2D,
  projectionFrameIdForAlgorithm,
  trajectoryPathLength,
  type TrajectorySubjectFilter,
} from "@/lib/pow-api/knowledge-config-store";
import {
  loadAllLearningWorldModels,
  loadLearningWorldModel,
  loadLearningWorldModelsForSubjects,
} from "@/lib/pow-api/learning-world-model-store";
import {
  aggregateLearningWorldModels,
  resolveModelsTabScopeFromRequest,
} from "@/lib/pow-api/models-tab-scope";
import {
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  emptyKnowledgeConfig,
  parseProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import { listWorkspaceAvailableSubjectsForUi } from "@/lib/pow-api/workspace-snapshot-subjects";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";

export const runtime = "nodejs";

type QuerySource = URLSearchParams | Record<string, string | undefined | null>;

function getParam(query: QuerySource, key: string): string | null {
  if (query instanceof URLSearchParams) return query.get(key);
  const v = query[key];
  return v == null || v === "" ? null : String(v);
}



/**
 * Cookie-auth Evaluation surface for workspace UI.
 * GET/POST support Models tab scope:
 * - scope=user (default): user_id | guest_user_id (unique IDs only)
 * - scope=user_group: user_ids + guest_user_ids (comma-separated)
 * - scope=all: workspace-wide trajectory + aggregated LWM
 *
 * Non-owners always resolve to self regardless of requested scope.
 */
async function handle(
  workspaceId: string,
  userId: string,
  supabase: SupabaseClient,
  query: QuerySource,
  access: { isOwner: boolean },
) {
  const maxPoints = Math.min(500, Math.max(2, Number(getParam(query, "max_points") || 100) || 100));
  const projectionAlgorithm = parseProjectionAlgorithmId(
    getParam(query, "projection_algorithm") ?? getParam(query, "algorithm"),
    "random",
  );
  const fromRaw = getParam(query, "from");
  const toRaw = getParam(query, "to");
  const fromMs = fromRaw
    ? /^\d+$/.test(fromRaw)
      ? Number(fromRaw)
      : Date.parse(fromRaw)
    : null;
  const toMs = toRaw
    ? /^\d+$/.test(toRaw)
      ? Number(toRaw)
      : Date.parse(toRaw)
    : null;

  const resolved = resolveModelsTabScopeFromRequest({
    scope: getParam(query, "scope"),
    subject: getParam(query, "subject"),
    user_id: getParam(query, "user_id"),
    guest_user_id: getParam(query, "guest_user_id"),
    user_ids: getParam(query, "user_ids"),
    guest_user_ids: getParam(query, "guest_user_ids"),
    currentUserId: userId,
    canInspectOthers: access.isOwner,
  });

  let subjectFilter: TrajectorySubjectFilter;
  if (resolved.kind === "all") {
    subjectFilter = { kind: "all" };
  } else if (resolved.kind === "multi") {
    subjectFilter = { kind: "multi", subjects: resolved.subjects };
  } else {
    subjectFilter = {
      kind: "single",
      subject: resolved.subjects[0] ?? { user_id: userId },
    };
  }

  const range = {
    fromMs: fromMs != null && Number.isFinite(fromMs) ? fromMs : null,
    toMs: toMs != null && Number.isFinite(toMs) ? toMs : null,
    maxPoints,
  };

  const pointsPromise = loadKnowledgeConfigTrajectory(supabase, {
    workspaceId,
    subjectFilter,
    ...range,
  });

  let latestPromise: Promise<
    Awaited<ReturnType<typeof loadLatestKnowledgeConfig>> | null
  >;
  let lwmPromise: Promise<LearningWorldModelV0>;

  if (resolved.kind === "all") {
    latestPromise = loadLatestKnowledgeConfigAnySubject(supabase, workspaceId);
    lwmPromise = loadAllLearningWorldModels(supabase, workspaceId).then((models) =>
      aggregateLearningWorldModels({ workspaceId, models }),
    );
  } else if (resolved.kind === "multi") {
    latestPromise = loadLatestKnowledgeConfigForSubjects(
      supabase,
      workspaceId,
      resolved.subjects,
    );
    lwmPromise = loadLearningWorldModelsForSubjects(
      supabase,
      workspaceId,
      resolved.subjects,
    ).then((models) => aggregateLearningWorldModels({ workspaceId, models }));
  } else {
    const subject = resolved.subjects[0] ?? { user_id: userId };
    latestPromise = loadLatestKnowledgeConfig(supabase, workspaceId, subject);
    lwmPromise = loadLearningWorldModel(supabase, workspaceId, subject).then((r) => r.model);
  }

  // Owners see PoW guests + link guests + prior knowledge subjects (not KC-only).
  const subjectsPromise = access.isOwner
    ? listWorkspaceAvailableSubjectsForUi(supabase, workspaceId, userId)
    : Promise.resolve([]);

  const [latest, learning_world_model, points, available_subjects] = await Promise.all([
    latestPromise,
    lwmPromise,
    pointsPromise,
    subjectsPromise,
  ]);

  const embedding = latest
    ? {
        embedding_model_id: latest.embedding_model_id,
        dim: latest.dim,
        vector: latest.vector,
        as_of: new Date(latest.as_of_ms).toISOString(),
        as_of_ms: latest.as_of_ms,
        confidence: latest.confidence,
        pow_event_count: latest.pow_event_count,
        empty: false,
      }
    : { ...emptyKnowledgeConfig(), empty: true };

  return {
    workspace_id: workspaceId,
    embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    scope: {
      mode: resolved.mode,
      kind: resolved.kind,
      label: resolved.label,
      subjects: resolved.subjects,
    },
    knowledge_config: embedding,
    learning_world_model,
    available_subjects,
    trajectory: {
      point_count: points.length,
      path_length: trajectoryPathLength(points),
      points,
      projection: {
        algorithm: projectionAlgorithm,
        frame_id: projectionFrameIdForAlgorithm(projectionAlgorithm),
        coords: projectTrajectory2D(points, projectionAlgorithm),
      },
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await requireProductWorkspaceEvalAuth(
      workspaceId,
      url.searchParams.get("ayclToken"),
    );
    if (!auth.ok) return auth.response;
    const payload = await handle(
      workspaceId,
      auth.subjectId,
      auth.supabase,
      url.searchParams,
      { isOwner: auth.isOwner },
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[workspace/knowledge-config] GET failed:", error);
    return jsonError(500, "Failed to load knowledge config");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await requireProductWorkspaceEvalAuth(
      workspaceId,
      ayclTokenFromBody(body),
    );
    if (!auth.ok) return auth.response;
    const payload = await handle(
      workspaceId,
      auth.subjectId,
      auth.supabase,
      {
        from: typeof body.from === "string" ? body.from : undefined,
        to: typeof body.to === "string" ? body.to : undefined,
        max_points: body.max_points != null ? String(body.max_points) : undefined,
        scope: typeof body.scope === "string" ? body.scope : undefined,
        subject: typeof body.subject === "string" ? body.subject : undefined,
        user_id: typeof body.user_id === "string" ? body.user_id : undefined,
        guest_user_id: typeof body.guest_user_id === "string" ? body.guest_user_id : undefined,
        user_ids:
          typeof body.user_ids === "string"
            ? body.user_ids
            : Array.isArray(body.user_ids)
              ? body.user_ids.filter((x: unknown) => typeof x === "string").join(",")
              : undefined,
        guest_user_ids:
          typeof body.guest_user_ids === "string"
            ? body.guest_user_ids
            : Array.isArray(body.guest_user_ids)
              ? body.guest_user_ids.filter((x: unknown) => typeof x === "string").join(",")
              : undefined,
      },
      { isOwner: auth.isOwner },
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[workspace/knowledge-config] POST failed:", error);
    return jsonError(500, "Failed to load knowledge config");
  }
}
