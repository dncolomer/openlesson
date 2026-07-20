/**
 * Persist / load / score custom verification models / knowledge regions (workspace-scoped).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  createSyntheticKnowledgeRegionFromProfile,
  type KnowledgeConfigSubject,
  type SyntheticRegionProfile,
} from "@/lib/knowledge-config";
import {
  computeKnowledgeDistance,
  createCustomVerificationModelFromVectors,
  scoreAgainstCustomVerificationModel,
  type CustomVerificationModelSpec,
  type CustomVerificationScore,
  type CustomVerificationSubjectRef,
  type KnowledgeDistance,
  CustomVerificationModelError,
} from "@/lib/knowledge-config/custom-verification-model";
import { callXaiJSON, DEFAULT_MODEL, systemMessage, userMessage } from "@/lib/xai-client";
import { loadLatestKnowledgeConfig } from "./knowledge-config-store";

export interface CustomVerificationModelRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  embedding_model_id: string;
  dim: number;
  centroid: number[];
  cohort_cohesion: number;
  mean_radius: number;
  cosine_threshold: number;
  subject_count: number;
  subjects: CustomVerificationSubjectRef[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSpec(row: CustomVerificationModelRow): CustomVerificationModelSpec {
  return {
    name: row.name,
    embedding_model_id: row.embedding_model_id,
    dim: row.dim,
    centroid: row.centroid,
    cohort_cohesion: row.cohort_cohesion,
    mean_radius: row.mean_radius,
    cosine_threshold: row.cosine_threshold,
    subject_count: row.subject_count,
    subjects: row.subjects,
  };
}

function parseRow(raw: Record<string, unknown>): CustomVerificationModelRow {
  const centroid = Array.isArray(raw.centroid) ? (raw.centroid as number[]) : [];
  const subjects = Array.isArray(raw.subjects)
    ? (raw.subjects as CustomVerificationSubjectRef[])
    : [];
  return {
    id: String(raw.id),
    workspace_id: String(raw.workspace_id),
    name: String(raw.name),
    description: (raw.description as string | null) ?? null,
    embedding_model_id: String(raw.embedding_model_id || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID),
    dim: Number(raw.dim) || 64,
    centroid,
    cohort_cohesion: Number(raw.cohort_cohesion) || 0,
    mean_radius: Number(raw.mean_radius) || 0,
    cosine_threshold: Number(raw.cosine_threshold) || 0.5,
    subject_count: Number(raw.subject_count) || 0,
    subjects,
    created_by: (raw.created_by as string | null) ?? null,
    created_at: String(raw.created_at || ""),
    updated_at: String(raw.updated_at || ""),
  };
}

export async function listCustomVerificationModels(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<CustomVerificationModelRow[]> {
  const { data, error } = await supabase
    .from("custom_verification_models")
    .select(
      "id, workspace_id, name, description, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[custom-verification-model-store] list failed:", error.message);
    return [];
  }
  return (data || []).map((r) => parseRow(r as Record<string, unknown>));
}

export async function getCustomVerificationModel(
  supabase: SupabaseClient,
  workspaceId: string,
  modelId: string,
): Promise<CustomVerificationModelRow | null> {
  const { data, error } = await supabase
    .from("custom_verification_models")
    .select(
      "id, workspace_id, name, description, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", modelId)
    .maybeSingle();

  if (error || !data) return null;
  return parseRow(data as Record<string, unknown>);
}

/**
 * Delete a workspace-scoped custom knowledge region.
 * Returns the deleted row when found; throws when missing or delete fails.
 */
export async function deleteCustomVerificationModel(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    modelId: string;
  },
): Promise<CustomVerificationModelRow> {
  const modelId = options.modelId.trim();
  if (!modelId) {
    throw new CustomVerificationModelError("modelId is required");
  }

  const existing = await getCustomVerificationModel(
    supabase,
    options.workspaceId,
    modelId,
  );
  if (!existing) {
    throw new CustomVerificationModelError("knowledge region not found");
  }

  const { error } = await supabase
    .from("custom_verification_models")
    .delete()
    .eq("workspace_id", options.workspaceId)
    .eq("id", modelId);

  if (error) {
    throw new CustomVerificationModelError(
      error.message || "failed to delete knowledge region",
    );
  }

  return existing;
}

/**
 * Load latest knowledge configs for each subject, build model, persist.
 */
export async function createCustomVerificationModelFromSubjects(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    name: string;
    description?: string | null;
    subjects: CustomVerificationSubjectRef[];
    createdBy?: string | null;
  },
): Promise<{ model: CustomVerificationModelRow; spec: CustomVerificationModelSpec }> {
  if (!options.subjects.length) {
    throw new CustomVerificationModelError("select at least one subject");
  }

  const vectors: number[][] = [];
  const resolvedSubjects: CustomVerificationSubjectRef[] = [];

  for (const subject of options.subjects) {
    const ref: KnowledgeConfigSubject = {
      user_id: subject.user_id,
      guest_user_id: subject.guest_user_id,
    };
    const latest = await loadLatestKnowledgeConfig(supabase, options.workspaceId, ref);
    if (!latest?.vector?.length) {
      throw new CustomVerificationModelError(
        `no knowledge config embedding for subject ${subject.label || subject.user_id || subject.guest_user_id || "unknown"}`,
      );
    }
    vectors.push(latest.vector);
    resolvedSubjects.push({
      user_id: subject.user_id ?? null,
      guest_user_id: subject.guest_user_id ?? null,
      label: subject.label ?? null,
    });
  }

  const spec = createCustomVerificationModelFromVectors({
    name: options.name,
    vectors,
    subjects: resolvedSubjects,
  });

  const payload = {
    workspace_id: options.workspaceId,
    name: spec.name,
    description: options.description?.trim() || null,
    embedding_model_id: spec.embedding_model_id,
    dim: spec.dim,
    centroid: spec.centroid,
    cohort_cohesion: spec.cohort_cohesion,
    mean_radius: spec.mean_radius,
    cosine_threshold: spec.cosine_threshold,
    subject_count: spec.subject_count,
    subjects: resolvedSubjects,
    created_by: options.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("custom_verification_models")
    .insert(payload)
    .select(
      "id, workspace_id, name, description, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at",
    )
    .maybeSingle();

  if (error || !data) {
    throw new CustomVerificationModelError(error?.message || "failed to save custom verification model");
  }

  return { model: parseRow(data as Record<string, unknown>), spec };
}

/**
 * Ask Grok 4.5 for a synthetic competency profile, then encode into knowledgecfg-v1-d64
 * and persist as a custom knowledge region (same table/shape as cohort regions).
 */
export async function generateSyntheticRegionProfileWithGrok(options: {
  prompt: string;
  name?: string | null;
}): Promise<SyntheticRegionProfile> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new CustomVerificationModelError("prompt is required for synthetic region generation");
  }

  const response = await callXaiJSON<{
    name?: string;
    description?: string;
    verification_score?: number;
    augmentation_score?: number;
    optimization_score?: number;
    ghc_score?: number;
    strengths?: string[];
    friction_patterns?: string[];
    preferred_modalities?: string[];
    pow_types?: string[];
    tool_names?: string[];
  }>(
    [
      systemMessage(
        `You design synthetic knowledge regions for a fixed knowledge configuration embedding space (knowledgecfg-v1-d64).
Return JSON only describing an idealized competency region. Scores are 0-100.
pow_types should be a subset of: tool, screen, speech, video, eeg.
preferred_modalities examples: tool, speech, canvas, notebook.
Keep strengths and friction_patterns short concrete phrases (max 8 each).`,
      ),
      userMessage(
        `Create a synthetic knowledge region profile.
Desired region name hint: ${options.name?.trim() || "(derive from prompt)"}
User request:
${prompt}

Return JSON with keys: name, description, verification_score, augmentation_score, optimization_score, ghc_score, strengths, friction_patterns, preferred_modalities, pow_types, tool_names.`,
      ),
    ],
    {
      model: DEFAULT_MODEL,
      temperature: 0.4,
      maxTokens: 900,
      reasoningEffort: "low",
    },
  );

  if (!response.success || !response.data) {
    throw new CustomVerificationModelError(
      response.error || "Grok failed to generate a synthetic knowledge region profile",
    );
  }

  const data = response.data;
  return {
    name: typeof data.name === "string" ? data.name : options.name || undefined,
    description: typeof data.description === "string" ? data.description : prompt,
    verification_score: data.verification_score,
    augmentation_score: data.augmentation_score,
    optimization_score: data.optimization_score,
    ghc_score: data.ghc_score,
    strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
    friction_patterns: Array.isArray(data.friction_patterns)
      ? data.friction_patterns.map(String)
      : [],
    preferred_modalities: Array.isArray(data.preferred_modalities)
      ? data.preferred_modalities.map(String)
      : [],
    pow_types: Array.isArray(data.pow_types) ? data.pow_types.map(String) : [],
    tool_names: Array.isArray(data.tool_names) ? data.tool_names.map(String) : [],
  };
}

export async function createSyntheticCustomVerificationModel(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    name: string;
    prompt: string;
    description?: string | null;
    createdBy?: string | null;
    /** Injected profile for tests — skips live Grok when provided. */
    profile?: SyntheticRegionProfile | null;
  },
): Promise<{ model: CustomVerificationModelRow; spec: CustomVerificationModelSpec }> {
  const name = options.name.trim();
  if (!name) throw new CustomVerificationModelError("name is required");
  const prompt = options.prompt.trim();
  if (!prompt && !options.profile) {
    throw new CustomVerificationModelError("prompt is required for synthetic region generation");
  }

  const profile =
    options.profile ||
    (await generateSyntheticRegionProfileWithGrok({
      prompt: prompt || name,
      name,
    }));

  const spec = createSyntheticKnowledgeRegionFromProfile({
    name,
    profile: { ...profile, name },
    description: options.description || profile.description || prompt,
    workspaceId: options.workspaceId,
  });

  const description =
    options.description?.trim() ||
    profile.description ||
    prompt ||
    null;
  const taggedDescription = description
    ? `[synthetic:grok-4.5] ${description}`
    : "[synthetic:grok-4.5]";

  const payload = {
    workspace_id: options.workspaceId,
    name: spec.name,
    description: taggedDescription,
    embedding_model_id: spec.embedding_model_id,
    dim: spec.dim,
    centroid: spec.centroid,
    cohort_cohesion: spec.cohort_cohesion,
    mean_radius: spec.mean_radius,
    cosine_threshold: spec.cosine_threshold,
    subject_count: Math.max(1, spec.subject_count),
    subjects: spec.subjects,
    created_by: options.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("custom_verification_models")
    .insert(payload)
    .select(
      "id, workspace_id, name, description, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at",
    )
    .maybeSingle();

  if (error || !data) {
    throw new CustomVerificationModelError(
      error?.message || "failed to save synthetic knowledge region",
    );
  }

  return { model: parseRow(data as Record<string, unknown>), spec };
}

export async function evalSubjectAgainstCustomVerificationModel(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    modelId: string;
    subject: CustomVerificationSubjectRef;
  },
): Promise<{ score: CustomVerificationScore; model: CustomVerificationModelRow }> {
  const model = await getCustomVerificationModel(supabase, options.workspaceId, options.modelId);
  if (!model) {
    throw new CustomVerificationModelError("custom verification model not found");
  }

  const latest = await loadLatestKnowledgeConfig(supabase, options.workspaceId, {
    user_id: options.subject.user_id,
    guest_user_id: options.subject.guest_user_id,
  });
  if (!latest?.vector?.length) {
    throw new CustomVerificationModelError("subject has no knowledge config embedding to evaluate");
  }

  const score = scoreAgainstCustomVerificationModel(latest.vector, rowToSpec(model));
  return { score, model };
}

/**
 * Knowledge distance for a subject vs a saved region.
 * Pure geometry load+compute — does not run vertical scores or write eval_run_history.
 */
export async function computeKnowledgeDistanceForSubject(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    regionId: string;
    subject: CustomVerificationSubjectRef;
  },
): Promise<{
  knowledge_distance: KnowledgeDistance;
  region: CustomVerificationModelRow;
  subject: {
    user_id: string | null;
    guest_user_id: string | null;
    as_of_ms: number | null;
    embedding_model_id: string;
  };
}> {
  const region = await getCustomVerificationModel(supabase, options.workspaceId, options.regionId);
  if (!region) {
    throw new CustomVerificationModelError("knowledge region not found");
  }

  const latest = await loadLatestKnowledgeConfig(supabase, options.workspaceId, {
    user_id: options.subject.user_id,
    guest_user_id: options.subject.guest_user_id,
  });
  if (!latest?.vector?.length) {
    throw new CustomVerificationModelError(
      "subject has no knowledge config embedding for Knowledge distance",
    );
  }

  const knowledge_distance = computeKnowledgeDistance(latest.vector, rowToSpec(region));
  return {
    knowledge_distance,
    region,
    subject: {
      user_id: options.subject.user_id ?? null,
      guest_user_id: options.subject.guest_user_id ?? null,
      as_of_ms: latest.as_of_ms ?? null,
      embedding_model_id: latest.embedding_model_id || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    },
  };
}

/** Distinct subjects that have at least one knowledge config snapshot in the workspace. */
export async function listSubjectsWithKnowledgeConfig(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<
  Array<{
    user_id: string | null;
    guest_user_id: string | null;
    embedding_model_id: string;
    as_of_ms: number;
    confidence: number;
  }>
> {
  const { data, error } = await supabase
    .from("knowledge_config_snapshots")
    .select("subject_user_id, subject_guest_user_id, embedding_model_id, as_of_ms, confidence")
    .eq("workspace_id", workspaceId)
    .eq("embedding_model_id", KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID)
    .order("as_of_ms", { ascending: false })
    .limit(500);

  if (error || !data) {
    console.warn("[custom-verification-model-store] list subjects failed:", error?.message);
    return [];
  }

  const seen = new Set<string>();
  const out: Array<{
    user_id: string | null;
    guest_user_id: string | null;
    embedding_model_id: string;
    as_of_ms: number;
    confidence: number;
  }> = [];

  for (const row of data) {
    const uid = (row.subject_user_id as string | null) ?? null;
    const gid = (row.subject_guest_user_id as string | null) ?? null;
    const key = `${uid ?? ""}|${gid ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      user_id: uid,
      guest_user_id: gid,
      embedding_model_id: String(row.embedding_model_id),
      as_of_ms: Number(row.as_of_ms),
      confidence: Number(row.confidence) || 0,
    });
  }
  return out;
}

export { rowToSpec };
