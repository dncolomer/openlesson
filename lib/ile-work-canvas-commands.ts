/**
 * Work-canvas command catalog and slash drafts. Prompt text for those commands lives with the other prompts.
 */
export const ILE_SELECTIVE_COMPRESSION_LABEL = "Compress";
export const ILE_WORK_CANVAS_OVERLAP_GAP = 16;

export const ILE_WORK_CANVAS_COMMANDS = [
  {
    id: "answer",
    label: "Answer",
    tooltip: "Answer the question texts you selected on the canvas.",
  },
  {
    id: "simplify",
    label: "Simplify",
    tooltip: "Rewrite the selected text in shorter, plainer sentences.",
  },
  {
    id: "ask",
    label: "Ask",
    tooltip: "Ask by voice. You can type the question instead.",
  },
  {
    id: "rephrase",
    label: "Rephrase",
    tooltip:
      "Ask XAI to rewrite the selected marks in different words while keeping the same meaning.",
  },
  {
    id: "split",
    label: "Split",
    tooltip: "Break the selected text into two or three separate blocks on the canvas.",
  },
  {
    id: "join",
    label: "Join",
    tooltip: "Join the selected elements into one text block, or one group when they have no text.",
  },
  {
    id: "elaborate",
    label: "Elaborate",
    tooltip: "Ask XAI to expand the selected marks with more concrete detail on this topic.",
  },
  {
    id: "selective-compression",
    label: "Compress",
    tooltip:
      "Ask XAI for one dense summary of the selected marks and replace only those marks with it.",
  },
  {
    id: "refactor",
    label: "Refactor",
    tooltip:
      "Ask XAI to rephrase the selected marks and rearrange those marks into a clearer layout.",
  },
  {
    id: "suggest-insight",
    label: "Suggest Insight",
    tooltip:
      "Ask XAI to add one new mark suggesting an insight from the selection, without saving it.",
  },
  {
    id: "clear-overlaps",
    label: "Clear overlaps",
    tooltip: "Move the selected marks so their boxes no longer touch. Layout only.",
  },
] as const;

export type IleWorkCanvasCommandId = (typeof ILE_WORK_CANVAS_COMMANDS)[number]["id"];

export type IleWorkCanvasAskKind =
  | "ask"
  | "answer"
  | "simplify"
  | "selective-compress"
  | "refactor"
  | "suggest-insight"
  | "clear-overlaps";

/** Ask can run with no selection. Every other command uses the selected marks. */
export function ileWorkCanvasCommandNeedsSelection(id: string | null | undefined): boolean {
  return String(id || "").trim() !== "ask";
}

export function filterIleWorkCanvasCommands(query: string | null | undefined) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [...ILE_WORK_CANVAS_COMMANDS];
  return ILE_WORK_CANVAS_COMMANDS.filter((command) => {
    const label = command.label.toLowerCase();
    const compact = label.replace(/\s+/g, "");
    const dashed = label.replace(/\s+/g, "-");
    return (
      command.id.startsWith(q) ||
      label.startsWith(q) ||
      compact.startsWith(q) ||
      dashed.startsWith(q)
    );
  });
}

/** Slash draft. `/ask what is force` is Ask plus the typed question. */
export function ileCanvasCommandDraft(raw: string | null | undefined): {
  slash: boolean;
  query: string;
  rest: string;
  exactId: IleWorkCanvasCommandId | null;
} {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed.startsWith("/")) {
    return { slash: false, query: "", rest: trimmed, exactId: null };
  }
  const body = trimmed.slice(1).trim();
  const space = body.search(/\s/);
  const head = (space === -1 ? body : body.slice(0, space)).toLowerCase();
  const rest = space === -1 ? "" : body.slice(space + 1).trim();
  const matches = filterIleWorkCanvasCommands(head);
  const exact =
    ILE_WORK_CANVAS_COMMANDS.find((command) => {
      const label = command.label.toLowerCase();
      return (
        command.id === head ||
        label === head ||
        label.replace(/\s+/g, "") === head ||
        label.replace(/\s+/g, "-") === head
      );
    }) ?? (head && matches.length === 1 ? matches[0] : null);
  return { slash: true, query: head, rest, exactId: exact?.id ?? null };
}
