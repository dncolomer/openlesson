/**
 * The field prepared at the start of a Learn session.
 * XAI writes the territories, the observations, and the price of each action.
 * Close, Keep, and Discard reveal the next ring. Insight is the last step.
 */

import {
  convertIleWorkCanvasSkeletons,
  ILE_WORK_CANVAS_STROKE_COLOR,
  ileWorkCanvasContentBounds,
  type IleWorkCanvasElement,
} from "@/lib/ile-work-canvas";
import type { SessionMarkButtonId } from "@/lib/session-marks";

export const SESSION_BRANCH_REGION_COUNT = 6;
export const SESSION_BRANCH_AVENUE_COUNT = 4;
export const SESSION_BRANCH_INQUIRY_COUNT = 3;
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
 * Below this the session refuses the field instead of starting a tiny maze.
 */
export const SESSION_BRANCH_ACCEPT_COUNT = 80;

export const SESSION_BRANCH_ACTION_ORDER = ["try", "hold", "drop", "insight"] as const;

export type SessionBranchAction = {
  id: SessionMarkButtonId;
  price: number;
  /** Where this action takes the learner. */
  leads: string;
  /** The observation this action writes on the board. */
  observation: string;
};

export type SessionBranchStatus = "open" | "closed" | "latent";

export type SessionBranch = {
  id: string;
  parentId: string | null;
  title: string;
  territory: string;
  observation: string;
  depth: number;
  status: SessionBranchStatus;
  actions: SessionBranchAction[];
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

type RawActionPrices = {
  closePrice?: unknown;
  keepPrice?: unknown;
  discardPrice?: unknown;
  insightPrice?: unknown;
  closeLeads?: unknown;
  keepLeads?: unknown;
  discardLeads?: unknown;
  insightLeads?: unknown;
  closeObservation?: unknown;
  keepObservation?: unknown;
  discardObservation?: unknown;
  insightObservation?: unknown;
};

type RawInquiry = RawActionPrices & {
  title?: unknown;
  territory?: unknown;
  observation?: unknown;
};

type RawAvenue = RawInquiry & {
  inquiries?: unknown;
};

type RawRegion = RawInquiry & {
  avenues?: unknown;
};

export type SessionBranchDraft = RawActionPrices & {
  premise?: unknown;
  regions?: unknown;
};

const ACTION_FIELDS: Array<{
  id: SessionMarkButtonId;
  price: keyof RawActionPrices;
  leads: keyof RawActionPrices;
  observation: keyof RawActionPrices;
}> = [
  { id: "try", price: "closePrice", leads: "closeLeads", observation: "closeObservation" },
  { id: "hold", price: "keepPrice", leads: "keepLeads", observation: "keepObservation" },
  { id: "drop", price: "discardPrice", leads: "discardLeads", observation: "discardObservation" },
  { id: "insight", price: "insightPrice", leads: "insightLeads", observation: "insightObservation" },
];

function textOf(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : fallback;
}

function priceOf(value: unknown, fallback: number): number {
  const price = Number(value);
  if (!Number.isFinite(price)) return fallback;
  return Math.max(0, Math.min(100, Math.round(price)));
}

function actionsFrom(raw: RawActionPrices, observation: string): SessionBranchAction[] {
  return ACTION_FIELDS.map((field, index) => ({
    id: field.id,
    price: priceOf(raw[field.price], 20 + index * 15),
    leads: textOf(raw[field.leads], "The next ring of this territory opens on the board."),
    observation: textOf(raw[field.observation], observation),
  }));
}

function pushBranch(
  branches: SessionBranch[],
  branch: SessionBranch,
): void {
  branches.push(branch);
}

export function normalizeSessionBranchModel(
  draft: SessionBranchDraft | null | undefined,
  chapterTitle: string,
): SessionBranchModel | null {
  const regions = Array.isArray(draft?.regions) ? (draft.regions as RawRegion[]) : [];
  if (!regions.length) return null;
  const title = textOf(chapterTitle, "This chapter");
  const premise = textOf(draft?.premise, title);
  const branches: SessionBranch[] = [];
  const root: SessionBranch = {
    id: "root",
    parentId: null,
    title,
    territory: premise,
    observation: premise,
    depth: 0,
    status: "open",
    actions: actionsFrom(draft ?? {}, premise),
  };
  pushBranch(branches, root);

  regions.forEach((region, regionIndex) => {
    const regionId = `r${regionIndex + 1}`;
    const regionTitle = textOf(region?.title, `Region ${regionIndex + 1}`);
    const regionObservation = textOf(region?.observation, regionTitle);
    pushBranch(branches, {
      id: regionId,
      parentId: root.id,
      title: regionTitle,
      territory: textOf(region?.territory, regionObservation),
      observation: regionObservation,
      depth: 1,
      status: "open",
      actions: actionsFrom(region ?? {}, regionObservation),
    });
    const avenues = Array.isArray(region?.avenues) ? (region.avenues as RawAvenue[]) : [];
    avenues.forEach((avenue, avenueIndex) => {
      const avenueId = `${regionId}-a${avenueIndex + 1}`;
      const avenueTitle = textOf(avenue?.title, `${regionTitle}, avenue ${avenueIndex + 1}`);
      const avenueObservation = textOf(avenue?.observation, avenueTitle);
      pushBranch(branches, {
        id: avenueId,
        parentId: regionId,
        title: avenueTitle,
        territory: textOf(avenue?.territory, avenueObservation),
        observation: avenueObservation,
        depth: 2,
        status: "latent",
        actions: actionsFrom(avenue ?? {}, avenueObservation),
      });
      const inquiries = Array.isArray(avenue?.inquiries) ? (avenue.inquiries as RawInquiry[]) : [];
      inquiries.forEach((inquiry, inquiryIndex) => {
        const inquiryTitle = textOf(inquiry?.title, `${avenueTitle}, inquiry ${inquiryIndex + 1}`);
        const inquiryObservation = textOf(inquiry?.observation, inquiryTitle);
        pushBranch(branches, {
          id: `${avenueId}-q${inquiryIndex + 1}`,
          parentId: avenueId,
          title: inquiryTitle,
          territory: textOf(inquiry?.territory, inquiryObservation),
          observation: inquiryObservation,
          depth: 3,
          status: "latent",
          actions: actionsFrom(inquiry ?? {}, inquiryObservation),
        });
      });
    });
  });

  return {
    chapterTitle: title,
    rootId: root.id,
    focusId: root.id,
    step: 0,
    branches,
    boardNotes: branches
      .filter((branch) => branch.observation.trim())
      .map((branch) => ({ key: branch.id, text: branch.observation })),
  };
}

export function sessionBranchById(
  model: SessionBranchModel,
  id: string | null | undefined,
): SessionBranch | null {
  if (!id) return null;
  return model.branches.find((branch) => branch.id === id) ?? null;
}

/** Branches the learner can close. Latent inquiries stay off the frozen list. */
export function openSessionBranchQuestions(
  model: SessionBranchModel | null | undefined,
): { id: string; text: string }[] {
  if (!model) return [];
  return model.branches
    .filter((branch) => branch.status !== "latent")
    .map((branch) => ({ id: branch.id, text: branch.title }));
}

export function recommendSessionBranchAction(
  model: SessionBranchModel,
  branchId: string | null | undefined,
): SessionBranchAction | null {
  const focus = sessionBranchById(model, branchId || model.focusId);
  if (!focus) return null;
  const openLeft = model.branches.some((branch) => branch.status === "open");
  if (!openLeft) return focus.actions.find((action) => action.id === "insight") ?? null;
  const ranked = focus.actions
    .filter((action) => action.id !== "insight")
    .slice()
    .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  return ranked[0] ?? null;
}

function openLatent(
  branches: SessionBranch[],
  ids: string[],
): SessionBranch[] {
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

export function advanceSessionBranchModel(
  model: SessionBranchModel,
  input: { branchId?: string | null; action: SessionMarkButtonId },
): SessionBranchModel {
  const focusId = input.branchId || model.focusId;
  const focus = sessionBranchById(model, focusId);
  if (!focus) return model;
  // Insight is allowed on the last closed node, once nothing is left open.
  if (focus.status === "closed" && input.action !== "insight") return model;
  const action = focus.actions.find((row) => row.id === input.action);
  const step = model.step + 1;
  let branches = model.branches.map((branch) => ({ ...branch, actions: branch.actions.map((row) => ({ ...row })) }));
  const seen = new Set(model.boardNotes.map((note) => note.key));
  const notes: SessionBranchNote[] = [];

  if (input.action === "try") {
    branches = branches.map((branch) =>
      branch.id === focus.id ? { ...branch, status: "closed" } : branch,
    );
    const childIds = branches
      .filter((branch) => branch.parentId === focus.id && branch.status === "latent")
      .map((branch) => branch.id);
    branches = openLatent(branches, childIds);
  } else if (input.action === "hold") {
    const child = branches.find((branch) => branch.parentId === focus.id && branch.status === "latent");
    if (child) branches = openLatent(branches, [child.id]);
  } else if (input.action === "drop") {
    const sibling = branches.find(
      (branch) => branch.parentId === focus.parentId && branch.id !== focus.id && branch.status === "latent",
    );
    if (sibling) branches = openLatent(branches, [sibling.id]);
  }

  const prepared =
    action?.observation?.trim() ||
    action?.leads?.trim() ||
    `The next observation on ${focus.title} is ready.`;
  const actionNote = noteFor(`${focus.id}:${input.action}:${step}`, prepared, seen);
  if (actionNote) notes.push(actionNote);
  for (const branch of branches) {
    if (branch.status !== "open") continue;
    const opened = noteFor(branch.id, branch.observation, seen);
    if (opened && !model.boardNotes.some((note) => note.key === opened.key)) notes.push(opened);
  }

  const nextFocus =
    branches.find((branch) => branch.status === "open" && branch.parentId === focus.id)?.id ||
    branches.find((branch) => branch.status === "open" && branch.depth >= focus.depth && branch.id !== focus.id)?.id ||
    branches.find((branch) => branch.status === "open")?.id ||
    focus.id;

  return {
    ...model,
    step,
    focusId: input.action === "try" ? nextFocus : focus.id,
    branches,
    boardNotes: [...model.boardNotes, ...notes],
  };
}

/**
 * Add branches that arrived after the session opened.
 * Status, focus, and notes already on the live tree stay.
 * A latent child of a node the learner already closed opens, because Close asked for that ring.
 * Every new branch places its observation, including ones that stay latent, so a later slice
 * reaches the board without an action press.
 */
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
    return { ...born, status, actions: born.actions.map((action) => ({ ...action })) };
  });
  const focusId = branches.some((branch) => branch.id === live.focusId) ? live.focusId : incoming.focusId;
  return { ...live, focusId, branches, boardNotes: notes };
}

/** The live tree wins once the learner has moved. A fuller birth tree replaces an untouched one. */
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

export const SESSION_BRANCH_MODEL_SCHEMA = {
  name: "session_branch_field",
  strict: true,
  schema: {
    type: "object" as const,
    additionalProperties: false,
    required: [
      "premise",
      "closePrice",
      "keepPrice",
      "discardPrice",
      "insightPrice",
      "closeLeads",
      "keepLeads",
      "discardLeads",
      "insightLeads",
      "closeObservation",
      "keepObservation",
      "discardObservation",
      "insightObservation",
      "regions",
    ],
    properties: {
      premise: { type: "string" },
      closePrice: { type: "number" },
      keepPrice: { type: "number" },
      discardPrice: { type: "number" },
      insightPrice: { type: "number" },
      closeLeads: { type: "string" },
      keepLeads: { type: "string" },
      discardLeads: { type: "string" },
      insightLeads: { type: "string" },
      closeObservation: { type: "string" },
      keepObservation: { type: "string" },
      discardObservation: { type: "string" },
      insightObservation: { type: "string" },
      regions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "territory",
            "observation",
            "closePrice",
            "keepPrice",
            "discardPrice",
            "insightPrice",
            "closeLeads",
            "keepLeads",
            "discardLeads",
            "insightLeads",
            "closeObservation",
            "keepObservation",
            "discardObservation",
            "insightObservation",
            "avenues",
          ],
          properties: {
            title: { type: "string" },
            territory: { type: "string" },
            observation: { type: "string" },
            closePrice: { type: "number" },
            keepPrice: { type: "number" },
            discardPrice: { type: "number" },
            insightPrice: { type: "number" },
            closeLeads: { type: "string" },
            keepLeads: { type: "string" },
            discardLeads: { type: "string" },
            insightLeads: { type: "string" },
            closeObservation: { type: "string" },
            keepObservation: { type: "string" },
            discardObservation: { type: "string" },
            insightObservation: { type: "string" },
            avenues: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "title",
                  "territory",
                  "observation",
                  "closePrice",
                  "keepPrice",
                  "discardPrice",
                  "insightPrice",
                  "closeLeads",
                  "keepLeads",
                  "discardLeads",
                  "insightLeads",
                  "closeObservation",
                  "keepObservation",
                  "discardObservation",
                  "insightObservation",
                  "inquiries",
                ],
                properties: {
                  title: { type: "string" },
                  territory: { type: "string" },
                  observation: { type: "string" },
                  closePrice: { type: "number" },
                  keepPrice: { type: "number" },
                  discardPrice: { type: "number" },
                  insightPrice: { type: "number" },
                  closeLeads: { type: "string" },
                  keepLeads: { type: "string" },
                  discardLeads: { type: "string" },
                  insightLeads: { type: "string" },
                  closeObservation: { type: "string" },
                  keepObservation: { type: "string" },
                  discardObservation: { type: "string" },
                  insightObservation: { type: "string" },
                  inquiries: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "title",
                        "territory",
                        "observation",
                        "closePrice",
                        "keepPrice",
                        "discardPrice",
                        "insightPrice",
                        "closeLeads",
                        "keepLeads",
                        "discardLeads",
                        "insightLeads",
                        "closeObservation",
                        "keepObservation",
                        "discardObservation",
                        "insightObservation",
                      ],
                      properties: {
                        title: { type: "string" },
                        territory: { type: "string" },
                        observation: { type: "string" },
                        closePrice: { type: "number" },
                        keepPrice: { type: "number" },
                        discardPrice: { type: "number" },
                        insightPrice: { type: "number" },
                        closeLeads: { type: "string" },
                        keepLeads: { type: "string" },
                        discardLeads: { type: "string" },
                        insightLeads: { type: "string" },
                        closeObservation: { type: "string" },
                        keepObservation: { type: "string" },
                        discardObservation: { type: "string" },
                        insightObservation: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export function sessionBranchModelPrompt(input: { chapterTitle: string; chapterBrief?: string | null }): string {
  const brief = textOf(input.chapterBrief);
  return [
    `Prepare the working field for a session on "${textOf(input.chapterTitle, "this chapter")}".`,
    brief ? `Chapter material:\n${brief}` : "",
    `This is a landscape of inquiry, not a short quiz and not a three-step maze.`,
    `Write ${SESSION_BRANCH_REGION_COUNT} regions.`,
    `Under every region write ${SESSION_BRANCH_AVENUE_COUNT} avenues.`,
    `Under every avenue write ${SESSION_BRANCH_INQUIRY_COUNT} inquiries.`,
    "Every node needs its own territory, a board observation of one or two sentences, and four actions: close, keep, discard, and insight.",
    "Price each action from 0 to 100. A lower price is the better next policy for that node.",
    "Close should be cheap when the observation would settle that node, and expensive when the node is still only a hunch.",
    "Keep should be cheap when the node needs a further observation before it can be settled.",
    "Discard should be cheap when the node is a dead end and another avenue should be opened.",
    "Insight should be expensive on early nodes and cheaper only where the territory is already settled.",
    "leads says where that action takes the learner next, in one sentence.",
    "observation on an action is the new text that action would place on the board, one or two sentences, specific to this chapter.",
    "The regions must cover different parts of the chapter. Avenues under one region must diverge. Inquiries must go further into that avenue, not repeat its title.",
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
    const made = convertIleWorkCanvasSkeletons(
      [
        {
          type: "text",
          id: `branch-note-${note.key}`,
          text: note.text,
          x: originX + column * 340,
          y: originY + row * 280,
          width: 300,
          strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
          customData: { sessionBranchNote: note.key },
        },
      ],
      { regenerateIds: false },
    );
    return made;
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
