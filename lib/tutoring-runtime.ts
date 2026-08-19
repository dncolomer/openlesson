/**
 * One tutoring runtime for ILE / TAP / AYCL.
 * Product + dialog|solo + auth kind parameterize speech, idle, mutate, and solo thought.
 */

import {
  demoteExerciseSubmissionToStash,
  emptyExerciseDualLists,
  promoteExerciseStashToSubmission,
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
  type ExerciseDualLists,
} from "@/lib/exercise-tap";
import {
  buildIleIdleHeartbeatPayload,
  buildIleSpeechSegmentPayload,
  ILE_IDLE_TOOL_NAME,
  ILE_SPEECH_TOOL_NAME,
} from "@/lib/ile-thought-traces";
import {
  TAP_IDLE_TOOL_NAME,
  buildTapIdleHeartbeatPayload,
} from "@/lib/tap-idle-proof-of-work";
import {
  TAP_SPEECH_TOOL_NAME,
  buildTapSpeechSegmentPayload,
} from "@/lib/tap-speech-proof-of-work";
import {
  applyIleProjectThoughtMutation,
  type IleProjectThoughtMutation,
  type IleProjectThoughtMutationResult,
} from "@/lib/ile-mode";

export type TutoringProduct = "ile" | "tap";
export type TutoringModality = "dialog" | "solo";
export type TutoringAuthKind = "cookie" | "ile" | "aycl" | "tap";

export type TutoringContext = {
  product: TutoringProduct;
  modality: TutoringModality;
  authKind: TutoringAuthKind;
  workspaceId: string;
  sessionId: string;
  blockId?: string | null;
};

export type TutoringSpeechEvent = "start" | "stop";

export type TutoringSpeechInput = {
  event: TutoringSpeechEvent;
  segmentDurationMs?: number;
  transcriptSnapshot?: string;
  timestampMs?: number;
};

export type TutoringIdleInput = {
  idleDurationMs: number;
  hasPendingTranscription?: boolean;
  timestampMs?: number;
};

export type TutoringMutateAction = "get" | "save" | "add_probe";

export type TutoringMutateRequest = {
  action: TutoringMutateAction;
  session?: Record<string, unknown>;
  probes?: Array<Record<string, unknown>>;
  probe?: Record<string, unknown>;
};

export type TutoringPowOutcome = {
  toolName: string;
  toolAction: string;
  type: string;
  sessionId: string;
  workspaceId: string;
  product: TutoringProduct;
  modality: TutoringModality;
  authKind: TutoringAuthKind;
  payload: Record<string, unknown>;
};

export function tutoringSpeechToolName(product: TutoringProduct): string {
  return product === "tap" ? TAP_SPEECH_TOOL_NAME : ILE_SPEECH_TOOL_NAME;
}

export function tutoringIdleToolName(product: TutoringProduct): string {
  return product === "tap" ? TAP_IDLE_TOOL_NAME : ILE_IDLE_TOOL_NAME;
}

export function resolveTutoringContext(input: {
  product?: unknown;
  modality?: unknown;
  authKind?: unknown;
  workspaceId: string;
  sessionId: string;
  blockId?: string | null;
}): TutoringContext {
  const product: TutoringProduct = input.product === "tap" ? "tap" : "ile";
  const modality: TutoringModality = input.modality === "solo" ? "solo" : "dialog";
  const authKind: TutoringAuthKind =
    input.authKind === "aycl" ||
    input.authKind === "ile" ||
    input.authKind === "tap" ||
    input.authKind === "cookie"
      ? input.authKind
      : product === "tap"
        ? "tap"
        : "cookie";
  return {
    product,
    modality,
    authKind,
    workspaceId: String(input.workspaceId || "").trim(),
    sessionId: String(input.sessionId || "").trim(),
    blockId: input.blockId ?? null,
  };
}

export function buildTutoringSpeechOutcome(
  ctx: TutoringContext,
  input: TutoringSpeechInput,
): TutoringPowOutcome {
  const timestampMs = input.timestampMs ?? Date.now();
  const event: TutoringSpeechEvent = input.event === "stop" ? "stop" : "start";
  const payload =
    ctx.product === "tap"
      ? (buildTapSpeechSegmentPayload({
          event,
          tapSessionId: ctx.sessionId,
          workspaceId: ctx.workspaceId,
          blockId: ctx.blockId,
          segmentDurationMs: input.segmentDurationMs,
          transcriptSnapshot: input.transcriptSnapshot,
          timestampMs,
        }) as unknown as Record<string, unknown>)
      : (buildIleSpeechSegmentPayload({
          event,
          sessionId: ctx.sessionId,
          workspaceId: ctx.workspaceId,
          blockId: ctx.blockId,
          segmentDurationMs: input.segmentDurationMs,
          transcriptSnapshot: input.transcriptSnapshot,
          timestampMs,
        }) as unknown as Record<string, unknown>);
  return {
    toolName: tutoringSpeechToolName(ctx.product),
    toolAction: event,
    type: String(payload.type || ""),
    sessionId: ctx.sessionId,
    workspaceId: ctx.workspaceId,
    product: ctx.product,
    modality: ctx.modality,
    authKind: ctx.authKind,
    payload,
  };
}

export function buildTutoringIdleOutcome(
  ctx: TutoringContext,
  input: TutoringIdleInput,
): TutoringPowOutcome {
  const timestampMs = input.timestampMs ?? Date.now();
  const payload =
    ctx.product === "tap"
      ? (buildTapIdleHeartbeatPayload({
          tapSessionId: ctx.sessionId,
          workspaceId: ctx.workspaceId,
          blockId: ctx.blockId,
          idleDurationMs: input.idleDurationMs,
          hasPendingTranscription: input.hasPendingTranscription,
          timestampMs,
        }) as unknown as Record<string, unknown>)
      : (buildIleIdleHeartbeatPayload({
          sessionId: ctx.sessionId,
          workspaceId: ctx.workspaceId,
          blockId: ctx.blockId,
          idleDurationMs: input.idleDurationMs,
          hasPendingTranscription: input.hasPendingTranscription,
          timestampMs,
        }) as unknown as Record<string, unknown>);
  return {
    toolName: tutoringIdleToolName(ctx.product),
    toolAction: "idle_heartbeat",
    type: String(payload.type || ""),
    sessionId: ctx.sessionId,
    workspaceId: ctx.workspaceId,
    product: ctx.product,
    modality: ctx.modality,
    authKind: ctx.authKind,
    payload,
  };
}

export type TutoringMutateOutcome = {
  action: TutoringMutateAction;
  product: TutoringProduct;
  modality: TutoringModality;
  authKind: TutoringAuthKind;
  sessionId: string;
  workspaceId: string;
  sessionPatch: Record<string, unknown> | null;
  probes: Array<Record<string, unknown>>;
  probeInsert: Record<string, unknown> | null;
};

export function planTutoringSessionMutate(
  ctx: TutoringContext,
  request: TutoringMutateRequest,
): TutoringMutateOutcome {
  const action: TutoringMutateAction =
    request.action === "save" || request.action === "add_probe"
      ? request.action
      : "get";
  const sessionPatch =
    action === "save" && request.session && typeof request.session === "object"
      ? request.session
      : null;
  const probes =
    action === "save" && Array.isArray(request.probes)
      ? request.probes.filter((p) => p && typeof p === "object")
      : [];
  let probeInsert: Record<string, unknown> | null = null;
  if (action === "add_probe") {
    const probe = request.probe && typeof request.probe === "object" ? request.probe : {};
    probeInsert = {
      id: typeof probe.id === "string" ? probe.id : "",
      session_id: ctx.sessionId,
      text: typeof probe.text === "string" ? probe.text : "",
      timestamp_ms:
        typeof probe.timestamp_ms === "number"
          ? probe.timestamp_ms
          : typeof probe.timestamp === "number"
            ? probe.timestamp
            : Date.now(),
      gap_score: probe.gap_score ?? probe.gapScore ?? 0,
      signals: probe.signals ?? [],
      expanded_text: probe.expanded_text ?? probe.expandedText ?? null,
      starred: probe.starred ?? false,
      is_revealed: probe.is_revealed ?? probe.isRevealed ?? false,
      request_type: probe.request_type ?? probe.requestType ?? "question",
      plan_step_id: probe.plan_step_id ?? probe.planStepId ?? null,
      archived: probe.archived ?? false,
      focused: probe.focused ?? false,
    };
  }
  return {
    action,
    product: ctx.product,
    modality: ctx.modality,
    authKind: ctx.authKind,
    sessionId: ctx.sessionId,
    workspaceId: ctx.workspaceId,
    sessionPatch,
    probes,
    probeInsert,
  };
}

export type TutoringDb = {
  from: (table: string) => any;
};

function sessionUpdatePayload(sessionPatch: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...(typeof sessionPatch.metadata === "object" && sessionPatch.metadata
      ? (sessionPatch.metadata as Record<string, unknown>)
      : {}),
  };
  if (Array.isArray(sessionPatch.objectives) && sessionPatch.objectives.length > 0) {
    metadata.objectives = sessionPatch.objectives;
  }
  const updatePayload: Record<string, unknown> = {};
  if (sessionPatch.status !== undefined) updatePayload.status = sessionPatch.status;
  if (sessionPatch.duration_ms !== undefined) updatePayload.duration_ms = sessionPatch.duration_ms;
  if (sessionPatch.ended_at !== undefined) updatePayload.ended_at = sessionPatch.ended_at;
  if (sessionPatch.report !== undefined) updatePayload.report = sessionPatch.report;
  if (sessionPatch.planning_prompt !== undefined) {
    updatePayload.planning_prompt = sessionPatch.planning_prompt;
  }
  if (Object.keys(metadata).length > 0) updatePayload.metadata = metadata;
  return updatePayload;
}

export type TutoringMutateApplyResult =
  | { ok: true; action: "get"; session: Record<string, unknown>; probes: Array<Record<string, unknown>> }
  | { ok: true; action: "save" }
  | { ok: true; action: "add_probe"; probe: Record<string, unknown> }
  | { ok: false; status: number; message: string };

/** Shared ILE/AYCL session get/save/add_probe. TAP start/complete stays on TAP rows. */
export async function applyTutoringSessionMutate(
  db: TutoringDb,
  ctx: TutoringContext,
  request: TutoringMutateRequest,
  probeUserId?: string | null,
): Promise<TutoringMutateApplyResult> {
  const planned = planTutoringSessionMutate(ctx, request);
  if (planned.action === "get") {
    const { data: session, error } = await db
      .from("sessions")
      .select("*")
      .eq("id", ctx.sessionId)
      .single();
    if (error || !session) {
      return { ok: false, status: 404, message: "Session not found" };
    }
    const { data: probes } = await db
      .from("probes")
      .select("*")
      .eq("session_id", ctx.sessionId)
      .order("timestamp_ms", { ascending: true });
    return {
      ok: true,
      action: "get",
      session,
      probes: probes || [],
    };
  }

  if (planned.action === "save" && planned.sessionPatch) {
    const updatePayload = sessionUpdatePayload(planned.sessionPatch);
    const { error: updateError } = await db
      .from("sessions")
      .update(updatePayload)
      .eq("id", ctx.sessionId);
    if (updateError) {
      return { ok: false, status: 500, message: updateError.message || "Failed to save session" };
    }
    for (const probe of planned.probes) {
      if (!probe.id) continue;
      const row: Record<string, unknown> = {
        id: probe.id,
        session_id: ctx.sessionId,
        text: probe.text,
        timestamp_ms: probe.timestamp_ms,
        gap_score: probe.gap_score ?? 0,
        signals: probe.signals || [],
        expanded_text: probe.expanded_text,
        starred: probe.starred ?? false,
        is_revealed: probe.is_revealed ?? false,
        request_type: probe.request_type || "question",
        plan_step_id: probe.plan_step_id,
        archived: probe.archived ?? false,
        focused: probe.focused ?? false,
      };
      if (probeUserId) row.user_id = probeUserId;
      await db.from("probes").upsert(row);
    }
    return { ok: true, action: "save" };
  }

  if (planned.action === "add_probe" && planned.probeInsert) {
    const id =
      typeof planned.probeInsert.id === "string" && planned.probeInsert.id
        ? planned.probeInsert.id
        : crypto.randomUUID();
    const row: Record<string, unknown> = { ...planned.probeInsert, id };
    if (probeUserId) row.user_id = probeUserId;
    const { data, error } = await db.from("probes").insert(row).select("*").single();
    if (error || !data) {
      return { ok: false, status: 500, message: error?.message || "Failed to add probe" };
    }
    return { ok: true, action: "add_probe", probe: data };
  }

  return { ok: false, status: 400, message: "Unknown action" };
}

/** ILE Project and TAP Exercise share this solo thought path. */
export function applySoloThoughtMutation(
  lists: ExerciseDualLists,
  chapterStatus: string | null | undefined,
  mutation: IleProjectThoughtMutation,
): IleProjectThoughtMutationResult {
  return applyIleProjectThoughtMutation(lists, chapterStatus, mutation);
}

export function emptySoloThoughtLists(): ExerciseDualLists {
  return emptyExerciseDualLists();
}

export {
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
  promoteExerciseStashToSubmission,
  demoteExerciseSubmissionToStash,
};
