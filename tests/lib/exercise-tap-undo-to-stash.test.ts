/**
 * Exercise TAP Undo: Solution Stack → Stash demote (not hard delete).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildExerciseRemoveTracePayload,
  demoteExerciseSubmissionToStash,
  emptyExerciseDualLists,
  promoteExerciseStashToSubmission,
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
} from "@/lib/exercise-tap";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("demoteExerciseSubmissionToStash", () => {
  it("moves thought from solution to stash preserving id and text", () => {
    let lists = emptyExerciseDualLists();
    const stashed = stashExerciseSpeech(lists, "reasoning step");
    lists = stashed.lists;
    const promoted = promoteExerciseStashToSubmission(lists, stashed.added!.id);
    lists = promoted.lists;
    expect(lists.submitted).toHaveLength(1);
    expect(lists.stash).toHaveLength(0);

    const demoted = demoteExerciseSubmissionToStash(lists, promoted.moved!.id);
    expect(demoted.moved?.id).toBe(promoted.moved!.id);
    expect(demoted.moved?.text).toBe("reasoning step");
    expect(demoted.lists.submitted).toHaveLength(0);
    expect(demoted.lists.stash).toHaveLength(1);
    expect(demoted.lists.stash[0].id).toBe(promoted.moved!.id);
    expect(demoted.lists.stash[0].text).toBe("reasoning step");
  });

  it("works after direct submit and is a no-op for missing ids", () => {
    const direct = submitExerciseSpeechDirect(emptyExerciseDualLists(), "direct solution");
    const id = direct.added!.id;
    const demoted = demoteExerciseSubmissionToStash(direct.lists, id);
    expect(demoted.lists.submitted).toHaveLength(0);
    expect(demoted.lists.stash.map((t) => t.text)).toEqual(["direct solution"]);

    const noop = demoteExerciseSubmissionToStash(demoted.lists, "no-such-id");
    expect(noop.moved).toBeNull();
    expect(noop.lists).toEqual(demoted.lists);
  });
});

describe("undo wiring + copy", () => {
  it("client Undo uses demote helper and sys2 remove trace", () => {
    const client = read("components/ExerciseTapClient.tsx");
    expect(client).toContain("demoteExerciseSubmissionToStash");
    expect(client).toContain("handleUndoSubmissionToStash");
    expect(client).toContain('action: "remove"');
    expect(client).toContain('traceType: "system2"');
    expect(client).toMatch(/moves it back to Stash|back to Stash|undo → stash/i);
  });

  it("Solution Stack control labels demote to stash (not discard)", () => {
    const stack = read("components/exercise-tap/ExerciseSubmissionStack.tsx");
    expect(stack).toContain("data-exercise-undo-to-stash");
    expect(stack).toContain("To stash");
    expect(stack).toContain("Move back to Stash");
    expect(stack).toContain("undo → stash");
    expect(stack).not.toMatch(/permanent discard|delete forever/i);
  });
});

describe("demote still emits sys2 remove PoW", () => {
  it("buildExerciseRemoveTracePayload remains system2 remove for demote signal", () => {
    const { added } = submitExerciseSpeechDirect(emptyExerciseDualLists(), "x");
    const payload = buildExerciseRemoveTracePayload({
      tapSessionId: "t",
      workspaceId: "w",
      thought: added!,
    });
    expect(payload.trace_type).toBe("system2");
    expect(payload.action).toBe("remove");
    expect(payload.thought_id).toBe(added!.id);
  });
});
