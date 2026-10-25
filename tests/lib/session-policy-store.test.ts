import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { advanceSessionBranchModel, normalizeSessionBranchModel } from "@/lib/session-branch-model";
import { applyIleSessionNameToMetadata } from "@/lib/learn-session-name";
import {
  enqueueIleSessionSave,
  resetIleSessionSaveQueueForTests,
} from "@/lib/learn-session-save-queue";
import { scorePolicySequence } from "@/lib/session-policy-score";
import {
  applySessionPolicyToMetadata,
  clearRememberedSessionPolicies,
  learnFieldFromStoredPolicy,
  mergeRememberedSessionPolicy,
  readSessionPolicyRecord,
  rememberSessionPolicy,
  sessionPolicyRecordFromLive,
  SESSION_POLICY_META_KEY,
} from "@/lib/session-policy-store";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function birthTree() {
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

describe("session policy store", () => {
  beforeEach(() => {
    clearRememberedSessionPolicies();
    resetIleSessionSaveQueueForTests();
  });

  it("restores the live field, the history, and the birth-tree score", () => {
    const birth = birthTree();
    expect(birth).not.toBeNull();
    if (!birth) return;
    const live = advanceSessionBranchModel(birth, { toId: "r1", fromId: birth.focusId });
    expect(live.step).toBe(1);
    expect(live.focusId).toBe("r1");
    const sentence = "Stay with the line you just drew and open the part that is still thin.";
    const inference = {
      hiddenStateId: "r1",
      fromId: birth.focusId,
      confidence: 0.82,
      label: sentence,
    };
    const record = sessionPolicyRecordFromLive({
      model: live,
      birth,
      inferences: [inference],
      suggestion: sentence,
    });
    expect(record).not.toBeNull();
    if (!record) return;
    const metadata = applySessionPolicyToMetadata(
      { session_name: "Morning", whiteboardData: "png" },
      record,
    );
    const named = applyIleSessionNameToMetadata(metadata, "Afternoon");
    expect(named.session_name).toBe("Afternoon");
    expect(named.whiteboardData).toBe("png");
    const restored = readSessionPolicyRecord(named);
    expect(restored?.model.step).toBe(1);
    expect(restored?.model.focusId).toBe(live.focusId);
    expect(restored?.model.chapterTitle).toBe("Heat");
    expect(restored?.birth.step).toBe(0);
    expect(restored?.inferences).toEqual([inference]);
    expect(
      readSessionPolicyRecord({
        [SESSION_POLICY_META_KEY]: {
          version: 1,
          model: live,
          birth,
          inferences: [{ action: "hold", confidence: 0.82, label: "Keep" }],
          suggestion: sentence,
        },
      })?.inferences[0]?.label,
    ).toBe("");
    expect(restored?.suggestion).toBe(sentence);
    expect(
      scorePolicySequence(
        restored!.birth,
        restored!.inferences.map((entry) => entry.hiddenStateId),
      ),
    ).toEqual(scorePolicySequence(birth, ["r1"]));
    const again = applySessionPolicyToMetadata(metadata, record);
    expect(again).toBe(metadata);

    const opened = learnFieldFromStoredPolicy(named, {
      sessionId: "sess-1",
      chapterTitle: "Heat ",
      scope: "chapter-1",
    });
    expect(opened).toEqual({ ok: true, model: restored?.model, key: "chapter-1" });
    expect(learnFieldFromStoredPolicy(named, { chapterTitle: "Sound", scope: "other" })).toBeNull();
    expect(
      learnFieldFromStoredPolicy(named, {
        sessionId: "sess-1",
        chapterTitle: "A cause can fail.",
        scope: "sess-1",
      }),
    ).toEqual({ ok: true, model: restored?.model, key: "sess-1" });
    expect(
      learnFieldFromStoredPolicy(named, {
        sessionId: "sess-1",
        chapterTitle: "A cause can fail.",
        scope: "chapter-1",
      }),
    ).toBeNull();
    const merged = mergeRememberedSessionPolicy(
      { session_name: "Afternoon" } as Record<string, unknown>,
      "sess-1",
    );
    expect(merged[SESSION_POLICY_META_KEY]).toBeTruthy();
  });

  it("drops a snapshot that cannot be resumed", () => {
    const birth = birthTree();
    expect(birth).not.toBeNull();
    if (!birth) return;
    expect(readSessionPolicyRecord(null)).toBeNull();
    expect(readSessionPolicyRecord({ [SESSION_POLICY_META_KEY]: { version: 2 } })).toBeNull();
    expect(readSessionPolicyRecord({ [SESSION_POLICY_META_KEY]: "{not json" })).toBeNull();
    expect(
      sessionPolicyRecordFromLive({
        model: { ...birth, step: 1 },
        birth: { ...birth, step: 1 },
        inferences: [],
        suggestion: "Keep",
      }),
    ).toBeNull();
    const live = advanceSessionBranchModel(birth, { toId: "r1", fromId: birth.focusId });
    const record = sessionPolicyRecordFromLive({
      model: live,
      birth,
      inferences: [{ action: "hold", confidence: 0.5, label: "nope" }],
      suggestion: "Keep",
    });
    expect(record?.suggestion).toBeNull();
    expect(record?.inferences[0]?.label).toBe("nope");
    const encoded = JSON.stringify({
      version: 1,
      model: live,
      birth,
      inferences: [{ action: "hold", confidence: 0.5, label: "Keep" }],
      suggestion: null,
    });
    const decoded = readSessionPolicyRecord({ [SESSION_POLICY_META_KEY]: encoded });
    expect(decoded?.model.step).toBe(1);
    expect(decoded?.inferences[0]?.label).toBe("");
  });

  it("writes a later session save after the one already in flight", async () => {
    const order: string[] = [];
    const first = enqueueIleSessionSave(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            order.push("first");
            resolve();
          }, 20);
        }),
    );
    const second = enqueueIleSessionSave(async () => {
      order.push("second");
    });
    await second;
    await first;
    expect(order).toEqual(["first", "second"]);
  });

  it("keeps autosave on the session row and naming on the exit dialog", () => {
    const store = read("lib/session-policy-store.ts");
    const prepare = read("components/session-view/session-branch-prepare.tsx");
    const phase = read("components/session-view/use-session-field.ts");
    const sessionPhase = read("components/session-view/use-session-phase.ts");
    const canvas = read("components/session-view/session-chapter-canvas.tsx");
    const autosave = read("components/session-view/session-policy-autosave.tsx");
    const persist = read("lib/learn-session-persist.ts");
    const context = read("components/session-view/session-policy-context.tsx");
    const confirmAt = phase.indexOf("const handleConfirmSettings");
    const readyAt = phase.indexOf("const handleWelcomeReadyStart");
    const confirm = phase.slice(confirmAt, phase.indexOf("const handleWelcomeReadyStart", confirmAt));
    const ready = phase.slice(readyAt, phase.indexOf("return {", readyAt));
    const restoreAt = context.indexOf("const restorePolicy");
    const restore = context.slice(restoreAt, context.indexOf("return (", restoreAt));
    expect(store).not.toContain("callXai");
    expect(store).not.toContain("xai-client");
    expect(prepare.indexOf("learnFieldFromStoredPolicy")).toBeGreaterThan(-1);
    expect(prepare.indexOf("learnFieldFromStoredPolicy")).toBeLessThan(
      prepare.indexOf("loadSessionBranchField"),
    );
    expect(prepare).toContain("useRestoreSessionPolicy");
    expect(confirm.indexOf("learnFieldFromStoredPolicy")).toBeGreaterThan(-1);
    expect(confirm.indexOf("learnFieldFromStoredPolicy")).toBeLessThan(
      confirm.indexOf("loadSessionBranchField"),
    );
    expect(confirm.indexOf("loadSessionBranchField")).toBeLessThan(confirm.indexOf("startRecording()"));
    expect(ready.indexOf("learnFieldFromStoredPolicy")).toBeLessThan(ready.indexOf("loadSessionBranchField"));
    expect(ready.indexOf("loadSessionBranchField")).toBeLessThan(ready.indexOf("startRecording()"));
    expect(sessionPhase).toContain("persistIleSessionRow");
    expect(sessionPhase).toContain("applyIleSessionNameToMetadata");
    expect(canvas.indexOf("useSessionBranchField")).toBeLessThan(canvas.indexOf("sessionCanvasMayOpen"));
    expect(canvas).toContain("session?.metadata");
    expect(canvas).toContain("<SessionPolicyAutosave");
    expect(autosave).toContain("rememberSessionPolicy");
    expect(autosave).toContain("persistIleSessionRow");
    expect(persist).toContain("mergeRememberedSessionPolicy");
    expect(persist).toContain("enqueueIleSessionSave");
    expect(restore).toContain("setInferences(record.inferences)");
    expect(restore).not.toContain("publishSlot");
    expect(context).toContain("if (suggestAction.current) setSuggestion(null)");
    expect(rememberSessionPolicy("sess-2", sessionPolicyRecordFromLive({
      model: birthTree(),
      birth: birthTree(),
      inferences: [],
    })!)).toBeUndefined();
  });
});
