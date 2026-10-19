/**
 * Helios tools for authoring a block unsys-model seed.
 * Local graph mutations are pure over SessionBranchModel.
 * generate_sample / generate_deeper run on the studio host via xAI.
 */

import {
  addAuthorUnsysBranch,
  cloneAuthorUnsysModel,
  inspectAuthorUnsysFocus,
  listAuthorUnsysHiddenStates,
  removeAuthorUnsysBranch,
  setAuthorUnsysBranchFields,
  setAuthorUnsysEdgePrice,
} from "@/lib/author-unsys-model";
import { sessionBranchById, type SessionBranchModel } from "@/lib/session-branch-model";

export const AUTHOR_UNSYS_HELIOS_TOOL_IDS = [
  "set_edge_price",
  "add_branch",
  "remove_branch",
  "edit_branch",
  "set_focus",
  "generate_sample",
  "generate_deeper",
] as const;

export const AUTHOR_UNSYS_HELIOS_HOST_TOOL_IDS = [
  "generate_sample",
  "generate_deeper",
] as const;

export type AuthorUnsysHeliosToolId = (typeof AUTHOR_UNSYS_HELIOS_TOOL_IDS)[number];

export type AuthorUnsysHeliosToolSpec = {
  id: AuthorUnsysHeliosToolId;
  title: string;
  description: string;
};

export const AUTHOR_UNSYS_HELIOS_TOOL_CATALOG: readonly AuthorUnsysHeliosToolSpec[] = [
  {
    id: "set_edge_price",
    title: "Set edge price",
    description:
      "Change the cost of travelling from a parent hidden state to a child. Arguments: fromId (or parent title), toId (or child title), price 0–100.",
  },
  {
    id: "add_branch",
    title: "Add branch",
    description:
      "Add a child hidden state. Arguments: parentId (or title), title, optional question, territory, observation, edgePrice.",
  },
  {
    id: "remove_branch",
    title: "Remove branch",
    description:
      "Remove a hidden state and its descendants. Arguments: branchId (or title). The root cannot be removed.",
  },
  {
    id: "edit_branch",
    title: "Edit branch",
    description:
      "Change a hidden state's title, question, observation, or territory. Arguments: branchId (or title), optional title, question, observation, territory.",
  },
  {
    id: "set_focus",
    title: "Set focus",
    description: "Focus the graph on a hidden state. Arguments: branchId (or title).",
  },
  {
    id: "generate_sample",
    title: "Generate sample",
    description:
      "Write the first ring of the graph with xAI. xAI chooses how many children, between 2 and 8. Replaces the working graph. No arguments.",
  },
  {
    id: "generate_deeper",
    title: "Generate deeper",
    description:
      "Grow children under a hidden state with xAI. Arguments: parentId (or title). Defaults to the selected node. xAI chooses how many children, between 2 and 8.",
  },
];

export const AUTHOR_UNSYS_HELIOS_OPENING =
  "How should a learner explore this block? Tell Helios to write the first ring, go deeper on a node, price a line, or add a branch.";

export const AUTHOR_UNSYS_HELIOS_PLACEHOLDER =
  "Ask Helios to work the graph…";

export const AUTHOR_UNSYS_HELIOS_EXAMPLES = [
  {
    id: "generate-opening",
    label: "Generate the first ring",
    prompt: "Generate the first ring of hidden states.",
  },
  {
    id: "cheap-edge",
    label: "Cheap edge to region 1",
    prompt:
      "Make the edge from the root to region 1 cheaper than the other opening edges.",
  },
  {
    id: "add-misconception",
    label: "Add a misconception branch",
    prompt:
      "Add a branch under the root for a common misconception, and make that edge expensive.",
  },
] as const;

export type AuthorUnsysHeliosToolCall = {
  name: AuthorUnsysHeliosToolId;
  args: Record<string, unknown>;
};

export type AuthorUnsysHeliosChatTurn = {
  reply: string;
  toolCalls: AuthorUnsysHeliosToolCall[];
};

export type AuthorUnsysHeliosApplyState = {
  model: SessionBranchModel;
  focusId: string;
};

export type AuthorUnsysHeliosStep = {
  name: AuthorUnsysHeliosToolId;
  ok: boolean;
  message: string;
};

export function isAuthorUnsysHeliosToolId(
  value: unknown,
): value is AuthorUnsysHeliosToolId {
  return (
    typeof value === "string" &&
    (AUTHOR_UNSYS_HELIOS_TOOL_IDS as readonly string[]).includes(value)
  );
}

export function authorUnsysHeliosToolAwarenessText(
  catalog: readonly AuthorUnsysHeliosToolSpec[] = AUTHOR_UNSYS_HELIOS_TOOL_CATALOG,
): string {
  const lines = catalog.map((tool) => `- ${tool.id}: ${tool.title}. ${tool.description}`);
  return [
    "HELIOS UNSYS SEED TOOLS",
    "Helios works the unsys graph for the selected block the way it works a Learning Map: mutate the live graph with tools.",
    "SELECTED NODE is the current context. Prefer mutating that node unless the author names another.",
    "If there is no graph yet, call generate_sample.",
    "generate_sample writes the first ring. generate_deeper grows children under a node.",
    "Call tools. Do not tell the author which tab to click.",
    "Lower edge price is the better next hidden state from that parent.",
    "There is no action catalog. Travel is a priced parent-to-child edge.",
    ...lines,
  ].join("\n");
}

export function isAuthorUnsysHeliosHostTool(
  value: unknown,
): value is (typeof AUTHOR_UNSYS_HELIOS_HOST_TOOL_IDS)[number] {
  return (
    typeof value === "string" &&
    (AUTHOR_UNSYS_HELIOS_HOST_TOOL_IDS as readonly string[]).includes(value)
  );
}

export type AuthorUnsysHeliosSelectionChip = {
  key: string;
  label: string;
  hint: string;
};

export type AuthorUnsysHeliosSelectionContext = {
  active: boolean;
  chips: AuthorUnsysHeliosSelectionChip[];
  summary: string;
};

export function authorUnsysHeliosSelectionContext(
  model: SessionBranchModel | null | undefined,
  focusId?: string | null,
): AuthorUnsysHeliosSelectionContext {
  const focus = inspectAuthorUnsysFocus(model, focusId);
  if (!focus) {
    return {
      active: false,
      chips: [],
      summary: "No node selected",
    };
  }
  return {
    active: true,
    chips: [
      {
        key: focus.focusId,
        label: focus.hiddenState.title || focus.focusId,
        hint: `d${focus.hiddenState.depth}`,
      },
    ],
    summary: focus.hiddenState.title || focus.focusId,
  };
}

export function formatAuthorUnsysSelectionForPrompt(input: {
  model?: SessionBranchModel | null;
  focusId?: string | null;
}): string {
  const focus = inspectAuthorUnsysFocus(input.model, input.focusId);
  if (!focus) return "SELECTED NODE: none";
  const state = focus.hiddenState;
  return [
    "SELECTED NODE",
    `id: ${state.id}`,
    `title: ${state.title}`,
    `depth: ${state.depth}`,
    state.parentId ? `parent: ${state.parentId}` : "parent: (root)",
    `children: ${focus.childIds.join(", ") || "(none)"}`,
    `question: ${state.question || "(none)"}`,
    `edges: ${state.edges.map((edge) => `${edge.toId}=${edge.price}`).join(", ") || "(none)"}`,
  ].join("\n");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function recordFromUnknown(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return recordFromUnknown(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function parseAuthorUnsysHeliosToolCall(
  raw: unknown,
): AuthorUnsysHeliosToolCall | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const nestedFn =
    rec.function && typeof rec.function === "object"
      ? (rec.function as Record<string, unknown>)
      : null;
  const name = rec.name ?? rec.id ?? rec.tool ?? nestedFn?.name;
  if (!isAuthorUnsysHeliosToolId(name)) return null;
  const argsRaw = rec.arguments ?? rec.args ?? rec.payload ?? nestedFn?.arguments;
  const args = { ...(recordFromUnknown(argsRaw) || {}) };
  for (const [key, value] of Object.entries(rec)) {
    if (
      key === "name" ||
      key === "id" ||
      key === "tool" ||
      key === "arguments" ||
      key === "args" ||
      key === "payload" ||
      key === "function"
    ) {
      continue;
    }
    if (!(key in args)) args[key] = value;
  }
  return { name, args };
}

export function parseAuthorUnsysHeliosChatTurn(
  raw: unknown,
): AuthorUnsysHeliosChatTurn {
  if (!raw || typeof raw !== "object") return { reply: "", toolCalls: [] };
  const rec = raw as Record<string, unknown>;
  const reply = String(rec.reply ?? rec.explanation ?? rec.text ?? "").trim();
  const list = rec.toolCalls ?? rec.tool_calls ?? rec.tools;
  const toolCalls: AuthorUnsysHeliosToolCall[] = [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const parsed = parseAuthorUnsysHeliosToolCall(item);
      if (parsed) toolCalls.push(parsed);
    }
  }
  return { reply, toolCalls };
}

export function formatAuthorUnsysSeedForPrompt(input: {
  blockTitle: string;
  model?: SessionBranchModel | null;
  focusId?: string | null;
}): string {
  if (!input.model) {
    return [
      "CURRENT SEED",
      `Block: ${text(input.blockTitle) || "This block"}`,
      "No graph yet. Call generate_sample to write the first ring.",
    ].join("\n");
  }
  const focus = inspectAuthorUnsysFocus(input.model, input.focusId);
  const states = listAuthorUnsysHiddenStates(input.model);
  const lines = states.map((state) => {
    const prices = state.edges
      .map((edge) => `${edge.toId}=${edge.price}`)
      .join(", ");
    return `- ${state.id} [d${state.depth}${state.parentId ? ` parent=${state.parentId}` : ""}] ${state.title} :: ${prices || "(no edges)"}`;
  });
  return [
    `CURRENT SEED`,
    `Block: ${text(input.blockTitle) || input.model.chapterTitle || "This block"}`,
    `Focus: ${focus?.focusId || input.model.rootId}`,
    "Hidden states:",
    ...lines,
  ].join("\n");
}

export function resolveAuthorUnsysHeliosBranchId(
  model: SessionBranchModel,
  raw: unknown,
): string {
  const id = text(raw);
  if (!id) return "";
  if (sessionBranchById(model, id)) return id;
  const lower = id.toLowerCase();
  const matches = model.branches.filter(
    (branch) =>
      branch.id.toLowerCase() === lower || branch.title.toLowerCase() === lower,
  );
  return matches.length === 1 ? matches[0]!.id : "";
}

function dispatchOne(
  state: AuthorUnsysHeliosApplyState,
  call: AuthorUnsysHeliosToolCall,
): { state: AuthorUnsysHeliosApplyState; step: AuthorUnsysHeliosStep } {
  if (call.name === "set_focus") {
    const branchId = resolveAuthorUnsysHeliosBranchId(
      state.model,
      call.args.branchId ?? call.args.id ?? call.args.title,
    );
    if (!branchId) {
      return {
        state,
        step: { name: call.name, ok: false, message: "Unknown hidden state" },
      };
    }
    return {
      state: { ...state, model: cloneAuthorUnsysModel(state.model), focusId: branchId },
      step: { name: call.name, ok: true, message: `focus ${branchId}` },
    };
  }
  if (call.name === "set_edge_price") {
    const fromId = resolveAuthorUnsysHeliosBranchId(
      state.model,
      call.args.fromId ?? call.args.branchId ?? call.args.parentId ?? call.args.id,
    );
    const toId = resolveAuthorUnsysHeliosBranchId(
      state.model,
      call.args.toId ?? call.args.childId ?? call.args.to,
    );
    const price = Number(call.args.price ?? call.args.value);
    if (!fromId || !toId || !Number.isFinite(price)) {
      return {
        state,
        step: {
          name: call.name,
          ok: false,
          message: "Need a parent, a child, and a price",
        },
      };
    }
    const model = setAuthorUnsysEdgePrice(state.model, fromId, toId, price);
    return {
      state: { ...state, model },
      step: {
        name: call.name,
        ok: true,
        message: `${fromId}->${toId}=${Math.max(0, Math.min(100, Math.round(price)))}`,
      },
    };
  }
  if (call.name === "remove_branch") {
    const branchId = resolveAuthorUnsysHeliosBranchId(
      state.model,
      call.args.branchId ?? call.args.id ?? call.args.title,
    );
    if (!branchId) {
      return {
        state,
        step: { name: call.name, ok: false, message: "Unknown hidden state" },
      };
    }
    if (branchId === state.model.rootId) {
      return {
        state,
        step: { name: call.name, ok: false, message: "The root cannot be removed" },
      };
    }
    const parentId =
      sessionBranchById(state.model, branchId)?.parentId || state.model.rootId;
    const model = removeAuthorUnsysBranch(state.model, branchId);
    const focusId = sessionBranchById(model, state.focusId)
      ? state.focusId
      : parentId;
    return {
      state: { ...state, model, focusId },
      step: { name: call.name, ok: true, message: `removed ${branchId}` },
    };
  }
  if (call.name === "edit_branch") {
    const branchId = resolveAuthorUnsysHeliosBranchId(
      state.model,
      call.args.branchId ?? call.args.id ?? call.args.parentId,
    );
    if (!branchId) {
      return {
        state,
        step: { name: call.name, ok: false, message: "Unknown hidden state" },
      };
    }
    const model = setAuthorUnsysBranchFields(state.model, branchId, {
      ...(call.args.title !== undefined ? { title: text(call.args.title) } : {}),
      ...(call.args.question !== undefined
        ? { question: text(call.args.question) }
        : {}),
      ...(call.args.observation !== undefined
        ? { observation: text(call.args.observation) }
        : {}),
      ...(call.args.territory !== undefined
        ? { territory: text(call.args.territory) }
        : {}),
    });
    return {
      state: { ...state, model, focusId: branchId },
      step: { name: call.name, ok: true, message: `edited ${branchId}` },
    };
  }
  if (isAuthorUnsysHeliosHostTool(call.name)) {
    return {
      state,
      step: {
        name: call.name,
        ok: false,
        message: "Graph generation runs on the studio host",
      },
    };
  }
  const parentId = resolveAuthorUnsysHeliosBranchId(
    state.model,
    call.args.parentId ?? call.args.branchId ?? call.args.parent,
  );
  const title = text(call.args.title);
  if (!parentId || !title) {
    return {
      state,
      step: { name: call.name, ok: false, message: "Need a parent and a title" },
    };
  }
  const before = new Set(state.model.branches.map((branch) => branch.id));
  const model = addAuthorUnsysBranch(state.model, parentId, {
    title,
    question: text(call.args.question) || undefined,
    territory: text(call.args.territory) || undefined,
    observation: text(call.args.observation) || undefined,
    edgePrice:
      call.args.edgePrice != null ? Number(call.args.edgePrice) : undefined,
  });
  const added = model.branches.find((branch) => !before.has(branch.id));
  return {
    state: { ...state, model, focusId: added?.id || state.focusId },
    step: {
      name: call.name,
      ok: Boolean(added),
      message: added ? `added ${added.id}` : "Branch was not added",
    },
  };
}

export function applyAuthorUnsysHeliosTools(input: {
  model: SessionBranchModel;
  focusId?: string | null;
  calls: readonly AuthorUnsysHeliosToolCall[];
}): AuthorUnsysHeliosApplyState & { steps: AuthorUnsysHeliosStep[] } {
  let state: AuthorUnsysHeliosApplyState = {
    model: cloneAuthorUnsysModel(input.model),
    focusId:
      resolveAuthorUnsysHeliosBranchId(input.model, input.focusId) ||
      input.model.rootId,
  };
  const steps: AuthorUnsysHeliosStep[] = [];
  for (const call of input.calls) {
    const next = dispatchOne(state, call);
    state = next.state;
    steps.push(next.step);
  }
  return { ...state, steps };
}
