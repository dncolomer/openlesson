import { describe, expect, it } from "vitest";
import {
  addProbeToSession,
  endSession,
  getIlePostSessionPath,
  getSessionStats,
  isUuid,
  validatePlanSteps,
  type Probe,
  type Session,
  type SessionPlanStep,
} from "@/lib/domain/types";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    problem: "Why is the sky blue?",
    startedAt: new Date().toISOString(),
    durationMs: 60_000,
    status: "active",
    probes: [],
    objectives: [],
    hasAudio: false,
    metadata: {},
    ...overrides,
  };
}

describe("domain types pure helpers", () => {
  it("validatePlanSteps accepts valid steps and empty arrays", () => {
    expect(() => validatePlanSteps([])).not.toThrow();
    const steps: SessionPlanStep[] = [
      {
        id: "s1",
        description: "Define the problem",
        status: "pending",
        type: "question",
        order: 0,
      },
    ];
    expect(() => validatePlanSteps(steps)).not.toThrow();
  });

  it("validatePlanSteps rejects empty descriptions", () => {
    const steps: SessionPlanStep[] = [
      {
        id: "s1",
        description: "   ",
        status: "pending",
        type: "question",
        order: 0,
      },
    ];
    expect(() => validatePlanSteps(steps)).toThrow(/empty descriptions/);
  });

  it("isUuid accepts RFC4122-looking ids and rejects ordinals", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("1")).toBe(false);
    expect(isUuid("probe_1")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it("addProbeToSession appends without mutating the original", () => {
    const session = makeSession();
    const probe: Probe = {
      id: "22222222-2222-4222-8222-222222222222",
      timestamp: 1200,
      gapScore: 0.4,
      signals: ["hesitation"],
      text: "What did you assume?",
    };
    const next = addProbeToSession(session, probe);
    expect(next.probes).toHaveLength(1);
    expect(session.probes).toHaveLength(0);
    expect(next.probes[0].text).toBe("What did you assume?");
  });

  it("endSession marks completed with duration", () => {
    const session = makeSession({ status: "active" });
    const ended = endSession(session, 90_000);
    expect(ended.status).toBe("completed");
    expect(ended.durationMs).toBe(90_000);
    expect(ended.endedAt).toBeTruthy();
  });

  it("getIlePostSessionPath prefers workspace when present", () => {
    expect(getIlePostSessionPath({ metadata: {} })).toBe("/dashboard");
    expect(
      getIlePostSessionPath({
        metadata: { workspace_id: "ws-abc" },
      })
    ).toBe("/workspace/ws-abc");
  });

  it("getSessionStats computes probe averages", () => {
    const session = makeSession({
      durationMs: 120_000,
      probes: [
        {
          id: "a",
          timestamp: 0,
          gapScore: 0.2,
          signals: [],
          text: "q1",
        },
        {
          id: "b",
          timestamp: 1000,
          gapScore: 0.8,
          signals: [],
          text: "q2",
        },
      ],
    });
    const stats = getSessionStats(session);
    expect(stats.probeCount).toBe(2);
    expect(stats.avgGapScore).toBe(0.5);
    expect(stats.durationMinutes).toBe(2);
    expect(stats.peakGapScore).toBe(0.8);
  });
});
