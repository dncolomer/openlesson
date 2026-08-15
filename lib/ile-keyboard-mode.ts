/**
 * Learning vs Project keyboard / PoW logging — not a capture-phase interceptor
 * and not a setState updater side effect.
 */

export type IleThoughtKeyboardMode = "helios" | "project";

export type IleKeyboardAction = "helios_send" | "helios_stash" | "project_submit" | "project_stash" | "ignore";

export function decideIleKeyboardAction(input: {
  mode: IleThoughtKeyboardMode;
  key: string;
}): IleKeyboardAction {
  const key = input.key;
  if (input.mode === "project") {
    if (key === "Enter") return "project_submit";
    if (key === "Delete" || key === "Backspace") return "project_stash";
    return "ignore";
  }
  if (key === "Enter") return "helios_send";
  if (key === "Delete" || key === "Backspace") return "helios_stash";
  return "ignore";
}

/** PoW / traces must be logged after state commits, not inside a setState updater. */
export function shouldLogIlePowInsideSetState(): boolean {
  return false;
}
