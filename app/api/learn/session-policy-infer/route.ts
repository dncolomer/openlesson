/**
 * Infer which hidden state the canvas work is on, or rephrase the cheapest next one.
 * The same session check as the field route. A refusal does not end the session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { guardSessionRoute } from "@/lib/api/require-auth";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";
import { getCalibrationFlowByToken } from "@/lib/calibration-flow-repository";
import {
  inferSessionGapReply,
  inferSessionPolicyReply,
  suggestSessionPolicyReply,
} from "@/lib/session-policy-infer-xai";
import type { SessionPolicyProofEvent } from "@/lib/session-policy-infer";
import {
  planSessionBranchPrepare,
  type SessionBranchPrepareInput,
} from "@/lib/session-branch-prepare";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { getVerificationFlowByToken } from "@/lib/verification-flow-repository";

export const runtime = "nodejs";
export const maxDuration = 60;

function proofEvents(raw: unknown): SessionPolicyProofEvent[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const events: SessionPolicyProofEvent[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const action = (row as { action?: unknown }).action;
    if (typeof action !== "string" || !action.trim()) return null;
    const prompt = (row as { prompt?: unknown }).prompt;
    const event: SessionPolicyProofEvent = { action: action.trim() };
    if (typeof prompt === "string" && prompt.trim()) event.prompt = prompt.trim();
    events.push(event);
  }
  return events;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const body =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as SessionBranchPrepareInput & Record<string, unknown>)
        : {};
    const plan = planSessionBranchPrepare({
      ...body,
      entryQueryParams: entryQueryParamsFromBody(body),
    });
    if (plan.kind === "missing-material") return jsonError(400, "A chapter is required.");
    if (plan.kind === "none") return jsonError(400, "A session is required.");

    if (plan.kind === "calibration") {
      const flow = await getCalibrationFlowByToken(plan.token);
      if (!flow) return jsonError(404, "Calibration flow not found");
    } else if (plan.kind === "verification") {
      const flow = await getVerificationFlowByToken(plan.token);
      if (!flow) return jsonError(404, "Verification flow not found");
    } else if (plan.kind === "workspace") {
      const access = await resolveTapSessionAccess({
        privateToken: plan.privateToken || undefined,
        workspaceId: plan.workspaceId || undefined,
        tapSessionId: plan.tapSessionId || undefined,
        blockId: plan.blockId || null,
        focusSessionId: plan.sessionId || null,
        entryQueryParams: plan.entryQueryParams,
      });
      if ("error" in access) return jsonError(access.status, access.error);
    } else {
      const auth = await guardSessionRoute(plan.sessionId, {
        ayclToken: plan.ayclToken || null,
        ileToken: plan.ileToken || null,
        requireSessionId: !plan.ayclToken && !plan.ileToken,
      });
      if (!auth.ok) return auth.response;
    }

    if (body.phase === "infer") {
      const events = proofEvents(body.events);
      if (!events) return jsonError(400, "The policy could not be read.");
      const prepared = await inferSessionPolicyReply({
        events,
        chapterTitle: plan.chapterTitle,
        chapterBrief: plan.chapterBrief,
        candidates: typeof body.candidates === "string" ? body.candidates : null,
      });
      if (!prepared.ok) {
        console.error("[session-policy-infer] infer", prepared.error);
        return NextResponse.json({ reply: null });
      }
      return NextResponse.json({ reply: prepared.reply });
    }

    if (body.phase === "project") {
      const events = proofEvents(body.events);
      if (!events) return jsonError(400, "The policy could not be read.");
      const rawCandidates = body.candidates;
      if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
        return jsonError(400, "The policy could not be read.");
      }
      const candidates: { id: string; title: string; observation: string }[] = [];
      for (const row of rawCandidates) {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          return jsonError(400, "The policy could not be read.");
        }
        const id = typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id.trim() : "";
        const title =
          typeof (row as { title?: unknown }).title === "string" ? (row as { title: string }).title.trim() : "";
        const observation =
          typeof (row as { observation?: unknown }).observation === "string"
            ? (row as { observation: string }).observation.trim()
            : "";
        if (!id || !title) return jsonError(400, "The policy could not be read.");
        candidates.push({ id, title, observation: observation || title });
      }
      const prepared = await inferSessionGapReply({
        events,
        chapterTitle: plan.chapterTitle,
        nodeTitle: typeof body.nodeTitle === "string" ? body.nodeTitle : "",
        candidates,
      });
      if (!prepared.ok) {
        console.error("[session-policy-infer] project", prepared.error);
        return NextResponse.json({ reply: null });
      }
      return NextResponse.json({ reply: prepared.reply });
    }

    if (body.phase === "suggest") {
      const prepared = await suggestSessionPolicyReply({
        nodeTitle: typeof body.nodeTitle === "string" ? body.nodeTitle : "",
        observation: typeof body.observation === "string" ? body.observation : "",
        intent: typeof body.intent === "string" ? body.intent : "",
        canvasNote: typeof body.canvasNote === "string" ? body.canvasNote : "",
      });
      if (!prepared.ok) {
        console.error("[session-policy-infer] suggest", prepared.error);
        return NextResponse.json({ reply: null });
      }
      return NextResponse.json({ reply: prepared.reply });
    }

    return jsonError(400, "The policy could not be read.");
  } catch (error) {
    console.error("[session-policy-infer]", error);
    return jsonError(500, "The policy could not be read.");
  }
}
