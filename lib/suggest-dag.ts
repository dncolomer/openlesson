/**
 * Suggest DAG — pure helpers for xAI-backed leads-to graphs among a
 * multi-selected block set. No network I/O here.
 */

import {
  MULTI_BLOCK_DAG_MAX_BLOCKS,
  type MultiBlockDagDraft,
  type MultiBlockDagEdge,
} from "@/lib/multi-block-dag";

export type SuggestDagBlock = {
  id: string;
  title?: string | null;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  is_start?: boolean | null;
};

export type SuggestDagContext = {
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  blocks: readonly SuggestDagBlock[];
  currentEdges?: ReadonlyArray<{ from: string; to: string }>;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

export function normalizeSuggestDagBlockIds(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const id = clean(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MULTI_BLOCK_DAG_MAX_BLOCKS) break;
  }
  return out;
}

function resolveBlockRef(
  raw: unknown,
  idSet: Set<string>,
  titleToId: Map<string, string>,
): string {
  const token = clean(raw);
  if (!token) return "";
  if (idSet.has(token)) return token;
  const byTitle = titleToId.get(token.toLowerCase());
  return byTitle || "";
}

function collectRawEdges(raw: unknown): Array<{ from: unknown; to: unknown }> {
  if (!raw || typeof raw !== "object") return [];
  const rec = raw as Record<string, unknown>;
  const draft = rec.draft && typeof rec.draft === "object"
    ? (rec.draft as Record<string, unknown>)
    : null;
  const dag = rec.dag && typeof rec.dag === "object"
    ? (rec.dag as Record<string, unknown>)
    : null;
  const candidates = [
    rec.edges,
    rec.next,
    rec.links,
    draft?.edges,
    dag?.edges,
  ];
  for (const list of candidates) {
    if (!Array.isArray(list)) continue;
    return list.map((item) => {
      if (Array.isArray(item) && item.length >= 2) {
        return { from: item[0], to: item[1] };
      }
      if (!item || typeof item !== "object") return { from: "", to: "" };
      const e = item as Record<string, unknown>;
      return {
        from: e.from ?? e.from_id ?? e.source ?? e.src,
        to: e.to ?? e.to_id ?? e.target ?? e.dst,
      };
    });
  }
  return [];
}

/**
 * Turn a model/API payload into a leads-to draft among `blockIds` only.
 * Unknown, self, duplicate, and out-of-set edges are dropped.
 */
export function normalizeSuggestDagResponse(
  raw: unknown,
  blockIds: readonly string[],
  blocks: readonly SuggestDagBlock[] = [],
): MultiBlockDagDraft {
  const ids = normalizeSuggestDagBlockIds(blockIds);
  const idSet = new Set(ids);
  const titleToId = new Map<string, string>();
  for (const b of blocks) {
    const id = clean(b.id);
    const title = clean(b.title).toLowerCase();
    if (!id || !idSet.has(id) || !title) continue;
    if (!titleToId.has(title)) titleToId.set(title, id);
  }

  const edges: MultiBlockDagEdge[] = [];
  const seen = new Set<string>();
  for (const item of collectRawEdges(raw)) {
    const from = resolveBlockRef(item.from, idSet, titleToId);
    const to = resolveBlockRef(item.to, idSet, titleToId);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to, kind: "next" });
  }

  return { blockIds: ids, edges };
}

export function assembleSuggestDagXaiMessages(ctx: SuggestDagContext): {
  system: string;
  user: string;
} {
  const blocks = ctx.blocks
    .map((b) => ({
      id: clean(b.id),
      title: clip(clean(b.title) || "Untitled", 120),
      description: clip(clean(b.description), 240),
      col: typeof b.position_x === "number" ? b.position_x : null,
      row: typeof b.position_y === "number" ? b.position_y : null,
      is_start: Boolean(b.is_start),
    }))
    .filter((b) => b.id)
    .slice(0, MULTI_BLOCK_DAG_MAX_BLOCKS);

  const blockLines = blocks
    .map((b) => {
      const bits = [
        `id=${b.id}`,
        `title=${b.title}`,
        b.description ? `desc=${b.description}` : "",
        b.col != null && b.row != null ? `map=(c${b.col},r${b.row})` : "",
        b.is_start ? "starter=true" : "",
      ].filter(Boolean);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");

  const current = (ctx.currentEdges || [])
    .map((e) => `${clean(e.from)} -> ${clean(e.to)}`)
    .filter((line) => !line.startsWith(" ->") && !line.endsWith("-> "))
    .slice(0, 40)
    .join("\n");

  const title = clip(clean(ctx.workspaceTitle), 160) || "Workspace";
  const goal = clip(clean(ctx.workspaceGoal), 240);

  return {
    system: [
      "You propose a learning journey DAG among the given blocks only.",
      'Return JSON: { "edges": [{ "from": "<block id>", "to": "<block id>" }] }.',
      "Each edge is a leads-to link: from should be studied before to.",
      "Use only the provided block ids. No self-loops. Prefer an acyclic graph.",
      "Use starter blocks as likely sources. Map coordinates (col,row) may imply left-to-right or top-to-bottom order.",
      "Do not invent blocks. Omit weak or redundant links. A sparse correct graph is better than a dense one.",
    ].join(" "),
    user: [
      `Workspace: ${title}`,
      goal ? `Goal: ${goal}` : "",
      "Blocks:",
      blockLines || "(none)",
      current
        ? `Current leads-to edges (replace if a better journey exists):\n${current}`
        : "Current leads-to edges: none",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
