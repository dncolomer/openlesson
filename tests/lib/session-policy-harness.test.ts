import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SessionFieldLoader } from "@/components/session-view/session-field-gate";
import {
  formatPolicyScoreFigure,
  SessionPolicyScoreResult,
} from "@/components/session-view/session-policy-score-result";
import { SessionMarkControls } from "@/components/session-view/session-mark-controls";
import {
  SessionPolicyProvider,
  useSessionMarkCanvasEffects,
} from "@/components/session-view/session-policy-context";
import { applyCalibrationCommand, emptyCalibrationState } from "@/lib/calibration-flow";
import {
  canvasEffectGateApply,
  canvasEffectGateRegister,
  emptyCanvasEffectGate,
  sessionActionsMayCommit,
} from "@/lib/session-canvas-effect-gate";
import {
  advanceSessionBranchModel,
  normalizeSessionBranchModel,
  recommendSessionBranchAction,
  sessionBranchById,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import {
  clearSessionBranchFieldCache,
  loadSessionBranchField,
  readSessionBranchFieldCache,
  sessionBranchFieldLoadDecision,
  sessionBranchFieldRequestKey,
  sessionClockMayStart,
  subscribeSessionBranchField,
} from "@/lib/session-branch-field-load";
import {
  sessionActionPricesVisible,
  sessionCanvasMayOpen,
  sessionFieldLoadProgress,
} from "@/lib/session-field-gate";
import {
  embedPolicyScore,
  policyScoreFromSnapshot,
  policyScoreFromUnknown,
  policyScoreProofEvent,
  scorePolicySequence,
  sessionPolicySnapshot,
} from "@/lib/session-policy-score";
import type { SessionMarkCanvasEffect } from "@/lib/session-mark-canvas";
import type { SessionMarkButtonId } from "@/lib/session-marks";
import { buildRegionFromFlowEmbeddings, verificationProofEmbedding } from "@/lib/verification-flow";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("session field gate", () => {
  it("keeps the canvas closed until a tree is ready", () => {
    expect(sessionCanvasMayOpen(null)).toBe(false);
    expect(sessionCanvasMayOpen(undefined)).toBe(false);
    expect(sessionCanvasMayOpen({ status: "idle", model: null })).toBe(false);
    expect(sessionCanvasMayOpen({ status: "preparing", model: null })).toBe(false);
    expect(sessionCanvasMayOpen({ status: "failed", model: null })).toBe(false);
    const model = normalizeSessionBranchModel(
      {
        premise: "A ready field.",
        regions: [{ title: "Region", observation: "The region is open." }],
      },
      "Ready",
    );
    expect(model).toBeTruthy();
    expect(sessionCanvasMayOpen({ status: "ready", model: null })).toBe(false);
    expect(sessionCanvasMayOpen({ status: "preparing", model })).toBe(false);
    expect(sessionCanvasMayOpen({ status: "ready", model })).toBe(true);
  });

  it("shows prices only on Learn", () => {
    expect(sessionActionPricesVisible("learn")).toBe(true);
    expect(sessionActionPricesVisible("calibrate")).toBe(false);
    expect(sessionActionPricesVisible("verification")).toBe(false);
    expect(sessionActionPricesVisible(null)).toBe(false);
  });

  it("reports load progress and a refusal without opening", () => {
    const start = sessionFieldLoadProgress({ status: "preparing", elapsedMs: 0 });
    const later = sessionFieldLoadProgress({ status: "preparing", elapsedMs: 20_000 });
    const ready = sessionFieldLoadProgress({ status: "ready", elapsedMs: 20_000 });
    const failed = sessionFieldLoadProgress({
      status: "failed",
      elapsedMs: 20_000,
      error: "The field came back too small to work in.",
    });
    expect(start.percent).toBeLessThan(100);
    expect(later.percent).toBeGreaterThan(start.percent);
    expect(later.percent).toBeLessThan(100);
    expect(later.label).not.toBe(start.label);
    expect(ready.percent).toBe(100);
    expect(failed.label).toContain("too small");
    expect(sessionCanvasMayOpen({ status: "failed", model: null })).toBe(false);
    const loader = renderToStaticMarkup(
      createElement(SessionFieldLoader, { status: "preparing", error: null }),
    );
    expect(loader).toContain('data-session-field-open="false"');
    expect(loader).toContain('role="progressbar"');
    expect(loader).toContain(start.label);
  });

  it("waits on the ready tree and puts commands and instructions in the live sidebar", () => {
    const learn = read("components/session-view/session-chapter-canvas.tsx");
    const prepare = read("components/session-view/session-branch-prepare.tsx");
    const calibrate = read("components/calibrate/calibrate-sounding-surface.tsx");
    const verification = read("components/tap-score/tap-score-phases.tsx");
    const publicCalibrate = read("components/CalibrationFlowRunner.tsx");
    const publicVerification = read("components/VerificationFlowRunner.tsx");
    const workspaceCalibrate = read("components/scout-tap/scout-tap-phases.tsx");
    const workspaceVerification = read("app/workspace/[id]/tap/page.tsx");
    const learnChrome = read("components/session-view/session-chrome.tsx");
    const prompt = read("components/excalidraw-canvas/canvas-prompt-bar.tsx");

    expect(learn).toContain("useSessionBranchField");
    expect(learn.indexOf("useSessionBranchField")).toBeLessThan(learn.indexOf("sessionCanvasMayOpen"));
    expect(learn).toContain("<SessionFieldLoader");
    expect(prepare).toContain("<SessionFieldGate>{children}</SessionFieldGate>");
    expect(calibrate).toContain("data-calibrate-sounding");
    expect(calibrate).not.toContain("SessionActionsPanel");
    expect(calibrate).not.toContain("data-calibrate-done-classifying");
    expect(calibrate).not.toContain("I'm done classifying");
    expect(workspaceCalibrate).toContain("<CalibrateSoundingSurface");
    expect(publicCalibrate).toContain("<CalibrateSoundingSurface");
    expect(verification).toContain('enabled={sidebarMode === "verification-tap"}');
    expect(verification).toContain('sidebarMode === "verification-tap" ? (\n                  <SessionGuidePanel guide="verification" />');
    expect(verification).toContain("data-tap-older-thoughts");
    const verificationFocus = verification.slice(
      verification.indexOf('sidebarMode === "verification-tap" ? ('),
      verification.indexOf("data-tap-older-thoughts"),
    );
    expect(verificationFocus).toContain('<SessionGuidePanel guide="verification" />');
    expect(verificationFocus).not.toContain("ThoughtMemoryPanel");
    expect(verificationFocus).not.toContain("I'm done");
    expect(publicVerification).toContain('sidebarMode="verification-tap"');
    expect(workspaceVerification).toContain("verification");
    expect(learnChrome).toContain('<SessionGuidePanel guide="learn" />');
    expect(learnChrome).toContain('id="actions"');
    expect(learnChrome).not.toContain("SessionActionsPanel");
    expect(learnChrome).not.toContain('focusLabel="actions"');
    expect(prompt).not.toContain("<SessionMarkControls");
    expect(prompt).toContain("mode: sessionMarkMode");
  });
});

function pricedNode(title: string) {
  return {
    title,
    observation: `${title} is open.`,
    closePrice: 10,
    keepPrice: 40,
    discardPrice: 80,
    insightPrice: 90,
    closeObservation: `Closing ${title} writes the next observation.`,
    keepObservation: `Keeping ${title} writes the next observation.`,
    discardObservation: `Discarding ${title} writes the next observation.`,
    insightObservation: `Insight on ${title} writes the next observation.`,
  };
}

function fixtureTree(): SessionBranchModel {
  const region = pricedNode("Region");
  const model = normalizeSessionBranchModel(
    {
      premise: "A priced field.",
      ...pricedNode("Premise"),
      regions: [
        {
          ...region,
          avenues: [pricedNode("Avenue")],
        },
      ],
    },
    "Priced",
  );
  if (!model) throw new Error("fixture tree was refused");
  return model;
}

function walkSequence(
  model: SessionBranchModel,
  pick: (
    bestId: SessionMarkButtonId,
    actions: { id: SessionMarkButtonId; price: number }[],
  ) => SessionMarkButtonId,
): SessionMarkButtonId[] {
  const sequence: SessionMarkButtonId[] = [];
  let cursor = model;
  for (let step = 0; step < 3; step += 1) {
    const focus = sessionBranchById(cursor, cursor.focusId);
    const best = recommendSessionBranchAction(cursor, cursor.focusId);
    if (!focus || !best) break;
    const action = pick(best.id, focus.actions);
    sequence.push(action);
    const next = advanceSessionBranchModel(cursor, { action, branchId: cursor.focusId });
    if (next === cursor) break;
    cursor = next;
  }
  return sequence;
}

describe("policy score against the prepared tree", () => {
  const model = fixtureTree();
  const lowest = walkSequence(model, (bestId) => bestId);
  const higher = walkSequence(model, (bestId, actions) => {
    const dearer = actions
      .filter((action) => action.id !== bestId && action.id !== "insight")
      .sort((a, b) => b.price - a.price)[0];
    if (!dearer || dearer.price <= (actions.find((action) => action.id === bestId)?.price ?? 0)) {
      throw new Error("fixture has no dearer action");
    }
    return dearer.id;
  });

  it("scores the lowest-priced sequence closer than a dearer sequence on the same tree", () => {
    const near = scorePair(model, lowest);
    const far = scorePair(model, higher);
    expect(near.steps).toBeGreaterThan(0);
    expect(far.steps).toBe(near.steps);
    expect(near.distance).toBeLessThan(far.distance);
    expect(near.sequence).not.toEqual(far.sequence);
  });

  it("shows distance, steps, and excess on the time-ended results pages", () => {
    expect(policyScoreFromSnapshot(null)).toBeNull();
    expect(policyScoreFromSnapshot({ model: null, sequence: ["try"] })).toBeNull();
    const scored = scorePolicySequence(model, higher);
    expect(policyScoreFromSnapshot({ model, sequence: higher })).toEqual(scored);

    const html = renderToStaticMarkup(
      createElement(SessionPolicyScoreResult, {
        score: { steps: 3, excess: 12.5, distance: 4.17, sequence: ["try", "hold"] },
      }),
    );
    expect(html).toContain('data-session-policy-score=""');
    expect(html).toContain('data-session-policy-distance="4.17"');
    expect(html).toContain('data-session-policy-steps="3"');
    expect(html).toContain('data-session-policy-excess="12.5"');
    expect(html).toContain(`>${formatPolicyScoreFigure(4.17)}<`);
    expect(html).toContain(">Policy score<");
    expect(html).toContain(">Distance<");
    expect(html).toContain(">Steps<");
    expect(html).toContain(">Excess<");
    expect(html).not.toMatch(/\b(try|hold|drop|insight)\b/);
    expect(renderToStaticMarkup(createElement(SessionPolicyScoreResult, { score: null }))).toBe("");

    const tap = read("components/tap-score/tap-score-phases.tsx");
    const impure = sliceBetween(tap, "data-tap-session-impure", "data-tap-session-thank-you");
    expect(impure).not.toContain("SessionPolicyScoreResult");
    const thankYou = tap.slice(tap.indexOf("data-tap-session-thank-you"));
    expect(thankYou).toContain("<SessionPolicyScoreResult");
    expect(thankYou).toContain("thankYouTitle");
    expect(thankYou).toContain("thankYouBody");
    expect(thankYou).toContain("data-tap-explore-uncertain-systems");
    const results = tap.slice(tap.indexOf("tap.postSession.resultsTitle"));
    expect(results).toContain("<SessionPolicyScoreResult");
    expect(results).toContain("policyScore || performanceReport");

    const scout = read("components/scout-tap/scout-tap-phases.tsx");
    const scoutThanks = scout.slice(scout.indexOf("data-scout-thank-you"));
    expect(scoutThanks).toContain("data-tap-session-thank-you");
    expect(scoutThanks).toContain("<SessionSoundingResult");
    expect(scoutThanks).toContain("SoundingFinishedStage");

    const calibrate = read("components/CalibrationFlowRunner.tsx");
    expect(calibrate).toContain("data-calibration-time-up");
    expect(calibrate).toContain("Time is up");
    expect(calibrate).toContain("data-calibration-thank-you");
    expect(calibrate).toContain("Your calibration proof of work has been stored.");
    expect(calibrate).toContain("<SessionSoundingResult");
    expect(calibrate).toContain("SoundingFinishedStage");
    expect(calibrate).toContain("soundingResultPresentation");

    expect(read("components/session-view/ile-insight-kept-screen.tsx")).not.toContain(
      "SessionPolicyScoreResult",
    );
    expect(read("components/exercise-tap/exercise-tap-phases.tsx")).not.toContain(
      "SessionPolicyScoreResult",
    );
  });

  it("changes the embedding when the sequence or the captured proof changes", () => {
    const speech = embedPolicyScore({
      model,
      sequence: lowest,
      workspaceId: "ws-policy",
      note: "The person spoke the observation.",
      proofRows: [{ proof_of_work_type: "speech", timestamp_ms: 40, tool_name: "speech" }],
    });
    const otherSequence = embedPolicyScore({
      model,
      sequence: higher,
      workspaceId: "ws-policy",
      note: "The person spoke the observation.",
      proofRows: [{ proof_of_work_type: "speech", timestamp_ms: 40, tool_name: "speech" }],
    });
    const canvas = embedPolicyScore({
      model,
      sequence: lowest,
      workspaceId: "ws-policy",
      note: "The person spoke the observation.",
      proofRows: [
        {
          proof_of_work_type: "tool",
          timestamp_ms: 40,
          tool_name: "canvas",
          tool_action: "draw",
        },
      ],
    });
    expect(speech.embedding).not.toEqual(otherSequence.embedding);
    expect(speech.embedding).not.toEqual(canvas.embedding);
    expect(speech.embedding.length).toBeGreaterThan(0);
    expect(speech.text).toContain("policy distance");
    expect(canvas.text).toContain(speech.score.sequence.join(" "));
  });

  it("builds a verification region from the policy-score embeddings", () => {
    const prompt = "What does this question ask the person to notice?";
    const low = verificationProofEmbedding({
      prompt,
      source: "runner",
      workspaceId: "flow-policy",
      policy: { model, sequence: lowest },
    });
    const high = verificationProofEmbedding({
      prompt,
      source: "runner",
      workspaceId: "flow-policy",
      policy: { model, sequence: higher },
    });
    const promptOnly = verificationProofEmbedding({
      prompt,
      source: "runner",
      workspaceId: "flow-policy",
    });
    expect(low).toEqual(
      embedPolicyScore({
        model,
        sequence: lowest,
        workspaceId: "flow-policy",
        note: prompt,
        proofRows: [{ proof_of_work_type: "speech", timestamp_ms: 1, tool_name: "runner" }],
      }).embedding,
    );
    expect(low).not.toEqual(high);
    expect(low).not.toEqual(promptOnly);
    expect(policyScoreFromUnknown(null)).toBeNull();
    expect(policyScoreFromUnknown({ model: { branches: [] }, sequence: lowest })).toBeNull();
    const region = buildRegionFromFlowEmbeddings({
      name: "Policy field",
      flowId: "flow-policy",
      items: [
        { id: "low", flowId: "flow-policy", embedding: low },
        { id: "high", flowId: "flow-policy", embedding: high },
        { id: "other", flowId: "flow-other", embedding: promptOnly },
      ],
    });
    const promptRegion = buildRegionFromFlowEmbeddings({
      name: "Prompt field",
      flowId: "flow-policy",
      items: [
        { id: "a", flowId: "flow-policy", embedding: promptOnly },
        { id: "b", flowId: "flow-policy", embedding: promptOnly },
      ],
    });
    expect(region.subject_count).toBe(2);
    expect(region.embedding_model_id).toBe("knowledgecfg-v1-d64");
    expect(region.centroid).not.toEqual(promptRegion.centroid);
  });

  it("stores a policy-only calibration proof and still writes the existing proof of work", () => {
    const scored = embedPolicyScore({
      model,
      sequence: lowest,
      workspaceId: "ws-cal",
      note: "Spoken while the field was open.",
    });
    const event = policyScoreProofEvent(scored);
    const created = applyCalibrationCommand(emptyCalibrationState(), {
      type: "create",
      workspaceId: "ws-cal",
      goal: "Continuity",
      questions: ["What stays continuous when the field moves?"],
      id: "flow-policy",
      publicToken: "token-policy",
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.flow) return;
    const claimed = applyCalibrationCommand(created.state, {
      type: "claim",
      flowId: created.flow.id,
      identity: "ada",
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    const empty = applyCalibrationCommand(claimed.state, {
      type: "addProof",
      flowId: created.flow.id,
      identity: "ada",
      events: [],
    });
    expect(empty.ok).toBe(false);
    const proved = applyCalibrationCommand(claimed.state, {
      type: "addProof",
      flowId: created.flow.id,
      identity: "ada",
      events: [event],
    });
    expect(proved.ok).toBe(true);
    if (!proved.ok || !proved.proof) return;
    expect(proved.proof.events).toEqual([event]);
    const stored = proved.proof.events[0];
    expect(stored?.type).toBe("policy_score");
    if (stored?.type === "policy_score") expect(stored.text).toContain("policy distance");

    const learnEnd = read("components/session-view/use-session-phase.ts");
    const learnCanvas = read("components/SessionView.tsx");
    const verificationEnd = read("components/tap-score/use-tap-score-flow.ts");
    const verificationCanvas = read("components/tap-score/tap-score-phases.tsx");
    const calibrateEnd = read("components/scout-tap/ScoutTapClient.tsx");
    const publicCalibrate = read("components/CalibrationFlowRunner.tsx");
    const publicVerification = read("components/VerificationFlowRunner.tsx");
    const results = read("app/api/verification-flow/public/[token]/results/route.ts");

    const confirmEnd = learnEnd.slice(learnEnd.indexOf("const handleConfirmEnd"));
    expect(confirmEnd.indexOf("embedPolicyScore")).toBeGreaterThan(-1);
    expect(confirmEnd.indexOf("embedPolicyScore")).toBeLessThan(confirmEnd.indexOf("endSession("));
    expect(confirmEnd.indexOf("endSession(")).toBeLessThan(confirmEnd.indexOf("stopRecording"));
    expect(confirmEnd).toContain("uploadIleProofOfWork");
    expect(learnCanvas).toContain('logTool("canvas"');
    const verificationFinish = verificationEnd.slice(verificationEnd.indexOf("async function endSession"));
    expect(verificationFinish.indexOf("embedPolicyScore")).toBeLessThan(
      verificationFinish.indexOf("postTutoringSessionComplete"),
    );
    expect(verificationFinish).toContain("policyScoreUploadItem");
    expect(verificationFinish).toContain("uploadTapWorkCanvasPow");
    expect(verificationCanvas).toContain("handleCanvasPowActions");
    expect(verificationCanvas).toContain("uploadTapWorkCanvasPow");
    expect(calibrateEnd).toContain("soundingProofUploadItem");
    expect(calibrateEnd).toContain("uploadTapWorkCanvasPow");
    expect(calibrateEnd).toContain("postTutoringSessionComplete");
    const calibrateFinish = calibrateEnd.slice(calibrateEnd.indexOf("async function endSession"));
    expect(calibrateFinish.indexOf("persistSounding")).toBeLessThan(
      calibrateFinish.indexOf("postTutoringSessionComplete"),
    );
    expect(publicCalibrate).toContain("soundingProofEvent");
    expect(publicCalibrate).toContain("data-calibration-end-session");
    expect(publicCalibrate).not.toContain("I'm done classifying");
    expect(publicVerification).toContain("policy: input.policy ?? null");
    expect(results).toContain("verificationProofEmbedding");
    expect(results).toContain("policyScoreFromUnknown");
    expect(results).toContain("prompt,");
  });
});

function scorePair(model: SessionBranchModel, sequence: readonly SessionMarkButtonId[]) {
  return embedPolicyScore({ model, sequence, workspaceId: "ws-policy" }).score;
}

function pricedActions(title: string, close: number, keep: number) {
  return {
    title,
    observation: `${title} is open.`,
    closePrice: close,
    keepPrice: keep,
    discardPrice: 80,
    insightPrice: 95,
    closeObservation: `Closing ${title}.`,
    keepObservation: `Keeping ${title}.`,
    discardObservation: `Discarding ${title}.`,
    insightObservation: `Insight on ${title}.`,
  };
}

describe("policy score starts from the prepared tree", () => {
  it("keeps the birth tree after the live slot has advanced", () => {
    const birth = normalizeSessionBranchModel(
      {
        premise: "A priced field.",
        ...pricedActions("Premise", 10, 40),
        regions: [pricedActions("Region", 90, 10)],
      },
      "Priced",
    );
    expect(birth).toBeTruthy();
    if (!birth) return;
    const afterClose = advanceSessionBranchModel(birth, { action: "try", branchId: birth.focusId });
    expect(afterClose.focusId).not.toBe(birth.focusId);

    const opened = sessionPolicySnapshot(null, { status: "ready", model: birth }, [{ button: "try" }]);
    const replayed = sessionPolicySnapshot(
      opened.prepared,
      { status: "ready", model: afterClose },
      [{ button: "try" }],
    );
    expect(replayed.snapshot.model).toBe(birth);
    const fuller = normalizeSessionBranchModel(
      {
        premise: "A priced field.",
        ...pricedActions("Premise", 10, 40),
        regions: [pricedActions("Region", 90, 10), pricedActions("Later", 15, 30)],
      },
      "Priced",
    );
    expect(fuller).toBeTruthy();
    if (!fuller) return;
    const upgraded = sessionPolicySnapshot(
      replayed.prepared,
      { status: "ready", model: afterClose, birth: fuller },
      [{ button: "try" }],
    );
    expect(upgraded.snapshot.model).toBe(fuller);
    expect(replayed.snapshot.sequence).toEqual(["try"]);

    const fromPrepared = scorePolicySequence(replayed.snapshot.model!, replayed.snapshot.sequence);
    const fromAdvanced = scorePolicySequence(afterClose, replayed.snapshot.sequence);
    const dearerKeep = scorePolicySequence(birth, ["hold"]);
    expect(fromPrepared.steps).toBeGreaterThan(0);
    expect(fromPrepared.distance).toBeLessThan(dearerKeep.distance);
    expect(fromPrepared.distance).toBeLessThan(fromAdvanced.distance);
    expect(fromAdvanced.distance).toBeGreaterThan(dearerKeep.distance);

    const embedded = embedPolicyScore({
      model: replayed.snapshot.model!,
      sequence: replayed.snapshot.sequence,
      workspaceId: "ws-policy",
    });
    const embeddedAdvanced = embedPolicyScore({
      model: afterClose,
      sequence: replayed.snapshot.sequence,
      workspaceId: "ws-policy",
    });
    expect(embedded.score.distance).toBe(fromPrepared.distance);
    expect(embedded.embedding).not.toEqual(embeddedAdvanced.embedding);

    const cleared = sessionPolicySnapshot(birth, { status: "preparing", model: null }, []);
    expect(cleared.snapshot.model).toBeNull();
    const nextTree = normalizeSessionBranchModel(
      {
        premise: "Another field.",
        ...pricedActions("Next", 5, 50),
        regions: [pricedActions("Next region", 5, 50)],
      },
      "Next",
    );
    expect(nextTree).toBeTruthy();
    if (!nextTree) return;
    const reborn = sessionPolicySnapshot(cleared.prepared, { status: "ready", model: nextTree }, []);
    expect(reborn.snapshot.model).toBe(nextTree);

    const bridge = read("components/session-view/session-policy-context.tsx");
    const bridgeBody = bridge.slice(bridge.indexOf("function SessionPolicyBridge"));
    expect(bridgeBody).toContain("sessionPolicySnapshot(");
    expect(bridgeBody).toContain("target.current = next.snapshot");
    expect(bridgeBody).not.toContain("slot.model");
  });
});

function CaptureBridge({
  hold,
}: {
  hold: { bridge: ReturnType<typeof useSessionMarkCanvasEffects> };
}) {
  hold.bridge = useSessionMarkCanvasEffects();
  return null;
}

describe("sidebar actions wait until the canvas can place an observation", () => {
  it("queues a press until the canvas effect is registered, then delivers it", () => {
    let state = emptyCanvasEffectGate();
    const waiting = canvasEffectGateApply(state, { kind: "try", branchId: "root" });
    expect(waiting.deliver).toBe(false);
    state = waiting.state;
    const opened = canvasEffectGateRegister(state, true);
    expect(opened.flush.map((effect) => effect.kind)).toEqual(["try"]);
    expect(opened.state.handlerReady).toBe(true);
    const live = canvasEffectGateApply(opened.state, { kind: "hold", branchId: "root" });
    expect(live.deliver).toBe(true);
    expect(live.state.queued).toHaveLength(0);
    expect(sessionActionsMayCommit({ bridge: true, ready: false, direct: false })).toBe(false);
    expect(sessionActionsMayCommit({ bridge: true, ready: true, direct: false })).toBe(true);
    expect(sessionActionsMayCommit({ bridge: false, ready: false, direct: false })).toBe(true);

    const hold: { bridge: ReturnType<typeof useSessionMarkCanvasEffects> } = { bridge: null };
    renderToStaticMarkup(
      createElement(
        SessionPolicyProvider,
        null,
        createElement(CaptureBridge, { hold }),
      ),
    );
    const delivered: SessionMarkCanvasEffect[] = [];
    hold.bridge?.apply({ kind: "try", branchId: "root" });
    hold.bridge?.register((effect) => {
      delivered.push(effect);
    });
    expect(delivered.map((effect) => effect.kind)).toEqual(["try"]);
  });

  it("disables the four actions inside the session until the canvas effect is ready", () => {
    const model = normalizeSessionBranchModel(
      {
        premise: "A ready field.",
        regions: [{ title: "Region", observation: "The region is open." }],
      },
      "Ready",
    );
    expect(model).toBeTruthy();
    if (!model) return;
    const inside = renderToStaticMarkup(
      createElement(
        SessionPolicyProvider,
        null,
        createElement(SessionMarkControls, {
          mode: "learn",
          questions: [{ id: "root", text: "Ready" }],
          branchModel: model,
          selectionActive: false,
          selectedTexts: [],
          speech: "",
        }),
      ),
    );
    expect(inside).toContain('data-session-actions-ready="false"');
    expect(inside).toContain('data-session-mark="try"');
    expect(inside).toContain('data-session-mark="hold"');
    expect(inside).toContain('data-session-mark="drop"');
    expect(inside).toContain('data-session-mark="insight"');
    expect(inside).not.toContain('data-session-mark-disabled="false"');
    const outside = renderToStaticMarkup(
      createElement(SessionMarkControls, {
        mode: "learn",
        questions: [{ id: "root", text: "Ready" }],
        branchModel: model,
        selectionActive: false,
        selectedTexts: [],
        speech: "",
      }),
    );
    expect(outside).toContain('data-session-actions-ready="true"');
    expect(outside).toContain('data-session-mark-disabled="false"');
  });

  it("builds the field on the tips screen and starts the clock only when that field is ready", async () => {
    clearSessionBranchFieldCache();
    expect(sessionClockMayStart({ mode: "learn", fieldReady: false })).toBe(false);
    expect(sessionClockMayStart({ mode: "calibrate", fieldReady: false })).toBe(false);
    expect(sessionClockMayStart({ mode: "verification", fieldReady: false })).toBe(false);
    expect(sessionClockMayStart({ mode: "learn", fieldReady: true })).toBe(true);
    expect(sessionClockMayStart({ mode: "calibrate", fieldReady: true })).toBe(true);
    expect(sessionClockMayStart({ mode: "verification", fieldReady: true })).toBe(true);
    expect(sessionClockMayStart({ mode: "tap", fieldReady: false })).toBe(true);
    expect(sessionClockMayStart({ mode: "exercise", fieldReady: false })).toBe(true);
    expect(sessionBranchFieldLoadDecision(null)).toBe("fetch");
    expect(sessionBranchFieldLoadDecision({ status: "preparing" })).toBe("join");
    expect(sessionBranchFieldLoadDecision({ status: "ready" })).toBe("reuse");
    expect(sessionBranchFieldLoadDecision({ status: "failed" })).toBe("fetch");

    let calls = 0;
    let release: (response: Response) => void = () => {};
    const input = {
      chapterTitle: "Just war",
      chapterBrief: "A cause can fail.",
      sessionId: "session-1",
      scope: "chapter-1",
    };
    const first = loadSessionBranchField(input, {
      fetchImpl: () => {
        calls += 1;
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      },
    });
    const joined = loadSessionBranchField(input, {
      fetchImpl: async () => {
        calls += 1;
        return new Response("should not run", { status: 500 });
      },
    });
    release(new Response(JSON.stringify({ model: { branches: [{ id: "root" }] } }), { status: 200 }));
    const [ready, shared] = await Promise.all([first, joined]);
    expect(ready.ok).toBe(true);
    expect(shared.ok).toBe(true);
    if (ready.ok && shared.ok) expect(shared.model).toBe(ready.model);
    expect(calls).toBe(1);
    const reused = await loadSessionBranchField(input, {
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ model: { branches: [{ id: "other" }] } }), { status: 200 });
      },
    });
    expect(reused.ok).toBe(true);
    if (ready.ok && reused.ok) expect(reused.model).toBe(ready.model);
    expect(calls).toBe(1);

    const refused = await loadSessionBranchField(
      { ...input, scope: "refused" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: { message: "The field came back too small." } }), {
            status: 422,
          }),
      },
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toContain("too small");
    expect(sessionClockMayStart({ mode: "learn", fieldReady: refused.ok })).toBe(false);
    const retried = await loadSessionBranchField(
      { ...input, scope: "refused" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ model: { branches: [{ id: "root" }] } }), { status: 200 }),
      },
    );
    expect(retried.ok).toBe(true);

    const phase = read("components/session-view/use-session-phase.ts");
    const confirm = sliceBetween(phase, "const handleConfirmSettings", "const handleContinueWithoutInference");
    const readyStart = sliceBetween(phase, "const handleWelcomeReadyStart", "return {");
    expect(confirm.indexOf("loadSessionBranchField")).toBeGreaterThan(-1);
    expect(confirm.indexOf("loadSessionBranchField")).toBeLessThan(confirm.indexOf("startRecording()"));
    expect(confirm.indexOf("sessionClockMayStart")).toBeLessThan(confirm.indexOf("setShowWelcomeModal(false)"));
    expect(readyStart.indexOf("loadSessionBranchField")).toBeLessThan(readyStart.indexOf("startRecording()"));
    expect(readyStart.indexOf("sessionClockMayStart")).toBeLessThan(readyStart.indexOf("startRecording()"));

    const scout = sliceBetween(
      read("components/scout-tap/ScoutTapClient.tsx"),
      "async function startSession",
      "async function endSession",
    );
    expect(scout.indexOf("loadSessionBranchField")).toBeLessThan(scout.indexOf("setStartedAt"));
    expect(scout.indexOf("sessionClockMayStart")).toBeLessThan(scout.indexOf('setPhase("live")'));
    expect(scout.indexOf("loadSessionBranchField")).toBeLessThan(scout.indexOf("soundingTreeIsTravelable"));
    expect(scout.indexOf("soundingTreeIsTravelable")).toBeLessThan(scout.indexOf("await loadPool"));

    const tap = sliceBetween(
      read("components/tap-score/use-tap-score-flow.ts"),
      "async function startSession",
      "function restartBriefingFlow",
    );
    const firstClock = tap.indexOf("startedAt: startedAtMs");
    const secondClock = tap.indexOf("startedAt: startedAtMs", firstClock + 1);
    expect(tap.lastIndexOf("loadSessionBranchField", firstClock)).toBeGreaterThan(-1);
    expect(tap.lastIndexOf("sessionClockMayStart", firstClock)).toBeGreaterThan(-1);
    expect(tap.lastIndexOf("loadSessionBranchField", secondClock)).toBeGreaterThan(firstClock);
    expect(tap.lastIndexOf('sidebarMode === "verification-tap"', secondClock)).toBeGreaterThan(firstClock);

    const calibrate = sliceBetween(
      read("components/CalibrationFlowRunner.tsx"),
      "async function finishCalibrationStart",
      "async function claim",
    );
    expect(calibrate.indexOf("loadSessionBranchField")).toBeLessThan(calibrate.indexOf("setStartedAt"));
    expect(calibrate).toContain("sessionClockMayStart");
    expect(read("components/CalibrationFlowRunner.tsx")).toContain("<IleStartLoading");
    expect(read("components/session-view/session-welcome-modal.tsx")).toContain("<IleStartLoading");
    expect(read("components/scout-tap/scout-tap-phases.tsx")).toContain("<IleStartLoading");
    expect(read("components/tap-score/tap-score-phases.tsx")).toContain("<IleStartLoading");
    expect(read("components/tap-score/tap-score-phases.tsx")).toContain(
      'sidebarMode === "verification-tap"',
    );
    expect(read("components/session-view/session-page-loading.tsx")).toContain("<IleStartLoading");
    expect(read("components/exercise-tap/exercise-tap-phases.tsx")).toContain("<SessionPageLoading");
    expect(read("components/session-view/session-field-gate.tsx")).toContain("<IleStartLoading");
    expect(read("components/session-view/session-branch-prepare.tsx")).toContain("loadSessionBranchField");
    expect(read("components/session-view/session-chapter-canvas.tsx")).toContain("<SessionFieldLoader");
  });

  it("returns the opening field and applies a later batch without waiting for it", async () => {
    clearSessionBranchFieldCache();
    const input = {
      chapterTitle: "Just war",
      chapterBrief: "A cause can fail.",
      sessionId: "session-grow",
      scope: "grow",
    };
    const openingModel = {
      chapterTitle: "Just war",
      rootId: "root",
      focusId: "root",
      step: 0,
      branches: [
        { id: "root" },
        { id: "r1" },
      ],
      boardNotes: [],
    };
    const continuation = {
      root: { premise: "A cause can fail." },
      regions: [{ title: "Region 1", observation: "Region 1 is open." }],
      avenues: [],
      inquiries: [],
      regionFailures: 0,
      failed: [],
      settled: [],
    };
    let releaseContinue: (response: Response) => void = () => {};
    let calls = 0;
    const pending = loadSessionBranchField(input, {
      fetchImpl: (_url, init) => {
        calls += 1;
        const body = JSON.parse(String(init?.body)) as { phase?: string };
        if (body.phase === "continue") {
          return new Promise<Response>((resolve) => {
            releaseContinue = resolve;
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ model: openingModel, continuation, done: false }), { status: 200 }),
        );
      },
    });
    const seen: number[] = [];
    subscribeSessionBranchField(sessionBranchFieldRequestKey(input), (entry) => {
      seen.push(entry.model?.branches.length ?? 0);
    });
    const ready = await pending;
    expect(ready.ok).toBe(true);
    if (ready.ok) expect(ready.model.branches).toHaveLength(2);
    expect(calls).toBe(2);
    expect(seen).toContain(2);
    releaseContinue(
      new Response(
        JSON.stringify({
          model: { ...openingModel, branches: [...openingModel.branches, { id: "r2" }] },
          done: true,
        }),
        { status: 200 },
      ),
    );
    await vi.waitFor(() => {
      expect(seen).toContain(3);
    });
    expect(calls).toBe(2);
    const cached = readSessionBranchFieldCache(sessionBranchFieldRequestKey(input));
    expect(cached?.model?.branches).toHaveLength(3);
  });
});

function sliceBetween(source: string, start: string, end: string): string {
  const at = source.indexOf(start);
  const until = source.indexOf(end, at + start.length);
  return source.slice(at, until === -1 ? source.length : until);
}
