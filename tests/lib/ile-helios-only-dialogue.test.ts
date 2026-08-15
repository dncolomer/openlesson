/**
 * ILE dialogue is Helios-only: small top-center avatar + waiting think copy.
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
      expect(turn.showHeliosAvatar).toBe(true);
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
  it("small top-center Helios avatar; no learner avatar; centered wait + think helper", () => {
    const ui = read("components/thought-ui/ThoughtUi.tsx");
    expect(ui).toContain("resolveIleDialogueTurn");
    expect(ui).toContain("ileHeliosThinkingLine");
    expect(ui).toContain("data-ile-helios-avatar-top");
    expect(ui).toContain("justify-center");
    expect(ui).toContain("data-ile-helios-waiting");
    expect(ui).toContain("data-ile-helios-waiting-ellipsis");
    expect(ui).toContain("data-ile-helios-thinking-copy");
    expect(ui).toContain("ILE_HELIOS_THINKING_ROTATE_MS");

    const ileFn = ui.slice(ui.indexOf("function DialogueSplitIle"), ui.indexOf("function DialogueSplitFramed"));
    expect(ileFn).toContain("<HeliosProbeAvatar");
    expect(ileFn).not.toContain("<LearnerThoughtAvatar");
    expect(ileFn).toContain('data-ile-dialogue-speaker="helios"');

    expect(ILE_DIALOGUE_AVATAR_SIZE_CLASS).toBe("h-10 w-10");
    expect(TAP_DIALOGUE_AVATAR_SIZE_CLASS).toBe("h-28 w-28");

    const comic = ui.slice(ui.indexOf("function DialogueSplitComic"), ui.indexOf("function DialogueSplitIle"));
    expect(comic).toContain("<HeliosProbeAvatar");
    expect(comic).toContain("<LearnerThoughtAvatar");

    writeScratch(
      "ile-helios-dialogue-excerpts.txt",
      [
        "DialogueSplitIle: Helios-only, data-ile-helios-avatar-top, waiting ellipsis + ileHeliosThinkingLine",
        "no LearnerThoughtAvatar on ILE path",
        "TAP DialogueSplitComic still mounts both avatars",
        `ileAvatar=${ILE_DIALOGUE_AVATAR_SIZE_CLASS}`,
      ].join("\n"),
    );
  });
});
