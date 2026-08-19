import { describe, expect, it } from "vitest";
import {
  decideEvalPowGate,
  NO_NEW_POW_CODE,
} from "@/lib/pow-api/eval-pow-gate";
import { LWM_SNAPSHOT_LABEL, SNAPSHOT_VERTICAL } from "@/lib/pow-api/performance-report";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

describe("decideEvalPowGate (single LWM Snapshot strategy)", () => {
  it("allows first snapshot when no prior run", () => {
    const status = decideEvalPowGate({
      vertical: "verification",
      lastEvalAt: null,
      newPowCount: 0,
    });
    expect(status.allowed).toBe(true);
    expect(status.vertical).toBe(SNAPSHOT_VERTICAL);
    expect(status.last_eval_at).toBeNull();
    expect(status.new_pow_count).toBeNull();
    expect(status.code).toBeUndefined();
  });

  it("allows re-run when new PoW exists since last snapshot", () => {
    const status = decideEvalPowGate({
      lastEvalAt: "2026-07-19T10:00:00.000Z",
      newPowCount: 3,
    });
    expect(status.allowed).toBe(true);
    expect(status.new_pow_count).toBe(3);
    expect(status.last_eval_at).toBe("2026-07-19T10:00:00.000Z");
  });

  it("blocks re-run without new PoW", () => {
    const status = decideEvalPowGate({
      lastEvalAt: "2026-07-19T12:00:00.000Z",
      newPowCount: 0,
    });
    expect(status.allowed).toBe(false);
    expect(status.code).toBe(NO_NEW_POW_CODE);
    expect(status.new_pow_count).toBe(0);
    expect(status.message).toMatch(new RegExp(LWM_SNAPSHOT_LABEL, "i"));
    expect(status.message).toMatch(/proof of work/i);
  });

  it("ignores requested vertical — always single snapshot strategy", () => {
    const a = decideEvalPowGate({
      vertical: "augmentation",
      lastEvalAt: "2026-07-19T10:00:00.000Z",
      newPowCount: 0,
    });
    const b = decideEvalPowGate({
      vertical: "optimization",
      lastEvalAt: null,
      newPowCount: 0,
    });
    expect(a.vertical).toBe(SNAPSHOT_VERTICAL);
    expect(a.allowed).toBe(false);
    expect(b.vertical).toBe(SNAPSHOT_VERTICAL);
    expect(b.allowed).toBe(true);
  });
});

describe("eval pow gate wiring", () => {
  it("runVerticalScore, performance-report, and LWM panel call the gate / eligibility", () => {
    const run = readFileSync(
      join(process.cwd(), "lib/pow-api/run-vertical-score.ts"),
      "utf8",
    );
    const web = readFileSync(
      join(process.cwd(), "app/api/workspace/performance-report/route.ts"),
      "utf8",
    );
    const lwm = readKnowledgePanelSurface();
    expect(run).toContain("assertEvalAllowedWithNewPow");
    expect(web).toContain("NO_NEW_POW");
    expect(lwm).toContain("snapshot-history");
    expect(lwm).toContain("data-lwm-generate-snapshot");
    expect(lwm).toContain("snapshotEligibility");
  });
});
