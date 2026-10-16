import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadSessionBranchField,
  readSessionBranchFieldCache,
  sessionBranchFieldRequestKey,
} from "@/lib/session-branch-field-load";
import { releaseSessionLocalMemory } from "@/lib/session-local-memory";
import {
  clearRememberedSessionPolicies,
  mergeRememberedSessionPolicy,
  rememberSessionPolicy,
  sessionPolicyRecordFromLive,
  SESSION_POLICY_META_KEY,
} from "@/lib/session-policy-store";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function birth() {
  return normalizeSessionBranchModel(
    {
      premise: "Heat moves from warm to cool.",
      closePrice: 10,
      keepPrice: 40,
      discardPrice: 70,
      insightPrice: 90,
      regions: [
        {
          title: "Conduction",
          observation: "Conduction is touch.",
          closePrice: 15,
          keepPrice: 25,
          discardPrice: 55,
          insightPrice: 80,
        },
      ],
    },
    "Heat",
  );
}

describe("releaseSessionLocalMemory", () => {
  beforeEach(() => {
    releaseSessionLocalMemory();
    clearRememberedSessionPolicies();
  });

  it("drops the field cache and the remembered policy after persist", async () => {
    const model = birth();
    expect(model).not.toBeNull();
    if (!model) return;
    const record = sessionPolicyRecordFromLive({
      model,
      birth: model,
      inferences: [],
    });
    expect(record).not.toBeNull();
    if (!record) return;
    rememberSessionPolicy("sess-exit", record);
    expect(
      mergeRememberedSessionPolicy({} as Record<string, unknown>, "sess-exit")[
        SESSION_POLICY_META_KEY
      ],
    ).toBeTruthy();

    const loaded = await loadSessionBranchField(
      {
        chapterTitle: "Heat",
        chapterBrief: "Conduction is touch.",
        scope: "chapter-exit",
        sessionId: "sess-exit",
      },
      {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              model,
              done: true,
            }),
            { status: 200 },
          ),
      },
    );
    expect(loaded.ok).toBe(true);
    const key = loaded.ok ? loaded.key : sessionBranchFieldRequestKey({
      chapterTitle: "Heat",
      scope: "chapter-exit",
      sessionId: "sess-exit",
    });
    expect(readSessionBranchFieldCache(key)?.model).toBeTruthy();

    releaseSessionLocalMemory("sess-exit");
    expect(readSessionBranchFieldCache(key)).toBeUndefined();
    expect(
      mergeRememberedSessionPolicy({} as Record<string, unknown>, "sess-exit")[
        SESSION_POLICY_META_KEY
      ],
    ).toBeUndefined();
  });

  it("Learn, Calibrate, and Verify release after persist and on unmount", () => {
    const phase = read("components/session-view/use-session-phase.ts");
    const stop = phase.slice(phase.indexOf("const stopRecording"));
    const persistAt = stop.indexOf("await persistIleSessionRow");
    const releaseAt = stop.indexOf("releaseSessionLocalMemory", persistAt);
    expect(persistAt).toBeGreaterThan(-1);
    expect(releaseAt).toBeGreaterThan(persistAt);
    expect(phase).toContain("releaseSessionLocalMemory(sessionRef.current?.id)");
    expect(phase).toContain("releaseSessionLocalMemory(next?.id ?? current?.id)");

    const calibrate = read("components/CalibrationFlowRunner.tsx");
    expect(calibrate).toContain("releaseSessionLocalMemory()");
    const store = calibrate.slice(calibrate.indexOf("const storeProof"));
    expect(store.indexOf("setStored(true)")).toBeLessThan(store.indexOf("releaseSessionLocalMemory()"));

    const scout = read("components/scout-tap/ScoutTapClient.tsx");
    expect(scout).toContain("releaseSessionLocalMemory(sessionId)");

    const tap = read("components/tap-score/use-tap-score-flow.ts");
    expect(tap).toContain("releaseSessionLocalMemory(s.sessionId)");
    expect(tap).toContain("releaseSessionLocalMemory(sessionRef.current.sessionId)");
  });

  it("removes local Gemma inference", () => {
    expect(() => read("lib/local-inference.ts")).toThrow();
    expect(() => read("lib/local-context.ts")).toThrow();
    expect(() => read("components/ModelLoadingModal.tsx")).toThrow();
    expect(read("package.json")).not.toContain("@huggingface/transformers");
    expect(read("components/SessionView.tsx")).not.toContain("LocalInferenceManager");
    expect(read("components/session-view/use-session-phase.ts")).not.toContain("LocalInferenceManager");
  });
});
