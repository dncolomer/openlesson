/**
 * Persist / load / score custom verification models / knowledge regions (workspace-scoped).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSyntheticKnowledgeRegionFromProfile,
  type SyntheticRegionProfile,
} from "@/lib/knowledge-config";
import {
  computeKnowledgeDistance,
  createCustomVerificationModelFromVectors,
  scoreAgainstCustomVerificationModel,
  pathTextRegionCompanionNames,
  voiceRegionName,
  type CustomVerificationModelSpec,
  type CustomVerificationScore,
  type CustomVerificationSubjectRef,
  type KnowledgeDistance,
  CustomVerificationModelError,
} from "@/lib/knowledge-config/custom-verification-model";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  embedFlowOutput,
  isFlowEmbeddingVector,
  recoverFlowEmbeddingRaw,
} from "@/lib/flow-embedding";
import {
  callXaiJSON,
  callXaiResponsesWithFiles,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";
import { normalizeSubject, subjectIdentityKey } from "./subject-ref";
import {
  filterImportableKnowledgeRegions,
  type ImportableKnowledgeRegion,
} from "@/lib/knowledge-region-import";

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
    embedding_model_id: String(raw.embedding_model_id || FLOW_EMBEDDING_MODEL_ID),
    dim: Number(raw.dim) || FLOW_EMBEDDING_DIM,
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

const CUSTOM_MODEL_SELECT =
  "id, workspace_id, name, description, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at";

/** Regions from other workspaces the caller owns — for embeddings import overlay. */
export async function listImportableKnowledgeRegionsForOwner(
  supabase: SupabaseClient,
  options: { callerUserId: string; currentWorkspaceId: string },
): Promise<ImportableKnowledgeRegion[]> {
  const callerUserId = String(options.callerUserId || "").trim();
  const currentWorkspaceId = String(options.currentWorkspaceId || "").trim();
  if (!callerUserId || !currentWorkspaceId) return [];

  const { data: owned, error: ownedError } = await supabase
    .from("workspaces")
    .select("id, user_id, title, root_topic")
    .eq("user_id", callerUserId)
    .neq("id", currentWorkspaceId);

  if (ownedError || !owned || owned.length === 0) return [];

  const ids = owned.map((w) => String((w as { id: string }).id)).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("custom_verification_models")
    .select(CUSTOM_MODEL_SELECT)
    .in("workspace_id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[custom-verification-model-store] importable list failed:", error.message);
    return [];
  }

  return filterImportableKnowledgeRegions({
    callerUserId,
    currentWorkspaceId,
    ownedWorkspaces: owned as Array<{
      id: string;
      user_id: string;
      title?: string | null;
      root_topic?: string | null;
    }>,
    regions: (rows || []).map((r) => parseRow(r as Record<string, unknown>)),
  });
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

  if (existing.embedding_model_id === FLOW_EMBEDDING_MODEL_ID) {
    for (const companionName of pathTextRegionCompanionNames(existing.name)) {
      await supabase
        .from("custom_verification_models")
        .delete()
        .eq("workspace_id", options.workspaceId)
        .eq("embedding_model_id", FLOW_EMBEDDING_PATH_TEXT_MODEL_ID)
        .ilike("name", companionName);
    }
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

type LatestFlowVector = {
  vector: number[];
  vector_path_text: number[];
  as_of_ms: number;
  embedding_model_id: string;
};

function vectorForRegionModel(
  latest: LatestFlowVector,
  embeddingModelId: string,
): number[] {
  return embeddingModelId === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID
    ? latest.vector_path_text
    : latest.vector;
}

type SubjectPowProvenance = {
  user_id: string | null;
  guest_user_id: string | null;
  pow_source: "human" | "tapbench";
  source_link_id: string | null;
};

function subjectFromEmbeddingIdentity(
  identity: string,
  provenanceByIdentity: Map<string, SubjectPowProvenance>,
): {
  user_id: string | null;
  guest_user_id: string | null;
  prov: SubjectPowProvenance | undefined;
} {
  const raw = identity.trim();
  if (!raw) return { user_id: null, guest_user_id: null, prov: undefined };
  const prov = provenanceByIdentity.get(raw);
  // Unknown-bare default is guest so listed subjects still round-trip through
  // subjectIdentityKey to the stored embedding identity.
  const normalized = normalizeSubject(
    prov
      ? { user_id: prov.user_id, guest_user_id: prov.guest_user_id }
      : { guest_user_id: raw },
  );
  return {
    user_id: normalized.subject_user_id,
    guest_user_id: normalized.subject_guest_user_id,
    prov,
  };
}

async function loadLatestFlowVectorForSubject(
  supabase: SupabaseClient,
  workspaceId: string,
  subject: CustomVerificationSubjectRef,
): Promise<LatestFlowVector | null> {
  const identity = subjectIdentityKey(subject);
  if (!identity) return null;

  const { data, error } = await supabase
    .from("workspace_flow_embeddings")
    .select("vector, identity, created_at, embedding_model_id, dim, raw")
    .eq("workspace_id", workspaceId)
    .eq("identity", identity)
    .eq("embedding_model_id", FLOW_EMBEDDING_MODEL_ID)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;

  const row = data[0] as {
    vector?: unknown;
    identity?: string | null;
    created_at?: string;
    raw?: unknown;
  };
  const vector = Array.isArray(row.vector)
    ? row.vector.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
  if (!isFlowEmbeddingVector(vector)) return null;
  const recovered = recoverFlowEmbeddingRaw(row.raw);
  const embedded = recovered ? embedFlowOutput(recovered) : null;
  return {
    vector: embedded?.vector ?? vector,
    vector_path_text: embedded?.vector_path_text ?? vector,
    as_of_ms: Date.parse(String(row.created_at || "")) || 0,
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
  };
}

async function insertCustomVerificationSpec(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    spec: CustomVerificationModelSpec;
    description?: string | null;
    createdBy?: string | null;
    subjects: CustomVerificationSubjectRef[];
  },
): Promise<CustomVerificationModelRow> {
  const payload = {
    workspace_id: options.workspaceId,
    name: options.spec.name,
    description: options.description?.trim() || null,
    embedding_model_id: options.spec.embedding_model_id,
    dim: options.spec.dim,
    centroid: options.spec.centroid,
    cohort_cohesion: options.spec.cohort_cohesion,
    mean_radius: options.spec.mean_radius,
    cosine_threshold: options.spec.cosine_threshold,
    subject_count: options.spec.subject_count,
    subjects: options.subjects,
    created_by: options.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("custom_verification_models")
    .insert(payload)
    .select(CUSTOM_MODEL_SELECT)
    .maybeSingle();
  if (error || !data) {
    throw new CustomVerificationModelError(
      error?.message || "failed to save custom verification model",
    );
  }
  return parseRow(data as Record<string, unknown>);
}

/**
 * Load latest flow embeddings for each subject, build model, persist.
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
): Promise<{
  model: CustomVerificationModelRow;
  spec: CustomVerificationModelSpec;
  voiceModel: CustomVerificationModelRow | null;
  voiceSpec: CustomVerificationModelSpec | null;
}> {
  if (!options.subjects.length) {
    throw new CustomVerificationModelError("select at least one subject");
  }

  const pathVectors: number[][] = [];
  const voiceVectors: number[][] = [];
  const resolvedSubjects: CustomVerificationSubjectRef[] = [];

  for (const subject of options.subjects) {
    const latest = await loadLatestFlowVectorForSubject(supabase, options.workspaceId, subject);
    if (!latest?.vector?.length) {
      throw new CustomVerificationModelError(
        `no flow embedding for subject ${subject.label || subject.user_id || subject.guest_user_id || "unknown"}`,
      );
    }
    pathVectors.push(latest.vector);
    voiceVectors.push(latest.vector_path_text);
    resolvedSubjects.push({
      user_id: subject.user_id ?? null,
      guest_user_id: subject.guest_user_id ?? null,
      label: subject.label ?? null,
    });
  }

  const spec = createCustomVerificationModelFromVectors({
    name: options.name,
    vectors: pathVectors,
    subjects: resolvedSubjects,
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
  });
  const description = options.description?.trim() || null;
  const model = await insertCustomVerificationSpec(supabase, {
    workspaceId: options.workspaceId,
    spec,
    description,
    createdBy: options.createdBy,
    subjects: resolvedSubjects,
  });

  const voiceName = voiceRegionName(spec.name);
  let voiceSpec: CustomVerificationModelSpec | null = null;
  let voiceModel: CustomVerificationModelRow | null = null;
  if (
    voiceName !== spec.name &&
    voiceVectors.length === pathVectors.length &&
    voiceVectors.every((vector) => isFlowEmbeddingVector(vector))
  ) {
    voiceSpec = createCustomVerificationModelFromVectors({
      name: voiceName,
      vectors: voiceVectors,
      subjects: resolvedSubjects,
      embedding_model_id: FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
    });
    voiceModel = await insertCustomVerificationSpec(supabase, {
      workspaceId: options.workspaceId,
      spec: voiceSpec,
      description,
      createdBy: options.createdBy,
      subjects: resolvedSubjects,
    });
  }

  return { model, spec, voiceModel, voiceSpec };
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

const SYNTHETIC_REGION_PROFILE_SYSTEM = `You design synthetic knowledge regions for the flowcfg-v1-d96 embedding space used by Calibrate, Learn, and Verify.
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
 * Ask Grok 4.5 for a synthetic competency profile, then encode into flowcfg-v1-d96
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
     * Optional uploader for tests — defaults to org-scoped xAI Files.
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
      const { organizationIdFromWorkspace, uploadOrgScopedXaiFile } = await import(
        "@/lib/organization/org-xai-files"
      );
      const organizationId = await organizationIdFromWorkspace(supabase, options.workspaceId);
      for (const f of files) {
        try {
          const uploaded = options.uploadFile
            ? await options.uploadFile(f.name, f.mimeType, f.data)
            : await uploadOrgScopedXaiFile(f.name, f.mimeType, f.data, {
                organizationId,
                collectionFields: { workspace_id: options.workspaceId },
              });
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

  const model = await insertCustomVerificationSpec(supabase, {
    workspaceId: options.workspaceId,
    spec: { ...spec, subject_count: Math.max(1, spec.subject_count) },
    description: taggedDescription,
    createdBy: options.createdBy,
    subjects: spec.subjects,
  });
  return { model, spec };
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

  const latest = await loadLatestFlowVectorForSubject(supabase, options.workspaceId, options.subject);
  if (!latest?.vector?.length) {
    throw new CustomVerificationModelError("subject has no flow embedding to evaluate");
  }

  const score = scoreAgainstCustomVerificationModel(
    vectorForRegionModel(latest, model.embedding_model_id),
    rowToSpec(model),
  );
  return { score, model };
}

/**
 * Knowledge distance for a subject vs a saved region.
 * Pure geometry load+compute from the latest flow embedding.
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

  const latest = await loadLatestFlowVectorForSubject(supabase, options.workspaceId, options.subject);
  if (!latest?.vector?.length) {
    throw new CustomVerificationModelError("subject has no flow embedding for Knowledge distance");
  }

  const knowledge_distance = computeKnowledgeDistance(
    vectorForRegionModel(latest, region.embedding_model_id),
    rowToSpec(region),
  );
  return {
    knowledge_distance,
    region,
    subject: {
      user_id: options.subject.user_id ?? null,
      guest_user_id: options.subject.guest_user_id ?? null,
      as_of_ms: latest.as_of_ms ?? null,
      embedding_model_id: latest.embedding_model_id || FLOW_EMBEDDING_MODEL_ID,
    },
  };
}

/**
 * Build id → share URL map for TAP / TAP Learning links in a workspace.
 * Used so region-builder can filter by the same listable URLs operators copy.
 */
export async function buildWorkspaceLinkUrlMap(
  supabase: SupabaseClient,
  workspaceId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://uncertain.systems",
): Promise<Map<string, string>> {
  const { buildGuestLinkUrl } = await import("@/lib/guest-link-access");
  const map = new Map<string, string>();
  const base = (baseUrl || "").replace(/\/$/, "") || "https://uncertain.systems";

  const [calibrateRes, verifyRes, ileRes] = await Promise.all([
    supabase
      .from("workspace_calibrate_sessions")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("workspace_verify_sessions")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("workspace_learn_links")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
  ]);

  for (const row of calibrateRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "calibrate", tok.trim(), "calibrate"));
  }
  for (const row of verifyRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "verify", tok.trim()));
  }
  for (const row of ileRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "ile", tok.trim()));
  }

  return map;
}

/** Distinct subjects that have at least one flow embedding in the workspace. */
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
    /** human | tapbench — historical provenance from associated PoW metadata when available. */
    pow_source: "human" | "tapbench";
    source_link_id: string | null;
    /** Listable share URL for the source link (TAP / TAP Learning). */
    source_link_url: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("workspace_flow_embeddings")
    .select("identity, embedding_model_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("embedding_model_id", FLOW_EMBEDDING_MODEL_ID)
    .order("created_at", { ascending: false })
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

  const provenanceByIdentity = new Map<string, SubjectPowProvenance>();
  for (const row of powRows || []) {
    const uid = (row.user_id as string | null) ?? null;
    const gid = (row.guest_user_id as string | null) ?? null;
    const normalized = normalizeSubject({ user_id: uid, guest_user_id: gid });
    const key = subjectIdentityKey(normalized.subject);
    if (!key) continue;
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
    const existing = provenanceByIdentity.get(key);
    if (!existing) {
      provenanceByIdentity.set(key, {
        user_id: normalized.subject_user_id,
        guest_user_id: normalized.subject_guest_user_id,
        pow_source: isTapbench ? "tapbench" : "human",
        source_link_id: linkId,
      });
    } else if (isTapbench) {
      provenanceByIdentity.set(key, {
        ...existing,
        pow_source: "tapbench",
        source_link_id: existing.source_link_id || linkId,
      });
    } else if (!existing.source_link_id && linkId) {
      provenanceByIdentity.set(key, { ...existing, source_link_id: linkId });
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
    const identity = String((row as { identity?: string | null }).identity || "").trim();
    if (!identity) continue;
    const key = identity;
    if (seen.has(key)) continue;
    seen.add(key);
    const { user_id, guest_user_id, prov } = subjectFromEmbeddingIdentity(
      identity,
      provenanceByIdentity,
    );
    const source_link_id = prov?.source_link_id ?? null;
    out.push({
      user_id,
      guest_user_id,
      embedding_model_id: String((row as { embedding_model_id?: string }).embedding_model_id || FLOW_EMBEDDING_MODEL_ID),
      as_of_ms: Date.parse(String((row as { created_at?: string }).created_at || "")) || 0,
      confidence: 1,
      pow_source: prov?.pow_source ?? "human",
      source_link_id,
      source_link_url: source_link_id ? linkUrlById.get(source_link_id) ?? null : null,
    });
  }
  return out;
}

export { rowToSpec };
