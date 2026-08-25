/**
 * ILE leftover chrome absence + Helios auto-trigger classifier
 * (user-send vs idle/speech/interruption).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleHeliosAutoFire,
  classifyIleHeliosTrigger,
  ileHeliosTriggerKindFromPowOrigin,
  ILE_HELIOS_WHY_COPY,
} from "@/lib/ile-helios-trigger";
import { resolveIleDialogueTurn } from "@/lib/ile-dialogue-turn";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-c9348eb42d37/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const ILE_SURFACES = [
  "components/SessionHeliosPanel.tsx",
  "components/IleCompactStashWindow.tsx",
  "lib/ile-compact-chrome.ts",
  "components/thought-ui/ThoughtUi.tsx",
  "components/session-view/use-session-idle.ts",
  "components/session-view/use-session-speech.ts",
] as const;

const DELETED_LIVE = [
  "components/IleHuntAnswersPill.tsx",
  "lib/ile-hunt-answers-pill.ts",
  "lib/ile-concept-marks.ts",
  "components/thought-ui/IleConceptMarkedText.tsx",
] as const;

describe("ILE leftover chrome is gone from live sources", () => {
  it("hunt pill, concept highlighter, and last-thought are unhooked on ILE compact/Helios", () => {
    const lines: string[] = [];

    for (const rel of DELETED_LIVE) {
      const gone = !existsSync(join(ROOT, rel));
      expect(gone, rel).toBe(true);
      lines.push(`deleted ${rel}=${gone}`);
    }

    for (const rel of ILE_SURFACES) {
      const src = read(rel);
      expect(src).not.toContain("IleHuntAnswersPill");
      expect(src).not.toContain("ILE_HUNT_ANSWERS_PILL_COPY");
      expect(src).not.toContain("data-ile-hunt-answers-pill");
      expect(src).not.toContain("ile-concept-marks");
      expect(src).not.toContain("IleConceptMarkedText");
      expect(src).not.toContain("ILE_CONCEPT_MARK_PROMPT");
      expect(src).not.toContain("#ile-concept:");
      expect(src).not.toContain("data-ile-last-stash");
      expect(src).not.toContain("data-ile-last-stash-text");
      expect(src).not.toContain("selectLastStashedThought");
      expect(src).not.toContain("submitLastStashedThought");
      expect(src).not.toContain("lastStashedThought");
      lines.push(`${rel}: no hunt/concept/last-stash live path`);
    }

    const wordBoxes = read("lib/ile-word-boxes.ts");
    expect(wordBoxes).toContain("stripIleConceptMarkDelimiters");
    expect(wordBoxes).not.toContain("ILE_CONCEPT_MARK_PROMPT");
    expect(wordBoxes).not.toContain("#ile-concept:");
    lines.push("stripIleConceptMarkDelimiters allowed for leftover ==term==");

    const tapPhases = read("components/tap-score/tap-score-phases.tsx");
    expect(tapPhases).toContain("data-tap-last-stash");
    expect(tapPhases).toContain("selectLastStashedThought");
    lines.push("TAP last-stash unchanged");

    writeScratch("ile-dead-code.txt", lines.join("\n"));
  });
});

describe("classifyIleHeliosTrigger (shipped, from start)", () => {
  it("allows learner send; suppresses idle/speech/interruption auto-fires with whyHelios tokens", () => {
    const user = classifyIleHeliosTrigger({ kind: "user_send" });
    const idle = classifyIleHeliosTrigger({ kind: "idle" });
    const speech = classifyIleHeliosTrigger({ kind: "speech" });
    const interruption = classifyIleHeliosTrigger({ kind: "interruption" });

    expect(user.showOnDialogue).toBe(true);
    expect(user.whyHelios).toBeNull();
    expect(user.kind).toBe("user_send");

    for (const auto of [idle, speech, interruption]) {
      expect(auto.showOnDialogue).toBe(false);
      expect(auto.whyHelios).toBe(ILE_HELIOS_WHY_COPY[auto.kind]);
      expect(auto.whyHelios).toBeTruthy();
    }

    const userApply = applyIleHeliosAutoFire({ kind: "user_send" });
    expect(userApply.applied).toBe(user.showOnDialogue);
    expect(userApply.showOnDialogue).toBe(user.showOnDialogue);

    const idleApply = applyIleHeliosAutoFire({ kind: "idle" });
    const speechApply = applyIleHeliosAutoFire({ kind: "speech" });
    const interruptApply = applyIleHeliosAutoFire({ kind: "interruption" });
    expect(idleApply.applied).toBe(idle.showOnDialogue);
    expect(speechApply.applied).toBe(speech.showOnDialogue);
    expect(interruptApply.applied).toBe(interruption.showOnDialogue);
    expect(idleApply.whyHelios).toBe(idle.whyHelios);
    expect(speechApply.whyHelios).toBe(speech.whyHelios);
    expect(interruptApply.whyHelios).toBe(interruption.whyHelios);

    expect(ileHeliosTriggerKindFromPowOrigin("idle")).toBe("idle");
    expect(ileHeliosTriggerKindFromPowOrigin("speech")).toBe("speech");
    expect(ileHeliosTriggerKindFromPowOrigin("other")).toBe("interruption");
    expect(ileHeliosTriggerKindFromPowOrigin(undefined)).toBe("interruption");

    const sendTurn = resolveIleDialogueTurn({ isSending: true, heliosTurnMode: "responding" });
    expect(sendTurn.kind).toBe("waiting");
    const autoTurn = resolveIleDialogueTurn({
      isSending: false,
      heliosTurnMode: "interruption",
    });
    expect(autoTurn.kind).toBe(
      classifyIleHeliosTrigger({ kind: "interruption" }).showOnDialogue ? "waiting" : "helios",
    );

    writeScratch(
      "ile-helios-trigger.txt",
      [
        `user_send applied=${userApply.applied} why=${userApply.whyHelios}`,
        `idle applied=${idleApply.applied} why=${idleApply.whyHelios}`,
        `speech applied=${speechApply.applied} why=${speechApply.whyHelios}`,
        `interruption applied=${interruptApply.applied} why=${interruptApply.whyHelios}`,
        `sendTurn=${sendTurn.kind} autoTurn=${autoTurn.kind}`,
      ].join("\n"),
    );
  });
});

describe("ILE idle/speech apply uses the shipped classifier", () => {
  it("wires applyIleHeliosAutoFire and idle/speech origins on the ILE path only", () => {
    const idle = read("components/session-view/use-session-idle.ts");
    expect(idle).toContain("applyIleHeliosAutoFire");
    expect(idle).toContain("ileHeliosTriggerKindFromPowOrigin");
    expect(idle).toContain("if (!fired.applied) return");
    expect(idle).toContain("applyInterruption(interruption, { origin })");

    const speech = read("components/session-view/use-session-speech.ts");
    expect(speech).toContain('handlePowInterruption(interruption, "idle")');
    expect(speech).toContain('handlePowInterruption(interruption, "speech")');

    const tap = read("components/TapScoreClient.tsx");
    expect(tap).not.toContain("applyIleHeliosAutoFire");
    expect(tap).toContain('handlePowInterruption(interruption, "idle")');
    expect(tap).toContain('handlePowInterruption(interruption, "speech")');
    expect(tap).toContain("setHeliosTurnMode(\"interruption\")");

    const dialogue = read("lib/ile-dialogue-turn.ts");
    expect(dialogue).toContain("classifyIleHeliosTrigger");

    writeScratch(
      "ile-helios-paths.txt",
      [
        "auto-fire origins: idle heartbeat (useTapIdleProofOfWork + origin idle), speech segment (useTapSpeechProofOfWork + origin speech), other PoW (screenshots/traces → interruption)",
        "user send: submitHeliosChatMessageNow / sendThought — classifyIleHeliosTrigger user_send showOnDialogue true",
        "ILE apply: use-session-idle onIntervention → applyIleHeliosAutoFire; suppressed auto-fires do not append chat or set interruption mode",
        "TAP TapScoreClient still appends interruption messages (unchanged)",
      ].join("\n"),
    );
  });
});
