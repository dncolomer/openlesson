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
  ileCompactChapterTitle,
  ileMiniModeShareCtaLabel,
  resolveIleCompactTranscript,
  runIleMiniShareCta,
  shouldShowIleMiniShareCta,
} from "@/lib/ile-compact-chrome";

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
    expect(interrupt.kind).toBe("waiting");
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
    expect(helios).toContain("See Older Thoughts");
    expect(helios).toContain("Submit last Thought");
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
        "SessionHeliosPanel: See Older Thoughts / onOpenThoughts (not Open Thoughts)",
        "DialogueSplitIle: resolveIleDialogueTurn, no Helios avatar",
        "TAP live: TapSessionMap + overlay (comic helper unused on live)",
        "Tools rail still has thought-history",
      ].join("\n"),
    );
  });
});

describe("mini-mode TAP chrome helpers (shipped)", () => {
  it("share CTA only when not sharing; click starts existing share path; transcript + forming; no stash boxes or ILE label", async () => {
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
    expect(cta.toLowerCase()).toMatch(/share/);
    expect(cta.toLowerCase()).toMatch(/screen/);

    const waiting = resolveIleCompactTranscript({
      lastHeliosText: "Walk the recurrence with me.",
      isSending: true,
    });
    expect(waiting.kind).toBe("waiting");
    expect(waiting.text.toLowerCase()).toMatch(/helios is thinking/);

    const liveTurn = resolveIleCompactTranscript({
      lastHeliosText: "Walk the recurrence with me.",
      isSending: false,
      heliosTurnMode: "idle",
    });
    expect(liveTurn.kind).toBe("helios");
    expect(liveTurn.text).toBe("Walk the recurrence with me.");

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
    expect(compact).toContain("data-ile-compact-forming");
    expect(compact).toContain("data-ile-compact-share-cta");
    expect(compact).toContain("<button");
    expect(compact).toContain("ileMiniModeShareCtaLabel");
    expect(compact).toContain("onStartShare");
    expect(compact).not.toContain("CompactList");
    expect(compact).not.toContain("data-ile-compact-stash-item");
    expect(compact).not.toContain("data-ile-compact-share-note");
    expect(compact).not.toMatch(/>\s*ILE\s*</);
    expect(compact).not.toContain('"ILE"');
    expect(compact).not.toContain("'ILE'");
    expect(compact).not.toContain("Thought stash");
    expect(compact).not.toMatch(/background:\s*"#0a0a0a"/);

    const hook = read("lib/useIleBlurScreenshare.tsx");
    expect(hook).toContain("transcriptText={props.transcriptText}");
    expect(hook).toContain("onStartShare");
    expect(hook).toContain("startRef.current()");
    expect(hook).not.toContain("thoughts={props.thoughts}");
    expect(hook).not.toContain("projectStash={props.projectStash}");

    const view = readSessionViewSurface();
    expect(view).toContain("transcriptText: lastDialogueAssistantTurn");
    expect(view).toContain("formingText: sessionThoughtInterface.crystallizableText");
    expect(view).not.toContain('?? "ILE"');
    expect(view).not.toContain("thoughts: sessionThoughtInterface.stashedThoughts");

    const layers = read("components/thought-ui/ThoughtUi.tsx");
    expect(layers).toContain("THOUGHT_BACKGROUND_IMAGES");
    expect(layers).toContain("/aesthetics/Greco-futurism/");
    expect(layers).toContain("export function ThoughtBackgroundLayers");

    writeScratch(
      "ile-mini-tap-ui-excerpts.txt",
      [
        `cta=${cta}`,
        `showCtaWhenIdle=${shown}`,
        `hideCtaWhenSharing=${hidden}`,
        `transcriptIdle=${liveTurn.kind}:${liveTurn.text}`,
        `transcriptWaiting=${waiting.kind}:${waiting.text}`,
        "bg=ThoughtBackgroundLayers + THOUGHT_BACKGROUND_IMAGES Greco-futurism",
        "forming=data-ile-compact-forming",
        "no CompactList / no visible ILE label",
        "onStartShare → startRef.current (existing getDisplayMedia path)",
      ].join("\n"),
    );
  });
});
