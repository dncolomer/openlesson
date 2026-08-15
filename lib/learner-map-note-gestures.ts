/**
 * Pointer live-box / commit math for learner map notes.
 * Kept out of learner-map-notes.ts so that module stays under 1k lines.
 */

import {
  LEARNER_NOTE_MIN_HEIGHT,
  LEARNER_NOTE_MIN_WIDTH,
  normalizeLearnerNoteHeight,
  normalizeLearnerNoteWidth,
} from "@/lib/learner-map-notes";

/** Live box while dragging/resizing (screen/world layer units). */
export type LearnerNoteGestureBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Pure pointer-move → live box for move/resize gestures (same math as post-it UI).
 * Callers store the result on a drag ref and commit from that ref on pointerup
 * (not from React state, which can lag).
 */
export function learnerNoteLiveBoxFromPointerMove(input: {
  kind: "move" | "resize";
  originLeft: number;
  originTop: number;
  originWidth: number;
  originHeight: number;
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  zoom: number;
}): LearnerNoteGestureBox {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  const dx = (input.clientX - input.startClientX) / zoom;
  const dy = (input.clientY - input.startClientY) / zoom;
  if (input.kind === "move") {
    return {
      left: input.originLeft + dx,
      top: input.originTop + dy,
      width: input.originWidth,
      height: input.originHeight,
    };
  }
  return {
    left: input.originLeft,
    top: input.originTop,
    width: Math.max(LEARNER_NOTE_MIN_WIDTH, input.originWidth + dx),
    height: Math.max(LEARNER_NOTE_MIN_HEIGHT, input.originHeight + dy),
  };
}

/**
 * Commit payload from the last gesture box stored on the drag ref (pointerup).
 */
export function learnerNoteCommitFromGestureBox(
  kind: "move" | "resize",
  box: LearnerNoteGestureBox,
):
  | { kind: "move"; x: number; y: number }
  | { kind: "resize"; width: number; height: number } {
  if (kind === "move") {
    return { kind: "move", x: box.left, y: box.top };
  }
  return {
    kind: "resize",
    width: normalizeLearnerNoteWidth(box.width),
    height: normalizeLearnerNoteHeight(box.height),
  };
}
