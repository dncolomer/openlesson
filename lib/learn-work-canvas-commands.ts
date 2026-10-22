/**
 * Work-canvas command catalog and slash drafts. Prompt text for those commands lives with the other prompts.
 */
export const ILE_SELECTIVE_COMPRESSION_LABEL = "Compress";
export const ILE_WORK_CANVAS_OVERLAP_GAP = 16;

export const ILE_WORK_CANVAS_COMMANDS = [
  {
    id: "focus",
    label: "Focus",
    tooltip: "Place the harness next step onto the canvas as a note.",
    shortcut: "f",
    needsSelection: false,
    learnOnly: true,
  },
  {
    id: "simplify",
    label: "Simplify",
    tooltip: "Replace the selected marks with a shorter, plainer rewrite.",
    shortcut: "s",
    needsSelection: true,
    learnOnly: false,
  },
  {
    id: "split",
    label: "Split",
    tooltip: "Break the selected text into two or three separate blocks on the canvas.",
    shortcut: "x",
    needsSelection: true,
    learnOnly: false,
  },
  {
    id: "answer",
    label: "Answer",
    tooltip: "Answer the highlighted question and place the reply beside it.",
    shortcut: "a",
    needsSelection: true,
    learnOnly: false,
  },
  {
    id: "draw",
    label: "Draw",
    tooltip: "Give a visual answer: a diagram of the highlighted question.",
    shortcut: "d",
    needsSelection: true,
    learnOnly: false,
  },
  {
    id: "refactor",
    label: "Refactor",
    tooltip: "Delete the selected marks and replace them with a clearer rewrite.",
    shortcut: "r",
    needsSelection: true,
    learnOnly: false,
  },
] as const;

export type IleWorkCanvasCommandId = (typeof ILE_WORK_CANVAS_COMMANDS)[number]["id"];

export type IleWorkCanvasAskKind =
  | "ask"
  | "answer"
  | "draw"
  | "simplify"
  | "check"
  | "selective-compress"
  | "refactor"
  | "suggest-insight"
  | "clear-overlaps"
  | "declutter";

export const ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT = "l";
export const ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL = "Auto layout";
export const ILE_WORK_CANVAS_AUTO_LAYOUT_TOOLTIP =
  "After each command or reply, rearrange the whole board so marks do not overlap.";
export const ILE_WORK_CANVAS_CHEATSHEET_LABEL = "Command cheat sheet";

export type IleWorkCanvasCommandDef = (typeof ILE_WORK_CANVAS_COMMANDS)[number];

/** Learn includes Focus. Verify and the leftover TAP dock do not. */
export function ileWorkCanvasCommandsFor(
  guide: string | null | undefined,
): IleWorkCanvasCommandDef[] {
  if (guide === "learn") return [...ILE_WORK_CANVAS_COMMANDS];
  return ILE_WORK_CANVAS_COMMANDS.filter((command) => !command.learnOnly);
}

export function ileWorkCanvasCommandShortcutLabel(shortcut: string | null | undefined): string {
  const key = String(shortcut || "").trim();
  if (!key) return "";
  return `Alt+${key.toUpperCase()}`;
}

export function ileWorkCanvasCommandByShortcut(
  key: string | null | undefined,
  guide?: string | null,
): IleWorkCanvasCommandDef | null {
  const letter = String(key || "")
    .trim()
    .toLowerCase();
  if (!letter) return null;
  return ileWorkCanvasCommandsFor(guide).find((command) => command.shortcut === letter) ?? null;
}

export function ileWorkCanvasCommandNeedsSelection(id: string | null | undefined): boolean {
  const command = ILE_WORK_CANVAS_COMMANDS.find((row) => row.id === id);
  return command ? command.needsSelection : Boolean(String(id || "").trim());
}

export function filterIleWorkCanvasCommands(
  query: string | null | undefined,
  guide?: string | null,
) {
  const catalog = ileWorkCanvasCommandsFor(guide);
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return catalog;
  return catalog.filter((command) => {
    const label = command.label.toLowerCase();
    const compact = label.replace(/[\s/]+/g, "");
    const dashed = label.replace(/[\s/]+/g, "-");
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
        label.replace(/[\s/]+/g, "") === head ||
        label.replace(/[\s/]+/g, "-") === head
      );
    }) ?? (head && matches.length === 1 ? matches[0] : null);
  return { slash: true, query: head, rest, exactId: exact?.id ?? null };
}
