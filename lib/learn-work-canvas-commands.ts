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
    replacesSelection: false,
  },
  {
    id: "simplify",
    label: "Simplify",
    tooltip: "Replace the selected marks with a shorter, plainer rewrite.",
    shortcut: "s",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: true,
  },
  {
    id: "split",
    label: "Split",
    tooltip: "Break the selected text into two or three separate blocks on the canvas.",
    shortcut: "x",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "breakdown",
    label: "Breakdown",
    tooltip: "Keep the original mark and fan its parts into smaller nodes, linked with arrows.",
    shortcut: "b",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "concepts",
    label: "Concepts",
    tooltip: "Keep the original and fan its named concepts into linked nodes.",
    shortcut: "c",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "define",
    label: "Define",
    tooltip: "Keep the original and place a clean, simple definition beside it.",
    shortcut: "e",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "answer",
    label: "Answer",
    tooltip: "Answer the highlighted question and place the reply beside it.",
    shortcut: "a",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "draw",
    label: "Draw",
    tooltip: "Give a visual answer: a diagram of the highlighted question.",
    shortcut: "d",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: false,
  },
  {
    id: "refactor",
    label: "Refactor",
    tooltip: "Delete the selected marks and replace them with a clearer rewrite.",
    shortcut: "r",
    needsSelection: true,
    learnOnly: false,
    replacesSelection: true,
  },
] as const;

export type IleWorkCanvasCommandId = (typeof ILE_WORK_CANVAS_COMMANDS)[number]["id"];

export type IleWorkCanvasAskKind =
  | "ask"
  | "answer"
  | "draw"
  | "simplify"
  | "concepts"
  | "define"
  | "check"
  | "selective-compress"
  | "refactor"
  | "suggest-insight"
  | "clear-overlaps"
  | "declutter";

export const ILE_WORK_CANVAS_AUTO_LAYOUT_SHORTCUT = "l";
export const ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL = "Auto layout";
export const ILE_WORK_CANVAS_AUTO_LAYOUT_TOOLTIP =
  "Toggle: after each command or reply, space loose notes so they do not overlap. Drawings, groups, and linked diagrams stay together.";
export const ILE_WORK_CANVAS_CHEATSHEET_LABEL = "Command cheat sheet";

export type IleWorkCanvasCommandDef = (typeof ILE_WORK_CANVAS_COMMANDS)[number];

/** Learn includes Focus. Verify and the leftover TAP dock do not. */
export function ileWorkCanvasCommandsFor(
  guide: string | null | undefined,
): IleWorkCanvasCommandDef[] {
  if (guide === "learn") return [...ILE_WORK_CANVAS_COMMANDS];
  return ILE_WORK_CANVAS_COMMANDS.filter((command) => !command.learnOnly);
}

export const ILE_WORK_CANVAS_SHORTCUT_MOD_HINT =
  "On a MacBook, hold Option (⌥) and the letter. The same modifier is Alt on other keyboards.";

export function ileWorkCanvasCommandShortcutKey(shortcut: string | null | undefined): string {
  return String(shortcut || "").trim().toUpperCase();
}

export function ileWorkCanvasCommandShortcutAppleLabel(shortcut: string | null | undefined): string {
  const key = ileWorkCanvasCommandShortcutKey(shortcut);
  return key ? `⌥${key}` : "";
}

export function ileWorkCanvasCommandShortcutAltLabel(shortcut: string | null | undefined): string {
  const key = ileWorkCanvasCommandShortcutKey(shortcut);
  return key ? `Alt+${key}` : "";
}

export function ileWorkCanvasCommandShortcutLabel(shortcut: string | null | undefined): string {
  const apple = ileWorkCanvasCommandShortcutAppleLabel(shortcut);
  const alt = ileWorkCanvasCommandShortcutAltLabel(shortcut);
  if (!apple) return "";
  return `${apple} / ${alt}`;
}

/** Option/Alt letter from a keydown. Prefer `code` so Mac Option does not send å/ƒ/ß. */
export function ileWorkCanvasCommandShortcutKeyFromEvent(event: {
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  code?: string;
  key?: string;
}): string | null {
  if (!event.altKey || event.metaKey || event.ctrlKey) return null;
  const fromCode = /^Key([A-Z])$/i.exec(String(event.code || ""));
  if (fromCode) return fromCode[1]!.toLowerCase();
  const key = String(event.key || "").toLowerCase();
  return /^[a-z]$/.test(key) ? key : null;
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

/** True when the command drops the original marks before the model reply lands. */
export function ileWorkCanvasCommandReplacesSelection(id: string | null | undefined): boolean {
  return Boolean(ILE_WORK_CANVAS_COMMANDS.find((row) => row.id === id)?.replacesSelection);
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
