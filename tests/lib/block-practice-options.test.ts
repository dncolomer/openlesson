import {
  readGridOpsSurface,
  readMapGridSurface,
  readWorkspaceViewSurface,
} from "@/tests/helpers/surface-source";
/**
 * Block practice launch limits: pure normalize/allow rules + structural Edit/map wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  blockAllowedDurations,
  blockAllowsLaunchTarget,
  blockAllowsPracticeStyle,
  clampPracticeDuration,
  defaultBlockPracticeOptions,
  enabledPracticeLaunchCombos,
  normalizeBlockPracticeOptions,
  parseAyclClonePracticeOptions,
  parseBlockPracticeOptions,
  parseWorkspacePracticeOptions,
  practiceOptionsIconKeys,
  withExplorePracticeEnabled,
  practiceOptionsIsRestricted,
  resolveDefaultPracticeLaunchUi,
  serializeBlockPracticeOptions,
} from "@/lib/block-practice-options";
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.BLOCK_PRACTICE_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-00e5ee38097b/implementer");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("normalize + allow rules", () => {
  it("defaults full surface; restricts styles/horizons/durations", () => {
    const def = defaultBlockPracticeOptions();
    expect(def.allowExplore).toBe(true);
    expect(def.allowDrill).toBe(false);
    expect(def.allowScout).toBe(true);
    expect(def.allowOpenEnded).toBe(true);
    expect(def.allowTimed).toBe(true);
    expect(def.allowedDurationsMinutes.length).toBeGreaterThan(1);

    // Drill-only, timed-only, limited minutes
    const limited = normalizeBlockPracticeOptions({
      allow_explore: false,
      allow_drill: true,
      allow_open_ended: false,
      allow_timed: true,
      allowed_durations_minutes: [10, 20, 99, 10],
    });
    expect(limited.allowExplore).toBe(false);
    expect(limited.allowDrill).toBe(false);
    expect(limited.allowOpenEnded).toBe(false);
    expect(limited.allowTimed).toBe(true);
    expect(limited.allowedDurationsMinutes).toEqual([]);

    expect(blockAllowsPracticeStyle(limited, "drill")).toBe(false);
    expect(blockAllowsPracticeStyle(limited, "explore")).toBe(true);
    expect(blockAllowsPracticeStyle(limited, "scout")).toBe(false);
    expect(blockAllowsLaunchTarget(limited, "drill", true)).toBe(false);
    expect(blockAllowsLaunchTarget(limited, "drill", false)).toBe(false);
    expect(blockAllowedDurations(limited)).toEqual([]);
    expect(clampPracticeDuration(limited, 15)).toBe(15);
    expect(clampPracticeDuration(limited, 20)).toBe(20);

    // Explore+Drill off with Scout default on → keep Scout, do not reopen others
    const exploreDrillOff = normalizeBlockPracticeOptions({
      allowExplore: false,
      allowDrill: false,
    });
    expect(exploreDrillOff.allowExplore).toBe(false);
    expect(exploreDrillOff.allowDrill).toBe(false);
    expect(exploreDrillOff.allowScout).toBe(true);

    // All three off → reopen Work
    const allOff = normalizeBlockPracticeOptions({
      allowExplore: false,
      allowDrill: false,
      allowScout: false,
    });
    expect(allOff.allowExplore).toBe(true);
    expect(allOff.allowScout).toBe(false);

    const combos = enabledPracticeLaunchCombos(limited);
    expect(combos).toEqual(["explore_dialog"]);
    expect(practiceOptionsIconKeys(limited)).toEqual(["explore"]);
    expect(practiceOptionsIsRestricted(limited)).toBe(false);
    expect(practiceOptionsIsRestricted(def)).toBe(false);

    const ui = resolveDefaultPracticeLaunchUi(limited);
    expect(ui.style).toBe("explore");
    expect(ui.solo).toBe(false);
    expect(ui.timebox).toBe(false);
    expect(ui.durationMinutes).toBe(15);

    const wire = serializeBlockPracticeOptions(limited);
    expect(wire.allow_drill).toBe(false);
    expect(wire.allow_explore).toBe(false);
    expect(parseBlockPracticeOptions(wire).allowedDurationsMinutes).toEqual([]);

    const catalogOff = normalizeBlockPracticeOptions({
      allow_explore: false,
      allow_drill: true,
    });
    expect(catalogOff.allowExplore).toBe(false);
    expect(withExplorePracticeEnabled(catalogOff).allowExplore).toBe(true);
    expect(withExplorePracticeEnabled(catalogOff).allowDrill).toBe(false);
    expect(parseAyclClonePracticeOptions({ allow_explore: false }).allowExplore).toBe(
      true,
    );
    expect(
      parseWorkspacePracticeOptions({ allow_explore: false }, { ayclClone: true })
        .allowExplore,
    ).toBe(true);
    expect(
      parseWorkspacePracticeOptions({ allow_explore: false }, { ayclClone: false })
        .allowExplore,
    ).toBe(false);

    writeEvidence(
      "block-practice-options.log",
      [
        "default=" + JSON.stringify(def),
        "limited=" + JSON.stringify(limited),
        "combos=" + combos.join(","),
        "icons=" + practiceOptionsIconKeys(limited).join(","),
        "ui=" + JSON.stringify(ui),
        "wire=" + JSON.stringify(wire),
      ].join("\n"),
    );
  });
});
