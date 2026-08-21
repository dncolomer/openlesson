/**
 * ILE dialogue is Helios-only: question fills the panel; no Helios avatar.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ILE_DIALOGUE_AVATAR_SIZE_CLASS,
  ILE_HELIOS_THINKING_LINES,
  TAP_DIALOGUE_AVATAR_SIZE_CLASS,
  ileHeliosThinkingLine,
  resolveIleDialogueTurn,
} from "@/lib/ile-dialogue-turn";
import { processHeliosMarkdown } from "@/lib/helios-markdown";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-4fe0671e0fe3/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("ILE Helios-only surface helper", () => {
  it("idle/first-chapter and post-reply are Helios; sending is waiting (no learner)", () => {
    const idle = resolveIleDialogueTurn({ isSending: false, heliosTurnMode: "idle" });
    const reply = resolveIleDialogueTurn({ isSending: false, heliosTurnMode: "responding" });
    const sending = resolveIleDialogueTurn({ isSending: true, heliosTurnMode: "responding" });
    const interrupt = resolveIleDialogueTurn({
      isSending: false,
      heliosTurnMode: "interruption",
    });

    for (const turn of [idle, reply, sending, interrupt]) {
      expect(turn.speaker).toBe("helios");
      expect(turn.showLearnerAvatar).toBe(false);
      expect(turn.showHeliosAvatar).toBe(false);
    }
    expect(idle.kind).toBe("helios");
    expect(reply.kind).toBe("helios");
    expect(sending.kind).toBe("waiting");
    expect(interrupt.kind).toBe("waiting");

    writeScratch(
      "ile-helios-only-surface.txt",
      [
        `idle=${idle.speaker}/${idle.kind} L=${idle.showLearnerAvatar}`,
        `reply=${reply.speaker}/${reply.kind}`,
        `sending=${sending.speaker}/${sending.kind}`,
        `interrupt=${interrupt.speaker}/${interrupt.kind}`,
      ].join("\n"),
    );
  });
});

describe("Helios thinking copy", () => {
  it("exposes 3 distinct Helios-is-thinking lines", () => {
    expect(ILE_HELIOS_THINKING_LINES).toHaveLength(3);
    const unique = new Set(ILE_HELIOS_THINKING_LINES);
    expect(unique.size).toBe(3);
    for (const line of ILE_HELIOS_THINKING_LINES) {
      expect(line.toLowerCase()).toMatch(/helios is thinking/);
    }
    expect(ileHeliosThinkingLine(0)).toBe(ILE_HELIOS_THINKING_LINES[0]);
    expect(ileHeliosThinkingLine(1)).toBe(ILE_HELIOS_THINKING_LINES[1]);
    expect(ileHeliosThinkingLine(2)).toBe(ILE_HELIOS_THINKING_LINES[2]);
    expect(ileHeliosThinkingLine(3)).toBe(ILE_HELIOS_THINKING_LINES[0]);

    writeScratch(
      "ile-helios-thinking-copy.txt",
      ILE_HELIOS_THINKING_LINES.join("\n"),
    );
  });
});

describe("ILE dialogue UI wiring", () => {
  it("question fills remaining space; no Helios avatar; wait + think helper", () => {
    const ui = read("components/thought-ui/ThoughtUi.tsx");
    expect(ui).toContain("resolveIleDialogueTurn");
    expect(ui).toContain("ileHeliosThinkingLine");
    expect(ui).not.toContain("data-ile-helios-avatar-top");
    expect(ui).toContain("data-ile-helios-waiting");
    expect(ui).toContain("data-ile-helios-waiting-ellipsis");
    expect(ui).toContain("data-ile-helios-thinking-copy");
    expect(ui).toContain("ILE_HELIOS_THINKING_ROTATE_MS");

    const ileFn = ui.slice(ui.indexOf("function DialogueSplitIle"), ui.indexOf("function DialogueSplitFramed"));
    expect(ileFn).not.toContain("<HeliosProbeAvatar");
    expect(ileFn).not.toContain("<LearnerThoughtAvatar");
    expect(ileFn).toContain('data-ile-dialogue-speaker="helios"');
    expect(ileFn).toContain("HeliosMarkdown");
    expect(ileFn).toContain("data-ile-helios-scroll");
    expect(ileFn).toContain("overflow-y-auto");
    expect(ileFn).toContain("flex-1");
    expect(ileFn).not.toMatch(
      /<p className=\{`\$\{textClass\} text-center text-neutral-100`\}>\{lastAssistantTurn\.content\}<\/p>/,
    );

    const markdown = read("components/thought-ui/HeliosMarkdown.tsx");
    expect(markdown).toContain("react-markdown");
    expect(markdown).toContain("remarkGfm");
    expect(markdown).toContain("remarkMath");
    expect(markdown).toContain("rehypeKatex");
    expect(markdown).toContain("processHeliosMarkdown");
    expect(markdown).toContain("data-helios-markdown");

    expect(ILE_DIALOGUE_AVATAR_SIZE_CLASS).toBe("h-10 w-10");
    expect(TAP_DIALOGUE_AVATAR_SIZE_CLASS).toBe("h-28 w-28");

    const comic = ui.slice(ui.indexOf("function DialogueSplitComic"), ui.indexOf("function DialogueSplitIle"));
    expect(comic).toContain("<HeliosProbeAvatar");
    expect(comic).toContain("<LearnerThoughtAvatar");

    writeScratch(
      "ile-helios-dialogue-excerpts.txt",
      [
        "DialogueSplitIle: Helios-only, no avatar, question fills remaining space",
        "no LearnerThoughtAvatar on ILE path",
        "TAP DialogueSplitComic still mounts both avatars",
        "Helios bubble: HeliosMarkdown + data-ile-helios-scroll overflow-y-auto",
        `ileAvatar=${ILE_DIALOGUE_AVATAR_SIZE_CLASS}`,
      ].join("\n"),
    );
  });
});

describe("processHeliosMarkdown", () => {
  it("strips leaked role tags and undoubles LaTeX commands", () => {
    expect(processHeliosMarkdown("See \\\\frac{1}{2} and \\\\[x\\\\]")).toBe(
      "See \\frac{1}{2} and \\[x\\]",
    );
    expect(
      processHeliosMarkdown(
        "Hello <system-reminder>secret</system-reminder> world",
      ),
    ).toBe("Hello  world");
    expect(processHeliosMarkdown("**bold** and a list\n- one\n- two")).toContain(
      "**bold**",
    );
  });
});
