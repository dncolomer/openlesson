/**
 * TAP thought memory: local per-thought edit/delete + I'm done answering confirm.
 * Drives shipped helpers; TAP convo + exercise surfaces must not multi-select submit.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyExerciseDualLists, stashExerciseSpeech } from "@/lib/exercise-tap";
import { readExerciseTapSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
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

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-cdad02195afd/implementer";

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
    const route = read("app/api/workspace-tap-score/trace/route.ts");
    expect(route).toContain('"edit"');
    expect(route).toContain('"remove"');
  });
});

describe("TAP convo + exercise chrome for local thought memory", () => {
  it("always shows Thought Memory with local edit/delete and I'm done confirm", () => {
    const convo = readTapScoreSurface();
    const exercise = readExerciseTapSurface();
    const memory = read("components/thought-ui/ThoughtMemoryPanel.tsx");
    const done = read("components/thought-ui/ImDoneAnsweringButton.tsx");

    for (const surface of [convo, exercise]) {
      expect(surface).not.toContain("TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL");
      expect(surface).toContain("data-tap-thought-memory-always");
      expect(surface).toContain("confirmClose");
      expect(surface).toContain("TAP_IM_DONE_CONFIRM_TITLE");
      expect(surface).toContain("onEditThought");
      expect(surface).toContain("onDeleteThought");
      expect(surface).toContain("composeTapThoughtEditPow");
      expect(surface).toContain("composeTapThoughtDeletePow");
      expect(surface).not.toContain("onSendThought={sendThought}");
    }

    expect(memory).toContain("data-tap-edit-thought");
    expect(memory).toContain("data-tap-delete-thought");
    expect(memory).toContain("T extends ThoughtMemoryEntry");
    expect(memory).toContain("onEditThought?: (thought: T, nextText: string) => void");
    expect(memory).toContain("onDeleteThought?: (thought: T) => void");
    expect(memory).toContain('submitLabel="Save"');
    expect(memory).toContain("Keep speaking");
    expect(memory).toContain("!canManageThoughts && (generationEnabled || Boolean(onSendThought))");

    expect(done).toContain("data-tap-im-done-confirm");
    expect(done).toContain("data-tap-im-done-confirm-cancel");
    expect(done).toContain("data-tap-im-done-confirm-submit");
    expect(done).toContain("confirmClose");
    expect(TAP_IM_DONE_CONFIRM_TITLE.toLowerCase()).toContain("submit");
    expect(TAP_IM_DONE_CONFIRM_BODY.toLowerCase()).toContain("sure");
    expect(TAP_IM_DONE_CONFIRM_BODY.toLowerCase()).toContain("edit");
    expect(TAP_IM_DONE_CONFIRM_BODY.toLowerCase()).toContain("delete");
    expect(TAP_IM_DONE_CONFIRM_CONFIRM).toBe("I'm done answering");
    expect(TAP_IM_DONE_CONFIRM_CANCEL.toLowerCase()).toContain("thinking");

    const helios = read("components/SessionHeliosPanel.tsx");
    expect(exercise).toContain("isTapExerciseThoughtMemoryLocked");
    expect(exercise).toContain("data-tap-thoughts-locked");
    expect(exercise).toContain("thoughtsLocked ? undefined : onEditThought");
    expect(exercise).toContain("thoughtsLocked ? undefined : onDeleteThought");
    expect(convo).not.toContain("isTapExerciseThoughtMemoryLocked");

    expect(helios).not.toContain("confirmClose");
    expect(helios).not.toContain(TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL);

    writeScratch(
      "tap-thought-edit-delete.txt",
      [
        `label unused in TAP chrome=${TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL}`,
        `confirmTitle=${TAP_IM_DONE_CONFIRM_TITLE}`,
        "TAP convo+exercise: always-on Thought Memory, local edit/delete System 2 PoW",
        "TAP I'm done answering: UI confirm before close",
        "ILE Helios: no TAP confirmClose / See-Edit label",
      ].join("\n"),
    );
  });
});
