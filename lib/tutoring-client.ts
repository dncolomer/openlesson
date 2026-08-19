/**
 * Browser posts for the shared tutoring runtime.
 * Speech / idle / start / complete go through tutoring-runtime + TAP_SESSION_RUNTIME_PATHS.
 */
import {
  buildTutoringIdleOutcome,
  buildTutoringSpeechOutcome,
  resolveTutoringContext,
  type TutoringIdleInput,
  type TutoringSpeechInput,
} from "@/lib/tutoring-runtime";
import { TAP_SESSION_RUNTIME_PATHS } from "@/lib/tap-session-runtime";
import type { SessionPowContext } from "@/lib/session-pow-api-paths";

export type TutoringClientAuth = {
  product?: "ile" | "tap";
  modality?: "dialog" | "solo";
  authKind?: "cookie" | "ile" | "aycl" | "tap";
  workspaceId: string;
  sessionId: string;
  blockId?: string | null;
};

export type TutoringPostResult = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown>;
};

export async function postTutoringJson(
  path: string,
  body: Record<string, unknown>,
): Promise<TutoringPostResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, payload };
}

export function tutoringSpeechRequestBody(
  ctxInput: TutoringClientAuth,
  speech: TutoringSpeechInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const ctx = resolveTutoringContext(ctxInput);
  const outcome = buildTutoringSpeechOutcome(ctx, speech);
  return {
    ...extra,
    workspaceId: ctx.workspaceId,
    sessionId: ctx.sessionId,
    blockId: ctx.blockId,
    event: speech.event,
    segmentDurationMs: speech.segmentDurationMs,
    transcriptSnapshot: speech.transcriptSnapshot,
    timestampMs: speech.timestampMs ?? Date.now(),
    product: ctx.product,
    modality: ctx.modality,
    authKind: ctx.authKind,
    type: outcome.type,
  };
}

export function tutoringIdleRequestBody(
  ctxInput: TutoringClientAuth,
  idle: TutoringIdleInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const ctx = resolveTutoringContext(ctxInput);
  const outcome = buildTutoringIdleOutcome(ctx, idle);
  return {
    ...extra,
    workspaceId: ctx.workspaceId,
    sessionId: ctx.sessionId,
    blockId: ctx.blockId,
    idleDurationMs: idle.idleDurationMs,
    hasPendingTranscription: idle.hasPendingTranscription,
    timestampMs: idle.timestampMs ?? Date.now(),
    product: ctx.product,
    modality: ctx.modality,
    authKind: ctx.authKind,
    type: outcome.type,
  };
}

export function tutoringContextFromPow(
  context: SessionPowContext,
  extras?: Pick<TutoringClientAuth, "product" | "modality" | "authKind">,
): TutoringClientAuth {
  return {
    product: extras?.product ?? "tap",
    modality: extras?.modality ?? (context.practice === true ? "solo" : "dialog"),
    authKind: extras?.authKind ?? "tap",
    workspaceId: String(context.workspaceId || ""),
    sessionId: String(context.tapSessionId || context.sessionId || ""),
    blockId: context.blockId ?? null,
  };
}

export function powAuthFields(context: SessionPowContext): Record<string, unknown> {
  return {
    workspaceId: context.workspaceId,
    blockId: context.blockId,
    sessionId: context.sessionId,
    privateToken: context.privateToken,
    ileToken: context.privateToken,
    tapSessionId: context.tapSessionId,
    entryQueryParams: context.entryQueryParams,
    practice: context.practice === true,
  };
}

export async function postTutoringSpeech(
  context: SessionPowContext,
  speech: TutoringSpeechInput,
  path: string,
): Promise<TutoringPostResult> {
  return postTutoringJson(
    path,
    tutoringSpeechRequestBody(tutoringContextFromPow(context), speech, powAuthFields(context)),
  );
}

export async function postTutoringIdle(
  context: SessionPowContext,
  idle: TutoringIdleInput,
  path: string,
): Promise<TutoringPostResult> {
  return postTutoringJson(
    path,
    tutoringIdleRequestBody(tutoringContextFromPow(context), idle, powAuthFields(context)),
  );
}

export async function postTutoringSessionStart(
  body: Record<string, unknown>,
): Promise<TutoringPostResult> {
  return postTutoringJson(TAP_SESSION_RUNTIME_PATHS.start, body);
}

export async function postTutoringSessionComplete(
  body: Record<string, unknown>,
): Promise<TutoringPostResult> {
  return postTutoringJson(TAP_SESSION_RUNTIME_PATHS.complete, body);
}
