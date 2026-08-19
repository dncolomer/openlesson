/**
 * Exercise TAP dual history: sys1 stash, sys2 submit, sys2 remove-from-submission.
 * Drives real reducers + shipped trace payload shapes + UI wiring contracts.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildExerciseRemoveTracePayload,
  buildExerciseStashTracePayload,
  buildExerciseSubmitTracePayload,
  emptyExerciseDualLists,
  demoteExerciseSubmissionToStash,
  promoteExerciseStashToSubmission,
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
} from "@/lib/exercise-tap";
import { readExerciseTapSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("sys1 stash → sys2 submit → sys2 remove", () => {
  it("full path empties correctly", () => {
    let state = emptyExerciseDualLists();
    const s1 = stashExerciseSpeech(state, "first step");
    state = s1.lists;
    const s2 = stashExerciseSpeech(state, "second step");
    state = s2.lists;
    expect(state.stash).toHaveLength(2);
    expect(state.submitted).toHaveLength(0);

    const promoted = promoteExerciseStashToSubmission(state, s1.added!.id);
    state = promoted.lists;
    expect(state.stash.map((t) => t.text)).toEqual(["second step"]);
    expect(state.submitted.map((t) => t.text)).toEqual(["first step"]);

    const direct = submitExerciseSpeechDirect(state, "live enter submit");
    state = direct.lists;
    expect(state.submitted).toHaveLength(2);

    const demoted = demoteExerciseSubmissionToStash(state, promoted.moved!.id);
    state = demoted.lists;
    expect(state.submitted.map((t) => t.text)).toEqual(["live enter submit"]);
    // Demoted thought returns to stash with original text (not discarded)
    expect(state.stash.map((t) => t.text)).toEqual(["second step", "first step"]);
    expect(demoted.moved?.text).toBe("first step");
  });
});

describe("trace payload contracts", () => {
  it("stash is system1; submit/remove are system2", () => {
    const { added: stashed } = stashExerciseSpeech(emptyExerciseDualLists(), "s");
    const stashPayload = buildExerciseStashTracePayload({
      tapSessionId: "t",
      workspaceId: "w",
      thought: stashed!,
    });
    expect(stashPayload.trace_type).toBe("system1");
    expect(stashPayload.action).toBe("pause_finalize");

    const { added: sent } = submitExerciseSpeechDirect(emptyExerciseDualLists(), "x");
    const sendPayload = buildExerciseSubmitTracePayload({
      tapSessionId: "t",
      workspaceId: "w",
      thought: sent!,
    });
    expect(sendPayload.trace_type).toBe("system2");
    expect(sendPayload.action).toBe("send");

    const removePayload = buildExerciseRemoveTracePayload({
      tapSessionId: "t",
      workspaceId: "w",
      thought: sent!,
    });
    expect(removePayload.trace_type).toBe("system2");
    expect(removePayload.action).toBe("remove");
  });
});

describe("structural dual history + wider shell", () => {
  it("Exercise live UI has stash + submission sections and sys1/sys2 actions", () => {
    const client = readExerciseTapSurface();
    expect(client).toContain("stashCurrentTranscription");
    expect(client).toContain("submitCurrentOrLatestStash");
    expect(client).toContain("handleUndoSubmissionToStash");
    expect(client).toContain("demoteExerciseSubmissionToStash");
    expect(client).toContain('traceType: "system1"');
    expect(client).toContain('traceType: "system2"');
    expect(client).toContain('action: "send"');
    expect(client).toContain('action: "remove"');
    expect(client).toContain("max-w-7xl");
    expect(client).not.toContain("DialogueSplit");

    const shell = read("components/exercise-tap/ExerciseTapShell.tsx");
    expect(shell).toContain("data-exercise-dual-history");
    expect(shell).toContain("ExerciseStashHistory");
    expect(shell).toContain("ExerciseSubmissionStack");
    expect(shell).toContain("lg:grid-cols-2");

    expect(read("components/exercise-tap/ExerciseStashHistory.tsx")).toContain(
      "data-exercise-stash-history",
    );
    expect(read("components/exercise-tap/ExerciseSubmissionStack.tsx")).toContain(
      "data-exercise-submission-history",
    );
    expect(read("components/exercise-tap/ExerciseSubmissionStack.tsx")).toContain(
      "data-exercise-remove-thought",
    );
  });

  it("trace route allowlists system2 remove", () => {
    const route = read("app/api/workspace-tap-score/trace/route.ts");
    // Extract only the SYSTEM1_ACTIONS set block
    const s1 = route.match(/const SYSTEM1_ACTIONS = new Set<TapSystem1Action>\(\[([\s\S]*?)\]\)/);
    const s2 = route.match(/const SYSTEM2_ACTIONS = new Set<TapSystem2Action>\(\[([\s\S]*?)\]\)/);
    expect(s1?.[1]).toBeTruthy();
    expect(s2?.[1]).toBeTruthy();
    expect(s1![1]).not.toContain('"remove"');
    expect(s2![1]).toContain('"remove"');
  });
});
