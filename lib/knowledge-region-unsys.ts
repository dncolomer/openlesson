/**
 * Overlay a run’s hidden-state walk onto a reference Unsys tree.
 * Reference is the author’s flow seed when present; mapped is that run’s
 * projectedPolicy.sequence (and sounded genModel when distinct).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  recoverFlowEmbeddingRaw,
  type FlowGenModelRaw,
} from "@/lib/flow-embedding";
import {
  listFlowEmbeddingsForOwner,
  type StoredFlowEmbedding,
} from "@/lib/flow-embedding-store";
import { studentSessionModelFromAuthorSeed } from "@/lib/author-unsys-model";
import {
  candidateIdentityKeys,
  type LoadKnowledgeRegionCandidateResult,
} from "@/lib/knowledge-region-candidate";
import type { KnowledgeRegionDetailsRow } from "@/lib/knowledge-region-details";
import { productFlowEmbeddingKind } from "@/lib/product-flow";
import {
  hydrateSessionBranchModel,
  type SessionBranchModel,
  type SessionBranchStatus,
} from "@/lib/session-branch-model";

export const DASHBOARD_KNOWLEDGE_REGION_UNSYS_PATH =
  "/api/dashboard/knowledge-regions";

const REGION_SELECT =
  "id, workspace_id, owner_user_id, organization_id, name, description, subject_count, subjects, created_at, embedding_model_id, centroid, cosine_threshold, mean_radius, verify_flow_id";

const FLOW_TABLE = "verify_flows";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type UnsysWalkEdge = {
  to_id: string;
  price: number;
};

export type UnsysWalkHiddenState = {
  id: string;
  parent_id: string | null;
  title: string;
  question: string;
  observation: string;
  territory: string;
  depth: number;
  edges: UnsysWalkEdge[];
  visited: boolean;
  sequence: number | null;
};

export type UnsysWalkTree = {
  root_id: string;
  chapter_title: string;
  hidden_states: Array<Omit<UnsysWalkHiddenState, "visited" | "sequence">>;
};

export type UnsysWalkOverlay = {
  root_id: string;
  chapter_title: string;
  hidden_states: UnsysWalkHiddenState[];
  walk: string[];
};

export type KnowledgeRegionUncertaintyModelRender = {
  knowledge_region_id: string;
  candidate_id: string;
  observation_id: string | null;
  run_id: string | null;
  identity: string | null;
  reference: UnsysWalkTree;
  mapped: {
    sequence: string[];
    hidden_states: UnsysWalkTree["hidden_states"];
  };
  overlay: UnsysWalkOverlay;
};

type BranchLike = {
  id: string;
  parentId: string | null;
  title: string;
  question: string;
  territory: string;
  observation: string;
  depth: number;
  status?: string;
  edges: Array<{ toId: string; price: number }>;
};

function branchesFromModel(
  model: SessionBranchModel | FlowGenModelRaw | null | undefined,
): { rootId: string; chapterTitle: string; branches: BranchLike[] } {
  if (!model) return { rootId: "", chapterTitle: "", branches: [] };
  const asSession = model as SessionBranchModel;
  if (Array.isArray(asSession.branches) && asSession.focusId !== undefined) {
    return {
      rootId: text(asSession.rootId),
      chapterTitle: text(asSession.chapterTitle),
      branches: asSession.branches.map((branch) => ({
        id: text(branch.id),
        parentId: branch.parentId == null ? null : text(branch.parentId) || null,
        title: text(branch.title),
        question: text(branch.question),
        territory: text(branch.territory),
        observation: text(branch.observation),
        depth: Number.isFinite(Number(branch.depth)) ? Number(branch.depth) : 0,
        status: branch.status,
        edges: (branch.edges ?? []).map((edge) => ({
          toId: text(edge.toId),
          price: Number.isFinite(Number(edge.price)) ? Number(edge.price) : 0,
        })),
      })),
    };
  }
  const gen = model as FlowGenModelRaw;
  return {
    rootId: text(gen.rootId),
    chapterTitle: text(gen.chapterTitle),
    branches: (gen.branches ?? []).map((branch) => ({
      id: text(branch.id),
      parentId: branch.parentId == null ? null : text(branch.parentId) || null,
      title: text(branch.title),
      question: text(branch.question),
      territory: text(branch.territory),
      observation: text(branch.observation),
      depth: Number.isFinite(Number(branch.depth)) ? Number(branch.depth) : 0,
      status: branch.status,
      edges: (branch.edges ?? []).map((edge) => ({
        toId: text(edge.toId),
        price: Number.isFinite(Number(edge.price)) ? Number(edge.price) : 0,
      })),
    })),
  };
}

function treeFromBranches(
  rootId: string,
  chapterTitle: string,
  branches: BranchLike[],
): UnsysWalkTree {
  const hidden_states = branches
    .filter((branch) => branch.id)
    .map((branch) => ({
      id: branch.id,
      parent_id: branch.parentId,
      title: branch.title,
      question: branch.question,
      observation: branch.observation,
      territory: branch.territory,
      depth: branch.depth,
      edges: branch.edges
        .filter((edge) => edge.toId)
        .map((edge) => ({ to_id: edge.toId, price: edge.price })),
    }));
  return {
    root_id: rootId || hidden_states.find((row) => row.parent_id == null)?.id || "",
    chapter_title: chapterTitle,
    hidden_states,
  };
}

export function walkSequenceNumbers(walk: readonly string[] | null | undefined): Map<string, number> {
  const numbers = new Map<string, number>();
  let n = 0;
  for (const raw of walk ?? []) {
    const id = text(raw);
    if (!id || numbers.has(id)) continue;
    n += 1;
    numbers.set(id, n);
  }
  return numbers;
}

export function presentUnsysWalkOverlay(input: {
  reference: SessionBranchModel | FlowGenModelRaw | null | undefined;
  walk?: readonly string[] | null;
  mapped?: SessionBranchModel | FlowGenModelRaw | null | undefined;
}): UnsysWalkOverlay {
  const reference = branchesFromModel(input.reference);
  const mapped = branchesFromModel(input.mapped);
  const walk = (input.walk ?? []).map((id) => text(id)).filter(Boolean);
  const sequence = walkSequenceNumbers(walk);
  const byId = new Map<string, BranchLike>();
  for (const branch of reference.branches) {
    if (branch.id) byId.set(branch.id, branch);
  }
  for (const branch of mapped.branches) {
    if (!branch.id || byId.has(branch.id)) continue;
    if (sequence.has(branch.id)) byId.set(branch.id, branch);
  }
  const hidden_states: UnsysWalkHiddenState[] = [...byId.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((branch) => {
      const step = sequence.get(branch.id) ?? null;
      return {
        id: branch.id,
        parent_id: branch.parentId,
        title: branch.title,
        question: branch.question,
        observation: branch.observation,
        territory: branch.territory,
        depth: branch.depth,
        edges: branch.edges
          .filter((edge) => edge.toId)
          .map((edge) => ({ to_id: edge.toId, price: edge.price })),
        visited: step != null,
        sequence: step,
      };
    });
  const rootId =
    reference.rootId ||
    mapped.rootId ||
    hidden_states.find((row) => row.parent_id == null)?.id ||
    "";
  return {
    root_id: rootId,
    chapter_title: reference.chapterTitle || mapped.chapterTitle,
    hidden_states,
    walk,
  };
}

export function overlayToSessionBranchModel(overlay: UnsysWalkOverlay | null | undefined): SessionBranchModel | null {
  if (!overlay?.hidden_states.length) return null;
  const branches = overlay.hidden_states.map((state) => ({
    id: state.id,
    parentId: state.parent_id,
    title: state.title,
    question: state.question,
    territory: state.territory,
    observation: state.observation,
    depth: state.depth,
    status: "open" as SessionBranchStatus,
    edges: state.edges.map((edge) => ({ toId: edge.to_id, price: edge.price })),
  }));
  return {
    chapterTitle: overlay.chapter_title,
    rootId: overlay.root_id || branches[0]!.id,
    focusId: overlay.root_id || branches[0]!.id,
    step: 0,
    branches,
    boardNotes: [],
  };
}

function parseSubjects(value: unknown): Array<{
  user_id: string | null;
  guest_user_id: string | null;
  label: string | null;
}> {
  if (!Array.isArray(value)) return [];
  const out: Array<{
    user_id: string | null;
    guest_user_id: string | null;
    label: string | null;
  }> = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as { user_id?: unknown; guest_user_id?: unknown; label?: unknown };
    out.push({
      user_id: text(record.user_id) || null,
      guest_user_id: text(record.guest_user_id) || null,
      label: text(record.label) || null,
    });
  }
  return out;
}

function parentFlowId(row: KnowledgeRegionDetailsRow): string {
  return text(row.verify_flow_id);
}

function createdAtMs(value: string | null | undefined): number {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function embeddingMatchesKeys(embedding: StoredFlowEmbedding, keys: Set<string>): boolean {
  const identity = text(embedding.identity);
  if (identity && keys.has(identity)) return true;
  if (text(embedding.id) && keys.has(text(embedding.id))) return true;
  if (text(embedding.run_id) && keys.has(text(embedding.run_id))) return true;
  return false;
}

export function pickUncertaintyModelEmbedding(
  embeddings: readonly StoredFlowEmbedding[],
  input: { candidateId: string; runId?: string | null; keys: Set<string> },
): StoredFlowEmbedding | null {
  const runId = text(input.runId);
  if (runId) {
    const exact = embeddings.find(
      (row) => text(row.id) === runId || text(row.run_id) === runId,
    );
    if (exact) return exact;
  }
  const candidateId = text(input.candidateId);
  const byId = embeddings.find(
    (row) => text(row.id) === candidateId || text(row.run_id) === candidateId,
  );
  if (byId) return byId;
  const matched = embeddings
    .filter((row) => embeddingMatchesKeys(row, input.keys))
    .sort((a, b) => {
      const byTime = createdAtMs(b.created_at) - createdAtMs(a.created_at);
      return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
    });
  return matched[0] ?? null;
}

function modelFromEmbedding(embedding: StoredFlowEmbedding | null): {
  gen: FlowGenModelRaw | null;
  walk: string[];
} {
  if (!embedding) return { gen: null, walk: [] };
  const raw = recoverFlowEmbeddingRaw(embedding.raw) ?? embedding.raw;
  const gen = raw?.genModel ?? null;
  const walk = raw?.projectedPolicy?.sequence ?? [];
  return { gen, walk };
}

export function presentKnowledgeRegionUncertaintyModel(input: {
  knowledgeRegionId: string;
  candidateId: string;
  runId?: string | null;
  parent: KnowledgeRegionDetailsRow;
  embeddings?: readonly StoredFlowEmbedding[];
  referenceModel?: SessionBranchModel | FlowGenModelRaw | null;
}): KnowledgeRegionUncertaintyModelRender {
  const subjects = parseSubjects(input.parent.subjects);
  const keys = candidateIdentityKeys(input.candidateId, subjects);
  const embedding = pickUncertaintyModelEmbedding(input.embeddings ?? [], {
    candidateId: input.candidateId,
    runId: input.runId,
    keys,
  });
  const mapped = modelFromEmbedding(embedding);
  const referenceSource = input.referenceModel ?? mapped.gen;
  const overlay = presentUnsysWalkOverlay({
    reference: referenceSource,
    mapped: mapped.gen,
    walk: mapped.walk,
  });
  const referenceTree = treeFromBranches(
    ...(() => {
      const parsed = branchesFromModel(referenceSource);
      return [parsed.rootId, parsed.chapterTitle, parsed.branches] as const;
    })(),
  );
  const mappedTree = treeFromBranches(
    ...(() => {
      const parsed = branchesFromModel(mapped.gen);
      return [parsed.rootId, parsed.chapterTitle, parsed.branches] as const;
    })(),
  );
  return {
    knowledge_region_id: text(input.knowledgeRegionId),
    candidate_id: text(input.candidateId),
    observation_id: embedding?.id ?? null,
    run_id: embedding ? text(embedding.run_id) || embedding.id : null,
    identity: embedding ? text(embedding.identity) || null : null,
    reference: referenceTree,
    mapped: {
      sequence: overlay.walk,
      hidden_states: mappedTree.hidden_states,
    },
    overlay,
  };
}

export type LoadKnowledgeRegionUncertaintyModelResult =
  | { ok: true; payload: KnowledgeRegionUncertaintyModelRender }
  | Extract<LoadKnowledgeRegionCandidateResult, { ok: false }>;

async function loadFlowUnsysSeed(
  supabase: ReturnType<typeof createAdminClient>,
  flowId: string,
): Promise<SessionBranchModel | null> {
  if (!flowId) return null;
  const { data } = await supabase
    .from(FLOW_TABLE)
    .select("answers_model_seed")
    .eq("id", flowId)
    .maybeSingle();
  return studentSessionModelFromAuthorSeed(data?.answers_model_seed) ?? hydrateSessionBranchModel(data?.answers_model_seed);
}

export async function loadKnowledgeRegionUncertaintyModel(input: {
  ownerUserId: string;
  knowledgeRegionId: string;
  candidateId: string;
  runId?: string | null;
  organizationId?: string | null;
}): Promise<LoadKnowledgeRegionUncertaintyModelResult> {
  const ownerUserId = text(input.ownerUserId);
  const knowledgeRegionId = text(input.knowledgeRegionId);
  const candidateId = text(input.candidateId);
  const organizationId = text(input.organizationId);
  if (!ownerUserId) {
    return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
  }
  if (!knowledgeRegionId || !candidateId) {
    return {
      ok: false,
      status: 400,
      code: "validation_error",
      message: "knowledge_region_id and candidate_id are required",
    };
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("knowledge_regions")
    .select(REGION_SELECT)
    .eq("id", knowledgeRegionId);
  if (!organizationId) query = query.eq("owner_user_id", ownerUserId);
  const { data: row, error } = await query.maybeSingle();
  if (error || !row) {
    return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
  }
  const rowOrg = text((row as { organization_id?: unknown }).organization_id);
  if (organizationId) {
    if (rowOrg && rowOrg !== organizationId) {
      return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
    }
    if (!rowOrg && text(row.owner_user_id) !== ownerUserId) {
      return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
    }
  }
  if (text(row.embedding_model_id) === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) {
    return { ok: false, status: 404, code: "not_found", message: "Knowledge region not found" };
  }
  const embeddings = await listFlowEmbeddingsForOwner({
    ownerUserId,
    flowKind: productFlowEmbeddingKind(),
  });
  const parent = row as KnowledgeRegionDetailsRow;
  const referenceModel = await loadFlowUnsysSeed(supabase, parentFlowId(parent));

  return {
    ok: true,
    payload: presentKnowledgeRegionUncertaintyModel({
      knowledgeRegionId,
      candidateId,
      runId: input.runId,
      parent,
      embeddings,
      referenceModel,
    }),
  };
}

export function dashboardKnowledgeRegionUncertaintyModelPath(
  regionId: string,
  query: { candidateId: string; runId?: string | null },
): string {
  const params = new URLSearchParams();
  params.set("candidateId", query.candidateId);
  if (text(query.runId)) params.set("runId", text(query.runId));
  return `${DASHBOARD_KNOWLEDGE_REGION_UNSYS_PATH}/${encodeURIComponent(regionId)}/uncertainty-model?${params.toString()}`;
}
