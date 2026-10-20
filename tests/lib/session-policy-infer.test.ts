import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeSessionBranchModel,
  recommendSessionBranchAction,
} from "@/lib/session-branch-model";
import {
  applyPolicyInference,
  parsePolicyHiddenStateReply,
  parsePolicySuggestionReply,
  policySuggestionIsRawLabel,
  recordPolicyInference,
  SESSION_POLICY_INFER_EVENT_THRESHOLD,
  SESSION_POLICY_INFER_INTERVAL_MS,
  sessionPolicyCandidateLines,
  sessionPolicyInferDue,
  sessionPolicyLocalSuggestion,
  sessionPolicyProofFromCanvas,
  type SessionPolicyInference,
} from "@/lib/session-policy-infer";
import { scorePolicySequence } from "@/lib/session-policy-score";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

const thresholds = { eventCount: 3, elapsedMs: 1_000 };

function hiddenReply(hiddenStateId: string, confidence = 0.82, line = ""): string {
  return JSON.stringify({
    hiddenStateId,
    confidence,
    line,
  });
}

function birthTree() {
  return normalizeSessionBranchModel(
    {
      premise: "A priced field.",
      question: "What is still open?",
      territory: "A priced field.",
      observation: "The field is open.",
      regions: [
        {
          title: "Cheap region",
          question: "What is cheap here?",
          territory: "Cheap region of the field.",
          observation: "The cheap region is open.",
          edgePrice: 8,
        },
        {
          title: "Dear region",
          question: "What is dear here?",
          territory: "Dear region of the field.",
          observation: "The dear region is open.",
          edgePrice: 70,
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

  it("selects a hidden state from a supplied reply and travels that edge", () => {
    const birth = birthTree();
    expect(birth).toBeTruthy();
    if (!birth) return;
    const parsed = parsePolicyHiddenStateReply(hiddenReply("r1", 0.82));
    expect(parsed).toMatchObject({ hiddenStateId: "r1", confidence: 0.82, label: "" });
    expect(parsePolicyHiddenStateReply("not json")).toBeNull();
    expect(parsePolicyHiddenStateReply('{"hiddenStateId":"r1"}')).toBeNull();
    expect(parsePolicyHiddenStateReply('{"hiddenStateId":"r1","confidence":"high"}')).toBeNull();

    const percent = parsePolicyHiddenStateReply(JSON.stringify({ hiddenStateId: "r2", confidence: 80 }));
    expect(percent?.confidence).toBeCloseTo(0.8);

    const applied = applyPolicyInference(birth, hiddenReply("r1", 0.82));
    expect(applied).toBeTruthy();
    expect(applied!.entry).toMatchObject({
      hiddenStateId: "r1",
      fromId: birth.focusId,
      confidence: 0.82,
      label: "",
    });
    const line = "Stay with the ray and mark the end that is still open.";
    const lined = applyPolicyInference(birth, hiddenReply("r1", 0.82, line));
    expect(lined?.entry.label).toBe(line);
    expect(applied!.model.step).toBe(birth.step + 1);
    expect(applied!.model.focusId).toBe("r1");
    expect(applied!.model).not.toBe(birth);
    expect(applyPolicyInference(birth, hiddenReply("missing", 0.9))).toBeNull();

    const proof = sessionPolicyProofFromCanvas([
      { toolAction: "draw_freedraw", metadata: {} },
      { toolAction: "rephrase", metadata: { prompt: "Say it in fewer words." } },
    ]);
    expect(proof).toEqual([
      { action: "draw_freedraw" },
      { action: "rephrase", prompt: "Say it in fewer words." },
    ]);
  });

  it("appends nothing on a failed reply and scores the inferred path on the birth tree", () => {
    const birth = birthTree();
    expect(birth).toBeTruthy();
    if (!birth) return;
    const empty: SessionPolicyInference[] = [];
    const failed = recordPolicyInference(birth, empty, "the model refused");
    expect(failed.model).toBe(birth);
    expect(failed.log).toBe(empty);
    expect(failed.log).toHaveLength(0);

    const best = recommendSessionBranchAction(birth, birth.focusId);
    expect(best?.toId).toBe("r1");
    expect(sessionPolicyLocalSuggestion({
      nodeTitle: best?.leads,
      observation: best?.observation,
      intent: best?.observation,
    })).toBe("The cheap region is open.");
    expect(sessionPolicyCandidateLines(birth)).toContain("cheapest: true");
    expect(sessionPolicyCandidateLines(birth)).toContain("price: 8");
    const recorded = recordPolicyInference(birth, empty, hiddenReply(best!.toId, 0.91));
    expect(recorded.log).toHaveLength(1);
    expect(recorded.log[0]?.hiddenStateId).toBe("r1");
    expect(recorded.model.step).toBe(birth.step + 1);

    const stalled = recordPolicyInference(recorded.model, recorded.log, "still not json");
    expect(stalled.model).toBe(recorded.model);
    expect(stalled.log).toBe(recorded.log);

    const lowest = scorePolicySequence(birth, ["r1"]);
    const dearer = scorePolicySequence(birth, ["r2"]);
    expect(lowest.steps).toBe(1);
    expect(dearer.steps).toBe(1);
    expect(lowest.distance).toBeLessThan(dearer.distance);
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
    expect(context).toContain("sessionPolicyCandidateLines");
    expect(context).toContain("sessionPolicyLocalSuggestion");
    expect(infer).toContain("cheapest: true");
    expect(bridge).toContain("useSessionPolicyInferences");
    expect(bridge).toContain("sessionPolicySnapshot(");
    expect(bridge).toContain("target.current = next.snapshot");
    expect(bridge).not.toContain("presses");
    expect(bridge).not.toContain("slot.model");
    const xai = read("lib/session-policy-infer-xai.ts");
    expect(xai).toContain("sessionPolicyLocalSuggestion");
    expect(xai).toContain("Stay on it.");
    expect(xai).toContain("callXai");
    expect(xai).toContain("callPolicyXai");
    expect(xai).toContain("hiddenStateId");
    expect(xai).toContain("inferSessionGapReply");
    expect(xai).toContain("Do not use the words Close, Keep, Discard, Insight, Forage, Exploit, Avoid, or Infer.");
    expect(xai.match(/Address the learner as you\. Do not use I, me, or my\./g)).toHaveLength(2);
    expect(xai).toContain("POLICY_XAI_TIMEOUT_MS = 12_000");
    expect(xai).toContain('responseFormat: "json_schema"');
    expect(xai).toContain('responseFormat: "json"');
    expect(xai).toContain("retries: 1");
    expect(xai).not.toContain("fetchTimeout: 30_000");
    expect(context).not.toContain('draft?.mode !== "learn"');
    expect(read("app/api/ile/session-policy-infer/route.ts")).toContain("planSessionBranchPrepare");
    expect(read("app/api/ile/session-policy-infer/route.ts")).toContain('body.phase === "project"');
    expect(read("app/api/ile/session-policy-infer/route.ts")).toContain("NextResponse.json({ reply: null })");
    expect(read("app/api/ile/session-policy-infer/route.ts")).not.toContain('jsonError(502, "The policy could not be read.")');
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("usePublishSessionProof");
  });
});
