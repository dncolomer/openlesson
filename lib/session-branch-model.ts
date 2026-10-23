/**
 * Generative model for a session: hidden states on state factors, each with
 * a predicted observation. Travel is a priced edge from one hidden state to
 * another. Learn and Verify infer which hidden state the work is on.
 */

import {
  boardInstructionNoteElements,
  ileWorkCanvasContentBounds,
  type IleWorkCanvasElement,
} from "@/lib/learn-work-canvas";

export const SESSION_BRANCH_REGION_COUNT = 6;
export const SESSION_BRANCH_AVENUE_COUNT = 4;
export const SESSION_BRANCH_INQUIRY_COUNT = 3;
export const SESSION_BRANCH_CHILD_MIN = 2;
export const SESSION_BRANCH_CHILD_MAX = 8;
/** Root + regions + avenues. Inquiries make it a field rather than a short path. */
export const SESSION_BRANCH_MIN_COUNT =
  1 +
  SESSION_BRANCH_REGION_COUNT +
  SESSION_BRANCH_REGION_COUNT * SESSION_BRANCH_AVENUE_COUNT;
/** Root, six regions, four avenues each, three inquiries each. */
export const SESSION_BRANCH_TARGET_COUNT =
  1 +
  SESSION_BRANCH_REGION_COUNT +
  SESSION_BRANCH_REGION_COUNT * SESSION_BRANCH_AVENUE_COUNT +
  SESSION_BRANCH_REGION_COUNT * SESSION_BRANCH_AVENUE_COUNT * SESSION_BRANCH_INQUIRY_COUNT;
/**
 * Smallest field worth keeping after a short model reply.
 * Author first-ring samples are smaller; live session trees still grow.
 */
export const SESSION_BRANCH_ACCEPT_COUNT = 8;

export type SessionBranchEdge = {
  toId: string;
  price: number;
};

export type SessionBranchStatus = "open" | "closed" | "latent";

export type SessionBranch = {
  id: string;
  parentId: string | null;
  title: string;
  /** Learner-facing question xAI wrote for this node. Never a title wrap. */
  question: string;
  /** State factor. Stored key stays `territory`. */
  territory: string;
  /** Likelihood p(o|s). Predicted observation for this hidden state. */
  observation: string;
  depth: number;
  status: SessionBranchStatus;
  edges: SessionBranchEdge[];
};

export type SessionBranchNote = {
  key: string;
  text: string;
};

export type SessionBranchModel = {
  chapterTitle: string;
  rootId: string;
  focusId: string;
  step: number;
  branches: SessionBranch[];
  boardNotes: SessionBranchNote[];
};

/** Cheapest outgoing edge, framed as the next hidden state. */
export type SessionBranchRecommended = {
  id: string;
  toId: string;
  price: number;
  leads: string;
  observation: string;
  leadsBranchId: string;
};

type RawNode = {
  title?: unknown;
  question?: unknown;
  territory?: unknown;
  observation?: unknown;
  edgePrice?: unknown;
  closePrice?: unknown;
  keepPrice?: unknown;
  discardPrice?: unknown;
  insightPrice?: unknown;
  children?: unknown;
  regions?: unknown;
  avenues?: unknown;
  inquiries?: unknown;
  [key: string]: unknown;
};

export type SessionBranchDraft = RawNode & {
  premise?: unknown;
};

function textOf(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : fallback;
}

function priceOf(value: unknown, fallback: number): number {
  const price = Number(value);
  if (!Number.isFinite(price)) return fallback;
  return Math.max(0, Math.min(100, Math.round(price)));
}

function edgePriceFromRaw(raw: RawNode | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  if (raw.edgePrice != null && Number.isFinite(Number(raw.edgePrice))) {
    return priceOf(raw.edgePrice, fallback);
  }
  const priced = [raw.keepPrice, raw.closePrice, raw.discardPrice, raw.insightPrice]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!priced.length) return fallback;
  return priceOf(Math.min(...priced), fallback);
}

function cloneEdges(edges: readonly SessionBranchEdge[] | null | undefined): SessionBranchEdge[] {
  return (edges ?? []).map((edge) => ({
    toId: String(edge.toId || "").trim(),
    price: priceOf(edge.price, 20),
  })).filter((edge) => edge.toId);
}

function childrenOf(model: Pick<SessionBranchModel, "branches">, parentId: string): SessionBranch[] {
  return model.branches.filter((branch) => branch.parentId === parentId);
}

function attachChildEdges(branches: SessionBranch[]): SessionBranch[] {
  const ids = new Set(branches.map((branch) => branch.id));
  return branches.map((branch) => {
    const kids = branches.filter((row) => row.parentId === branch.id);
    const byTo = new Map(branch.edges.map((edge) => [edge.toId, edge]));
    const edges: SessionBranchEdge[] = kids
      .filter((child) => ids.has(child.id))
      .map((child, index) => {
        const existing = byTo.get(child.id);
        return {
          toId: child.id,
          price: existing ? priceOf(existing.price, 20 + index * 8) : 20 + index * 8,
        };
      });
    return { ...branch, edges };
  });
}

function edgesFromLegacyActions(
  rawEdges: unknown,
  rawActions: unknown,
  childIds: string[],
): SessionBranchEdge[] {
  if (Array.isArray(rawEdges) && rawEdges.length) {
    const listed = cloneEdges(rawEdges as SessionBranchEdge[]);
    const allowed = new Set(childIds);
    const filtered = listed.filter((edge) => allowed.has(edge.toId));
    if (filtered.length) return filtered;
  }
  const actions = Array.isArray(rawActions) ? rawActions : [];
  const edges: SessionBranchEdge[] = [];
  const seen = new Set<string>();
  for (const item of actions) {
    if (!item || typeof item !== "object") continue;
    const row = item as { leadsBranchId?: unknown; leads?: unknown; price?: unknown };
    const lead = textOf(row.leadsBranchId) || textOf(row.leads);
    if (!lead || !childIds.includes(lead) || seen.has(lead)) continue;
    seen.add(lead);
    edges.push({ toId: lead, price: priceOf(row.price, 20) });
  }
  if (edges.length) return edges;
  return childIds.map((toId, index) => ({ toId, price: 20 + index * 8 }));
}

export function sessionBranchById(
  model: SessionBranchModel,
  id: string | null | undefined,
): SessionBranch | null {
  if (!id) return null;
  return model.branches.find((branch) => branch.id === id) ?? null;
}

/**
 * How many children a live session still wants under this depth.
 * The author's first ring (root children) stays as written.
 * Depth 1 grows to avenues, depth 2 to inquiries.
 */
export function sessionBranchChildQuota(depth: number): number {
  if (depth === 1) return SESSION_BRANCH_AVENUE_COUNT;
  if (depth === 2) return SESSION_BRANCH_INQUIRY_COUNT;
  return 0;
}

export function sessionBranchParentsNeedingGrowth(
  model: SessionBranchModel,
  failed: readonly string[] = [],
): { parent: SessionBranch; need: number }[] {
  const blocked = new Set(
    failed
      .map((key) => (key.startsWith("seed:") ? key.slice("seed:".length) : ""))
      .filter(Boolean),
  );
  const out: { parent: SessionBranch; need: number }[] = [];
  for (const parent of model.branches) {
    if (blocked.has(parent.id)) continue;
    const quota = sessionBranchChildQuota(parent.depth);
    if (quota <= 0) continue;
    const have = model.branches.filter((branch) => branch.parentId === parent.id).length;
    if (have >= quota) continue;
    out.push({ parent, need: quota - have });
  }
  return out.sort(
    (a, b) => a.parent.depth - b.parent.depth || a.parent.id.localeCompare(b.parent.id),
  );
}

export function sessionBranchOutgoing(
  model: SessionBranchModel,
  branchId: string | null | undefined,
): SessionBranchEdge[] {
  const focus = sessionBranchById(model, branchId);
  if (!focus) return [];
  const ids = new Set(model.branches.map((branch) => branch.id));
  return focus.edges.filter((edge) => ids.has(edge.toId));
}

export function sessionBranchEdgeBetween(
  model: SessionBranchModel,
  fromId: string | null | undefined,
  toId: string | null | undefined,
): SessionBranchEdge | null {
  if (!fromId || !toId) return null;
  const listed = sessionBranchOutgoing(model, fromId).find((edge) => edge.toId === toId);
  if (listed) return listed;
  const target = sessionBranchById(model, toId);
  if (target?.parentId === fromId) return { toId, price: 20 };
  return null;
}

export function recommendSessionBranchEdge(
  model: SessionBranchModel,
  branchId: string | null | undefined,
): { edge: SessionBranchEdge; target: SessionBranch } | null {
  const focusId = branchId || model.focusId;
  const ranked = sessionBranchOutgoing(model, focusId)
    .slice()
    .sort((a, b) => a.price - b.price || a.toId.localeCompare(b.toId));
  for (const edge of ranked) {
    const target = sessionBranchById(model, edge.toId);
    if (target) return { edge, target };
  }
  return null;
}

export function recommendSessionBranchAction(
  model: SessionBranchModel,
  branchId: string | null | undefined,
): SessionBranchRecommended | null {
  const recommended = recommendSessionBranchEdge(model, branchId);
  if (!recommended) return null;
  return {
    id: recommended.target.id,
    toId: recommended.target.id,
    price: recommended.edge.price,
    leads: recommended.target.title,
    observation: recommended.target.observation || recommended.target.question,
    leadsBranchId: recommended.target.id,
  };
}

/** Cheapest parent→child step from a hidden state, named with both node titles. */
export type SessionBranchCheapestTransition = {
  fromId: string;
  fromTitle: string;
  toId: string;
  toTitle: string;
  price: number;
};

export function sessionBranchCheapestTransition(
  model: SessionBranchModel | null | undefined,
  branchId?: string | null,
): SessionBranchCheapestTransition | null {
  if (!model) return null;
  const from = sessionBranchById(model, branchId || model.focusId);
  if (!from) return null;
  const recommended = recommendSessionBranchAction(model, from.id);
  if (!recommended) return null;
  const to = sessionBranchById(model, recommended.toId);
  if (!to) return null;
  return {
    fromId: from.id,
    fromTitle: from.title,
    toId: to.id,
    toTitle: to.title,
    price: recommended.price,
  };
}

/** Nearby hidden states the live classifier may pick. */
export function sessionBranchInferCandidates(
  model: SessionBranchModel,
  branchId?: string | null,
): SessionBranch[] {
  const focus = sessionBranchById(model, branchId || model.focusId);
  if (!focus) return model.branches.filter((branch) => branch.status !== "latent").slice(0, 12);
  const nearby: SessionBranch[] = [focus];
  const seen = new Set<string>([focus.id]);
  const push = (branch: SessionBranch | null) => {
    if (!branch || seen.has(branch.id)) return;
    seen.add(branch.id);
    nearby.push(branch);
  };
  for (const child of childrenOf(model, focus.id)) push(child);
  if (focus.parentId) {
    push(sessionBranchById(model, focus.parentId));
    for (const sibling of childrenOf(model, focus.parentId)) push(sibling);
  }
  return nearby;
}

function pushBranch(branches: SessionBranch[], branch: SessionBranch): void {
  branches.push(branch);
}

function nodeFromRaw(
  raw: RawNode,
  id: string,
  parentId: string | null,
  depth: number,
  fallbackTitle: string,
  fallbackPrice: number,
): { branch: SessionBranch; edgePrice: number } {
  const title = textOf(raw.title, fallbackTitle);
  const observation = textOf(raw.observation, title);
  return {
    edgePrice: edgePriceFromRaw(raw, fallbackPrice),
    branch: {
      id,
      parentId,
      title,
      question: textOf(raw.question),
      territory: textOf(raw.territory, observation),
      observation,
      depth,
      status: depth <= 1 ? "open" : "latent",
      edges: [],
    },
  };
}

function walkChildren(
  branches: SessionBranch[],
  parent: SessionBranch,
  kids: RawNode[],
  idPrefix: string,
): void {
  kids.forEach((raw, index) => {
    const id = `${idPrefix}${index + 1}`;
    const made = nodeFromRaw(
      raw,
      id,
      parent.id,
      parent.depth + 1,
      `${parent.title}, ${index + 1}`,
      20 + index * 8,
    );
    pushBranch(branches, made.branch);
    parent.edges.push({ toId: id, price: made.edgePrice });
    const nested = Array.isArray(raw.children) ? (raw.children as RawNode[]) : [];
    const avenues = Array.isArray(raw.avenues) ? (raw.avenues as RawNode[]) : [];
    const inquiries = Array.isArray(raw.inquiries) ? (raw.inquiries as RawNode[]) : [];
    if (nested.length) walkChildren(branches, made.branch, nested, `${id}-c`);
    else if (avenues.length) walkChildren(branches, made.branch, avenues, `${id}-a`);
    else if (inquiries.length) walkChildren(branches, made.branch, inquiries, `${id}-q`);
  });
}

export function normalizeSessionBranchModel(
  draft: SessionBranchDraft | null | undefined,
  chapterTitle: string,
  _unusedCatalogSize?: unknown,
): SessionBranchModel | null {
  const title = textOf(chapterTitle, "This chapter");
  const premise = textOf(draft?.premise, title);
  const regions = Array.isArray(draft?.regions) ? (draft?.regions as RawNode[]) : [];
  const children = Array.isArray(draft?.children) ? (draft?.children as RawNode[]) : [];
  const first = children.length ? children : regions;
  if (!first.length) return null;
  const branches: SessionBranch[] = [];
  const root: SessionBranch = {
    id: "root",
    parentId: null,
    title,
    question: textOf(draft?.question),
    territory: premise,
    observation: premise,
    depth: 0,
    status: "open",
    edges: [],
  };
  pushBranch(branches, root);
  walkChildren(branches, root, first, children.length ? "c" : "r");
  const attached = attachChildEdges(branches);
  return {
    chapterTitle: title,
    rootId: root.id,
    focusId: root.id,
    step: 0,
    branches: attached,
    boardNotes: attached
      .filter((branch) => branch.observation.trim())
      .map((branch) => ({ key: branch.id, text: branch.observation })),
  };
}

function parseStoredBranch(raw: unknown): SessionBranch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = textOf(row.id);
  if (!id) return null;
  const parentRaw = row.parentId;
  return {
    id,
    parentId: parentRaw == null || parentRaw === "" ? null : textOf(parentRaw),
    title: textOf(row.title, id),
    question: textOf(row.question),
    territory: textOf(row.territory),
    observation: textOf(row.observation),
    depth: Number.isFinite(Number(row.depth)) ? Math.max(0, Math.floor(Number(row.depth))) : 0,
    status:
      row.status === "closed" || row.status === "latent" || row.status === "open"
        ? row.status
        : "open",
    edges: cloneEdges(row.edges as SessionBranchEdge[]),
  };
}

/** Read a stored or live tree. Legacy action catalogs become priced parent→child edges. */
export function hydrateSessionBranchModel(raw: unknown): SessionBranchModel | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const listed = Array.isArray(row.branches) ? row.branches : [];
  const parsed = listed
    .map(parseStoredBranch)
    .filter((branch): branch is SessionBranch => Boolean(branch));
  if (!parsed.length) {
    return normalizeSessionBranchModel(row as SessionBranchDraft, textOf(row.chapterTitle, "This chapter"));
  }
  const ids = new Set(parsed.map((branch) => branch.id));
  const withEdges = parsed.map((branch) => {
    const childIds = parsed.filter((row) => row.parentId === branch.id).map((row) => row.id);
    const source = listed.find((item) => {
      if (!item || typeof item !== "object") return false;
      return textOf((item as { id?: unknown }).id) === branch.id;
    }) as { edges?: unknown; actions?: unknown } | undefined;
    return {
      ...branch,
      edges: edgesFromLegacyActions(source?.edges ?? branch.edges, source?.actions, childIds).filter(
        (edge) => ids.has(edge.toId),
      ),
    };
  });
  const rootId =
    textOf(row.rootId) && ids.has(textOf(row.rootId))
      ? textOf(row.rootId)
      : withEdges.find((branch) => branch.parentId == null)?.id || withEdges[0]!.id;
  const focusId =
    textOf(row.focusId) && ids.has(textOf(row.focusId)) ? textOf(row.focusId) : rootId;
  const boardNotes: SessionBranchNote[] = Array.isArray(row.boardNotes)
    ? (row.boardNotes as unknown[])
        .map((note) => {
          if (!note || typeof note !== "object") return null;
          const rec = note as { key?: unknown; text?: unknown };
          const key = textOf(rec.key);
          const text = textOf(rec.text);
          return key && text ? { key, text } : null;
        })
        .filter((note): note is SessionBranchNote => Boolean(note))
    : withEdges
        .filter((branch) => branch.observation.trim())
        .map((branch) => ({ key: branch.id, text: branch.observation }));
  return {
    chapterTitle: textOf(row.chapterTitle, "This chapter"),
    rootId,
    focusId,
    step: Number.isInteger(Number(row.step)) ? Math.max(0, Number(row.step)) : 0,
    branches: withEdges,
    boardNotes,
  };
}

/** Branches the learner can close. Latent inquiries stay off the frozen list. */
export function openSessionBranchQuestions(
  model: SessionBranchModel | null | undefined,
): { id: string; text: string }[] {
  if (!model) return [];
  return model.branches
    .filter((branch) => branch.status !== "latent")
    .map((branch) => ({
      id: branch.id,
      text: (branch.question || "").trim() || branch.title,
    }));
}

function openLatent(branches: SessionBranch[], ids: string[]): SessionBranch[] {
  const wanted = new Set(ids);
  return branches.map((branch) =>
    wanted.has(branch.id) && branch.status === "latent" ? { ...branch, status: "open" } : branch,
  );
}

function noteFor(key: string, text: string, seen: Set<string>): SessionBranchNote | null {
  const clean = text.trim();
  if (!clean || seen.has(key)) return null;
  seen.add(key);
  return { key, text: clean };
}

function cloneModelBranches(model: SessionBranchModel): SessionBranch[] {
  return model.branches.map((branch) => ({
    ...branch,
    edges: cloneEdges(branch.edges),
  }));
}

export function advanceSessionBranchModel(
  model: SessionBranchModel,
  input: { toId?: string | null; fromId?: string | null; branchId?: string | null },
): SessionBranchModel {
  const fromId = input.fromId || input.branchId || model.focusId;
  const toId = textOf(input.toId) || fromId;
  const from = sessionBranchById(model, fromId);
  const target = sessionBranchById(model, toId);
  if (!from || !target) return model;
  const step = model.step + 1;
  let branches = cloneModelBranches(model);
  if (target.status === "latent") branches = openLatent(branches, [target.id]);
  const seen = new Set(model.boardNotes.map((note) => note.key));
  const notes: SessionBranchNote[] = [];
  const moved = noteFor(`${from.id}->${target.id}:${step}`, target.observation, seen);
  if (moved) notes.push(moved);
  for (const branch of branches) {
    if (branch.status !== "open") continue;
    const opened = noteFor(branch.id, branch.observation, seen);
    if (opened && !model.boardNotes.some((note) => note.key === opened.key)) notes.push(opened);
  }
  return {
    ...model,
    step,
    focusId: target.id,
    branches,
    boardNotes: [...model.boardNotes, ...notes],
  };
}

export function graftSessionBranchModel(
  live: SessionBranchModel,
  incoming: SessionBranchModel,
): SessionBranchModel {
  const liveById = new Map(live.branches.map((branch) => [branch.id, branch]));
  const incomingIds = new Set(incoming.branches.map((branch) => branch.id));
  if ([...incomingIds].every((id) => liveById.has(id))) return live;
  const closed = new Set(
    live.branches.filter((branch) => branch.status === "closed").map((branch) => branch.id),
  );
  const seen = new Set(live.boardNotes.map((note) => note.key));
  const notes = [...live.boardNotes];
  const branches = incoming.branches.map((born) => {
    const existing = liveById.get(born.id);
    if (existing) return existing;
    const status =
      born.parentId && closed.has(born.parentId) && born.status === "latent" ? "open" : born.status;
    const text = born.observation.trim();
    if (text && !seen.has(born.id)) {
      seen.add(born.id);
      notes.push({ key: born.id, text });
    }
    return { ...born, status, edges: cloneEdges(born.edges) };
  });
  const hydrated = attachChildEdges(branches);
  const focusId = hydrated.some((branch) => branch.id === live.focusId) ? live.focusId : incoming.focusId;
  return { ...live, focusId, branches: hydrated, boardNotes: notes };
}

export function adoptSessionBranchGrowth(
  current: { status: string; model: SessionBranchModel | null; birth?: SessionBranchModel | null; error: string | null },
  incoming: SessionBranchModel,
  birth: SessionBranchModel,
): { status: "ready"; model: SessionBranchModel; birth: SessionBranchModel; error: null } {
  const nextBirth =
    !current.birth || birth.branches.length >= current.birth.branches.length ? birth : current.birth;
  if (current.status === "ready" && current.model && current.model.step > 0) {
    return {
      status: "ready",
      model: graftSessionBranchModel(current.model, incoming),
      birth: nextBirth,
      error: null,
    };
  }
  if (
    current.status === "ready" &&
    current.model &&
    incoming.branches.length < current.model.branches.length
  ) {
    return { status: "ready", model: current.model, birth: nextBirth, error: null };
  }
  return { status: "ready", model: incoming, birth: nextBirth, error: null };
}

export function sessionBranchFieldCounts(model: SessionBranchModel): {
  total: number;
  open: number;
  latent: number;
  closed: number;
} {
  return {
    total: model.branches.length,
    open: model.branches.filter((branch) => branch.status === "open").length,
    latent: model.branches.filter((branch) => branch.status === "latent").length,
    closed: model.branches.filter((branch) => branch.status === "closed").length,
  };
}

export function sessionBranchModelFromUnknown(raw: unknown): SessionBranchModel | null {
  return hydrateSessionBranchModel(raw);
}

const NODE_PROPERTIES = {
  title: { type: "string" },
  question: { type: "string" },
  territory: { type: "string" },
  observation: { type: "string" },
  edgePrice: { type: "number" },
} as const;

export const SESSION_BRANCH_MODEL_SCHEMA = {
  name: "session_branch_field",
  strict: true,
  schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["premise", "question", "territory", "observation", "children"],
    properties: {
      premise: { type: "string" },
      question: { type: "string" },
      territory: { type: "string" },
      observation: { type: "string" },
      children: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "question", "territory", "observation", "edgePrice"],
          properties: { ...NODE_PROPERTIES },
        },
      },
    },
  },
};

export function sessionBranchModelPrompt(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
}): string {
  const brief = textOf(input.chapterBrief);
  return [
    `Prepare the working field for a session on "${textOf(input.chapterTitle, "this chapter")}".`,
    brief ? `Chapter material:\n${brief}` : "",
    "This is a landscape of inquiry, not a short quiz and not a three-step maze.",
    `Write between ${SESSION_BRANCH_CHILD_MIN} and ${SESSION_BRANCH_CHILD_MAX} hidden states branching from the opening state.`,
    "Choose how many branches the concept actually needs. Do not pad.",
    "Every node needs its own territory, a genuine question, a board observation of one or two sentences, and an edgePrice from 0 to 100: the cost of travelling to that hidden state from its parent.",
    "The question is one original interrogative sentence a learner would be asked. Write it from scratch. Never wrap the title or territory into a stock sentence.",
    "A lower edgePrice is the better next hidden state from the parent.",
    "The branches must cover different parts of the chapter.",
    "Write in complete sentences a learner can read. No headings, no bullets, no product names.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function branchObservationElements(
  notes: readonly SessionBranchNote[],
  existing: readonly IleWorkCanvasElement[],
): IleWorkCanvasElement[] {
  const pending = notes.filter((note) => note.text.trim());
  if (!pending.length) return [];
  const bounds = ileWorkCanvasContentBounds(existing);
  const originX = bounds ? bounds.maxX + 48 : 80;
  const originY = bounds ? bounds.minY : 80;
  return pending.flatMap((note, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const marked = { sessionBranchNote: note.key };
    return boardInstructionNoteElements({
      text: note.text,
      x: originX + column * 340,
      y: originY + row * 280,
      textWidth: 300,
      textId: `branch-note-${note.key}`,
      textCustomData: marked,
      bodyCustomData: marked,
      headerCustomData: marked,
    }).elements;
  });
}

function branchNoteKey(element: IleWorkCanvasElement): string | null {
  const marked = element.customData?.sessionBranchNote;
  if (typeof marked === "string" && marked) return marked;
  if (typeof element.id === "string" && element.id.startsWith("branch-note-")) {
    return element.id.slice("branch-note-".length);
  }
  return null;
}

/** Field observations stay on the model. They are not opening canvas text. */
export function withoutSessionBranchNotes<T extends { id?: unknown; customData?: IleWorkCanvasElement["customData"] }>(
  elements: readonly T[],
): T[] {
  return elements.filter((element) => branchNoteKey(element as unknown as IleWorkCanvasElement) == null);
}

/** Notes that are not already on the board, including ones the learner deleted. */
export function sessionBranchNotesToPlace(
  notes: readonly SessionBranchNote[],
  elements: readonly IleWorkCanvasElement[],
): SessionBranchNote[] {
  const present = new Set<string>();
  for (const element of elements) {
    const key = branchNoteKey(element);
    if (key) present.add(key);
  }
  return notes.filter((note) => note.text.trim() && !present.has(note.key));
}

export function appendSessionBranchNotes(
  elements: readonly IleWorkCanvasElement[],
  notes: readonly SessionBranchNote[],
): { elements: IleWorkCanvasElement[]; added: IleWorkCanvasElement[] } {
  const added = branchObservationElements(sessionBranchNotesToPlace(notes, elements), elements);
  if (!added.length) return { elements: [...elements], added };
  return { elements: [...elements, ...added], added };
}
