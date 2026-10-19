/**
 * Author inspect / edit / seed for a block’s unsys answers-model.
 * Pure over SessionBranchModel. UI and session prepare only call these.
 * One graph per block. Travel is a priced edge from parent to child.
 */

import {
  hydrateSessionBranchModel,
  normalizeSessionBranchModel,
  recommendSessionBranchAction,
  sessionBranchById,
  SESSION_BRANCH_CHILD_MAX,
  type SessionBranch,
  type SessionBranchDraft,
  type SessionBranchEdge,
  type SessionBranchModel,
  type SessionBranchStatus,
} from "@/lib/session-branch-model";

export const AUTHOR_UNSYS_MODEL_SURFACE = "data-author-unsys-model";
export const AUTHOR_UNSYS_MODEL_DRAWER_ID = "unsys_model";
export const AUTHOR_UNSYS_MODEL_DRAWER_TITLE = "Unsys model";
export const AUTHOR_UNSYS_STUDIO_SURFACE = "data-author-unsys-studio";
export const AUTHOR_UNSYS_GENERATE_PATH = "/api/workspace/helios-unsys-seed-generate";

export type AuthorUnsysEdge = {
  toId: string;
  price: number;
  title: string;
};

export type AuthorUnsysHiddenState = {
  id: string;
  title: string;
  question: string;
  territory: string;
  observation: string;
  depth: number;
  parentId: string | null;
  status: SessionBranchStatus;
  edges: AuthorUnsysEdge[];
};

export type AuthorUnsysInspectFocus = {
  focusId: string;
  hiddenState: AuthorUnsysHiddenState;
  parentId: string | null;
  childIds: string[];
  recommendedToId: string | null;
};

export type AuthorUnsysModelSeed = {
  model: SessionBranchModel;
};

export type StudentUnsysPrepare =
  | { source: "seed"; model: SessionBranchModel }
  | { source: "generated"; model: SessionBranchModel }
  | { source: "none"; model: null };

function clampPrice(value: unknown, fallback = 20): number {
  const price = Number(value);
  if (!Number.isFinite(price)) return fallback;
  return Math.max(0, Math.min(100, Math.round(price)));
}

function cloneEdges(edges: readonly SessionBranchEdge[] | null | undefined): SessionBranchEdge[] {
  return (edges ?? [])
    .map((edge) => ({
      toId: String(edge.toId || "").trim(),
      price: clampPrice(edge.price, 20),
    }))
    .filter((edge) => edge.toId);
}

export function cloneAuthorUnsysModel(model: SessionBranchModel): SessionBranchModel {
  return {
    ...model,
    branches: model.branches.map((branch) => ({
      ...branch,
      edges: cloneEdges(branch.edges),
    })),
    boardNotes: model.boardNotes.map((note) => ({ ...note })),
  };
}

function childrenOf(model: SessionBranchModel, parentId: string): SessionBranch[] {
  return model.branches.filter((branch) => branch.parentId === parentId);
}

function edgesOf(model: SessionBranchModel, branch: SessionBranch): AuthorUnsysEdge[] {
  return cloneEdges(branch.edges).map((edge) => {
    const child = sessionBranchById(model, edge.toId);
    return {
      toId: edge.toId,
      price: edge.price,
      title: child?.title || edge.toId,
    };
  });
}

function hiddenStateOf(model: SessionBranchModel, branch: SessionBranch): AuthorUnsysHiddenState {
  return {
    id: branch.id,
    title: branch.title,
    question: branch.question,
    territory: branch.territory,
    observation: branch.observation,
    depth: branch.depth,
    parentId: branch.parentId,
    status: branch.status,
    edges: edgesOf(model, branch),
  };
}

export function listAuthorUnsysHiddenStates(
  model: SessionBranchModel | null | undefined,
): AuthorUnsysHiddenState[] {
  if (!model?.branches?.length) return [];
  return model.branches.map((branch) => hiddenStateOf(model, branch));
}

export function inspectAuthorUnsysFocus(
  model: SessionBranchModel | null | undefined,
  focusId?: string | null,
): AuthorUnsysInspectFocus | null {
  if (!model?.branches?.length) return null;
  const id = String(focusId || model.focusId || model.rootId || "").trim();
  const focus = sessionBranchById(model, id) ?? sessionBranchById(model, model.rootId);
  if (!focus) return null;
  const recommended = recommendSessionBranchAction(model, focus.id);
  return {
    focusId: focus.id,
    hiddenState: hiddenStateOf(model, focus),
    parentId: focus.parentId,
    childIds: childrenOf(model, focus.id).map((child) => child.id),
    recommendedToId: recommended?.toId ?? null,
  };
}

export function navigateAuthorUnsysGraph(
  model: SessionBranchModel,
  focusId: string | null | undefined,
  edge: { kind: "parent" } | { kind: "child"; childId: string },
): string | null {
  const current = inspectAuthorUnsysFocus(model, focusId);
  if (!current) return null;
  if (edge.kind === "parent") return current.parentId;
  if (!current.childIds.includes(edge.childId)) return null;
  return edge.childId;
}

function nodeDraft(
  title: string,
  question: string,
  territory: string,
  observation: string,
  edgePrice: number,
): Record<string, unknown> {
  return {
    title,
    question,
    territory,
    observation,
    edgePrice,
  };
}

/** Opening-slice example for inspect when the block has no saved seed. No xAI. */
export function exampleAuthorUnsysModel(chapterTitle: string): SessionBranchModel {
  const title = String(chapterTitle || "").replace(/\s+/g, " ").trim() || "This chapter";
  const regions = [1, 2, 3].map((regionIndex) => {
    const regionTitle = `${title}, region ${regionIndex}`;
    const avenues = [1, 2].map((avenueIndex) => {
      const avenueTitle = `${regionTitle}, avenue ${avenueIndex}`;
      const inquiries = [1, 2].map((inquiryIndex) => ({
        ...nodeDraft(
          `${avenueTitle}, inquiry ${inquiryIndex}`,
          `What would you not trust yourself to answer at ${avenueTitle}, inquiry ${inquiryIndex}?`,
          `Inquiry ${regionIndex}.${avenueIndex}.${inquiryIndex} of ${title}.`,
          `Inquiry ${regionIndex}.${avenueIndex}.${inquiryIndex} is still ahead.`,
          14 + inquiryIndex * 3,
        ),
      }));
      return {
        ...nodeDraft(
          avenueTitle,
          `What would go wrong on ${avenueTitle}?`,
          `Avenue ${regionIndex}.${avenueIndex} of ${title}.`,
          `${avenueTitle} is still ahead.`,
          20 + avenueIndex * 4,
        ),
        inquiries,
      };
    });
    return {
      ...nodeDraft(
        regionTitle,
        `What would you not trust yourself to answer in ${regionTitle}?`,
        `Region ${regionIndex} of ${title}.`,
        `${regionTitle} is open on the board.`,
        10 + regionIndex * 6,
      ),
      avenues,
    };
  });
  const draft: SessionBranchDraft = {
    ...nodeDraft(
      title,
      `What would you not trust yourself to answer about ${title}?`,
      title,
      `${title} is open.`,
      8,
    ),
    premise: title,
    regions,
  };
  const model = normalizeSessionBranchModel(draft, title);
  if (!model) {
    throw new Error("The example unsys model could not be built.");
  }
  return model;
}

export function authorUnsysWorkingModel(
  seed: AuthorUnsysModelSeed | null | undefined,
  chapterTitle: string,
): SessionBranchModel {
  if (seed?.model) return cloneAuthorUnsysModel(seed.model);
  return exampleAuthorUnsysModel(chapterTitle);
}

export function setAuthorUnsysEdgePrice(
  model: SessionBranchModel,
  fromId: string,
  toId: string,
  price: number,
): SessionBranchModel {
  const next = cloneAuthorUnsysModel(model);
  const branch = next.branches.find((row) => row.id === fromId);
  if (!branch) return next;
  const clamped = clampPrice(price, 20);
  const childIds = new Set(childrenOf(next, fromId).map((child) => child.id));
  if (!childIds.has(toId)) return next;
  let found = false;
  branch.edges = branch.edges.map((edge) => {
    if (edge.toId !== toId) return edge;
    found = true;
    return { ...edge, price: clamped };
  });
  if (!found) branch.edges.push({ toId, price: clamped });
  return next;
}

export type AuthorUnsysWorkspaceSeedItem = {
  blockId: string;
  title: string;
  branchCount: number;
};

export function listAuthorUnsysWorkspaceSeeds(
  blocks: ReadonlyArray<{
    id?: string | null;
    title?: string | null;
    answers_model_seed?: unknown;
  }>,
): AuthorUnsysWorkspaceSeedItem[] {
  const items: AuthorUnsysWorkspaceSeedItem[] = [];
  for (const block of blocks) {
    const blockId = String(block.id || "").trim();
    if (!blockId) continue;
    const seed = normalizeAuthorUnsysModelSeed(block.answers_model_seed);
    if (!seed) continue;
    items.push({
      blockId,
      title: String(block.title || "").trim() || "Untitled",
      branchCount: seed.model.branches.length,
    });
  }
  return items;
}

function nextAuthorBranchId(model: SessionBranchModel, parentId: string): string {
  const prefix = `${parentId}-x`;
  let ordinal = childrenOf(model, parentId).length + 1;
  let id = `${prefix}${ordinal}`;
  const taken = new Set(model.branches.map((branch) => branch.id));
  while (taken.has(id)) {
    ordinal += 1;
    id = `${prefix}${ordinal}`;
  }
  return id;
}

export function addAuthorUnsysBranch(
  model: SessionBranchModel,
  parentId: string,
  input: {
    title: string;
    question?: string;
    territory?: string;
    observation?: string;
    edgePrice?: number;
  },
): SessionBranchModel {
  const next = cloneAuthorUnsysModel(model);
  const parent = next.branches.find((branch) => branch.id === parentId);
  const title = String(input.title || "").replace(/\s+/g, " ").trim();
  if (!parent || !title) return next;
  const observation =
    String(input.observation || "").replace(/\s+/g, " ").trim() || title;
  const territory =
    String(input.territory || "").replace(/\s+/g, " ").trim() || parent.territory || title;
  const question = String(input.question || "").replace(/\s+/g, " ").trim();
  const id = nextAuthorBranchId(next, parentId);
  const depth = parent.depth + 1;
  const branch: SessionBranch = {
    id,
    parentId,
    title,
    question,
    territory,
    observation,
    depth,
    status: depth <= 1 ? "open" : "latent",
    edges: [],
  };
  next.branches.push(branch);
  parent.edges.push({
    toId: id,
    price: clampPrice(input.edgePrice, 20 + parent.edges.length * 8),
  });
  if (observation && !next.boardNotes.some((note) => note.key === id)) {
    next.boardNotes.push({ key: id, text: observation });
  }
  return next;
}

export function addAuthorUnsysGeneratedChildren(
  model: SessionBranchModel,
  parentId: string,
  children: Array<{
    title: string;
    question?: string;
    territory?: string;
    observation?: string;
    edgePrice?: number;
  }>,
): SessionBranchModel {
  let next = model;
  for (const child of children) {
    next = addAuthorUnsysBranch(next, parentId, child);
  }
  return next;
}

export function authorUnsysDeeperChildCount(_parentDepth?: number): number {
  return SESSION_BRANCH_CHILD_MAX;
}

export function removeAuthorUnsysBranch(
  model: SessionBranchModel,
  branchId: string,
): SessionBranchModel {
  if (branchId === model.rootId) return cloneAuthorUnsysModel(model);
  const drop = new Set<string>();
  const visit = (id: string) => {
    drop.add(id);
    for (const child of childrenOf(model, id)) visit(child.id);
  };
  visit(branchId);
  if (!drop.size) return cloneAuthorUnsysModel(model);
  const next = cloneAuthorUnsysModel(model);
  next.branches = next.branches.filter((branch) => !drop.has(branch.id));
  for (const branch of next.branches) {
    branch.edges = branch.edges.filter((edge) => !drop.has(edge.toId));
  }
  next.boardNotes = next.boardNotes.filter((note) => !drop.has(note.key));
  if (drop.has(next.focusId)) {
    const parent = model.branches.find((branch) => branch.id === branchId);
    next.focusId = parent?.parentId || next.rootId;
  }
  return next;
}

export function setAuthorUnsysBranchFields(
  model: SessionBranchModel,
  branchId: string,
  input: {
    title?: string;
    question?: string;
    observation?: string;
    territory?: string;
  },
): SessionBranchModel {
  const next = cloneAuthorUnsysModel(model);
  const branch = next.branches.find((row) => row.id === branchId);
  if (!branch) return next;
  const title = String(input.title ?? branch.title).replace(/\s+/g, " ").trim();
  if (title) branch.title = title;
  if (input.question !== undefined) {
    branch.question = String(input.question || "").replace(/\s+/g, " ").trim();
  }
  if (input.observation !== undefined) {
    branch.observation = String(input.observation || "").replace(/\s+/g, " ").trim();
  }
  if (input.territory !== undefined) {
    branch.territory = String(input.territory || "").replace(/\s+/g, " ").trim();
  }
  return next;
}

export function generateAuthorUnsysSample(chapterTitle: string): SessionBranchModel {
  return exampleAuthorUnsysModel(chapterTitle);
}

function asStatus(value: unknown): SessionBranchStatus {
  if (value === "closed" || value === "latent" || value === "open") return value;
  return "open";
}

export function normalizeAuthorUnsysModel(raw: unknown): SessionBranchModel | null {
  const hydrated = hydrateSessionBranchModel(raw);
  if (hydrated) {
    return {
      ...hydrated,
      step: 0,
      focusId: hydrated.rootId,
      branches: hydrated.branches.map((branch) => ({
        ...branch,
        status: asStatus(branch.status),
        edges: cloneEdges(branch.edges),
      })),
    };
  }
  return null;
}

function pickLegacyCatalogModel(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  for (const size of [4, 8, 16] as const) {
    const value = row[size] ?? row[String(size)];
    if (value) return value;
  }
  const keys = Object.keys(row);
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return null;
}

export function normalizeAuthorUnsysModelSeed(raw: unknown): AuthorUnsysModelSeed | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as {
    model?: unknown;
    models?: unknown;
    seed?: unknown;
  };
  const nested =
    row.seed && typeof row.seed === "object" && !Array.isArray(row.seed)
      ? (row.seed as { model?: unknown; models?: unknown })
      : null;
  const candidates = [
    row.model,
    nested?.model,
    pickLegacyCatalogModel(row.models),
    pickLegacyCatalogModel(nested?.models),
    row.models ? null : raw,
  ];
  for (const candidate of candidates) {
    const model = normalizeAuthorUnsysModel(candidate);
    if (model) return { model };
  }
  return null;
}

export function serializeAuthorUnsysModelSeed(
  seed: AuthorUnsysModelSeed,
): Record<string, unknown> {
  return {
    model: cloneAuthorUnsysModel(seed.model),
  };
}

export function authorUnsysSeedForPersist(
  input: SessionBranchModel | readonly SessionBranchModel[] | AuthorUnsysModelSeed,
): AuthorUnsysModelSeed {
  if (input && typeof input === "object" && "model" in input && !Array.isArray(input)) {
    const seed = input as AuthorUnsysModelSeed;
    if (seed.model) return { model: cloneAuthorUnsysModel(seed.model) };
  }
  const list = Array.isArray(input) ? input : [input as SessionBranchModel];
  const model = list.find((row) => row && Array.isArray(row.branches) && row.branches.length);
  if (!model) {
    throw new Error("The unsys model could not be saved.");
  }
  return { model: cloneAuthorUnsysModel(model) };
}

export function studentSessionModelFromAuthorSeed(raw: unknown): SessionBranchModel | null {
  const seed = normalizeAuthorUnsysModelSeed(raw);
  return seed ? cloneAuthorUnsysModel(seed.model) : null;
}

export function resolveStudentUnsysPrepare(input: {
  seed?: unknown;
  generated?: SessionBranchModel | null;
}): StudentUnsysPrepare {
  const seeded = studentSessionModelFromAuthorSeed(input.seed);
  if (seeded) return { source: "seed", model: seeded };
  if (input.generated && input.generated.branches.length > 0) {
    return { source: "generated", model: input.generated };
  }
  return { source: "none", model: null };
}
