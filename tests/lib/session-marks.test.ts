import { describe, expect, it } from "vitest";
import {
  applySessionPress,
  buildSessionBundle,
  emptySessionMarkState,
  foldWorkspacePolicy,
  freezeMistakeList,
  learningPointer,
  mergeFrozenMistakes,
  rankByButtonGap,
  selectionSlice,
  setCalibrateSure,
  startedTooSureIds,
  verificationGap,
} from "@/lib/session-marks";

function started() {
  return emptySessionMarkState(
    freezeMistakeList([
      { id: "m1", text: "Treats a limit as a value." },
      { id: "m2", text: "Swaps the two sides of an inequality." },
    ]),
  );
}

describe("session marks", () => {
  it("freezes one open mistake per question, closed only by an aimed Close", () => {
    const list = freezeMistakeList([
      { id: "a", text: "First" },
      { text: "  " },
      { text: "Second" },
    ]);
    expect(list.map((row) => row.status)).toEqual(["open", "open"]);
    expect(list.every((row) => row.closingButton === "try")).toBe(true);

    const state = emptySessionMarkState(list);
    const held = applySessionPress(state, { button: "hold", aimedMistakeId: "a", slice: "sketch" });
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    expect(held.state.mistakes.every((row) => row.status === "open")).toBe(true);

    const dropped = applySessionPress(held.state, { button: "drop", slice: "gone" });
    expect(dropped.ok).toBe(true);
    if (!dropped.ok) return;
    expect(dropped.state.mistakes.every((row) => row.status === "open")).toBe(true);

    const missed = applySessionPress(dropped.state, { button: "try", slice: "no aim" });
    expect(missed.ok).toBe(true);
    if (!missed.ok) return;
    expect(missed.press.closedMistakeId).toBeNull();

    const closed = applySessionPress(missed.state, {
      button: "try",
      aimedMistakeId: "a",
      slice: selectionSlice({ selectedTexts: ["the drawing"], speech: "I think the sides swap" }),
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.press.closedMistakeId).toBe("a");
    expect(closed.press.slice).toContain("the drawing");
    expect(closed.state.mistakes.find((row) => row.id === "a")?.status).toBe("closed");
    expect(closed.state.mistakes.find((row) => row.id === "mistake-2")?.status).toBe("open");
  });

  it("records an early insight as a mark and refuses a second press", () => {
    const early = applySessionPress(started(), { button: "insight", slice: "too soon" });
    expect(early.ok).toBe(true);
    if (!early.ok) return;
    expect(early.press.earlyInsight).toBe(true);
    expect(early.press.insightCounted).toBe(false);
    expect(early.state.mistakes.every((row) => row.status === "open")).toBe(true);
    expect(verificationGap(early.state)).toBe(2);
    const again = applySessionPress(early.state, { button: "insight", slice: "again" });
    expect(again.ok).toBe(false);
    expect(early.state.presses).toHaveLength(1);
  });

  it("counts the insight only after every mistake is closed", () => {
    let state = started();
    for (const id of ["m1", "m2"]) {
      const next = applySessionPress(state, { button: "try", aimedMistakeId: id, slice: id });
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      state = next.state;
    }
    expect(learningPointer(state)).toBeNull();
    const insight = applySessionPress(state, { button: "insight", slice: "the takeaway" });
    expect(insight.ok).toBe(true);
    if (!insight.ok) return;
    expect(insight.press.insightCounted).toBe(true);
    expect(insight.press.earlyInsight).toBe(false);
    expect(verificationGap(insight.state)).toBe(0);
    const bundle = buildSessionBundle(insight.state);
    expect(bundle.closedIds).toEqual(["m1", "m2"]);
    expect(bundle.openAtInsightIds).toEqual([]);
  });

  it("marks started-too-sure only when a sure answer is still open at the insight", () => {
    let state = setCalibrateSure(started(), "m1", true);
    state = setCalibrateSure(state, "m2", false);
    const closed = applySessionPress(state, { button: "try", aimedMistakeId: "m1", slice: "holds" });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    const insight = applySessionPress(closed.state, { button: "insight", slice: "done" });
    expect(insight.ok).toBe(true);
    if (!insight.ok) return;
    expect(startedTooSureIds(insight.state)).toEqual([]);
    expect(verificationGap(insight.state)).toBe(1);
    expect(learningPointer(closed.state)).toEqual({ mistakeId: "m2", button: "try" });
  });

  it("ranks by the gap, and the workspace counts cheap closes and commit-pasts", () => {
    const early = applySessionPress(started(), { button: "insight", slice: "early" });
    expect(early.ok).toBe(true);
    if (!early.ok) return;
    let closed = started();
    for (const id of ["m1", "m2"]) {
      const next = applySessionPress(closed, { button: "try", aimedMistakeId: id, slice: id });
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      closed = next.state;
    }
    const done = applySessionPress(closed, { button: "insight", slice: "kept" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;

    const ranking = rankByButtonGap([
      { id: "early", label: "Early", gap: verificationGap(early.state) },
      { id: "done", label: "Done", gap: verificationGap(done.state) },
      { id: "open", label: "Still working", gap: null },
    ]);
    expect(ranking.map((row) => [row.id, row.rank])).toEqual([
      ["done", 1],
      ["early", 2],
      ["open", null],
    ]);

    const policy = foldWorkspacePolicy([
      { bundle: buildSessionBundle(early.state) },
      { bundle: buildSessionBundle(done.state) },
    ]);
    const first = policy.find((row) => row.mistakeId === "m1");
    expect(first?.cheapCloses).toBe(1);
    expect(first?.commitPasts).toBe(1);
  });

  it("keeps presses when a new branch opens on the same list", () => {
    const pressed = applySessionPress(started(), { button: "try", aimedMistakeId: "m1", slice: "holds" });
    expect(pressed.ok).toBe(true);
    if (!pressed.ok) return;
    const grown = mergeFrozenMistakes(
      pressed.state,
      [
        { id: "m1", text: "Treats a limit as a value." },
        { id: "m2", text: "Swaps the two sides of an inequality." },
        { id: "m3", text: "A newly opened branch." },
      ],
      false,
    );
    expect(grown.presses).toHaveLength(1);
    expect(grown.mistakes.find((row) => row.id === "m1")?.status).toBe("closed");
    expect(grown.mistakes.map((row) => row.id)).toEqual(["m1", "m2", "m3"]);
    const replaced = mergeFrozenMistakes(grown, [{ id: "other", text: "Another chapter." }], true);
    expect(replaced.presses).toHaveLength(0);
    expect(replaced.mistakes.map((row) => row.id)).toEqual(["other"]);
  });

});
