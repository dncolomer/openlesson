import { describe, expect, it } from "vitest";
import {
  extractGameCoaching,
  extractGameTips,
  isAppDemo,
  isGameDemo,
  isInteractiveDemo,
} from "@/lib/evidence-api-demo/game-tips";
import { gridworksDemo } from "@/lib/evidence-api-demo/demos/gridworks";
import { nexusfrontDemo } from "@/lib/evidence-api-demo/demos/nexusfront";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";

describe("game demo helpers", () => {
  it("detects interactive simulator modes", () => {
    expect(isGameDemo(nexusfrontDemo)).toBe(true);
    expect(isAppDemo(gridworksDemo)).toBe(true);
    expect(isInteractiveDemo(nexusfrontDemo)).toBe(true);
    expect(isInteractiveDemo(gridworksDemo)).toBe(true);
    expect(isGameDemo({ id: "gridworks" })).toBe(false);
  });

  it("extracts full direction and event coaching from gap analysis", () => {
    const report = {
      overall_score: 62,
      suggestions: [],
      growth_areas: [],
      gap_analysis: {
        gaps: [
          {
            title: "Trade opened too early",
            evidence: "Trade route activated before reserves were stable.",
            severity: "medium",
            suggested_repair: "Route energy before opening trade.",
          },
        ],
        next_steps: {
          directions: [
            "Complete sector scouting.",
            "Stabilize supply lines before expanding trade.",
          ],
          events: [
            "Deploy a scout drone to map the northern ridge.",
            "Open a trade route only after food reserves cover two seasons.",
          ],
        },
      },
    } as PerformanceReport;

    const coaching = extractGameCoaching(report);
    expect(coaching.directions).toEqual([
      "Complete sector scouting.",
      "Stabilize supply lines before expanding trade.",
    ]);
    expect(coaching.events).toEqual([
      "Deploy a scout drone to map the northern ridge.",
      "Open a trade route only after food reserves cover two seasons.",
    ]);
    expect(coaching.gapRepairs).toEqual(["Route energy before opening trade."]);

    const tips = extractGameTips(report);
    expect(tips).toContain("Complete sector scouting.");
    expect(tips).toContain("Deploy a scout drone to map the northern ridge.");
  });
});