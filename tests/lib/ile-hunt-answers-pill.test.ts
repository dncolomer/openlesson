/**
 * ILE hunt-for-answers pill: shipped copy + Helios adjacency; TAP unchanged.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTapScoreSurface, readExerciseTapSurface } from "@/tests/helpers/surface-source";
import {
  ILE_HUNT_ANSWERS_PILL_COPY,
  ileHuntAnswersPillLabel,
} from "@/lib/ile-hunt-answers-pill";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-2ae2d59e0256/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("ileHuntAnswersPillLabel (shipped)", () => {
  it("tells the learner to hunt with any tools including LLMs, and that outsourcing is not cheating", () => {
    const copy = ileHuntAnswersPillLabel();
    expect(copy).toBe(ILE_HUNT_ANSWERS_PILL_COPY);
    expect(copy).toMatch(/hunt for answers/i);
    expect(copy).toMatch(/even LLMs/i);
    expect(copy).toContain("Outsourcing knowledge is NOT cheating");

    const pill = read("components/IleHuntAnswersPill.tsx");
    expect(pill).toContain("ileHuntAnswersPillLabel");
    expect(pill).toContain("data-ile-hunt-answers-pill");
    expect(pill).toContain("{copy}");
    expect(pill).toContain("bg-white");
  });
});

describe("ILE Helios mounts the hunt pill next to the identity badge", () => {
  it("is a sibling of SessionIdentityBadge on the ILE identity row; TAP does not mount it", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).toContain("IleHuntAnswersPill");
    expect(helios).toContain("SessionIdentityBadge");
    expect(helios).toContain("data-ile-identity-row");

    const rowStart = helios.indexOf("data-ile-identity-row");
    const rowSlice = helios.slice(rowStart, rowStart + 900);
    expect(rowSlice).toContain("<IleHuntAnswersPill");
    expect(rowSlice).toContain("<SessionIdentityBadge");
    const huntIdx = rowSlice.indexOf("<IleHuntAnswersPill");
    const badgeIdx = rowSlice.indexOf("<SessionIdentityBadge");
    expect(huntIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(-1);
    expect(huntIdx).not.toEqual(badgeIdx);

    const tapPhases = read("components/tap-score/tap-score-phases.tsx");
    const tapSolo = read("components/exercise-tap/exercise-tap-phases.tsx");
    const tapSurface = readTapScoreSurface();
    const exerciseSurface = readExerciseTapSurface();
    for (const surface of [tapPhases, tapSolo, tapSurface, exerciseSurface]) {
      expect(surface).not.toContain("IleHuntAnswersPill");
      expect(surface).not.toContain("ILE_HUNT_ANSWERS_PILL_COPY");
      expect(surface).not.toContain("data-ile-hunt-answers-pill");
    }
    expect(tapPhases).toContain("SessionIdentityBadge");
    expect(tapSolo).toContain("SessionIdentityBadge");

    writeScratch(
      "ile-hunt-answers-pill.txt",
      [
        `copy=${ileHuntAnswersPillLabel()}`,
        "ILE Helios: IleHuntAnswersPill sibling of SessionIdentityBadge on data-ile-identity-row",
        "TAP convo + solo: identity badge only, no hunt pill",
      ].join("\n"),
    );
  });
});
