import type { ScoreVertical } from "../performance-report";
import { SCORE_VERTICALS } from "../performance-report";
import { loadLearningWorldModel } from "../learning-world-model-store";
import { resolveEvaluationSubject } from "../evaluation-subject";
import {
  loadLatestKnowledgeConfig,
  loadKnowledgeConfigTrajectory,
  projectTrajectory2D,
  trajectoryPathLength,
} from "../knowledge-config-store";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  emptyKnowledgeConfig,
} from "@/lib/knowledge-config";
import { computeKnowledgeDistanceForSubject } from "../custom-verification-model-store";
import {
  createCustomVerificationModelFromSubjects,
  evalSubjectAgainstCustomVerificationModel,
  listCustomVerificationModels,
  listSubjectsWithKnowledgeConfig,
} from "../custom-verification-model-store";
import {
  listEvalRunHistory,
  resolveHistorySubjectScope,
} from "../eval-run-history-store";
import {
  type McpProofOfWorkToolContext,
  boundedInt,
  evidenceToolResult,
  loadWorkspace,
  requireScope,
  stringArg,
} from "./helpers";

export async function handleGetWorldModel(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:read");
  const workspaceId = stringArg(args, "workspace_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  const workspace = await loadWorkspace(supabase, auth, workspaceId);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const subject = resolveEvaluationSubject(
    auth,
    {
      user_id: stringArg(args, "user_id") || auth.user_id,
      guest_user_id: stringArg(args, "guest_user_id"),
    },
    { isWorkspaceOwner },
  );
  const { id, model } = await loadLearningWorldModel(supabase, workspaceId, subject);
  return await evidenceToolResult(
    { workspace_id: workspaceId, subject, lwm_id: id, learning_world_model: model },
    { endpoint: "get_world_model", workspace_id: workspaceId },
  );
}

export async function handleGetKnowledgeConfig(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:read");
  const workspaceId = stringArg(args, "workspace_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  const workspace = await loadWorkspace(supabase, auth, workspaceId);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const subject = resolveEvaluationSubject(
    auth,
    {
      user_id: stringArg(args, "user_id") || auth.user_id,
      guest_user_id: stringArg(args, "guest_user_id"),
    },
    { isWorkspaceOwner },
  );
  const modelId = stringArg(args, "embedding_model_id") || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  const [latest, lwm] = await Promise.all([
    loadLatestKnowledgeConfig(supabase, workspaceId, subject, modelId),
    loadLearningWorldModel(supabase, workspaceId, subject),
  ]);
  if (!latest) {
    const empty = emptyKnowledgeConfig();
    return await evidenceToolResult(
      {
        workspace_id: workspaceId,
        subject,
        embedding_model_id: empty.embedding_model_id,
        dim: empty.dim,
        vector: empty.vector,
        as_of: empty.as_of,
        as_of_ms: empty.as_of_ms,
        confidence: 0,
        pow_event_count: 0,
        lwm_updated_at: lwm.model.updated_at,
        empty: true,
      },
      { endpoint: "get_knowledge_config", workspace_id: workspaceId },
    );
  }
  return await evidenceToolResult(
    {
      workspace_id: workspaceId,
      subject,
      embedding_model_id: latest.embedding_model_id,
      dim: latest.dim || KNOWLEDGE_CONFIG_DIM,
      vector: latest.vector,
      as_of: new Date(latest.as_of_ms).toISOString(),
      as_of_ms: latest.as_of_ms,
      confidence: latest.confidence,
      pow_event_count: latest.pow_event_count,
      trigger: latest.trigger,
      lwm_updated_at: lwm.model.updated_at,
      empty: false,
    },
    { endpoint: "get_knowledge_config", workspace_id: workspaceId },
  );
}

export async function handleGetKnowledgeConfigTrajectory(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:read");
  const workspaceId = stringArg(args, "workspace_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  const workspace = await loadWorkspace(supabase, auth, workspaceId);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const subject = resolveEvaluationSubject(
    auth,
    {
      user_id: stringArg(args, "user_id") || auth.user_id,
      guest_user_id: stringArg(args, "guest_user_id"),
    },
    { isWorkspaceOwner },
  );
  const maxPoints = boundedInt(args.max_points, 100, 2, 500);
  const includeProjection = args.project !== false;
  const modelId = stringArg(args, "embedding_model_id") || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  const parseMs = (value: unknown): number | null => {
    if (typeof value !== "string" || !value) return null;
    if (/^\d+$/.test(value)) return Number(value);
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  };
  const points = await loadKnowledgeConfigTrajectory(supabase, {
    workspaceId,
    subject,
    fromMs: parseMs(args.from),
    toMs: parseMs(args.to),
    maxPoints,
    embeddingModelId: modelId,
  });
  return await evidenceToolResult(
    {
      workspace_id: workspaceId,
      subject,
      embedding_model_id: modelId,
      point_count: points.length,
      path_length: trajectoryPathLength(points),
      points,
      projection: includeProjection
        ? {
            frame_id: `${modelId}:ui2d`,
            embedding_model_id: modelId,
            coords: projectTrajectory2D(points),
          }
        : undefined,
    },
    { endpoint: "get_knowledge_config_trajectory", workspace_id: workspaceId },
  );
}

export async function handleKnowledgeDistance(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:read");
  const workspaceId = stringArg(args, "workspace_id");
  const regionId = stringArg(args, "region_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  if (!regionId) throw new Error("region_id is required.");
  const workspace = await loadWorkspace(supabase, auth, workspaceId);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const subject = resolveEvaluationSubject(
    auth,
    {
      user_id: stringArg(args, "user_id") || auth.user_id,
      guest_user_id: stringArg(args, "guest_user_id"),
    },
    { isWorkspaceOwner },
  );
  const computed = await computeKnowledgeDistanceForSubject(supabase, {
    workspaceId,
    regionId,
    subject: { user_id: subject.user_id, guest_user_id: subject.guest_user_id },
  });
  return await evidenceToolResult(
    {
      workspace_id: workspaceId,
      computation: "knowledge_distance",
      note: "Pure embedding-space geometry — not a vertical Eval and not archived.",
      region: {
        id: computed.region.id,
        name: computed.region.name,
        embedding_model_id: computed.region.embedding_model_id,
        cosine_threshold: computed.region.cosine_threshold,
      },
      subject: computed.subject,
      knowledge_distance: computed.knowledge_distance,
    },
    { endpoint: "knowledge_distance", workspace_id: workspaceId },
  );
}

export async function handleListSnapshotHistory(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:read");
  const workspaceId = stringArg(args, "workspace_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  const workspace = await loadWorkspace(supabase, auth, workspaceId);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const parseCsv = (value: string | null): string[] =>
    value
      ? value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const requestedUserIds = parseCsv(stringArg(args, "user_ids"));
  const requestedGuestUserIds = parseCsv(stringArg(args, "guest_user_ids"));
  const requestedSubject =
    stringArg(args, "user_id") || stringArg(args, "guest_user_id")
      ? resolveEvaluationSubject(
          auth,
          {
            user_id: stringArg(args, "user_id"),
            guest_user_id: stringArg(args, "guest_user_id"),
          },
          { isWorkspaceOwner },
        )
      : null;
  const scope = resolveHistorySubjectScope({
    authUserId: auth.user_id,
    authGuestUserId: auth.guest_user_id,
    isOrgAdmin: auth.is_org_admin,
    isWorkspaceOwner,
    requestedUserIds: requestedUserIds.length > 0 ? requestedUserIds : null,
    requestedGuestUserIds: requestedGuestUserIds.length > 0 ? requestedGuestUserIds : null,
    requestedSubject,
  });
  const verticalRaw = stringArg(args, "vertical");
  const vertical =
    verticalRaw && (SCORE_VERTICALS as readonly string[]).includes(verticalRaw)
      ? (verticalRaw as ScoreVertical)
      : null;
  const limit = boundedInt(args.limit, 50, 1, 500);
  const offset = boundedInt(args.offset, 0, 0, 10_000);
  const runs = await listEvalRunHistory(supabase, {
    workspaceId,
    subject: scope.subject,
    userIds: scope.userIds,
    guestUserIds: scope.guestUserIds,
    vertical,
    from: stringArg(args, "from"),
    to: stringArg(args, "to"),
    limit,
    offset,
  });
  return await evidenceToolResult(
    {
      workspace_id: workspaceId,
      scope: {
        restricted: scope.restricted,
        subject: scope.subject ?? null,
        user_ids: scope.userIds ?? null,
        guest_user_ids: scope.guestUserIds ?? null,
      },
      count: runs.length,
      runs,
      limit,
      offset,
    },
    { endpoint: "list_snapshot_history", workspace_id: workspaceId },
  );
}

export async function handleListCustomKnowledgeRegions(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:read");
  const workspaceId = stringArg(args, "workspace_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  await loadWorkspace(supabase, auth, workspaceId);
  const [models, subjects] = await Promise.all([
    listCustomVerificationModels(supabase, workspaceId),
    listSubjectsWithKnowledgeConfig(supabase, workspaceId),
  ]);
  return await evidenceToolResult(
    { workspace_id: workspaceId, models, subjects },
    { endpoint: "list_custom_knowledge_regions", workspace_id: workspaceId },
  );
}

export async function handleCreateCustomKnowledgeRegion(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:write");
  const workspaceId = stringArg(args, "workspace_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  await loadWorkspace(supabase, auth, workspaceId);
  const modelName = stringArg(args, "name") || "";
  const subjects = Array.isArray(args.subjects) ? args.subjects : [];
  const { model, spec } = await createCustomVerificationModelFromSubjects(supabase, {
    workspaceId,
    name: modelName,
    description: stringArg(args, "description"),
    subjects: subjects.map((s: Record<string, unknown>) => ({
      user_id: typeof s.user_id === "string" ? s.user_id : null,
      guest_user_id: typeof s.guest_user_id === "string" ? s.guest_user_id : null,
      label: typeof s.label === "string" ? s.label : null,
    })),
    createdBy: auth.user_id,
  });
  return await evidenceToolResult(
    { workspace_id: workspaceId, model, spec, action: "create" },
    { endpoint: "create_custom_knowledge_region", workspace_id: workspaceId },
  );
}

export async function handleEvalCustomKnowledgeRegion(
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase } = ctx;
  requireScope(auth.scopes, "workspaces:write");
  const workspaceId = stringArg(args, "workspace_id");
  const modelId = stringArg(args, "model_id");
  if (!workspaceId) throw new Error("workspace_id is required.");
  if (!modelId) throw new Error("model_id is required.");
  const workspace = await loadWorkspace(supabase, auth, workspaceId);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const subject = resolveEvaluationSubject(
    auth,
    {
      user_id: stringArg(args, "user_id") || auth.user_id,
      guest_user_id: stringArg(args, "guest_user_id"),
    },
    { isWorkspaceOwner },
  );
  const scored = await evalSubjectAgainstCustomVerificationModel(supabase, {
    workspaceId,
    modelId,
    subject: { user_id: subject.user_id, guest_user_id: subject.guest_user_id },
  });
  return await evidenceToolResult(
    {
      workspace_id: workspaceId,
      model: { id: scored.model.id, name: scored.model.name },
      score: scored.score,
      action: "eval",
    },
    { endpoint: "eval_custom_knowledge_region", workspace_id: workspaceId },
  );
}
