import { describe, expect, it } from "vitest";
import {
  decideEvalPowGate,
  NO_NEW_POW_CODE,
} from "@/lib/pow-api/eval-pow-gate";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("decideEvalPowGate", () => {
  it("allows first eval of a type when no prior run", () => {
    const status = decideEvalPowGate({
      vertical: "verification",
      lastEvalAt: null,
      newPowCount: 0,
    });
    expect(status.allowed).toBe(true);
    expect(status.last_eval_at).toBeNull();
    expect(status.new_pow_count).toBeNull();
    expect(status.code).toBeUndefined();
  });

  it("allows re-run when new PoW exists since last eval", () => {
    const status = decideEvalPowGate({
      vertical: "augmentation",
      lastEvalAt: "2026-07-19T10:00:00.000Z",
      newPowCount: 3,
    });
    expect(status.allowed).toBe(true);
    expect(status.new_pow_count).toBe(3);
    expect(status.last_eval_at).toBe("2026-07-19T10:00:00.000Z");
  });

  it("blocks re-run of the same type without new PoW", () => {
    const status = decideEvalPowGate({
      vertical: "optimization",
      lastEvalAt: "2026-07-19T12:00:00.000Z",
      newPowCount: 0,
    });
    expect(status.allowed).toBe(false);
    expect(status.code).toBe(NO_NEW_POW_CODE);
    expect(status.new_pow_count).toBe(0);
    expect(status.message).toMatch(/optimization/i);
    expect(status.message).toMatch(/proof of work/i);
  });

  it("gates verticals independently (same helper, different lastEvalAt)", () => {
    const verification = decideEvalPowGate({
      vertical: "verification",
      lastEvalAt: "2026-07-19T10:00:00.000Z",
      newPowCount: 0,
    });
    const augmentation = decideEvalPowGate({
      vertical: "augmentation",
      lastEvalAt: null,
      newPowCount: 0,
    });
    expect(verification.allowed).toBe(false);
    expect(augmentation.allowed).toBe(true);
  });
});

describe("eval pow gate wiring", () => {
  it("runVerticalScore and workspace performance-report call the gate", () => {
    const run = readFileSync(
      join(process.cwd(), "lib/pow-api/run-vertical-score.ts"),
      "utf8",
    );
    const web = readFileSync(
      join(process.cwd(), "app/api/workspace/performance-report/route.ts"),
      "utf8",
    );
    const panel = readFileSync(
      join(process.cwd(), "components/WorkspacePerformancePanel.tsx"),
      "utf8",
    );
    expect(run).toContain("assertEvalAllowedWithNewPow");
    expect(web).toContain("assertEvalAllowedWithNewPow");
    expect(web).toContain("NO_NEW_POW_CODE");
    expect(panel).toContain("eval-history");
    expect(panel).toContain("inspectedRunId");
    expect(panel).toContain("performanceEvalNoNewPow");
  });
});
