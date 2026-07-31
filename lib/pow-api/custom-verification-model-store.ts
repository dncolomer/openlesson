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
import {
  callXaiJSON,
  callXaiResponsesWithFiles,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";
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

/** Attached file payload for synthetic knowledge region creation (UI base64 upload). */
export interface SyntheticRegionFileInput {
  name: string;
  mimeType: string;
  /** Base64-encoded file bytes. */
  data: string;
}

const TEXT_FILE_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "text/csv",
]);

const SYNTHETIC_REGION_PROFILE_SYSTEM = `You design synthetic knowledge regions for a fixed knowledge configuration embedding space (knowledgecfg-v1-d64).
Return JSON only describing an idealized competency region. Scores are 0-100.
pow_types should be a subset of: tool, screen, speech, video, eeg.
preferred_modalities examples: tool, speech, canvas, notebook.
Keep strengths and friction_patterns short concrete phrases (max 8 each).`;

const SYNTHETIC_REGION_JSON_SCHEMA = {
  name: "synthetic_knowledge_region_profile",
  schema: {
    type: "object" as const,
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      verification_score: { type: "number" },
      augmentation_score: { type: "number" },
      optimization_score: { type: "number" },
      ghc_score: { type: "number" },
      strengths: { type: "array", items: { type: "string" } },
      friction_patterns: { type: "array", items: { type: "string" } },
      preferred_modalities: { type: "array", items: { type: "string" } },
      pow_types: { type: "array", items: { type: "string" } },
      tool_names: { type: "array", items: { type: "string" } },
    },
    required: [
      "name",
      "description",
      "verification_score",
      "augmentation_score",
      "optimization_score",
      "ghc_score",
      "strengths",
      "friction_patterns",
      "preferred_modalities",
      "pow_types",
      "tool_names",
    ],
    additionalProperties: false,
  },
};

/**
 * Decode base64 text-like files for prompt context (unit-testable, no network).
 * Returns null for binary types (PDF/images) that need xAI attachment_search.
 */
export function decodeSyntheticRegionFileText(file: {
  name: string;
  mimeType: string;
  data: string;
}): string | null {
  const mime = (file.mimeType || "").toLowerCase().split(";")[0].trim();
  const lowerName = file.name.toLowerCase();
  const looksText =
    TEXT_FILE_MIME.has(mime) ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".csv");
  if (!looksText) return null;
  try {
    const text = Buffer.from(file.data, "base64").toString("utf8");
    // Skip if mostly binary garbage
    if (!text || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text.slice(0, 200))) {
      return null;
    }
    return text.slice(0, 24_000);
  } catch {
    return null;
  }
}

/**
 * Build the user-facing generation prompt from free text and/or attached files.
 * Pure helper — used by create path and unit tests.
 */
export function buildSyntheticRegionGenerationPrompt(options: {
  prompt?: string | null;
  name?: string | null;
  files?: Array<{ name: string; mimeType: string; textExcerpt?: string | null }>;
}): string {
  const prompt = (options.prompt || "").trim();
  const files = options.files || [];
  const parts: string[] = [];

  if (prompt) {
    parts.push(prompt);
  }

  if (files.length > 0) {
    const lines = files.map((f, i) => {
      const excerpt = (f.textExcerpt || "").trim();
      if (excerpt) {
        return `--- File ${i + 1}: ${f.name} (${f.mimeType}) ---\n${excerpt}`;
      }
      return `- ${f.name} (${f.mimeType}) [attached for agentic document search]`;
    });
    parts.push(
      `Reference material from ${files.length} attached file(s). Infer an idealized competency region from this content:\n${lines.join("\n\n")}`,
    );
  }

  if (parts.length === 0) {
    const name = (options.name || "").trim();
    return name || "";
  }
  return parts.join("\n\n");
}

function normalizeSyntheticRegionFiles(
  files: SyntheticRegionFileInput[] | undefined,
): SyntheticRegionFileInput[] {
  if (!Array.isArray(files)) return [];
  return files
    .filter(
      (f) =>
        f &&
        typeof f.name === "string" &&
        f.name.trim() &&
        typeof f.mimeType === "string" &&
        typeof f.data === "string" &&
        f.data.length > 0,
    )
    .slice(0, 5)
    .map((f) => ({
      name: f.name.trim(),
      mimeType: f.mimeType,
      data: f.data,
    }));
}

function mapProfileFromLlmData(
  data: Record<string, unknown>,
  fallbackDescription: string,
  nameHint?: string | null,
): SyntheticRegionProfile {
  return {
    name: typeof data.name === "string" ? data.name : nameHint || undefined,
    description:
      typeof data.description === "string" ? data.description : fallbackDescription,
    verification_score:
      typeof data.verification_score === "number" ? data.verification_score : undefined,
    augmentation_score:
      typeof data.augmentation_score === "number" ? data.augmentation_score : undefined,
    optimization_score:
      typeof data.optimization_score === "number" ? data.optimization_score : undefined,
    ghc_score: typeof data.ghc_score === "number" ? data.ghc_score : undefined,
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

/**
 * Ask Grok 4.5 for a synthetic competency profile, then encode into knowledgecfg-v1-d64
 * and persist as a custom knowledge region (same table/shape as cohort regions).
 * When fileIds are present, uses Responses API with input_file attachments.
 */
export async function generateSyntheticRegionProfileWithGrok(options: {
  prompt: string;
  name?: string | null;
  /** xAI Files API ids already uploaded. */
  fileIds?: string[];
}): Promise<SyntheticRegionProfile> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new CustomVerificationModelError(
      "prompt or files are required for synthetic region generation",
    );
  }

  const userPrompt = `Create a synthetic knowledge region profile.
Desired region name hint: ${options.name?.trim() || "(derive from prompt or files)"}
User request / material:
${prompt}

Return JSON with keys: name, description, verification_score, augmentation_score, optimization_score, ghc_score, strengths, friction_patterns, preferred_modalities, pow_types, tool_names.`;

  const fileIds = (options.fileIds || []).filter(Boolean);

  if (fileIds.length > 0) {
    const response = await callXaiResponsesWithFiles<Record<string, unknown>>(
      userPrompt,
      fileIds,
      {
        model: DEFAULT_MODEL,
        temperature: 0.4,
        maxOutputTokens: 900,
        reasoningEffort: "low",
        instructions: SYNTHETIC_REGION_PROFILE_SYSTEM,
        jsonSchema: SYNTHETIC_REGION_JSON_SCHEMA,
      },
    );

    if (!response.success || !response.data) {
      throw new CustomVerificationModelError(
        response.error || "Grok failed to generate a synthetic knowledge region profile from files",
      );
    }

    return mapProfileFromLlmData(response.data, prompt, options.name);
  }

  const response = await callXaiJSON<Record<string, unknown>>(
    [systemMessage(SYNTHETIC_REGION_PROFILE_SYSTEM), userMessage(userPrompt)],
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

  return mapProfileFromLlmData(response.data, prompt, options.name);
}

export async function createSyntheticCustomVerificationModel(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    name: string;
    prompt?: string | null;
    description?: string | null;
    createdBy?: string | null;
    /** Base64 file attachments — uploaded to xAI when generating (unless profile injected). */
    files?: SyntheticRegionFileInput[] | null;
    /** Pre-uploaded xAI file ids (optional shortcut). */
    fileIds?: string[] | null;
    /** Injected profile for tests — skips live Grok when provided. */
    profile?: SyntheticRegionProfile | null;
    /**
     * Optional uploader for tests — defaults to uploadFileToXAI.
     * Only used when files are present and profile is not injected.
     */
    uploadFile?: (
      name: string,
      mimeType: string,
      base64Data: string,
    ) => Promise<{ file_id: string }>;
  },
): Promise<{ model: CustomVerificationModelRow; spec: CustomVerificationModelSpec }> {
  const name = options.name.trim();
  if (!name) throw new CustomVerificationModelError("name is required");

  const prompt = (options.prompt || "").trim();
  const files = normalizeSyntheticRegionFiles(options.files ?? undefined);
  const preloadedFileIds = (options.fileIds || []).filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
  const hasFiles = files.length > 0 || preloadedFileIds.length > 0;

  if (!prompt && !hasFiles && !options.profile) {
    throw new CustomVerificationModelError(
      "prompt or files are required for synthetic region generation",
    );
  }

  const fileMeta = files.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    textExcerpt: decodeSyntheticRegionFileText(f),
  }));

  const generationPrompt = buildSyntheticRegionGenerationPrompt({
    prompt,
    name,
    files: fileMeta.length
      ? fileMeta
      : preloadedFileIds.length
        ? preloadedFileIds.map((id, i) => ({
            name: `file_${i + 1}`,
            mimeType: "application/octet-stream",
            textExcerpt: null,
          }))
        : [],
  });

  let profile = options.profile || null;

  if (!profile) {
    let fileIds = [...preloadedFileIds];
    if (files.length > 0) {
      const { uploadFileToXAI } = await import("@/lib/xai-files");
      const uploader = options.uploadFile || uploadFileToXAI;
      for (const f of files) {
        try {
          const uploaded = await uploader(f.name, f.mimeType, f.data);
          if (uploaded?.file_id) fileIds.push(uploaded.file_id);
        } catch (err) {
          console.error(
            `[custom-verification-model-store] xAI upload failed for "${f.name}":`,
            err,
          );
        }
      }
    }

    // Prefer text excerpts + prompt when no file ids resolved (e.g. upload failed but text decoded).
    const effectivePrompt = generationPrompt || prompt || name;
    if (!effectivePrompt.trim() && fileIds.length === 0) {
      throw new CustomVerificationModelError(
        "prompt or files are required for synthetic region generation",
      );
    }

    profile = await generateSyntheticRegionProfileWithGrok({
      prompt: effectivePrompt || `Derive a knowledge region from ${fileIds.length} attached file(s).`,
      name,
      fileIds,
    });
  }

  const sourceDescription =
    options.description ||
    profile.description ||
    prompt ||
    (files.length ? `From ${files.map((f) => f.name).join(", ")}` : null) ||
    "";

  const spec = createSyntheticKnowledgeRegionFromProfile({
    name,
    profile: { ...profile, name },
    description: sourceDescription,
    workspaceId: options.workspaceId,
  });

  const description =
    options.description?.trim() ||
    profile.description ||
    prompt ||
    (files.length ? `From files: ${files.map((f) => f.name).join(", ")}` : null) ||
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

/**
 * Build id → share URL map for TAP / ILE / TAPBench links in a workspace.
 * Used so region-builder can filter by the same listable URLs operators copy.
 */
export async function buildWorkspaceLinkUrlMap(
  supabase: SupabaseClient,
  workspaceId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://uncertain.systems",
): Promise<Map<string, string>> {
  const { buildGuestLinkUrl } = await import("@/lib/guest-link-access");
  const { buildTapbenchShareUrl, listStoredTapbenchLinks, toTapbenchListRow } = await import(
    "./tapbench"
  );
  const map = new Map<string, string>();
  const base = (baseUrl || "").replace(/\/$/, "") || "https://uncertain.systems";

  const [tapRes, ileRes, tbRes] = await Promise.all([
    supabase
      .from("workspace_tap_sessions")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("workspace_ile_links")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("workspace_tapbench_links")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
  ]);

  for (const row of tapRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "tap", tok.trim()));
  }
  for (const row of ileRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "ile", tok.trim()));
  }
  for (const row of tbRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildTapbenchShareUrl(base, tok.trim()));
  }

  // Process-store TAPBench mints not yet in DB
  for (const link of listStoredTapbenchLinks(workspaceId)) {
    if (!map.has(link.id)) {
      map.set(link.id, toTapbenchListRow(link, base).url);
    }
  }

  return map;
}

/** Distinct subjects that have at least one knowledge config snapshot in the workspace. */
export async function listSubjectsWithKnowledgeConfig(
  supabase: SupabaseClient,
  workspaceId: string,
  options?: { baseUrl?: string },
): Promise<
  Array<{
    user_id: string | null;
    guest_user_id: string | null;
    embedding_model_id: string;
    as_of_ms: number;
    confidence: number;
    /** human | tapbench — from associated PoW metadata when available. */
    pow_source: "human" | "tapbench";
    source_link_id: string | null;
    /** Listable share URL for the source link (TAP / ILE / TAPBench). */
    source_link_url: string | null;
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

  // Best-effort PoW provenance for region-builder human vs tapbench filter.
  const { data: powRows } = await supabase
    .from("workspace_proof_of_work")
    .select("user_id, guest_user_id, metadata")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const provenanceBySubject = new Map<
    string,
    { pow_source: "human" | "tapbench"; source_link_id: string | null }
  >();
  for (const row of powRows || []) {
    const uid = (row.user_id as string | null) ?? null;
    const gid = (row.guest_user_id as string | null) ?? null;
    const key = `${uid ?? ""}|${gid ?? ""}`;
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const isTapbench =
      meta.tapbench === true ||
      meta.pow_source === "tapbench" ||
      meta.source === "tapbench" ||
      meta.source_link_kind === "tapbench";
    const linkId =
      (typeof meta.source_link_id === "string" && meta.source_link_id.trim()) ||
      (typeof meta.tapbench_link_id === "string" && meta.tapbench_link_id.trim()) ||
      null;
    const existing = provenanceBySubject.get(key);
    if (!existing) {
      provenanceBySubject.set(key, {
        pow_source: isTapbench ? "tapbench" : "human",
        source_link_id: linkId,
      });
    } else if (isTapbench) {
      // tapbench wins if any PoW row is tapbench
      provenanceBySubject.set(key, {
        pow_source: "tapbench",
        source_link_id: existing.source_link_id || linkId,
      });
    } else if (!existing.source_link_id && linkId) {
      provenanceBySubject.set(key, { ...existing, source_link_id: linkId });
    }
  }

  const linkUrlById = await buildWorkspaceLinkUrlMap(
    supabase,
    workspaceId,
    options?.baseUrl,
  );

  const seen = new Set<string>();
  const out: Array<{
    user_id: string | null;
    guest_user_id: string | null;
    embedding_model_id: string;
    as_of_ms: number;
    confidence: number;
    pow_source: "human" | "tapbench";
    source_link_id: string | null;
    source_link_url: string | null;
  }> = [];

  for (const row of data) {
    const uid = (row.subject_user_id as string | null) ?? null;
    const gid = (row.subject_guest_user_id as string | null) ?? null;
    const key = `${uid ?? ""}|${gid ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const prov = provenanceBySubject.get(key);
    const source_link_id = prov?.source_link_id ?? null;
    out.push({
      user_id: uid,
      guest_user_id: gid,
      embedding_model_id: String(row.embedding_model_id),
      as_of_ms: Number(row.as_of_ms),
      confidence: Number(row.confidence) || 0,
      pow_source: prov?.pow_source ?? "human",
      source_link_id,
      source_link_url: source_link_id ? linkUrlById.get(source_link_id) ?? null : null,
    });
  }
  return out;
}

export { rowToSpec };
