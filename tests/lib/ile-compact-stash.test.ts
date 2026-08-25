/**
 * Compact ILE submit/stash: no Open Thoughts; Helios-only dialogue.
 * TAP live uses the ephemeral session map (comic helper unused on live).
 */
import { describe, expect, it } from "vitest";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ILE_DIALOGUE_AVATAR_SIZE_CLASS,
  TAP_DIALOGUE_AVATAR_SIZE_CLASS,
  resolveIleDialogueTurn,
} from "@/lib/ile-dialogue-turn";
import {
  focusIleCompactOpenerTab,
  ileCompactAutostashFillRatio,
  ileCompactChapterTitle,
  ileMiniModeDoneAnsweringLabel,
  ileMiniModeShareCtaLabel,
  resolveIleCompactTranscript,
  runIleMiniDoneAnswering,
  runIleMiniShareCta,
  shouldShowIleMiniShareCta,
} from "@/lib/ile-compact-chrome";
import { thoughtContextFillRatio } from "@/lib/thought-context-auto-stash";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-83851d3bce4a/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function avatarRem(sizeClass: string): number {
  const match = sizeClass.match(/h-(\d+)/);
  expect(match).toBeTruthy();
  return Number(match![1]);
}

describe("resolveIleDialogueTurn (shipped ILE speaker helper)", () => {
  it("ILE surface is Helios-only; wait after submit, Helios on idle/first chapter", () => {
    const heliosSend = resolveIleDialogueTurn({ isSending: true, heliosTurnMode: "responding" });
    expect(heliosSend.speaker).toBe("helios");
    expect(heliosSend.kind).toBe("waiting");
    expect(heliosSend.showHeliosAvatar).toBe(false);
    expect(heliosSend.showLearnerAvatar).toBe(false);

    const interrupt = resolveIleDialogueTurn({
      isSending: false,
      heliosTurnMode: "interruption",
    });
    expect(interrupt.speaker).toBe("helios");
    expect(interrupt.kind).toBe("helios");
    expect(interrupt.showHeliosAvatar).toBe(false);
    expect(interrupt.showLearnerAvatar).toBe(false);

    const firstChapter = resolveIleDialogueTurn({ isSending: false, heliosTurnMode: "idle" });
    expect(firstChapter.speaker).toBe("helios");
    expect(firstChapter.kind).toBe("helios");
    expect(firstChapter.showLearnerAvatar).toBe(false);
    expect(firstChapter.showHeliosAvatar).toBe(false);

    expect(avatarRem(ILE_DIALOGUE_AVATAR_SIZE_CLASS)).toBeLessThan(
      avatarRem(TAP_DIALOGUE_AVATAR_SIZE_CLASS),
    );
    expect(TAP_DIALOGUE_AVATAR_SIZE_CLASS).toBe("h-28 w-28");
    expect(ILE_DIALOGUE_AVATAR_SIZE_CLASS).not.toMatch(/h-28|w-28/);

    writeScratch(
      "ile-compact-stash-turn.txt",
      [
        `heliosSend=${heliosSend.speaker} H=${heliosSend.showHeliosAvatar} L=${heliosSend.showLearnerAvatar}`,
        `interrupt=${interrupt.speaker} H=${interrupt.showHeliosAvatar} L=${interrupt.showLearnerAvatar}`,
        `firstChapter=${firstChapter.speaker} kind=${firstChapter.kind} H=${firstChapter.showHeliosAvatar} L=${firstChapter.showLearnerAvatar}`,
        `ileAvatar=${ILE_DIALOGUE_AVATAR_SIZE_CLASS}`,
        `tapAvatar=${TAP_DIALOGUE_AVATAR_SIZE_CLASS}`,
      ].join("\n"),
    );
  });
});

describe("ILE vs TAP dialogue chrome (shipped source)", () => {
  it("ILE compact stash opens Thought tool via See Older Thoughts; TAP live uses the session map", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).not.toContain("data-open-thoughts");
    expect(helios).not.toContain("Open Thoughts");
    expect(helios).toContain("onOpenThoughts");
    expect(helios).toContain("See Your thoughts");
    expect(helios).not.toContain("Submit last Thought");
    expect(helios).toContain("ImDoneAnsweringControl");
    expect(helios).toContain("DialogueSplit");

    const view = readSessionViewSurface();
    expect(view).toContain("onOpenThoughts");
    expect(view).toContain("thought-history");
    expect(view).toContain("openIleThoughtHistoryTool");

    const ui = read("components/thought-ui/ThoughtUi.tsx");
    expect(ui).toContain("resolveIleDialogueTurn");
    expect(ui).toContain("data-ile-dialogue-compact");
    expect(ui).toContain("ILE_DIALOGUE_AVATAR_SIZE_CLASS");
    expect(ui).toContain("TAP_DIALOGUE_AVATAR_SIZE_CLASS");
    const ileFn = ui.slice(ui.indexOf("function DialogueSplitIle"), ui.indexOf("function DialogueSplitFramed"));
    expect(ileFn).not.toContain("<HeliosProbeAvatar");

    const tap = readTapScoreSurface();
    expect(tap).toContain("TapSessionMap");
    expect(tap).toContain("TapTurnOverlay");
    expect(tap).not.toContain("<DialogueSplit");

    const comic = ui.slice(ui.indexOf("function DialogueSplitComic"), ui.indexOf("function DialogueSplitIle"));
    expect(comic).toContain("<HeliosProbeAvatar");
    expect(comic).toContain("<LearnerThoughtAvatar");
    expect(comic).not.toContain("resolveIleDialogueTurn");

    writeScratch(
      "ile-compact-stash-excerpts.txt",
      [
        "SessionHeliosPanel: See Your thoughts / onOpenThoughts (not Open Thoughts)",
        "DialogueSplitIle: resolveIleDialogueTurn, no Helios avatar",
        "TAP live: TapSessionMap + overlay (comic helper unused on live)",
        "Tools rail still has thought-history",
      ].join("\n"),
    );
  });
});

describe("mini-mode TAP chrome helpers (shipped)", () => {
  it("share CTA only when not sharing; live transcript + autostash fill; I'm Done Answering focuses opener; no last thought", async () => {
    const calls: number[] = [];
    const shown = shouldShowIleMiniShareCta(false);
    const hidden = shouldShowIleMiniShareCta(true);
    expect(shown).toBe(true);
    expect(hidden).toBe(false);

    const started = await runIleMiniShareCta({
      isScreenSharing: false,
      startScreenshare: async () => {
        calls.push(1);
        return true;
      },
    });
    expect(started).toBe(true);
    expect(calls).toEqual([1]);

    const skipped = await runIleMiniShareCta({
      isScreenSharing: true,
      startScreenshare: async () => {
        calls.push(2);
        return true;
      },
    });
    expect(skipped).toBe(false);
    expect(calls).toEqual([1]);

    const cta = ileMiniModeShareCtaLabel();
    expect(cta).toBe("Share your Screen");
    expect(cta.toLowerCase()).toMatch(/share/);
    expect(cta.toLowerCase()).toMatch(/screen/);

    const doneLabel = ileMiniModeDoneAnsweringLabel();
    expect(doneLabel).toBe("I'm Done Answering");

    const heliosLastTurn = "Walk the recurrence with me.";
    const forming = "the walk-through of the recurrence";
    const liveTurn = resolveIleCompactTranscript({
      formingText: forming,
      speechDisplay: forming,
      lastHeliosText: heliosLastTurn,
    });
    expect(liveTurn.kind).toBe("live");
    expect(liveTurn.text).toBe(forming);
    expect(liveTurn.text).not.toBe(heliosLastTurn);
    expect(liveTurn.text.toLowerCase()).not.toMatch(/helios is thinking/);

    const listening = resolveIleCompactTranscript({
      formingText: "",
      isListening: true,
      speechEnabled: true,
      lastHeliosText: heliosLastTurn,
    });
    expect(listening.kind).toBe("live");
    expect(listening.text).toBe("Listening…");
    expect(listening.text).not.toBe(heliosLastTurn);

    const fill = ileCompactAutostashFillRatio(forming);
    expect(fill).toBe(thoughtContextFillRatio(forming));
    expect(ileCompactAutostashFillRatio("a".repeat(200), 400)).toBe(
      thoughtContextFillRatio("a".repeat(200), 400),
    );

    const focusCalls: string[] = [];
    const opener = { focus: () => focusCalls.push("opener") };
    const tab = { focus: () => focusCalls.push("tab") };
    expect(focusIleCompactOpenerTab({ opener, tab })).toBe(true);
    expect(focusCalls).toEqual(["opener"]);
    focusCalls.length = 0;
    expect(focusIleCompactOpenerTab({ opener: null, tab })).toBe(true);
    expect(focusCalls).toEqual(["tab"]);

    let closed = false;
    const focusedAfterClose = await runIleMiniDoneAnswering({
      closePath: async () => {
        closed = true;
      },
      opener,
    });
    expect(closed).toBe(true);
    expect(focusedAfterClose).toBe(true);
    expect(focusCalls).toEqual(["tab", "opener"]);

    expect(ileCompactChapterTitle("Recurrence relations")).toBe("Recurrence relations");
    expect(ileCompactChapterTitle("ILE")).toBeNull();
    expect(ileCompactChapterTitle("ile")).toBeNull();
    expect(ileCompactChapterTitle("")).toBeNull();
    expect(ileCompactChapterTitle(null)).toBeNull();

    const compact = read("components/IleCompactStashWindow.tsx");
    expect(compact).toContain("ThoughtBackgroundLayers");
    expect(compact).toContain("THOUGHT_BACKGROUND_IMAGES");
    expect(compact).not.toContain("HeliosProbeAvatar");
    expect(compact).toContain("data-ile-compact-transcript");
    expect(compact).toContain("data-ile-compact-share-cta");
    expect(compact).toContain("data-ile-compact-done-answering");
    expect(compact).toContain("data-ile-compact-autostash");
    expect(compact).toContain("ileMiniModeShareCtaLabel");
    expect(compact).toContain("ileMiniModeDoneAnsweringLabel");
    expect(compact).toContain("runIleMiniDoneAnswering");
    expect(compact).toContain("onStartShare");
    expect(compact).toContain("onDoneAnswering");
    expect(compact).toContain("<AutoStashContextBar");
    expect(compact).not.toContain("<SlidingTranscript");
    expect(compact).toContain('whiteSpace: "pre-wrap"');
    expect(compact).toContain('overflowWrap: "anywhere"');
    expect(compact).toContain('overflowX: "hidden"');
    expect(compact).not.toContain("data-ile-compact-forming");
    expect(compact).not.toContain("data-ile-last-stash");
    expect(compact).not.toContain("data-ile-last-stash-text");
    expect(compact).not.toContain("data-ile-compact-stash-item");
    expect(compact).not.toContain("data-ile-compact-share-note");
    expect(compact).not.toContain("data-ile-compact-chapter");
    expect(compact).not.toContain("data-ile-compact-helios");
    expect(compact).not.toContain("CompactList");
    expect(compact).not.toContain("See Older Thoughts");
    expect(compact).not.toContain("No stashed thought");
    expect(compact).not.toMatch(/>\s*ILE\s*</);
    expect(compact).not.toContain('"ILE"');
    expect(compact).not.toContain("'ILE'");
    expect(compact).not.toContain("Thought stash");
    expect(compact).not.toMatch(/background:\s*"#0a0a0a"/);

    const hook = read("lib/useIleBlurScreenshare.tsx");
    expect(hook).toContain("formingText={props.formingText}");
    expect(hook).toContain("speechDisplay={props.speechDisplay}");
    expect(hook).toContain("onStartShare");
    expect(hook).toContain("onDoneAnswering");
    expect(hook).toContain("startRef.current()");
    expect(hook).toContain("doneAnsweringRef.current");
    expect(hook).toContain("opener={win.opener ?? null}");
    expect(hook).not.toContain("transcriptText={props.transcriptText}");
    expect(hook).not.toContain("thoughts={props.thoughts}");
    expect(hook).not.toContain("projectStash={props.projectStash}");

    const view = readSessionViewSurface();
    expect(view).toContain("formingText: sessionThoughtInterface.crystallizableText");
    expect(view).toContain("formatSpeechTranscriptDisplay");
    expect(view).toContain("onDoneAnswering: handleCompactDoneAnswering");
    expect(view).toContain("closeIleImDoneAnswering");
    expect(view).toContain("thoughts: sessionThoughtInterface.stashedThoughts");
    expect(view).not.toContain("transcriptText: lastDialogueAssistantTurn");
    expect(view).not.toContain('?? "ILE"');
    const compactBlockStart = view.indexOf("compact: {");
    expect(compactBlockStart).toBeGreaterThan(-1);
    const compactBlock = view.slice(compactBlockStart, view.indexOf("},", compactBlockStart + 10) + 2);
    expect(compactBlock).toContain("formingText: sessionThoughtInterface.crystallizableText");
    expect(compactBlock).toContain("speechDisplay: formatSpeechTranscriptDisplay");
    expect(compactBlock).not.toContain("lastDialogueAssistantTurn");
    expect(compactBlock).not.toContain("stashedThoughts");
    expect(compactBlock).not.toContain("chapterLabel");

    const layers = read("components/thought-ui/ThoughtUi.tsx");
    expect(layers).toContain("THOUGHT_BACKGROUND_IMAGES");
    expect(layers).toContain("/aesthetics/Greco-futurism/");
    expect(layers).toContain("export function ThoughtBackgroundLayers");

    writeScratch(
      "ile-mini-tap-ui-excerpts.txt",
      [
        `cta=${cta}`,
        `done=${doneLabel}`,
        `showCtaWhenIdle=${shown}`,
        `hideCtaWhenSharing=${hidden}`,
        `transcriptLive=${liveTurn.kind}:${liveTurn.text}`,
        `transcriptListening=${listening.kind}:${listening.text}`,
        `autostashFill=${fill}`,
        "bg=ThoughtBackgroundLayers + THOUGHT_BACKGROUND_IMAGES Greco-futurism",
        "no last thought / no CompactList / no visible ILE label",
        "onStartShare → startRef.current (existing getDisplayMedia path)",
        "onDoneAnswering → closeIleImDoneAnswering + opener focus",
      ].join("\n"),
    );
    writeScratch(
      "ile-pip-chrome.txt",
      [
        `shareShownWhenIdle=${shown}`,
        `shareHiddenWhenSharing=${hidden}`,
        `shareLabel=${cta}`,
        `doneLabel=${doneLabel}`,
        `transcriptKind=${liveTurn.kind}`,
        `transcriptText=${liveTurn.text}`,
        `transcriptIgnoresHelios=${liveTurn.text !== heliosLastTurn}`,
        `listeningText=${listening.text}`,
        `autostashFill=${fill}`,
        `autostashMatchesMain=${fill === thoughtContextFillRatio(forming)}`,
        `focusOpenerThenTab=${focusCalls.join(",")}`,
        `doneAnsweringClosed=${closed}`,
        `doneAnsweringFocused=${focusedAfterClose}`,
      ].join("\n"),
    );
    writeScratch(
      "ile-pip-surface.txt",
      [
        "IleCompactStashWindow: Share your Screen + I'm Done Answering + data-ile-compact-transcript + data-ile-compact-autostash",
        "no data-ile-last-stash / data-ile-compact-forming / Helios last-turn",
        "useIleBlurScreenshare paints formingText + speechDisplay, not lastDialogueAssistantTurn",
        "SessionView: formatSpeechTranscriptDisplay + closeIleImDoneAnswering + opener/tab focus",
        `shareCta=${compact.includes("data-ile-compact-share-cta")}`,
        `doneAnswering=${compact.includes("data-ile-compact-done-answering")}`,
        `transcript=${compact.includes("data-ile-compact-transcript")}`,
        `autostash=${compact.includes("data-ile-compact-autostash")}`,
        `lastStash=${compact.includes("data-ile-last-stash")}`,
        `formingBox=${compact.includes("data-ile-compact-forming")}`,
        `heliosBody=${compact.includes("data-ile-compact-helios")}`,
        `hookSpeechDisplay=${hook.includes("speechDisplay={props.speechDisplay}")}`,
        `viewHeliosTranscript=${view.includes("transcriptText: lastDialogueAssistantTurn")}`,
      ].join("\n"),
    );
  });
});
