/**
 * TAP live UI still fires thought PoW through the shipped trace/start/complete path.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  TAP_SESSION_RUNTIME_PATHS,
  tapTracePayload,
} from "@/lib/tap-session-runtime";
import { readExerciseTapSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-74fce7726040/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("TAP live PoW after map/stash UI swap", () => {
  it("conversational and solo still register traces and start/complete through shipped helpers", () => {
    const stash = tapTracePayload({
      traceType: "system1",
      action: "pause_finalize",
      tapSessionId: "tap-1",
    });
    expect(stash.traceType).toBe("system1");
    expect(stash.action).toBe("pause_finalize");
    const send = tapTracePayload({
      traceType: "system2",
      action: "send",
      tapSessionId: "tap-1",
    });
    expect(send.traceType).toBe("system2");
    expect(send.action).toBe("send");
    const remove = tapTracePayload({
      traceType: "system2",
      action: "remove",
      tapSessionId: "tap-1",
    });
    expect(remove.traceType).toBe("system2");
    expect(remove.action).toBe("remove");

    const client = read("components/TapScoreClient.tsx");
    expect(client).toContain("tapTracePayload");
    expect(client).toContain('"/api/workspace-tap-score/trace"');
    expect(client).toContain('traceType: "system1"');
    expect(client).toContain("addThought");
    expect(client).toContain("stashCurrentTranscription");
    expect(client).toContain("sendThought");

    const flow = read("components/tap-score/use-tap-score-flow.ts");
    expect(flow).toContain("postTutoringSessionStart");
    expect(flow).toContain("postTutoringSessionComplete");
    expect(flow).toContain("s.logTapTrace");
    expect(flow).toContain('traceType: "system2"');
    expect(flow).toContain('action: isResend ? "resend" : "send"');

    const live = readTapScoreSurface();
    expect(live).not.toContain("ExerciseStashHistory");
    expect(live).toContain("submitLastStashedThought");
    expect(live).toContain("sendThought");
    expect(live).toContain("ThoughtMemoryPanel");
    expect(live).toContain("stashCurrentTranscription");
    expect(live).toContain("sendCurrentTranscription");
    expect(live).toContain("TapSessionMap");
    expect(live).toContain("TapTurnOverlay");

    const exercise = readExerciseTapSurface();
    expect(exercise).toContain("tapTracePayload");
    expect(exercise).toContain('"/api/workspace-tap-score/trace"');
    expect(exercise).toContain('traceType: "system1"');
    expect(exercise).toContain('traceType: "system2"');
    expect(exercise).toContain("stashExerciseSpeech");
    expect(exercise).toContain("promoteExerciseStashToSubmission");
    expect(exercise).toContain("postTutoringSessionStart");
    expect(exercise).toContain("postTutoringSessionComplete");
    expect(exercise).toContain("stashCurrentTranscription");
    expect(exercise).toContain("sendThought");
    expect(exercise).toContain("submitLastStashedThought");
    expect(exercise).toContain("TapSessionMap");
    expect(exercise).toContain("ThoughtMemoryPanel");
    const soloShell = read("components/exercise-tap/ExerciseTapShell.tsx");
    expect(soloShell).not.toContain("ExerciseStashHistory");
    expect(soloShell).not.toContain("ExerciseSubmissionStack");
    expect(soloShell).toContain("ThoughtMemoryPanel");

    writeScratch(
      "tap-pow-wiring.txt",
      [
        `trace=/api/workspace-tap-score/trace`,
        `start=${TAP_SESSION_RUNTIME_PATHS.start}`,
        `complete=${TAP_SESSION_RUNTIME_PATHS.complete}`,
        `sys1=${String(stash.traceType)}/${String(stash.action)}`,
        `sys2send=${String(send.traceType)}/${String(send.action)}`,
        `sys2remove=${String(remove.traceType)}/${String(remove.action)}`,
        "convo stash: addThought + tapTracePayload system1",
        "convo submit: submitLastStashedThought -> sendThought -> logTapTrace system2 send",
        "convo start/complete: postTutoringSessionStart/Complete",
        "solo stash: stashExerciseSpeech + logExerciseTrace system1",
        "solo submit: submitLastStashedThought -> sendThought -> logExerciseTrace system2 send",
        "solo start/complete: postTutoringSessionStart/Complete",
        "handlers still passed into live UI after map/overlay/stash-history swap",
      ].join("\n"),
    );
  });
});
