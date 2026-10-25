/**
 * Synthetic knowledge region generation (Grok profile → persisted custom verification model).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSyntheticKnowledgeRegionFromProfile,
  type SyntheticRegionProfile,
} from "@/lib/knowledge-config";
import {
  type CustomVerificationModelSpec,
  CustomVerificationModelError,
} from "@/lib/knowledge-config/custom-verification-model";
import {
  callXaiJSON,
  callXaiResponsesWithFiles,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";
import {
  insertCustomVerificationSpec,
  type CustomVerificationModelRow,
} from "@/lib/pow-api/custom-verification-model-crud";

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
