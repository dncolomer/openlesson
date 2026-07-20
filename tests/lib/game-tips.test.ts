import { describe, expect, it } from "vitest";
import {
  extractGameCoaching,
  isAppDemo,
  isExternalDemo,
  isGameDemo,
  isInteractiveDemo,
} from "@/lib/product-demos/game-tips";
import { orbitDemo } from "@/lib/product-demos/demos/orbit";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";

describe("game demo helpers", () => {
  it("detects interactive simulator modes", () => {
    expect(isExternalDemo(orbitDemo)).toBe(true);
    expect(isInteractiveDemo(orbitDemo)).toBe(true);
    expect(isGameDemo(orbitDemo)).toBe(false);
    expect(isAppDemo(orbitDemo)).toBe(false);
    expect(isExternalDemo({ id: "orbit" })).toBe(true);
  });

  it("extracts full direction and event coaching from gap analysis", () => {
    const report = {
      score: 62, vertical: 'verification' as const,
      suggestions: [],
      growth_areas: [],
      gap_analysis: {
        gaps: [
          {
            title: "Urgent issue unassigned",
            proof_of_work: "ORB-12 still has no owner.",
            severity: "medium",
            suggested_repair: "Assign the regression issue before changing status.",
          },
        ],
        next_steps: {
          directions: [
            "Complete inbox triage.",
            "Stabilize ownership before moving issues to In Progress.",
          ],
          events: [
            "Assign the regression issue to yourself.",
            "Move ORB-12 to In Progress only after triage.",
          ],
        },
      },
    } as unknown as PerformanceReport;

    const coaching = extractGameCoaching(report);
    expect(coaching.directions).toEqual([
      "Complete inbox triage.",
      "Stabilize ownership before moving issues to In Progress.",
    ]);
    expect(coaching.events).toEqual([
      "Assign the regression issue to yourself.",
      "Move ORB-12 to In Progress only after triage.",
    ]);
    expect(coaching.gapRepairs).toEqual(["Assign the regression issue before changing status."]);
  });
});