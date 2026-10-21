/**
 * Canvas side of Keep and Discard.
 * Keep locks the selection and draws one dashed frame around it.
 * Discard marks that selection deleted, including a Keep frame grouped with it.
 */

import {
  convertIleWorkCanvasSkeletons,
  ILE_WORK_CANVAS_STROKE_COLOR,
  ileWorkCanvasContentBounds,
  type IleWorkCanvasElement,
} from "@/lib/learn-work-canvas";
import {
  advanceSessionBranchModel,
  appendSessionBranchNotes,
  recommendSessionBranchAction,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import type { SessionMarkButtonId } from "@/lib/session-marks";

export const SESSION_MARK_KEPT_KEY = "sessionMarkKept";
export const SESSION_MARK_ANCHOR_KEY = "sessionMarkAnchor";
export const SESSION_MARK_ANCHOR_PAD = 14;

/** Keep frames the selection. Discard removes it. Every press can advance the field. */
export type SessionMarkCanvasEffect = {
  kind: SessionMarkButtonId;
  branchId?: string | null;
};

function boundId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id : null;
}

function revise(
  element: IleWorkCanvasElement,
  patch: Partial<IleWorkCanvasElement>,
): IleWorkCanvasElement {
  return {
    ...element,
    ...patch,
    version: (Number(element.version) || 1) + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    updated: Date.now(),
  };
}

/** Selected marks, their labels, and any Keep frame already grouped with them. */
export function sessionMarkTargetIds(
  elements: readonly IleWorkCanvasElement[],
  selectedIds: readonly string[],
): string[] {
  const wanted = new Set(selectedIds.map((id) => id.trim()).filter(Boolean));
  if (wanted.size === 0) return [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const element of elements) {
      if (!element.id || element.isDeleted) continue;
      if (wanted.has(element.id)) {
        for (const bound of element.boundElements ?? []) {
          const id = boundId(bound);
          if (id && !wanted.has(id)) {
            wanted.add(id);
            grew = true;
          }
        }
      }
      const containerId = typeof element.containerId === "string" ? element.containerId : "";
      if (containerId && wanted.has(containerId) && !wanted.has(element.id)) {
        wanted.add(element.id);
        grew = true;
      }
    }
  }
  const groups = new Set<string>();
  for (const element of elements) {
    if (!wanted.has(element.id)) continue;
    for (const groupId of element.groupIds ?? []) {
      if (groupId.startsWith("session-kept-")) groups.add(groupId);
    }
  }
  if (groups.size > 0) {
    for (const element of elements) {
      if (!element.id || element.isDeleted) continue;
      if ((element.groupIds ?? []).some((groupId) => groups.has(groupId))) wanted.add(element.id);
    }
  }
  return [...wanted];
}

export function discardSessionMarkSelection(
  elements: readonly IleWorkCanvasElement[],
  selectedIds: readonly string[],
): { elements: IleWorkCanvasElement[]; removedIds: string[] } {
  const removed = new Set(sessionMarkTargetIds(elements, selectedIds));
  if (removed.size === 0) return { elements: elements.map((element) => ({ ...element })), removedIds: [] };
  return {
    removedIds: [...removed],
    elements: elements.map((element) =>
      removed.has(element.id) && !element.isDeleted ? revise(element, { isDeleted: true }) : { ...element },
    ),
  };
}

function isAnchor(element: IleWorkCanvasElement): boolean {
  return element.customData?.[SESSION_MARK_ANCHOR_KEY] === true;
}

function isKeptMark(element: IleWorkCanvasElement): boolean {
  return element.locked === true && element.customData?.[SESSION_MARK_KEPT_KEY] === true;
}

export function anchorSessionMarkSelection(
  elements: readonly IleWorkCanvasElement[],
  selectedIds: readonly string[],
): { elements: IleWorkCanvasElement[]; anchoredIds: string[]; anchor: IleWorkCanvasElement | null } {
  const ids = sessionMarkTargetIds(elements, selectedIds);
  const marks = elements.filter((element) => ids.includes(element.id) && !element.isDeleted && !isAnchor(element));
  if (marks.length === 0) {
    return { elements: elements.map((element) => ({ ...element })), anchoredIds: [], anchor: null };
  }
  const existing = elements.find((element) => ids.includes(element.id) && isAnchor(element)) ?? null;
  if (marks.every(isKeptMark)) {
    return {
      elements: elements.map((element) => ({ ...element })),
      anchoredIds: ids,
      anchor: existing,
    };
  }
  const bounds = ileWorkCanvasContentBounds(marks);
  if (!bounds) {
    return { elements: elements.map((element) => ({ ...element })), anchoredIds: ids, anchor: existing };
  }
  const groupId = `session-kept-${marks.map((element) => element.id).sort().join("_")}`;
  const pad = SESSION_MARK_ANCHOR_PAD;
  const width = Math.max(24, bounds.maxX - bounds.minX + pad * 2);
  const height = Math.max(24, bounds.maxY - bounds.minY + pad * 2);
  const frame = convertIleWorkCanvasSkeletons(
    [
      {
        type: "rectangle",
        id: `session-anchor-${marks.map((element) => element.id).sort().join("_")}`,
        x: bounds.minX - pad,
        y: bounds.minY - pad,
        width,
        height,
        strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
        backgroundColor: "transparent",
        strokeStyle: "dashed",
        strokeWidth: 1,
        roughness: 0,
        locked: true,
        groupIds: [groupId],
        customData: { [SESSION_MARK_ANCHOR_KEY]: true },
      },
    ],
    { regenerateIds: false },
  )[0];
  if (!frame) {
    return { elements: elements.map((element) => ({ ...element })), anchoredIds: ids, anchor: null };
  }
  const marked = new Set(marks.map((element) => element.id));
  const next = elements.map((element) => {
    if (!ids.includes(element.id) || element.isDeleted) return { ...element };
    const groupIds = element.groupIds ?? [];
    return revise(element, {
      locked: true,
      groupIds: groupIds.includes(groupId) ? groupIds : [...groupIds, groupId],
      customData: isAnchor(element)
        ? element.customData ?? null
        : { ...(element.customData ?? {}), [SESSION_MARK_KEPT_KEY]: true },
    });
  });
  if (!marked.size) return { elements: next, anchoredIds: ids, anchor: existing };
  return {
    elements: [...next, frame],
    anchoredIds: [...ids, frame.id],
    anchor: frame,
  };
}

export type CommitSessionActionResult = {
  elements: IleWorkCanvasElement[];
  /** Set when Keep or Discard changed the selection. Close and Insight leave it alone. */
  selectedElementIds: Record<string, true> | null;
  anchor: IleWorkCanvasElement | null;
  added: IleWorkCanvasElement[];
  model: SessionBranchModel | null;
  changed: boolean;
};

/**
 * Keep frames a selection. Discard removes one. Either way, and with nothing
 * selected, the prepared field advances and the next observation is placed.
 * Without a field, only the selection edit runs.
 */
export function commitSessionAction(input: {
  elements: readonly IleWorkCanvasElement[];
  selectedIds: readonly string[];
  model: SessionBranchModel | null;
  action: SessionMarkButtonId;
  branchId?: string | null;
}): CommitSessionActionResult {
  const ids = input.selectedIds.map((id) => id.trim()).filter(Boolean);
  let elements: IleWorkCanvasElement[] = input.elements.map((element) => ({ ...element }));
  let selectedElementIds: Record<string, true> | null = null;
  let anchor: IleWorkCanvasElement | null = null;
  let selectionChanged = false;

  if (input.action === "hold" && ids.length > 0) {
    const kept = anchorSessionMarkSelection(input.elements, ids);
    if (kept.anchoredIds.length > 0) {
      elements = kept.elements;
      anchor = kept.anchor;
      selectedElementIds = Object.fromEntries(kept.anchoredIds.map((id) => [id, true as const]));
      selectionChanged = true;
    }
  } else if (input.action === "drop" && ids.length > 0) {
    const dropped = discardSessionMarkSelection(input.elements, ids);
    if (dropped.removedIds.length > 0) {
      elements = dropped.elements;
      selectedElementIds = {};
      selectionChanged = true;
    }
  }

  let model = input.model;
  let added: IleWorkCanvasElement[] = [];
  if (input.model) {
    const fromId = input.branchId || input.model.focusId;
    const recommended = recommendSessionBranchAction(input.model, fromId);
    const next = recommended
      ? advanceSessionBranchModel(input.model, { toId: recommended.toId, fromId })
      : input.model;
    if (next !== input.model) {
      model = next;
      const placed = appendSessionBranchNotes(elements, next.boardNotes);
      elements = placed.elements;
      added = placed.added;
    }
  }

  return {
    elements,
    selectedElementIds,
    anchor,
    added,
    model,
    changed: selectionChanged || added.length > 0 || model !== input.model,
  };
}
