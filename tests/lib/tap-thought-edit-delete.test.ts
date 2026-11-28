/**
 * TAP thought memory: local per-thought edit/delete.
 * Conversational TAP confirms I'm done answering. Drill closes the turn immediately.
 * Drives shipped helpers; TAP convo + exercise surfaces must not multi-select submit.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyExerciseDualLists, stashExerciseSpeech } from "@/lib/exercise-tap";
import { readTapScoreSurface } from "@/tests/helpers/surface-source";
import {
  TAP_IM_DONE_CONFIRM_BODY,
  TAP_IM_DONE_CONFIRM_CANCEL,
  TAP_IM_DONE_CONFIRM_CONFIRM,
  TAP_IM_DONE_CONFIRM_TITLE,
  TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL,
  applyTapExerciseThoughtDelete,
  applyTapExerciseThoughtEdit,
  applyTapThoughtLocalDelete,
  applyTapThoughtLocalEdit,
  composeTapThoughtDeletePow,
  composeTapThoughtEditPow,
  isTapExerciseThoughtMemoryLocked,
} from "@/lib/tap-thought-memory";
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-cdad02195afd/implementer");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("TAP local thought edit/delete helpers", () => {
  it("edits one thought in place and no-ops missing/empty text", () => {
    const thoughts = [
      { id: "a", text: "first" },
      { id: "b", text: "second" },
    ];
    const edited = applyTapThoughtLocalEdit(thoughts, "b", "  second revised  ");
    expect(edited.previous?.text).toBe("second");
    expect(edited.next?.text).toBe("second revised");
    expect(edited.thoughts.map((thought) => thought.text)).toEqual(["first", "second revised"]);
    expect(applyTapThoughtLocalEdit(thoughts, "missing", "x").next).toBeNull();
    expect(applyTapThoughtLocalEdit(thoughts, "a", "   ").next).toBeNull();
  });

  it("deletes one thought and leaves the rest", () => {
    const thoughts = [
      { id: "a", text: "first" },
      { id: "b", text: "second" },
      { id: "c", text: "third" },
    ];
    const deleted = applyTapThoughtLocalDelete(thoughts, "b");
    expect(deleted.removed?.text).toBe("second");
    expect(deleted.thoughts.map((thought) => thought.id)).toEqual(["a", "c"]);
    expect(applyTapThoughtLocalDelete(thoughts, "missing").removed).toBeNull();
  });

  it("edits and deletes across TAP exercise stash and submitted lists", () => {
    let lists = emptyExerciseDualLists();
    lists = stashExerciseSpeech(lists, "stash thought").lists;
    const stashId = lists.stash[0]?.id;
    expect(stashId).toBeTruthy();
    const edited = applyTapExerciseThoughtEdit(lists, stashId, "stash revised");
    expect(edited.next?.text).toBe("stash revised");
    expect(edited.lists.stash[0]?.text).toBe("stash revised");

    const deleted = applyTapExerciseThoughtDelete(edited.lists, stashId);
    expect(deleted.removed?.id).toBe(stashId);
    expect(deleted.lists.stash).toHaveLength(0);
  });

  it("locks exercise thought memory when the problem is done or submitted", () => {
    expect(isTapExerciseThoughtMemoryLocked(null)).toBe(false);
    expect(isTapExerciseThoughtMemoryLocked({ done: false, solutionSubmitted: false })).toBe(false);
    expect(isTapExerciseThoughtMemoryLocked({ done: true })).toBe(true);
    expect(isTapExerciseThoughtMemoryLocked({ solutionSubmitted: true })).toBe(true);
    expect(isTapExerciseThoughtMemoryLocked({ done: true, solutionSubmitted: true })).toBe(true);
  });

  it("composes System 2 edit and remove PoW events", () => {
    expect(composeTapThoughtEditPow({ thoughtId: "t1", originalText: "old", text: "new" })).toEqual({
      traceType: "system2",
      action: "edit",
      thoughtId: "t1",
      originalText: "old",
      text: "new",
    });
    expect(composeTapThoughtDeletePow({ thoughtId: "t1", text: "gone" })).toEqual({
      traceType: "system2",
      action: "remove",
      thoughtId: "t1",
      text: "gone",
    });
    const route = read("app/api/verify/session/trace/route.ts");
    expect(route).toContain('"edit"');
    expect(route).toContain('"remove"');
  });
});
