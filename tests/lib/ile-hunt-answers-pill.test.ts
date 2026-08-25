/**
 * ILE hunt-for-answers pill is gone from Helios; TAP never had it.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTapScoreSurface, readExerciseTapSurface } from "@/tests/helpers/surface-source";

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

describe("ILE hunt-for-answers pill (removed)", () => {
  it("is not mounted on ILE Helios or TAP identity rows", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).not.toContain("IleHuntAnswersPill");
    expect(helios).not.toContain("data-ile-hunt-answers-pill");
    expect(helios).not.toContain("Hunt for answers");
    expect(helios).not.toContain("Outsourcing knowledge is NOT cheating");
    expect(helios).toContain("SessionIdentityBadge");
    expect(helios).toContain("data-ile-identity-row");

    const tapPhases = read("components/tap-score/tap-score-phases.tsx");
    const tapSolo = read("components/exercise-tap/exercise-tap-phases.tsx");
    const tapSurface = readTapScoreSurface();
    const exerciseSurface = readExerciseTapSurface();
    for (const surface of [helios, tapPhases, tapSolo, tapSurface, exerciseSurface]) {
      expect(surface).not.toContain("IleHuntAnswersPill");
      expect(surface).not.toContain("ILE_HUNT_ANSWERS_PILL_COPY");
      expect(surface).not.toContain("data-ile-hunt-answers-pill");
    }
    expect(tapPhases).toContain("SessionIdentityBadge");
    expect(tapSolo).toContain("SessionIdentityBadge");

    expect(existsSync(join(ROOT, "components/IleHuntAnswersPill.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/ile-hunt-answers-pill.ts"))).toBe(false);

    writeScratch(
      "ile-hunt-answers-pill.txt",
      [
        "ILE Helios: no IleHuntAnswersPill",
        "TAP convo + solo: identity badge only, no hunt pill",
        "component + copy helper deleted",
      ].join("\n"),
    );
  });
});
