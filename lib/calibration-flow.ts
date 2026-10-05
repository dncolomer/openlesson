/**
 * Calibration flows on a Verification Workspace.
 * A flow stores a goal and a question pool. Starting it runs the calibrate
 * canvas procedure. It does not pick one verification question.
 */

import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";
import {
  buildCalibrateProofMetadata,
  createCalibrateState,
  normalizeCalibrateQuestions,
  type CalibrateProofEvent,
  type CalibrateQuestion,
  type CalibrateState,
} from "@/lib/calibrate-session";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import { acceptParticipantIdentity } from "@/lib/verification-flow";

export type CalibrationFlow = {
  id: string;
  workspaceId: string;
  goal: string;
  questions: CalibrateQuestion[];
  /** Countdown chosen when the flow is created, in minutes. */
  durationMinutes: number;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
};

export type CalibrationIdentity = {
  flowId: string;
  identity: string;
};

export type CalibrationProof = {
  id: string;
  flowId: string;
  workspaceId: string;
  identity: string;
  events: CalibrateProofEvent[];
  createdAt: string;
};

export type CalibrationState = {
  flows: CalibrationFlow[];
  identities: CalibrationIdentity[];
  proofs: CalibrationProof[];
};

export function emptyCalibrationState(): CalibrationState {
  return { flows: [], identities: [], proofs: [] };
}

/** A process that stored flows before identities existed has no identities array. */
export function completeCalibrationState(state: Partial<CalibrationState> | null | undefined): CalibrationState {
  return {
    flows: Array.isArray(state?.flows) ? state.flows : [],
    identities: Array.isArray(state?.identities) ? state.identities : [],
    proofs: Array.isArray(state?.proofs) ? state.proofs : [],
  };
}

export function calibrationFlowPublicPath(token: string): string {
  return `/c/${encodeURIComponent(token)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cal_${Math.random().toString(36).slice(2, 12)}`;
}

export function createCalibrationPublicToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function acceptCalibrationDraft(input: {
  goal: unknown;
  questions: unknown;
}): { ok: true; goal: string; questions: CalibrateQuestion[] } | { ok: false; reason: string } {
  const goal = String(input.goal ?? "").trim();
  if (!goal) return { ok: false, reason: "goal_required" };
  const questions = normalizeCalibrateQuestions(input.questions);
  if (questions.length === 0) return { ok: false, reason: "questions_required" };
  return { ok: true, goal, questions };
}

export type CalibrationCommand =
  | {
      type: "create";
      workspaceId: string;
      goal: string;
      questions: unknown;
      durationMinutes?: number;
      id?: string;
      publicToken?: string;
    }
  | {
      type: "update";
      workspaceId: string;
      flowId: string;
      goal?: string;
      questions?: unknown;
      durationMinutes?: number;
    }
  | { type: "remove"; workspaceId: string; flowId: string }
  | { type: "claim"; flowId: string; identity: string }
  | {
      type: "addProof";
      flowId: string;
      identity: string;
      events: unknown;
      id?: string;
    };

export type CalibrationCommandResult =
  | {
      ok: true;
      state: CalibrationState;
      flow?: CalibrationFlow;
      identity?: string;
      proof?: CalibrationProof;
    }
  | { ok: false; reason: string; state: CalibrationState };

function proofEvents(raw: unknown): CalibrateProofEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: CalibrateProofEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      type?: unknown;
      questionId?: unknown;
      from?: unknown;
      to?: unknown;
      text?: unknown;
      source?: unknown;
    };
    const questionId = String(record.questionId || "").trim();
    if (!questionId) continue;
    if (record.type === "region_move") {
      const from = record.from === "comfortable" || record.from === "unconfident" ? record.from : null;
      const to = record.to === "comfortable" || record.to === "unconfident" ? record.to : null;
      events.push({ type: "region_move", questionId, from, to });
      continue;
    }
    const text = String(record.text || "").trim();
    const source = record.source === "pasted" || record.source === "dictated" ? record.source : "typed";
    if (!text) continue;
    if (record.type === "comfortable_answer" || record.type === "uncertainty_explanation") {
      events.push({ type: record.type, questionId, text, source });
    }
  }
  return events;
}

export function applyCalibrationCommand(
  state: CalibrationState,
  command: CalibrationCommand,
): CalibrationCommandResult {
  state = completeCalibrationState(state);
  if (command.type === "create") {
    const draft = acceptCalibrationDraft({ goal: command.goal, questions: command.questions });
    if (!draft.ok) return { ok: false, reason: draft.reason, state };
    const token = (command.publicToken || createCalibrationPublicToken()).trim();
    if (!token) return { ok: false, reason: "token_required", state };
    if (state.flows.some((flow) => flow.publicToken === token)) {
      return { ok: false, reason: "token_taken", state };
    }
    const stamp = nowIso();
    const flow: CalibrationFlow = {
      id: command.id || makeId(),
      workspaceId: command.workspaceId,
      goal: draft.goal,
      questions: draft.questions,
      durationMinutes: flowCountdownMinutes(command.durationMinutes),
      publicToken: token,
      createdAt: stamp,
      updatedAt: stamp,
    };
    return { ok: true, state: { ...state, flows: [...state.flows, flow] }, flow };
  }

  if (command.type === "update") {
    const current = state.flows.find((flow) => flow.id === command.flowId);
    if (!current) return { ok: false, reason: "not_found", state };
    if (!command.workspaceId || current.workspaceId !== command.workspaceId) {
      return { ok: false, reason: "wrong_workspace", state };
    }
    const goal = command.goal === undefined ? current.goal : command.goal.trim();
    if (!goal) return { ok: false, reason: "goal_required", state };
    const questions =
      command.questions === undefined ? current.questions : normalizeCalibrateQuestions(command.questions);
    if (questions.length === 0) return { ok: false, reason: "questions_required", state };
    const flow: CalibrationFlow = {
      ...current,
      goal,
      questions,
      durationMinutes:
        command.durationMinutes === undefined
          ? flowCountdownMinutes(current.durationMinutes)
          : flowCountdownMinutes(command.durationMinutes),
      updatedAt: nowIso(),
    };
    return {
      ok: true,
      flow,
      state: {
        ...state,
        flows: state.flows.map((item) => (item.id === flow.id ? flow : item)),
      },
    };
  }

  if (command.type === "remove") {
    const current = state.flows.find((flow) => flow.id === command.flowId);
    if (!current) return { ok: false, reason: "not_found", state };
    if (!command.workspaceId || current.workspaceId !== command.workspaceId) {
      return { ok: false, reason: "wrong_workspace", state };
    }
    return {
      ok: true,
      state: {
        flows: state.flows.filter((flow) => flow.id !== command.flowId),
        identities: state.identities.filter((item) => item.flowId !== command.flowId),
        proofs: state.proofs.filter((proof) => proof.flowId !== command.flowId),
      },
    };
  }

  if (command.type === "claim") {
    const flow = state.flows.find((item) => item.id === command.flowId);
    if (!flow) return { ok: false, reason: "not_found", state };
    const existing = state.identities
      .filter((item) => item.flowId === flow.id)
      .map((item) => item.identity);
    const decision = acceptParticipantIdentity(command.identity, existing);
    if (!decision.ok) return { ok: false, reason: decision.reason, state };
    return {
      ok: true,
      identity: decision.identity,
      state: {
        ...state,
        identities: [...state.identities, { flowId: flow.id, identity: decision.identity }],
      },
    };
  }

  const flow = state.flows.find((item) => item.id === command.flowId);
  if (!flow) return { ok: false, reason: "not_found", state };
  const identity = command.identity.trim();
  if (!identity) return { ok: false, reason: "identity_required", state };
  const claimed = state.identities.some(
    (item) => item.flowId === flow.id && item.identity === identity,
  );
  if (!claimed) return { ok: false, reason: "identity_required", state };
  const events = proofEvents(command.events);
  if (events.length === 0) return { ok: false, reason: "events_required", state };
  const proof: CalibrationProof = {
    id: command.id || makeId(),
    flowId: flow.id,
    workspaceId: flow.workspaceId,
    identity,
    events,
    createdAt: nowIso(),
  };
  return {
    ok: true,
    proof,
    state: { ...state, proofs: [...state.proofs, proof] },
  };
}

export function flowByPublicToken(state: CalibrationState, token: string): CalibrationFlow | null {
  const needle = token.trim();
  return state.flows.find((flow) => flow.publicToken === needle) || null;
}

/**
 * Start the saved pool on the calibrate canvas.
 * This is not a verification run and does not pick a single question.
 */
export function beginCalibrationSession(flow: {
  questions: readonly { id?: string; text: string }[];
}): {
  kind: "calibration";
  verificationRun: false;
  requiresClassification: true;
  session: CalibrateState;
} {
  return {
    kind: "calibration",
    verificationRun: false,
    requiresClassification: true,
    session: createCalibrateState(flow.questions),
  };
}

export function calibrationProofMetadata(session: CalibrateState): Record<string, unknown> {
  return buildCalibrateProofMetadata(session);
}

export function buildCalibrationPoolFromGoalRequest(goal: string): {
  kind: "calibration_from_goal";
  instructions: string;
  user: string;
} {
  const text = goal.trim();
  return {
    kind: "calibration_from_goal",
    instructions: [
      "Generate a calibration question pool from the goal.",
      "Return JSON { \"questions\": string[] } with at least 5 questions.",
      "Each question is what a learner reads before deciding whether they could answer it: two or three unhurried sentences, specific to the goal, and free of headings.",
      "This is a calibration pool, not a verification flow and not one pooled verification question.",
      TUTOR_CANVAS_VOICE,
    ].join(" "),
    user: `Goal:\n${text}`,
  };
}

export function parseCalibrationQuestionTexts(raw: unknown): string[] {
  return normalizeCalibrateQuestions(raw).map((question) => question.text);
}

export async function generateCalibrationPoolFromGoal(input: {
  goal: string;
  complete: (request: { kind: "calibration_from_goal"; instructions: string; user: string }) => Promise<unknown>;
}): Promise<string[]> {
  const request = buildCalibrationPoolFromGoalRequest(input.goal);
  const raw = await input.complete(request);
  return parseCalibrationQuestionTexts(raw);
}
