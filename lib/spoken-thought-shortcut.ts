/**
 * Spoken live-bar shortcuts. Enter is not a submit — I'm done answering is.
 * Live-bar Edit / E is not a shortcut; edit lives on Thought Memory selection.
 */

export type SpokenCaptureKeyAction = "stash" | "cancel_edit" | "ignore";

export function decideSpokenCaptureKeyAction(input: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): SpokenCaptureKeyAction {
  if (input.altKey || input.metaKey || input.ctrlKey || input.shiftKey) return "ignore";
  const key = input.key;
  if (key === "Escape") return "cancel_edit";
  if (key === "Delete" || key === "Backspace") return "stash";
  return "ignore";
}
