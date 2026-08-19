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
  parseBlockPracticeOptions,
  practiceOptionsIconKeys,
  practiceOptionsIsRestricted,
  resolveDefaultPracticeLaunchUi,
  serializeBlockPracticeOptions,
} from "@/lib/block-practice-options";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.BLOCK_PRACTICE_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-00e5ee38097b/implementer";

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
    expect(def.allowDrill).toBe(true);
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
    expect(limited.allowDrill).toBe(true);
    expect(limited.allowOpenEnded).toBe(false);
    expect(limited.allowTimed).toBe(true);
    expect(limited.allowedDurationsMinutes).toEqual([10, 20]);

    expect(blockAllowsPracticeStyle(limited, "drill")).toBe(true);
    expect(blockAllowsPracticeStyle(limited, "explore")).toBe(false);
    expect(blockAllowsLaunchTarget(limited, "drill", true)).toBe(true);
    expect(blockAllowsLaunchTarget(limited, "drill", false)).toBe(false);
    expect(blockAllowedDurations(limited)).toEqual([10, 20]);
    expect(clampPracticeDuration(limited, 15)).toBe(10);
    expect(clampPracticeDuration(limited, 20)).toBe(20);

    // Both styles off → reopen both
    const both = normalizeBlockPracticeOptions({
      allowExplore: false,
      allowDrill: false,
    });
    expect(both.allowExplore).toBe(true);
    expect(both.allowDrill).toBe(true);

    const combos = enabledPracticeLaunchCombos(limited);
    // drill + solo only (allow_open_ended=false → no dialog; allow_timed=true → solo)
    expect(combos).toEqual(["drill_solo"]);
    expect(practiceOptionsIconKeys(limited)).toEqual(
      expect.arrayContaining(["drill", "solo", "timed"]),
    );
    expect(practiceOptionsIsRestricted(limited)).toBe(true);
    expect(practiceOptionsIsRestricted(def)).toBe(false);

    const ui = resolveDefaultPracticeLaunchUi(limited);
    expect(ui.style).toBe("drill");
    expect(ui.solo).toBe(true);
    expect(ui.timebox).toBe(true);
    expect(ui.durationMinutes).toBe(10);

    const wire = serializeBlockPracticeOptions(limited);
    expect(wire.allow_drill).toBe(true);
    expect(wire.allow_explore).toBe(false);
    expect(parseBlockPracticeOptions(wire).allowedDurationsMinutes).toEqual([
      10, 20,
    ]);

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

describe("structural: Edit drawer + launch + map icons", () => {
  it("Edit panel limits + card respects + map icons + API persist", () => {
    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    const card = read("components/BlockDetailCard.tsx");
    const grid = readMapGridSurface();
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    const view = readWorkspaceViewSurface();
    const api = readGridOpsSurface();
    const mig = read(
      "supabase/migrations/20260804120000_blocks_practice_options.sql",
    );

    expect(edit).toContain("data-block-edit-practice-options");
    expect(edit).toContain("data-block-edit-allow-explore");
    expect(edit).toContain("data-block-edit-allow-drill");
    expect(edit).toContain("data-block-edit-allow-open-ended");
    expect(edit).toContain("data-block-edit-allow-timed");
    expect(edit).toContain("data-block-edit-practice-durations");
    expect(edit).toContain("practiceOptions");

    expect(card).toContain("practiceOptions");
    expect(card).toContain("blockAllowsPracticeStyle");
    expect(card).toContain("allowedDurations");
    expect(card).toContain("data-practice-allow-explore");

    expect(grid).toContain("BlockPracticeOptionsBadge");
    expect(grid).toContain("practiceOptionsIconKeys");
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).toContain("data-block-practice-icons");
    expect(badges).toContain("data-practice-icon");
    // Top-left map decorator icons: monochrome white (not per-kind tints).
    const practiceBadge = badges.slice(
      badges.indexOf("export function BlockPracticeOptionsBadge"),
    );
    for (const key of ["explore", "drill", "dialog", "solo"] as const) {
      expect(practiceBadge).toMatch(
        new RegExp(
          `className="[^"]*text-white[^"]*"[\\s\\S]{0,60}data-practice-icon="${key}"`,
        ),
      );
    }
    // Tooltips use With AI / Solo (not Open-ended / Timed)
    expect(practiceBadge).toContain('"With AI"');
    expect(practiceBadge).toContain('"Solo"');
    expect(practiceBadge).not.toContain('"Open-ended"');
    expect(practiceBadge).not.toMatch(/:\s*"Timed"/);
    expect(practiceBadge).not.toMatch(/text-(?:sky|violet|emerald|amber)-/);

    expect(learner).toContain("parseBlockPracticeOptions");
    expect(learner).toContain("practiceOptions=");

    expect(view).toContain("practice_options");
    expect(view).toContain("serializeBlockPracticeOptions");
    expect(api).toContain("practice_options");
    expect(api).toContain("serializeBlockPracticeOptions");
    expect(mig).toContain("practice_options");

    writeEvidence(
      "block-practice-options-ui.log",
      [
        "edit=true",
        "card=true",
        "map_icons=true",
        "learner=true",
        "api=true",
        "migration=true",
      ].join("\n"),
    );
  });
});
