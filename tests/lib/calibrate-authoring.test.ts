/**
 * Calibration authoring stays beside verification flows.
 * Context and goal generation are injected. Verification start still returns one question.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acceptCalibrationDraft,
  applyCalibrationCommand,
  beginCalibrationSession,
  calibrationProofMetadata,
  emptyCalibrationState,
  type CalibrationState,
  generateCalibrationPoolFromGoal,
} from "@/lib/calibration-flow";
import { canFinishClassifying, moveCalibrateQuestion } from "@/lib/calibrate-session";
import {
  buildContextGenerationRequest,
  generateContextCandidates,
} from "@/lib/context-generation";
import { startChoicesForFlow, type VerificationFlow } from "@/lib/verification-flow";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const MANUAL_QUESTIONS = [
  "What is a limit?",
  "When is a function continuous?",
  "How do you read a derivative?",
  "Where does the mean value theorem fail?",
  "What makes a series converge?",
];

describe("calibration authoring", () => {
  it("accepts a typed goal and pool, and a goal generator fills that pool", async () => {
    const emptyGoal = acceptCalibrationDraft({ goal: "  ", questions: MANUAL_QUESTIONS });
    expect(emptyGoal.ok).toBe(false);

    const typed = acceptCalibrationDraft({ goal: " Continuity ", questions: MANUAL_QUESTIONS });
    expect(typed.ok).toBe(true);
    if (!typed.ok) return;

    const created = applyCalibrationCommand(emptyCalibrationState(), {
      type: "create",
      workspaceId: "ws-cal",
      goal: typed.goal,
      questions: typed.questions,
      id: "flow-1",
      publicToken: "token-cal",
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.flow) return;
    expect(created.flow.goal).toBe("Continuity");
    expect(created.flow.questions).toHaveLength(5);
    expect(created.flow.durationMinutes).toBe(15);
    const timed = applyCalibrationCommand(emptyCalibrationState(), {
      type: "create",
      workspaceId: "ws-cal",
      goal: typed.goal,
      questions: typed.questions,
      durationMinutes: 25,
      id: "flow-timed",
      publicToken: "token-timed",
    });
    expect(timed.ok).toBe(true);
    if (!timed.ok || !timed.flow) return;
    expect(timed.flow.durationMinutes).toBe(25);

    const started = beginCalibrationSession(created.flow);
    expect(started.kind).toBe("calibration");
    expect(started.verificationRun).toBe(false);
    expect(started.requiresClassification).toBe(true);
    expect(started.session.pool.map((question) => question.text)).toEqual(MANUAL_QUESTIONS);
    expect(canFinishClassifying(started.session)).toBe(false);

    let session = started.session;
    session = moveCalibrateQuestion(session, session.pool[0]!.id, "comfortable");
    session = moveCalibrateQuestion(session, session.pool[1]!.id, "comfortable");
    session = moveCalibrateQuestion(session, session.pool[2]!.id, "comfortable");
    session = moveCalibrateQuestion(session, session.pool[3]!.id, "unconfident");
    session = moveCalibrateQuestion(session, session.pool[4]!.id, "unconfident");
    expect(canFinishClassifying(session)).toBe(true);
    expect(calibrationProofMetadata(session).verification_run).toBe(false);
    const unclaimed = applyCalibrationCommand(created.state, {
      type: "addProof",
      flowId: created.flow.id,
      identity: "ada",
      events: session.events,
    });
    expect(unclaimed.ok).toBe(false);
    const blank = applyCalibrationCommand(created.state, {
      type: "claim",
      flowId: created.flow.id,
      identity: "  ",
    });
    expect(blank.ok).toBe(false);
    const claimed = applyCalibrationCommand(created.state, {
      type: "claim",
      flowId: created.flow.id,
      identity: "  ada ",
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.identity).toBe("ada");
    const duplicate = applyCalibrationCommand(claimed.state, {
      type: "claim",
      flowId: created.flow.id,
      identity: "ada",
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.reason).toBe("duplicate");
    expect(duplicate.state.identities).toHaveLength(1);
    const proved = applyCalibrationCommand(claimed.state, {
      type: "addProof",
      flowId: created.flow.id,
      identity: "ada",
      events: session.events,
    });
    expect(proved.ok).toBe(true);
    if (!proved.ok || !proved.proof) return;
    expect(proved.proof.identity).toBe("ada");
    expect(proved.proof.events).toEqual(session.events);
    expect(proved.proof.events.some((event) => event.type === "region_move")).toBe(true);
    const legacy = { ...created.state } as CalibrationState;
    delete (legacy as { identities?: CalibrationState["identities"] }).identities;
    const legacyClaim = applyCalibrationCommand(legacy, {
      type: "claim",
      flowId: created.flow.id,
      identity: "ada@example.com",
    });
    expect(legacyClaim.ok).toBe(true);
    if (!legacyClaim.ok) return;
    expect(legacyClaim.identity).toBe("ada@example.com");

    const fromGoal = await generateCalibrationPoolFromGoal({
      goal: "Understand continuity",
      complete: async (request) => {
        expect(request.kind).toBe("calibration_from_goal");
        expect(request.user).toContain("Understand continuity");
        expect(request.instructions).toContain("at least 5");
        expect(request.instructions).toContain("not a verification flow");
        return { questions: MANUAL_QUESTIONS };
      },
    });
    const generated = acceptCalibrationDraft({
      goal: "Understand continuity",
      questions: fromGoal,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.questions.map((question) => question.text)).toEqual(MANUAL_QUESTIONS);
    expect(beginCalibrationSession({ questions: generated.questions }).verificationRun).toBe(false);
  });

  it("asks context generation for a calibration pool that is not a verification flow", async () => {
    const calibration = buildContextGenerationRequest({
      kind: "calibration_flow",
      contextText: "A short note on limits.",
      avoid: ["Already used"],
    });
    const verification = buildContextGenerationRequest({
      kind: "verification_flow",
      contextText: "A short note on limits.",
      avoid: ["Already used"],
    });
    expect(calibration.kind).toBe("calibration_flow");
    expect(verification.kind).toBe("verification_flow");
    expect(calibration.instructions).not.toBe(verification.instructions);
    expect(calibration.instructions).toContain("at least 5");
    expect(calibration.instructions).toContain("not a verification flow");
    expect(verification.instructions).toContain("verification-flow");
    expect(verification.instructions).toContain("3 to 5");

    const generated = await generateContextCandidates({
      kind: "calibration_flow",
      contextText: "A short note on limits.",
      complete: async (request) => {
        expect(request.kind).toBe("calibration_flow");
        return {
          flows: [{ topic: "Limits", questions: MANUAL_QUESTIONS }],
        };
      },
    });
    expect(generated.goals).toEqual([]);
    expect(generated.flows).toEqual([{ topic: "Limits", questions: MANUAL_QUESTIONS }]);

    const panel = read("components/CalibrationFlowsPanel.tsx");
    expect(panel).toContain('kind="goals"');
    expect(panel).toContain('kind="calibration_flow"');
    expect(panel).toContain("data-calibration-flow-goal");
    expect(panel).toContain("data-calibration-flow-question");
    expect(panel).toContain("data-calibration-generate-from-goal");
    expect(panel).toContain("data-calibration-flow-save");
    const route = read("app/api/workspace/context-generation/route.ts");
    expect(route).toContain('calibration_from_goal');
    expect(route).toContain("generateCalibrationPoolFromGoal");
    const publicEntry = read("app/api/calibration-flow/public/[token]/route.ts");
    expect(publicEntry).toContain("claimCalibrationIdentity");
    expect(publicEntry).toContain("beginCalibrationSession");
    expect(publicEntry).not.toContain("pickVerificationFlowQuestion");
    expect(publicEntry).not.toContain("startChoicesForFlow");
    const proofRoute = read("app/api/calibration-flow/public/[token]/proof/route.ts");
    expect(proofRoute).toContain("addCalibrationProof");
    expect(proofRoute).toContain("body.identity");
    expect(proofRoute).toContain("verificationRun: false");
    expect(proofRoute).not.toContain("pickVerificationFlowQuestion");
    const runner = read("components/CalibrationFlowRunner.tsx");
    expect(runner).toContain("data-calibration-identity");
    expect(runner).toContain("data-calibration-identity-input");
    expect(runner).toContain("Identify yourself");
    expect(runner).toContain("That identity is already used for this calibration flow.");
    expect(runner).toContain("identity: claimedIdentity");
    expect(runner).toContain("data-calibration-live-clock");
    expect(panel).toContain("data-calibration-flow-minutes");
    expect(read("components/VerificationFlowsPanel.tsx")).toContain("data-verification-flow-minutes");
    expect(read("components/calibrate/calibrate-live-surface.tsx")).toContain("data-calibrate-opening");
    expect(read("components/calibrate/calibrate-live-surface.tsx")).toContain("data-calibrate-opening-cue");
    expect(read("components/calibrate/calibrate-live-surface.tsx")).toContain("CALIBRATE_MOVE_RIGHT_LABEL");
    expect(read("lib/calibrate-session.ts")).toContain('CALIBRATE_MOVE_RIGHT_LABEL = "move right"');
  });

  it("still starts a verification flow with one pooled question", () => {
    const flow: VerificationFlow = {
      id: "verify-1",
      workspaceId: "ws-cal",
      topic: "Limits",
      questions: MANUAL_QUESTIONS.map((text, index) => ({ id: `v-${index + 1}`, text })),
      durationMinutes: 15,
      publicToken: "token-verify",
      createdAt: "2026-10-05T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z",
    };
    const choices = startChoicesForFlow(flow, () => 0);
    expect(choices.emptyPool).toBe(false);
    expect(choices.topics).toHaveLength(1);
    expect(choices.question?.text).toBe(MANUAL_QUESTIONS[0]);
    expect(choices.topics[0]?.openingQuestion).toBe(MANUAL_QUESTIONS[0]);
    expect(JSON.stringify(choices)).not.toContain("requiresClassification");
  });
});
