/**
 * Session-level ILE turn close: shipped closeIleImDoneAnswering per open Work.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  closeIleOpenWorkTurn,
  ILE_SUBMIT_TURN_LABEL,
  ILE_SUBMIT_WORK_CONTINUE_TEXT,
  partitionIleThoughtsByOpenWork,
  resolveIleWorkChatTarget,
} from "@/lib/ile-session-turn-close";
import {
  ILE_END_OF_CHAIN_OF_THOUGHT_ACTION,
  type IleEndOfChainOfThoughtEvent,
} from "@/lib/ile-im-done-answering";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b5fb51e17c96/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function thought(id: string, text: string, chapterId?: string) {
  return { id, text, chapterId };
}

describe("closeIleOpenWorkTurn (shipped)", () => {
  it("one close submits both open Works and a second close does not re-expand flagged ids", async () => {
    expect(ILE_SUBMIT_TURN_LABEL.toLowerCase()).toMatch(/submit|turn/);
    expect(ILE_SUBMIT_WORK_CONTINUE_TEXT.toLowerCase()).toMatch(/submitted this turn/);

    const a1 = thought("a1", "chain A one", "ch-a");
    const a2 = thought("a2", "chain A two", "ch-a");
    const b1 = thought("b1", "chain B one", "ch-b");
    const later = thought("c1", "after the turn", "ch-a");

    const sends: { text: string; ids: string[]; chapterId: string }[] = [];
    const traces: IleEndOfChainOfThoughtEvent[] = [];

    const first = await closeIleOpenWorkTurn({
      works: [
        { chapterId: "ch-a", thoughts: [a1, a2] },
        { chapterId: "ch-b", thoughts: [b1] },
      ],
      sendThought: async (text, ids, chapterId) => {
        sends.push({ text, ids, chapterId });
      },
      logEndOfChainOfThought: (event) => traces.push(event),
    });

    expect(first.submitted).toBe(true);
    expect(first.results).toHaveLength(2);
    expect(first.results[0]?.chapterId).toBe("ch-a");
    expect(first.results[0]?.ids).toEqual(["a1", "a2"]);
    expect(first.results[1]?.chapterId).toBe("ch-b");
    expect(first.results[1]?.ids).toEqual(["b1"]);
    expect(sends).toHaveLength(2);
    expect(sends[0]).toEqual({
      text: "chain A one\nchain A two",
      ids: ["a1", "a2"],
      chapterId: "ch-a",
    });
    expect(sends[1]).toEqual({
      text: "chain B one",
      ids: ["b1"],
      chapterId: "ch-b",
    });
    expect(traces).toHaveLength(2);
    expect(traces.every((row) => row.action === ILE_END_OF_CHAIN_OF_THOUGHT_ACTION)).toBe(
      true,
    );
    expect(first.flaggedIds.has("a1")).toBe(true);
    expect(first.flaggedIds.has("a2")).toBe(true);
    expect(first.flaggedIds.has("b1")).toBe(true);

    const second = await closeIleOpenWorkTurn({
      works: [
        { chapterId: "ch-a", thoughts: [a1, a2, later] },
        { chapterId: "ch-b", thoughts: [b1] },
      ],
      flaggedIds: first.flaggedIds,
      sendThought: async (text, ids, chapterId) => {
        sends.push({ text, ids, chapterId });
      },
      logEndOfChainOfThought: (event) => traces.push(event),
    });
    expect(second.results[0]?.ids).toEqual(["c1"]);
    expect(second.results[0]?.ids).not.toContain("a1");
    expect(second.results[1]?.submitted).toBe(false);
    expect(sends).toHaveLength(3);
    expect(sends[2]?.ids).toEqual(["c1"]);

    const parts = partitionIleThoughtsByOpenWork({
      thoughts: [a1, b1, thought("x", "untagged")],
      openWorkIds: ["ch-a", "ch-b"],
      focusedChapterId: "ch-b",
    });
    expect(parts[0]?.chapterId).toBe("ch-a");
    expect((parts[0]?.thoughts ?? []).map((row) => row.id)).toEqual(["a1"]);
    expect((parts[1]?.thoughts ?? []).map((row) => row.id)).toEqual(["b1", "x"]);

    const steps = [
      { id: "ch-a", description: "Chapter A goal" },
      { id: "ch-b", description: "Chapter B goal" },
    ];
    const focusedA = resolveIleWorkChatTarget({
      chapterId: "ch-b",
      steps,
      fallbackIndex: 0,
      fallbackId: "ch-a",
      fallbackDescription: "Chapter A goal",
    });
    expect(focusedA.chapterId).toBe("ch-b");
    expect(focusedA.stepIndex).toBe(1);
    expect(focusedA.description).toBe("Chapter B goal");
    expect(focusedA.chapterId).not.toBe("ch-a");
    const fallback = resolveIleWorkChatTarget({
      chapterId: null,
      steps,
      fallbackIndex: 0,
      fallbackId: "ch-a",
      fallbackDescription: "Chapter A goal",
    });
    expect(fallback.chapterId).toBe("ch-a");
    expect(fallback.stepIndex).toBe(0);

    writeScratch(
      "ile-session-turn-close.txt",
      [
        `label=${ILE_SUBMIT_TURN_LABEL}`,
        `firstSubmitted=${first.submitted} chains=${sends.length} ids=${first.ids.join(",")}`,
        `secondOnlyLater=${second.ids.join(",")}`,
        `flaggedA1=${first.flaggedIds.has("a1")} flaggedB1=${first.flaggedIds.has("b1")}`,
        `chatTargetB=${focusedA.chapterId}@${focusedA.stepIndex}`,
        `chatFallbackA=${fallback.chapterId}@${fallback.stepIndex}`,
      ].join("\n"),
    );
  });
});
