/**
 * ILE Learning Mode compact stash + Thought-tool multi-select send/edit.
 * Lists are oldest → newest. Last stash is the newest remaining entry, never list[0].
 */

export const ILE_THOUGHT_HISTORY_TOOL = "thought-history" as const;

export const ILE_SUBMIT_LAST_THOUGHT_LABEL = "Submit last Thought";
export const ILE_SEE_OLDER_THOUGHTS_LABEL = "See Older Thoughts";
export const ILE_SUBMIT_SELECTION_LABEL = "Submit Selection";
export const ILE_EDIT_SELECTION_LABEL = "Edit Selection";

export type IleStashThought = {
  id: string;
  text: string;
};

export type IleSendThought = (text: string, thoughtIds: string[]) => void | Promise<void>;

function selectedIdSet(selectedIds: ReadonlySet<string> | readonly string[]): Set<string> {
  return selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
}

/** Empty → null; otherwise the newest entry (end of an oldest→newest list). */
export function selectLastStashedThought<T extends IleStashThought>(
  thoughts: readonly T[] | null | undefined,
): T | null {
  if (!thoughts || thoughts.length === 0) return null;
  return thoughts[thoughts.length - 1] ?? null;
}

/**
 * Selected bodies joined in list order (the array order, not click order).
 * Empty selection yields empty text / ids.
 */
export function combineSelectedThoughtText<T extends IleStashThought>(
  thoughts: readonly T[],
  selectedIds: ReadonlySet<string> | readonly string[],
): { text: string; ids: string[]; thoughts: T[] } {
  const idSet = selectedIdSet(selectedIds);
  const selected = thoughts.filter((thought) => idSet.has(thought.id));
  return {
    thoughts: selected,
    ids: selected.map((thought) => thought.id),
    text: selected.map((thought) => thought.text).join("\n"),
  };
}

export function openIleThoughtHistoryTool(
  setActiveTool: (tool: typeof ILE_THOUGHT_HISTORY_TOOL) => void,
): void {
  setActiveTool(ILE_THOUGHT_HISTORY_TOOL);
}

/** TAP conversation has no tools rail — open the in-chrome Thought Memory surface. */
export function openOlderThoughtsSurface(setOpen: (open: boolean) => void): void {
  setOpen(true);
}

export async function submitLastStashedThought<T extends IleStashThought>(input: {
  thoughts: readonly T[];
  sendThought: IleSendThought;
}): Promise<{ submitted: boolean; thought: T | null }> {
  const last = selectLastStashedThought(input.thoughts);
  if (!last?.text.trim()) return { submitted: false, thought: last };
  await input.sendThought(last.text, [last.id]);
  return { submitted: true, thought: last };
}

export async function submitSelectedThoughts<T extends IleStashThought>(input: {
  thoughts: readonly T[];
  selectedIds: ReadonlySet<string> | readonly string[];
  sendThought: IleSendThought;
}): Promise<{ submitted: boolean; text: string; ids: string[] }> {
  const combined = combineSelectedThoughtText(input.thoughts, input.selectedIds);
  if (!combined.text.trim() || combined.ids.length === 0) {
    return { submitted: false, text: "", ids: [] };
  }
  await input.sendThought(combined.text, combined.ids);
  return { submitted: true, text: combined.text, ids: combined.ids };
}

export function beginEditSelectedThoughts<T extends IleStashThought>(input: {
  thoughts: readonly T[];
  selectedIds: ReadonlySet<string> | readonly string[];
}): { draft: string; originalText: string; thoughtIds: string[] } | null {
  const combined = combineSelectedThoughtText(input.thoughts, input.selectedIds);
  if (!combined.text.trim() || combined.ids.length === 0) return null;
  return {
    draft: combined.text,
    originalText: combined.text,
    thoughtIds: combined.ids,
  };
}

export async function submitEditedThoughtSelection(input: {
  draft: string;
  thoughtIds: readonly string[];
  sendThought: IleSendThought;
}): Promise<{ submitted: boolean; text: string }> {
  const text = String(input.draft || "").trim();
  if (!text) return { submitted: false, text: "" };
  await input.sendThought(text, [...input.thoughtIds]);
  return { submitted: true, text };
}
