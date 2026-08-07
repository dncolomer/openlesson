/**
 * Snapshot re-run gate with goal-set identity.
 * Drives shipped decideEvalPowGate / decideEvalPowGateWithGoals.
 */
import { describe, expect, it } from "vitest";
import {
  decideEvalPowGate,
  decideEvalPowGateWithGoals,
  NO_NEW_POW_CODE,
} from "@/lib/pow-api/eval-pow-gate";
import { fingerprintGoals } from "@/lib/pow-api/goals";

describe("decideEvalPowGateWithGoals — PoW∪goals uniqueness", () => {
  const goalsA = fingerprintGoals([
    { id: "wg-1", text: "Ship API", scope: "workspace" },
  ]);
  const goalsB = fingerprintGoals([
    { id: "wg-2", text: "Certify", scope: "workspace" },
  ]);

  it("same PoW + same goals → still requires new PoW after a prior snapshot", () => {
    const status = decideEvalPowGateWithGoals({
      lastEvalAtForGoals: "2026-08-01T12:00:00.000Z",
      newPowCountSinceLastForGoals: 0,
      goalsFingerprint: goalsA,
    });
    expect(status.allowed).toBe(false);
    expect(status.code).toBe(NO_NEW_POW_CODE);
    expect(status.goals_fingerprint).toBe(goalsA);
  });

  it("same PoW + different goals → allowed without new PoW (no prior for that fingerprint)", () => {
    // No prior eval for goalsB → first snapshot for that set is allowed
    const status = decideEvalPowGateWithGoals({
      lastEvalAtForGoals: null,
      newPowCountSinceLastForGoals: 0,
      goalsFingerprint: goalsB,
    });
    expect(status.allowed).toBe(true);
    expect(status.goals_fingerprint).toBe(goalsB);
  });

  it("different PoW + same goals → allowed when new_pow_count > 0", () => {
    const status = decideEvalPowGateWithGoals({
      lastEvalAtForGoals: "2026-08-01T12:00:00.000Z",
      newPowCountSinceLastForGoals: 2,
      goalsFingerprint: goalsA,
    });
    expect(status.allowed).toBe(true);
    expect(status.new_pow_count).toBe(2);
  });

  it("decideEvalPowGate still works without goals fingerprint", () => {
    expect(
      decideEvalPowGate({
        lastEvalAt: "2026-08-01T12:00:00.000Z",
        newPowCount: 0,
      }).allowed,
    ).toBe(false);
    expect(
      decideEvalPowGate({
        lastEvalAt: null,
        newPowCount: 0,
      }).allowed,
    ).toBe(true);
  });
});
