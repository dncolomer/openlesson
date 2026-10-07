import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionMarkControls } from "@/components/session-view/session-mark-controls";
import { convertIleWorkCanvasSkeletons, type IleWorkCanvasElement } from "@/lib/ile-work-canvas";
import {
  anchorSessionMarkSelection,
  commitSessionAction,
  discardSessionMarkSelection,
  SESSION_MARK_ANCHOR_KEY,
  SESSION_MARK_KEPT_KEY,
} from "@/lib/session-mark-canvas";
import { appendSessionBranchNotes, normalizeSessionBranchModel, type SessionBranchModel } from "@/lib/session-branch-model";
import type { SessionMarkButtonId } from "@/lib/session-marks";

function marks(): IleWorkCanvasElement[] {
  const [box, note, aside] = convertIleWorkCanvasSkeletons(
    [
      { type: "rectangle", id: "box", x: 10, y: 20, width: 80, height: 40 },
      { type: "text", id: "note", x: 14, y: 24, text: "harm stays smaller", width: 70 },
      { type: "rectangle", id: "aside", x: 200, y: 20, width: 40, height: 40 },
    ],
    { regenerateIds: false },
  );
  box!.boundElements = [{ type: "text", id: "note" }];
  note!.containerId = "box";
  return [box!, note!, aside!];
}

describe("session mark canvas", () => {
  it("discards the selection and a label bound to it", () => {
    const next = discardSessionMarkSelection(marks(), ["box"]);
    const byId = new Map(next.elements.map((element) => [element.id, element]));
    expect(byId.get("box")?.isDeleted).toBe(true);
    expect(byId.get("note")?.isDeleted).toBe(true);
    expect(byId.get("aside")?.isDeleted).toBeFalsy();
    expect(next.removedIds.sort()).toEqual(["box", "note"]);
  });

  it("keeps a selection by locking it inside one dashed frame", () => {
    const first = anchorSessionMarkSelection(marks(), ["box"]);
    const frame = first.elements.find((element) => element.customData?.[SESSION_MARK_ANCHOR_KEY] === true);
    expect(frame).toBeTruthy();
    expect(frame?.strokeStyle).toBe("dashed");
    expect(frame?.locked).toBe(true);
    const box = first.elements.find((element) => element.id === "box");
    const note = first.elements.find((element) => element.id === "note");
    const aside = first.elements.find((element) => element.id === "aside");
    expect(box?.locked).toBe(true);
    expect(box?.customData?.[SESSION_MARK_KEPT_KEY]).toBe(true);
    expect(note?.locked).toBe(true);
    expect(aside?.locked).toBeFalsy();
    const groupId = (box?.groupIds ?? []).find((id) => id.startsWith("session-kept-"));
    expect(groupId).toBeTruthy();
    expect(frame?.groupIds).toContain(groupId);
    expect(note?.groupIds).toContain(groupId);

    const again = anchorSessionMarkSelection(first.elements, ["box"]);
    const frames = again.elements.filter((element) => element.customData?.[SESSION_MARK_ANCHOR_KEY] === true);
    expect(frames).toHaveLength(1);

    const removed = discardSessionMarkSelection(first.elements, ["box"]);
    expect(removed.elements.filter((element) => !element.isDeleted).map((element) => element.id)).toEqual(["aside"]);
  });

  it("renders the four actions ready without a selection, and Learn still marks the lowest cost", () => {
    const idle = renderToStaticMarkup(
      createElement(SessionMarkControls, {
        mode: "learn",
        questions: [{ id: "chapter", text: "Just war" }],
        selectionActive: false,
        selectedTexts: [],
        speech: "",
      }),
    );
    for (const id of ["try", "hold", "drop", "insight"]) {
      const at = idle.indexOf(`data-session-mark="${id}"`);
      expect(at).toBeGreaterThan(-1);
      const button = idle.slice(at, idle.indexOf("</button>", at));
      expect(button).toContain('data-session-mark-disabled="false"');
      expect(button).not.toContain('disabled=""');
      expect(button).toContain("disabled:text-neutral-600");
      expect(button).toContain("w-full");
      expect(button).toContain("py-3");
    }
    expect(idle).toContain('data-session-mark-buttons');
    expect(idle).toContain("flex flex-col");
    expect(idle).not.toContain("grid-cols-2");
    const recommended = idle.slice(idle.indexOf('data-session-mark="try"'), idle.indexOf("</button>", idle.indexOf('data-session-mark="try"')));
    expect(recommended).toContain("(recommended)");
    expect(recommended).toContain('data-session-mark-recommended="true"');
    expect(idle.slice(idle.indexOf('data-session-mark="hold"'), idle.indexOf("</button>", idle.indexOf('data-session-mark="hold"')))).not.toContain("(recommended)");
    const live = renderToStaticMarkup(
      createElement(SessionMarkControls, {
        mode: "learn",
        questions: [{ id: "chapter", text: "Just war" }],
        selectionActive: true,
        selectedTexts: ["harm stays smaller"],
        speech: "",
      }),
    );
    const closeAt = live.indexOf('data-session-mark="try"');
    const close = live.slice(closeAt, live.indexOf("</button>", closeAt));
    expect(close).toContain('data-session-mark-disabled="false"');
    expect(close).not.toContain('disabled=""');
  });
});

function fieldModel(): SessionBranchModel {
  const model = normalizeSessionBranchModel(
    {
      premise: "The premise is on the board.",
      closePrice: 28,
      keepPrice: 4,
      discardPrice: 60,
      insightPrice: 80,
      closeObservation: "Closing the premise writes the next observation.",
      keepObservation: "Keeping the premise writes the next observation.",
      discardObservation: "Discarding the premise writes the next observation.",
      insightObservation: "Insight writes the next observation.",
      regions: [
        {
          title: "Region one",
          territory: "The first territory.",
          observation: "Region one is open.",
          closeObservation: "Closing the region writes the next observation.",
          keepObservation: "Keeping the region writes the next observation.",
          discardObservation: "Discarding the region writes the next observation.",
          insightObservation: "The insight names what this region settled.",
        },
      ],
    },
    "Just war",
  );
  if (!model) throw new Error("fixture field was refused");
  return model;
}

function boardOf(model: SessionBranchModel): IleWorkCanvasElement[] {
  return appendSessionBranchNotes([], model.boardNotes).elements;
}

function placedTexts(elements: readonly IleWorkCanvasElement[]): string[] {
  return elements
    .map((element) => String(element.originalText || element.text || ""))
    .filter(Boolean);
}

describe("commit session action", () => {
  it("places the next observation for every action with an empty selection and with a selection", () => {
    const model = fieldModel();
    const actions: SessionMarkButtonId[] = ["try", "hold", "drop", "insight"];
    for (const action of actions) {
      const empty = commitSessionAction({
        elements: boardOf(model),
        selectedIds: [],
        model,
        action,
      });
      const written = model.branches
        .find((branch) => branch.id === model.focusId)
        ?.actions.find((row) => row.id === action)?.observation;
      expect(written?.trim()).toBeTruthy();
      expect(placedTexts(empty.added)).toContain(written);
      expect(empty.model?.step).toBe(model.step + 1);

      const selected = commitSessionAction({
        elements: marks().concat(boardOf(model)),
        selectedIds: ["box"],
        model,
        action,
      });
      expect(placedTexts(selected.added)).toContain(written);
      const box = selected.elements.find((element) => element.id === "box");
      if (action === "hold") {
        expect(box?.locked).toBe(true);
        expect(selected.elements.some((element) => element.customData?.[SESSION_MARK_ANCHOR_KEY] === true)).toBe(true);
      } else if (action === "drop") {
        expect(box?.isDeleted).toBe(true);
      } else {
        expect(box?.isDeleted).toBeFalsy();
        expect(box?.locked).toBeFalsy();
      }
    }
  });

  it("still edits a selection when the field is missing, and places nothing new", () => {
    const kept = commitSessionAction({
      elements: marks(),
      selectedIds: ["box"],
      model: null,
      action: "hold",
    });
    expect(kept.model).toBeNull();
    expect(kept.added).toHaveLength(0);
    expect(kept.elements.some((element) => element.customData?.[SESSION_MARK_ANCHOR_KEY] === true)).toBe(true);

    const dropped = commitSessionAction({
      elements: marks(),
      selectedIds: ["box"],
      model: null,
      action: "drop",
    });
    expect(dropped.elements.find((element) => element.id === "box")?.isDeleted).toBe(true);
    expect(dropped.added).toHaveLength(0);

    const idle = commitSessionAction({
      elements: marks(),
      selectedIds: [],
      model: null,
      action: "try",
    });
    expect(idle.changed).toBe(false);
    expect(idle.added).toHaveLength(0);
  });
});
