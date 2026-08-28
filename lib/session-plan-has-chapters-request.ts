import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardSessionRoute,
} from "@/lib/api/require-auth";
import {
  getSessionPlan,
  sessionPlanChaptersStatus,
  type SessionPlanChaptersStatus,
} from "@/lib/storage/session-plans";
import type { SessionPlan } from "@/lib/domain/types";

export type SessionPlanHasChaptersLookup =
  | { ok: true; status: SessionPlanChaptersStatus; plan: SessionPlan | null }
  | { ok: false; response: NextResponse };

/**
 * Same auth as session-plan create/translate: `guardSessionRoute` then
 * existence lookup on that client (service-role for ILE/AYCL).
 */
export async function lookupSessionPlanChaptersForRequest(
  body: Record<string, unknown>,
  guard: typeof guardSessionRoute = guardSessionRoute,
): Promise<SessionPlanHasChaptersLookup> {
  const raw = body.sessionId ?? body.session_id;
  const sessionId = typeof raw === "string" ? raw.trim() : "";
  if (!sessionId) {
    return { ok: false, response: jsonError(400, "Missing sessionId") };
  }

  const auth = await guard(sessionId, {
    ayclToken: ayclTokenFromBody(body),
    ileToken: ileTokenFromBody(body),
  });
  if (!auth.ok) return { ok: false, response: auth.response };

  const plan = await getSessionPlan(sessionId, auth.supabase);
  if (plan && (plan.steps?.length ?? 0) > 0) {
    return { ok: true, status: "exists", plan };
  }
  const status = await sessionPlanChaptersStatus(sessionId, auth.supabase);
  return { ok: true, status, plan: plan ?? null };
}
