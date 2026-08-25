/**
 * ILE spoken “I'm done answering”: collect unflagged PoW, emit a System 2
 * end-of-chain-of-thought, send that chain, and flag included ids so a later
 * close does not re-expand them.
 */

export const ILE_IM_DONE_ANSWERING_LABEL = "I'm done answering";
export const ILE_END_OF_CHAIN_OF_THOUGHT_ACTION = "end_of_chain_of_thought" as const;

export type IleImDoneAnsweringThought = {
  id: string;
  text: string;
};

export type IleEndOfChainOfThoughtEvent = {
  traceType: "system2";
  action: typeof ILE_END_OF_CHAIN_OF_THOUGHT_ACTION;
  thoughtIds: string[];
  thoughtId?: string;
  text: string;
  combined: boolean;
};

function flaggedIdSet(
  flaggedIds: ReadonlySet<string> | readonly string[] | null | undefined,
): Set<string> {
  if (!flaggedIds) return new Set();
  return flaggedIds instanceof Set ? new Set(flaggedIds) : new Set(flaggedIds);
}

function normalizeDoneAnsweringText(text: string | null | undefined): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function collectUnflaggedIleDoneAnsweringPow<T extends IleImDoneAnsweringThought>(input: {
  thoughts: readonly T[] | null | undefined;
  flaggedIds?: ReadonlySet<string> | readonly string[] | null;
  formingText?: string | null;
}): {
  thoughts: T[];
  ids: string[];
  formingText: string;
  includesForming: boolean;
  text: string;
} {
  const flagged = flaggedIdSet(input.flaggedIds);
  const thoughts = (input.thoughts ?? []).filter((thought) => {
    if (!thought?.id || flagged.has(thought.id)) return false;
    return Boolean(normalizeDoneAnsweringText(thought.text));
  });
  const formingText = normalizeDoneAnsweringText(input.formingText);
  const includesForming = formingText.length > 0;
  const parts = thoughts.map((thought) => normalizeDoneAnsweringText(thought.text));
  if (includesForming) parts.push(formingText);
  return {
    thoughts,
    ids: thoughts.map((thought) => thought.id),
    formingText,
    includesForming,
    text: parts.join("\n"),
  };
}

export function flagIleDoneAnsweringConsumed(
  flaggedIds: ReadonlySet<string> | readonly string[] | null | undefined,
  consumedIds: readonly string[],
): Set<string> {
  const next = flaggedIdSet(flaggedIds);
  for (const id of consumedIds) {
    if (id) next.add(id);
  }
  return next;
}

export function composeIleEndOfChainOfThoughtEvent(input: {
  ids: readonly string[];
  text: string;
  includesForming: boolean;
}): IleEndOfChainOfThoughtEvent {
  const thoughtIds = [...input.ids];
  return {
    traceType: "system2",
    action: ILE_END_OF_CHAIN_OF_THOUGHT_ACTION,
    thoughtIds,
    thoughtId: thoughtIds.length === 1 ? thoughtIds[0] : undefined,
    text: input.text,
    combined: thoughtIds.length > 1 || (input.includesForming && thoughtIds.length > 0),
  };
}

export async function closeIleImDoneAnswering<T extends IleImDoneAnsweringThought>(input: {
  thoughts: readonly T[] | null | undefined;
  flaggedIds?: ReadonlySet<string> | readonly string[] | null;
  formingText?: string | null;
  sendThought: (text: string, thoughtIds: string[]) => void | Promise<void>;
  logEndOfChainOfThought: (event: IleEndOfChainOfThoughtEvent) => void;
  /** Wipe the live speech bar as soon as the close is collected — do not wait for Helios. */
  onClearForming?: () => void;
}): Promise<{
  submitted: boolean;
  ids: string[];
  text: string;
  flaggedIds: Set<string>;
  includesForming: boolean;
}> {
  const collected = collectUnflaggedIleDoneAnsweringPow(input);
  const flaggedIds = flaggedIdSet(input.flaggedIds);
  if (!collected.text) {
    return {
      submitted: false,
      ids: [],
      text: "",
      flaggedIds,
      includesForming: false,
    };
  }

  const event = composeIleEndOfChainOfThoughtEvent({
    ids: collected.ids,
    text: collected.text,
    includesForming: collected.includesForming,
  });
  input.logEndOfChainOfThought(event);
  input.onClearForming?.();
  await input.sendThought(collected.text, collected.ids);

  return {
    submitted: true,
    ids: collected.ids,
    text: collected.text,
    flaggedIds: flagIleDoneAnsweringConsumed(flaggedIds, collected.ids),
    includesForming: collected.includesForming,
  };
}
