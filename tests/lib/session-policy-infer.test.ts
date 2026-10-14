import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeSessionBranchModel,
  recommendSessionBranchAction,
} from "@/lib/session-branch-model";
import {
  applyPolicyInference,
  chooseHighestPolicyConfidence,
  parsePolicyActionLine,
  parsePolicyConfidenceReply,
  parsePolicySuggestionReply,
  policySuggestionIsRawLabel,
  recordPolicyInference,
  SESSION_POLICY_INFER_EVENT_THRESHOLD,
  SESSION_POLICY_INFER_INTERVAL_MS,
  sessionPolicyInferDue,
  sessionPolicyProofFromCanvas,
  type SessionPolicyInference,
} from "@/lib/session-policy-infer";
import { scorePolicySequence } from "@/lib/session-policy-score";
import type { SessionMarkButtonId } from "@/lib/session-marks";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

const thresholds = { eventCount: 3, elapsedMs: 1_000 };

function confidenceReply(winner: SessionMarkButtonId, high = 0.82): string {
  const scores: Record<SessionMarkButtonId, number> = {
    try: 0.05,
    hold: 0.04,
    drop: 0.03,
    insight: 0.02,
  };
  scores[winner] = high;
  return JSON.stringify({
    close: scores.try,
    keep: scores.hold,
    discard: scores.drop,
    insight: scores.insight,
  });
}

function birthTree() {
  return normalizeSessionBranchModel(
    {
      premise: "A priced field.",
      closePrice: 10,
      keepPrice: 40,
      discardPrice: 70,
      insightPrice: 90,
      regions: [
        {
          title: "Region",
          observation: "The region is open.",
          closePrice: 10,
          keepPrice: 40,
          discardPrice: 70,
          insightPrice: 90,
        },
      ],
    },
    "Priced",
  );
}

describe("session policy inference", () => {
  it("waits until enough proof of work or enough time, and never on an empty batch", () => {
    expect(SESSION_POLICY_INFER_EVENT_THRESHOLD).toBeGreaterThan(1);
    expect(SESSION_POLICY_INFER_INTERVAL_MS).toBeGreaterThan(0);
    expect(sessionPolicyInferDue({ pendingEvents: 0, elapsedMs: 60_000, thresholds })).toBe(false);
    expect(sessionPolicyInferDue({ pendingEvents: 2, elapsedMs: 999, thresholds })).toBe(false);
    expect(sessionPolicyInferDue({ pendingEvents: 3, elapsedMs: 0, thresholds })).toBe(true);
    expect(sessionPolicyInferDue({ pendingEvents: 1, elapsedMs: 1_000, thresholds })).toBe(true);
    expect(
      sessionPolicyInferDue({
        pendingEvents: 1,
        elapsedMs: 0,
        thresholds: {
          eventCount: SESSION_POLICY_INFER_EVENT_THRESHOLD,
          elapsedMs: SESSION_POLICY_INFER_INTERVAL_MS,
        },
      }),
    ).toBe(false);
  });

  it("selects the highest confidence from a supplied reply and advances the field", () => {
    const birth = birthTree();
    expect(birth).toBeTruthy();
    if (!birth) return;
    const reply = '{"close":0.1,"keep":0.82,"discard":0.05,"insight":0.03}';
    const confidence = parsePolicyConfidenceReply(reply);
    expect(confidence).toEqual({ try: 0.1, hold: 0.82, drop: 0.05, insight: 0.03 });
    expect(chooseHighestPolicyConfidence(confidence!).action).toBe("hold");

    const tied = parsePolicyConfidenceReply('{"close":0.4,"keep":0.4,"discard":0.1,"insight":0.1}');
    expect(chooseHighestPolicyConfidence(tied!).action).toBe("try");

    const percent = parsePolicyConfidenceReply('{"try":10,"hold":80,"drop":5,"insight":5}');
    expect(percent?.hold).toBeCloseTo(0.8);
    expect(chooseHighestPolicyConfidence(percent!).action).toBe("hold");

    expect(parsePolicyConfidenceReply("not json")).toBeNull();
    expect(parsePolicyConfidenceReply('{"close":0.1,"keep":"high","discard":0.1,"insight":0.1}')).toBeNull();
    expect(parsePolicyConfidenceReply('{"close":0.2,"keep":0.2,"discard":0.2}')).toBeNull();
    expect(parsePolicyConfidenceReply('{"close":0.2,"try":0.9,"keep":0.1,"discard":0.1,"insight":0.1}')).toBeNull();

    const applied = applyPolicyInference(birth, reply);
    expect(applied).toBeTruthy();
    expect(applied!.entry).toMatchObject({ action: "hold", confidence: 0.82, label: "" });
    const line = "Stay with the ray and mark the end that is still open.";
    const lined = applyPolicyInference(
      birth,
      JSON.stringify({
        close: 0.1,
        keep: 0.82,
        discard: 0.05,
        insight: 0.03,
        closeLine: "Close",
        keepLine: line,
        discardLine: "Discard",
        insightLine: "Insight",
      }),
    );
    expect(lined?.entry.label).toBe(line);
    expect(parsePolicyActionLine(reply, "hold")).toBeNull();
    expect(parsePolicyActionLine('{"keepLine":"Keep"}', "hold")).toBeNull();
    expect(applied!.model.step).toBe(birth.step + 1);
    expect(applied!.model).not.toBe(birth);

    const proof = sessionPolicyProofFromCanvas([
      { toolAction: "draw_freedraw", metadata: {} },
      { toolAction: "rephrase", metadata: { prompt: "Say it in fewer words." } },
    ]);
    expect(proof).toEqual([
      { action: "draw_freedraw" },
      { action: "rephrase", prompt: "Say it in fewer words." },
    ]);
  });

  it("appends nothing on a failed reply and scores the inferred sequence on the birth tree", () => {
    const birth = birthTree();
    expect(birth).toBeTruthy();
    if (!birth) return;
    const empty: SessionPolicyInference[] = [];
    const failed = recordPolicyInference(birth, empty, "the model refused");
    expect(failed.model).toBe(birth);
    expect(failed.log).toBe(empty);
    expect(failed.log).toHaveLength(0);

    let model = birth;
    let log: readonly SessionPolicyInference[] = [];
    for (let step = 0; step < 3; step += 1) {
      const best = recommendSessionBranchAction(model, model.focusId);
      expect(best).toBeTruthy();
      if (!best) return;
      const recorded = recordPolicyInference(model, log, confidenceReply(best.id, 0.91));
      expect(recorded.log).toHaveLength(step + 1);
      expect(recorded.log[step]?.action).toBe(best.id);
      expect(recorded.model.step).toBe(model.step + 1);
      model = recorded.model;
      log = recorded.log;
    }
    const stalled = recordPolicyInference(model, log, "still not json");
    expect(stalled.model).toBe(model);
    expect(stalled.log).toBe(log);

    const lowest = scorePolicySequence(
      birth,
      log.map((entry) => entry.action),
    );
    const dearer = scorePolicySequence(birth, ["hold", "hold", "hold"]);
    expect(lowest.steps).toBeGreaterThan(0);
    expect(dearer.steps).toBeGreaterThan(0);
    expect(lowest.distance).toBeLessThan(dearer.distance);

    const closed = birthTree();
    expect(closed).toBeTruthy();
    if (!closed) return;
    let cursor = closed;
    for (let step = 0; step < 6; step += 1) {
      const next = applyPolicyInference(cursor, confidenceReply("try", 0.99));
      if (!next) break;
      cursor = next.model;
    }
    expect(applyPolicyInference(cursor, confidenceReply("hold", 0.99))).toBeNull();
  });

  it("keeps a rephrased suggestion and rejects a raw action label", () => {
    const sentence = "Stay with the line you just drew and open the part that is still thin.";
    expect(parsePolicySuggestionReply(sentence)).toBe(sentence);
    expect(parsePolicySuggestionReply(`{"text":${JSON.stringify(sentence)}}`)).toBe(sentence);
    expect(parsePolicySuggestionReply("Keep")).toBeNull();
    expect(parsePolicySuggestionReply("  discard. ")).toBeNull();
    expect(parsePolicySuggestionReply('{"text":"Insight"}')).toBeNull();
    expect(parsePolicySuggestionReply("")).toBeNull();
    expect(policySuggestionIsRawLabel("Close")).toBe(true);
    expect(policySuggestionIsRawLabel("Forage")).toBe(true);
    expect(policySuggestionIsRawLabel(sentence)).toBe(false);

    const infer = read("lib/session-policy-infer.ts");
    const client = read("lib/session-policy-infer-client.ts");
    const testSource = read("tests/lib/session-policy-infer.test.ts");
    const context = read("components/session-view/session-policy-context.tsx");
    const bridge = context.slice(context.indexOf("function SessionPolicyBridge"));
    expect(infer).not.toContain("callXai");
    expect(infer).not.toContain("xai-client");
    expect(client).not.toContain("xai-client");
    expect(client).not.toContain("callXai");
    expect(testSource).not.toMatch(/from "@\/lib\/xai-client"/);
    expect(testSource).not.toMatch(/from "@\/lib\/session-policy-infer-xai"/);
    expect(context).not.toContain("xai-client");
    expect(context).toContain("sessionPolicyInferDue");
    expect(context).toContain("recordPolicyInference");
    expect(bridge).toContain("useSessionPolicyInferences");
    expect(bridge).toContain("sessionPolicySnapshot(");
    expect(bridge).toContain("target.current = next.snapshot");
    expect(bridge).not.toContain("presses");
    expect(bridge).not.toContain("slot.model");
    const xai = read("lib/session-policy-infer-xai.ts");
    expect(xai).toContain("callXai");
    expect(xai).toContain("closeLine");
    expect(xai).toContain("inferSessionGapReply");
    expect(xai).toContain("Do not use the words Close, Keep, Discard, Insight, Forage, Exploit, Avoid, or Infer.");
    expect(xai.match(/Address the learner as you\. Do not use I, me, or my\./g)).toHaveLength(2);
    expect(read("app/api/ile/session-policy-infer/route.ts")).toContain("planSessionBranchPrepare");
    expect(read("app/api/ile/session-policy-infer/route.ts")).toContain('body.phase === "project"');
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("usePublishSessionProof");
  });
});
