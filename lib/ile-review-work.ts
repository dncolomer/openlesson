/**
 * Review work: inspect unsubmitted PoW by resource type (same icons as the top bar).
 */
import {
  ILE_POW_DISPLAY_COUNTER_TYPES,
  type IlePowDisplayCounterType,
} from "@/lib/ile-pow-counters";

export const ILE_REVIEW_WORK_LABEL = "Review work";
export const ILE_REVIEW_WORK_TOOL = "thought-history" as const;

export type IleReviewWorkThought = {
  id: string;
  text?: string | null;
};

export type IleReviewWorkItem = {
  id: string;
  type: IlePowDisplayCounterType;
  label: string;
  detail?: string;
  live?: boolean;
};

export type IleReviewWorkItemsByType = Record<IlePowDisplayCounterType, IleReviewWorkItem[]>;

export function emptyIleReviewWorkItems(): IleReviewWorkItemsByType {
  return {
    tool: [],
    screen: [],
    video: [],
    eeg: [],
    thoughts: [],
  };
}

function clipDetail(value: string, max = 280): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** Unsubmitted items the Review work widget can inspect, grouped by PoW type. */
export function listIleUnsubmittedReviewItems(input: {
  thoughts?: readonly IleReviewWorkThought[] | null;
  formingText?: string | null;
  notebookDirty?: boolean;
  notebookContent?: string | null;
  canvasDirty?: boolean;
}): IleReviewWorkItemsByType {
  const items = emptyIleReviewWorkItems();
  const forming = String(input.formingText || "").replace(/\s+/g, " ").trim();
  if (forming) {
    items.thoughts.push({
      id: "forming-speech",
      type: "thoughts",
      label: "Forming speech",
      detail: clipDetail(forming),
      live: true,
    });
  }
  for (const thought of input.thoughts ?? []) {
    const id = String(thought?.id || "").trim();
    const text = String(thought?.text || "").replace(/\s+/g, " ").trim();
    if (!id || !text) continue;
    items.thoughts.push({
      id,
      type: "thoughts",
      label: clipDetail(text, 80),
      detail: clipDetail(text),
    });
  }
  if (input.canvasDirty) {
    items.tool.push({
      id: "canvas",
      type: "tool",
      label: "Canvas",
      detail: "Unsubmitted drawing",
    });
  }
  if (input.notebookDirty) {
    const notes = String(input.notebookContent || "").trim();
    items.tool.push({
      id: "notebook",
      type: "tool",
      label: "Notebook",
      detail: notes ? clipDetail(notes) : "Unsubmitted notes",
    });
  }
  return items;
}

export function ileReviewWorkItemCount(
  items: IleReviewWorkItemsByType,
  type: IlePowDisplayCounterType,
): number {
  return items[type]?.length ?? 0;
}
