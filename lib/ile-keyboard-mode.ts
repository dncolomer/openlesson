/**
 * Learning vs Project keyboard / PoW logging — not a capture-phase interceptor
 * and not a setState updater side effect.
 */

import { decideSpokenCaptureKeyAction } from "@/lib/spoken-thought-shortcut";

export type IleThoughtKeyboardMode = "helios" | "project";

export type IleKeyboardAction = "helios_send" | "helios_stash" | "project_submit" | "project_stash" | "ignore";

export function decideIleKeyboardAction(input: {
  mode: IleThoughtKeyboardMode;
  key: string;
}): IleKeyboardAction {
  void input.mode;
  const spoken = decideSpokenCaptureKeyAction({ key: input.key });
  if (spoken === "stash") return "helios_stash";
  return "ignore";
}
