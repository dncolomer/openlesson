/**
 * ILE "I'm done answering": shipped CoT close + Helios chrome.
 * Drives closeIleImDoneAnswering (not a reimplementation).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ILE_END_OF_CHAIN_OF_THOUGHT_ACTION,
  ILE_IM_DONE_ANSWERING_LABEL,
  closeIleImDoneAnswering,
  collectUnflaggedIleDoneAnsweringPow,
  type IleEndOfChainOfThoughtEvent,
} from "@/lib/ile-im-done-answering";
import { decideSpokenCaptureKeyAction } from "@/lib/spoken-thought-shortcut";
import {
  applyTapSoloImDoneSend,
  emptyExerciseDualLists,
  splitTapSoloDoneAnsweringLeftover,
  stashExerciseSpeech,
} from "@/lib/exercise-tap";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-f71630052fca/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function thought(id: string, text: string) {
  return { id, text };
}

describe("decideSpokenCaptureKeyAction (shipped)", () => {
  it("Enter does not submit; Del stashes; E is not live-bar edit", () => {
    expect(decideSpokenCaptureKeyAction({ key: "Enter" })).toBe("ignore");
    expect(decideSpokenCaptureKeyAction({ key: "Delete" })).toBe("stash");
    expect(decideSpokenCaptureKeyAction({ key: "Backspace" })).toBe("stash");
    expect(decideSpokenCaptureKeyAction({ key: "e" })).toBe("ignore");
    expect(decideSpokenCaptureKeyAction({ key: "E" })).toBe("ignore");
    expect(decideSpokenCaptureKeyAction({ key: "Escape" })).toBe("cancel_edit");

    const hook = read("lib/useSessionThoughtInterface.ts");
    const tapConvo = read("components/TapScoreClient.tsx");
    const tapSolo = read("components/ExerciseTapClient.tsx");
    for (const source of [hook, tapConvo, tapSolo]) {
      expect(source).toContain("decideSpokenCaptureKeyAction");
      expect(source).not.toMatch(/key === "Enter"[\s\S]{0,180}sendCurrentTranscription/);
    }
  });
});

describe("closeIleImDoneAnswering (shipped)", () => {
  it("first close is A+B not flagged C; empty second close; third close is D only", async () => {
    const A = thought("A", "alpha reasoning");
    const B = thought("B", "beta reasoning");
    const C = thought("C", "already closed chain");
    const D = thought("D", "new later thought");

    const sends: { text: string; ids: string[] }[] = [];
    const traces: IleEndOfChainOfThoughtEvent[] = [];
    const sendThought = async (text: string, thoughtIds: string[]) => {
      sends.push({ text, ids: thoughtIds });
    };
    const logEndOfChainOfThought = (event: IleEndOfChainOfThoughtEvent) => {
      traces.push(event);
    };

    const first = await closeIleImDoneAnswering({
      thoughts: [A, B, C],
      flaggedIds: new Set(["C"]),
      formingText: "",
      sendThought,
      logEndOfChainOfThought,
    });

    expect(first.submitted).toBe(true);
    expect(first.ids).toEqual(["A", "B"]);
    expect(first.ids).not.toContain("C");
    expect(first.text).toBe("alpha reasoning\nbeta reasoning");
    expect(sends).toEqual([{ text: "alpha reasoning\nbeta reasoning", ids: ["A", "B"] }]);
    expect(traces).toHaveLength(1);
    expect(traces[0]?.traceType).toBe("system2");
    expect(traces[0]?.action).toBe(ILE_END_OF_CHAIN_OF_THOUGHT_ACTION);
    expect(traces[0]?.action).toBe("end_of_chain_of_thought");
    expect(traces[0]?.thoughtIds).toEqual(["A", "B"]);
    expect(traces[0]?.thoughtIds).not.toContain("C");
    expect(first.flaggedIds.has("A")).toBe(true);
    expect(first.flaggedIds.has("B")).toBe(true);
    expect(first.flaggedIds.has("C")).toBe(true);

    sends.length = 0;
    traces.length = 0;
    const second = await closeIleImDoneAnswering({
      thoughts: [A, B, C],
      flaggedIds: first.flaggedIds,
      formingText: "",
      sendThought,
      logEndOfChainOfThought,
    });
    expect(second.submitted).toBe(false);
    expect(sends).toEqual([]);
    expect(traces).toEqual([]);
    expect(second.ids).toEqual([]);

    const third = await closeIleImDoneAnswering({
      thoughts: [A, B, C, D],
      flaggedIds: second.flaggedIds,
      formingText: "",
      sendThought,
      logEndOfChainOfThought,
    });
    expect(third.submitted).toBe(true);
    expect(third.ids).toEqual(["D"]);
    expect(third.text).toBe("new later thought");
    expect(sends).toEqual([{ text: "new later thought", ids: ["D"] }]);
    expect(traces).toHaveLength(1);
    expect(traces[0]?.traceType).toBe("system2");
    expect(traces[0]?.action).toBe("end_of_chain_of_thought");
    expect(traces[0]?.thoughtIds).toEqual(["D"]);

    writeScratch(
      "ile-im-done-answering-close.txt",
      [
        `first=${first.ids.join(",")}|${first.text}`,
        `firstAction=${traces[0]?.action}`,
        `secondSubmitted=${second.submitted}`,
        `third=${third.ids.join(",")}|${third.text}`,
      ].join("\n"),
    );
  });

  it("includes live forming text in the CoT input and does not re-include it after flag", async () => {
    const A = thought("A", "stashed");
    const sends: { text: string; ids: string[] }[] = [];
    const first = await closeIleImDoneAnswering({
      thoughts: [A],
      flaggedIds: new Set(),
      formingText: "  still speaking the close  ",
      sendThought: async (text, ids) => {
        sends.push({ text, ids });
      },
      logEndOfChainOfThought: () => {},
    });
    expect(first.submitted).toBe(true);
    expect(first.includesForming).toBe(true);
    expect(first.text).toBe("stashed\nstill speaking the close");
    expect(sends[0]?.ids).toEqual(["A"]);

    const collected = collectUnflaggedIleDoneAnsweringPow({
      thoughts: [A],
      flaggedIds: first.flaggedIds,
      formingText: "",
    });
    expect(collected.text).toBe("");
    expect(collected.ids).toEqual([]);
  });

  it("clears the live transcription before sendThought finishes (not after Helios responds)", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const pending = closeIleImDoneAnswering({
      thoughts: [thought("A", "stashed")],
      formingText: "live close line",
      sendThought: async (text) => {
        order.push(`send:${text}`);
        await gate;
        order.push("send-done");
      },
      logEndOfChainOfThought: () => {
        order.push("trace");
      },
      onClearForming: () => {
        order.push("clear");
      },
    });

    await Promise.resolve();
    expect(order).toEqual(["trace", "clear", "send:stashed\nlive close line"]);
    expect(order).not.toContain("send-done");

    release();
    const result = await pending;
    expect(result.submitted).toBe(true);
    expect(result.includesForming).toBe(true);
    expect(order).toEqual([
      "trace",
      "clear",
      "send:stashed\nlive close line",
      "send-done",
    ]);
  });
});

describe("TAP solo I'm-done leftover (shipped sendThought path)", () => {
  it("keeps live forming after A+B when newlines were normalized to spaces", async () => {
    const leftover = splitTapSoloDoneAnsweringLeftover({
      composedText: "alpha reasoning\nbeta reasoning\nstill speaking the close",
      promotedThoughts: [{ text: "alpha reasoning" }, { text: "beta reasoning" }],
    });
    expect(leftover).toBe("still speaking the close");

    let lists = emptyExerciseDualLists();
    lists = stashExerciseSpeech(lists, "alpha reasoning", 1_000).lists;
    lists = stashExerciseSpeech(lists, "beta reasoning", 2_000).lists;
    const A = lists.stash[0]!;
    const B = lists.stash[1]!;
    const collected = collectUnflaggedIleDoneAnsweringPow({
      thoughts: [A, B],
      formingText: "still speaking the close",
    });
    expect(collected.ids).toEqual([A.id, B.id]);
    expect(collected.includesForming).toBe(true);

    const next = applyTapSoloImDoneSend(lists, collected.text, collected.ids, 3_000);
    expect(next.stash).toEqual([]);
    expect(next.submitted.map((item) => item.text)).toEqual([
      "alpha reasoning",
      "beta reasoning",
      "still speaking the close",
    ]);

    const sends: { text: string; ids: string[] }[] = [];
    let fromClose = lists;
    await closeIleImDoneAnswering({
      thoughts: [A, B],
      flaggedIds: new Set(),
      formingText: "still speaking the close",
      sendThought: (text, ids) => {
        sends.push({ text, ids });
        fromClose = applyTapSoloImDoneSend(lists, text, ids, 4_000);
      },
      logEndOfChainOfThought: () => {},
    });
    expect(sends).toHaveLength(1);
    expect(sends[0]?.ids).toEqual([A.id, B.id]);
    expect(fromClose.submitted.map((item) => item.text)).toContain("still speaking the close");

    const client = read("components/ExerciseTapClient.tsx");
    expect(client).toContain("applyTapSoloImDoneSend");
    expect(client).not.toContain("clean.startsWith(promotedText)");
  });
});

describe("ILE Helios I'm done answering chrome (shipped source)", () => {
  it("is a standard white overlay outside the transcription box; TAP uses the same close", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    const button = read("components/thought-ui/ImDoneAnsweringButton.tsx");
    const close = read("lib/ile-im-done-answering.ts");

    expect(ILE_IM_DONE_ANSWERING_LABEL).toBe("I'm done answering");
    expect(button).toContain("I'm done answering");
    expect(button).toContain("data-ile-im-done-answering");
    expect(button).toContain("bg-white");
    expect(button).not.toContain("<svg");
    expect(button).not.toContain("data-ile-im-done-answering-shape");
    expect(button).not.toMatch(/A52 52/);
    expect(button).not.toContain("ThoughtCompactAction");
    expect(button).not.toContain('label="Send"');

    expect(helios).toContain("ImDoneAnsweringControl");
    expect(helios).not.toContain("data-ile-transcription-box");
    expect(helios).not.toContain("<SlidingTranscript");
    expect(helios).toContain("data-ile-im-done-answering-overlay");
    expect(helios).not.toContain("absolute inset-x-0 bottom-0");
    expect(helios).not.toContain("Submit last Thought");
    expect(helios).not.toContain("data-ile-submit-last-thought");
    expect(helios).not.toContain("submitLastStashedThought");
    expect(helios).not.toContain('label="Send"');
    expect(helios).not.toContain('shortcut="↵"');
    expect(helios).not.toContain('label="Stash"');
    expect(helios).not.toContain("ThoughtCompactAction");
    expect(helios).not.toContain('label="Edit"');
    expect(helios).not.toContain('shortcut="E"');
    expect(helios).not.toContain("See Your thoughts");

    const overlayIdx = helios.indexOf("data-ile-im-done-answering-overlay");
    expect(overlayIdx).toBeGreaterThan(-1);
    const voice = read("components/session-view/ile-voice-bar.tsx");
    expect(voice).toContain("data-ile-transcription-box");
    expect(voice).toContain("<SlidingTranscript");

    expect(close).toContain('ILE_END_OF_CHAIN_OF_THOUGHT_ACTION = "end_of_chain_of_thought"');
    expect(close).toContain("collectUnflaggedIleDoneAnsweringPow");
    expect(close).toContain("flagIleDoneAnsweringConsumed");
    expect(close).toContain("onClearForming");
    const clearIdx = close.indexOf("input.onClearForming?.()");
    const sendIdx = close.indexOf("await input.sendThought");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(sendIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeLessThan(sendIdx);

    expect(button).toContain("onClearForming");
    const controlClose = button.slice(
      button.indexOf("closeIleImDoneAnswering"),
      button.indexOf(".then"),
    );
    expect(controlClose).toContain("onClearForming");
    expect(button).not.toMatch(/\.then\(\(result\) => \{[\s\S]*onClearForming/);

    const tapPhases = read("components/tap-score/tap-score-phases.tsx");
    const tapShell = read("components/exercise-tap/ExerciseTapShell.tsx");
    expect(tapPhases).not.toContain("Submit last Thought");
    expect(tapShell).not.toContain("Submit last Thought");
    const memory = read("components/thought-ui/ThoughtMemoryPanel.tsx");
    expect(memory).toContain("Edit Selection");
    expect(tapPhases).not.toContain('label="Edit"');
    expect(tapShell).not.toContain('label="Edit"');
    expect(tapPhases).toContain("data-tap-im-done-slot");
    expect(tapShell).toContain("data-tap-im-done-slot");
    expect(tapPhases).toContain("I'm done answering");
    expect(tapShell).toContain("ImDoneAnsweringControl");
    const tapTranscriptIdx = tapPhases.indexOf("data-tap-transcript-container");
    const tapDoneIdx = tapPhases.indexOf("data-tap-im-done-slot");
    const tapMemoryIdx = tapPhases.indexOf("<ThoughtMemoryPanel");
    expect(tapTranscriptIdx).toBeGreaterThan(-1);
    expect(tapDoneIdx).toBeGreaterThan(tapTranscriptIdx);
    expect(tapMemoryIdx).toBeGreaterThan(tapDoneIdx);

    writeScratch(
      "ile-im-done-answering-chrome.txt",
      [
        "ILE: standard white I'm done answering sits on top of the transcription box",
        "no SVG bump",
        "no Submit last Thought on ILE or TAP spoken chrome",
        "TAP: I'm done answering between transcript container and Thought Memory",
      ].join("\n"),
    );
  });
});

describe("I'm done answering vs chapter Complete (shipped split)", () => {
  it("turn close sends speech; Complete marks the chapter and never sends thoughts", () => {
    const actions = read("components/session-view/ile-chapter-helios-actions.tsx");
    const helios = read("components/SessionHeliosPanel.tsx");
    const mutate = read("components/session-view/use-session-mutate.ts");
    const close = read("lib/ile-im-done-answering.ts");
    const doneFn = mutate.slice(mutate.indexOf("const handleMarkChapterDone"));

    expect(actions).toContain('t("chapterMap.complete")');
    expect(actions).toContain("onChapterDone()");
    expect(actions).not.toContain("closeIleImDoneAnswering");
    expect(actions).not.toContain("sendThought");
    expect(actions).not.toContain("I'm done answering");
    expect(actions).not.toContain("ImDoneAnswering");

    expect(helios).toContain("ImDoneAnsweringControl");
    expect(helios).toContain("IleChapterHeliosActions");
    const actionsIdx = helios.indexOf("<IleChapterHeliosActions");
    const doneIdx = helios.indexOf("<ImDoneAnsweringControl");
    expect(actionsIdx).toBeGreaterThan(-1);
    expect(doneIdx).toBeGreaterThan(actionsIdx);

    expect(doneFn).toContain('toolAction: "chapter_done"');
    expect(doneFn).toContain("planIleChapterClose");
    expect(doneFn).not.toContain("closeIleImDoneAnswering");
    expect(doneFn).not.toContain("sendThought");

    expect(close).toContain("end_of_chain_of_thought");
    expect(close).toContain("sendThought");
    expect(close).not.toContain("chapter_done");
    expect(close).not.toContain("handleMarkChapterDone");
    expect(close).not.toContain("status: \"completed\"");

    writeScratch(
      "ile-done-vs-complete.txt",
      [
        "I'm done answering = close spoken turn (sendThought + end_of_chain_of_thought)",
        "Complete = mark chapter done after session PoW review (chapter_done)",
        "handlers do not call each other",
      ].join("\n"),
    );
  });
});
