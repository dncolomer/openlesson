/**
 * CRUD + subject list for custom verification models / knowledge regions (workspace-scoped).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createCustomVerificationModelFromVectors,
  pathTextRegionCompanionNames,
  voiceRegionName,
  type CustomVerificationModelSpec,
  type CustomVerificationSubjectRef,
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
import { normalizeSubject, subjectIdentityKey } from "./subject-ref";
import {
  filterImportableKnowledgeRegions,
  type ImportableKnowledgeRegion,
} from "@/lib/knowledge-region-import";

export interface CustomVerificationModelRow {
  id: string;
  workspace_id: string;
  owner_user_id?: string;
  product?: string | null;
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

export function rowToSpec(row: CustomVerificationModelRow): CustomVerificationModelSpec {
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
    workspace_id: String(raw.workspace_id || ""),
    owner_user_id: raw.owner_user_id ? String(raw.owner_user_id) : undefined,
    product: raw.product ? String(raw.product) : null,
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
    .from("knowledge_regions")
    .select(
      "id, workspace_id, owner_user_id, product, name, description, embedding_model_id, family_embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at, calibrate_flow_id, verify_flow_id",
    )
    .eq("workspace_id", workspaceId)
    .neq("dim", 64)
    .neq("embedding_model_id", "knowledgecfg-v1-d64")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[custom-verification-model-store] list failed:", error.message);
    return [];
  }
  return (data || []).map((r) => parseRow(r as Record<string, unknown>));
}

const CUSTOM_MODEL_SELECT =
  "id, workspace_id, owner_user_id, product, name, description, embedding_model_id, family_embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at, calibrate_flow_id, verify_flow_id";

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
    .from("knowledge_regions")
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
    .from("knowledge_regions")
    .select(
      "id, workspace_id, owner_user_id, product, name, description, embedding_model_id, dim, centroid, cohort_cohesion, mean_radius, cosine_threshold, subject_count, subjects, created_by, created_at, updated_at",
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
        .from("knowledge_regions")
        .delete()
        .eq("workspace_id", options.workspaceId)
        .eq("embedding_model_id", FLOW_EMBEDDING_PATH_TEXT_MODEL_ID)
        .ilike("name", companionName);
    }
  }

  const { error } = await supabase
    .from("knowledge_regions")
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

export type LatestFlowVector = {
  vector: number[];
  vector_path_text: number[];
  as_of_ms: number;
  embedding_model_id: string;
};

export function vectorForRegionModel(
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

export async function loadLatestFlowVectorForSubject(
  supabase: SupabaseClient,
  workspaceId: string,
  subject: CustomVerificationSubjectRef,
): Promise<LatestFlowVector | null> {
  const identity = subjectIdentityKey(subject);
  if (!identity) return null;

  const { data, error } = await supabase
    .from("session_embeddings")
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

async function resolveOwnerUserId(
  supabase: SupabaseClient,
  options: { workspaceId: string; ownerUserId?: string | null },
): Promise<string> {
  const provided = String(options.ownerUserId || "").trim();
  if (provided) return provided;
  const workspaceId = String(options.workspaceId || "").trim();
  if (!workspaceId) {
    throw new CustomVerificationModelError("owner_user_id is required");
  }
  const { data, error } = await supabase
    .from("workspaces")
    .select("user_id")
    .eq("id", workspaceId)
    .maybeSingle();
  const owner = String((data as { user_id?: string } | null)?.user_id || "").trim();
  if (!owner) {
    throw new CustomVerificationModelError(error?.message || "owner_user_id is required");
  }
  return owner;
}

export async function insertCustomVerificationSpec(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    spec: CustomVerificationModelSpec;
    description?: string | null;
    ownerUserId?: string | null;
    createdBy?: string | null;
    subjects: CustomVerificationSubjectRef[];
  },
): Promise<CustomVerificationModelRow> {
  const ownerUserId = await resolveOwnerUserId(supabase, options);
  const payload = {
    workspace_id: options.workspaceId || null,
    owner_user_id: ownerUserId,
    name: options.spec.name,
    description: options.description?.trim() || null,
    embedding_model_id: options.spec.embedding_model_id,
    family_embedding_model_id:
      options.spec.dim === 64 || options.spec.embedding_model_id === "knowledgecfg-v1-d64"
        ? null
        : "learn-flowcfg-v1-d96",
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
    .from("knowledge_regions")
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
    ownerUserId?: string | null;
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
    ownerUserId: options.ownerUserId,
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
      ownerUserId: options.ownerUserId,
      createdBy: options.createdBy,
      subjects: resolvedSubjects,
    });
  }

  return { model, spec, voiceModel, voiceSpec };
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
    .from("session_embeddings")
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
    .from("proof_of_work")
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

  const { buildWorkspaceLinkUrlMap } = await import(
    "@/lib/pow-api/custom-verification-model-eval"
  );
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
