/**
 * Welcome load/confirm existence entry: token-aware API, not a browser
 * `session_plans` SELECT. Errors stay distinct from empty.
 */
import type { ChapterPlanStatus } from "@/components/session-view/types";
import type { SessionPlan } from "@/lib/domain/types";
import type { SessionPlanChaptersStatus } from "@/lib/storage/session-plans";

export const SESSION_PLAN_HAS_CHAPTERS_PATH = "/api/session-plan/has-chapters";

export type { SessionPlanChaptersStatus };

export type CreateForceDecision =
  | { action: "create"; force: boolean }
  | { action: "abort"; reason: "failed" | "unknown" };

export type WelcomeChapterSnapshot = {
  status: SessionPlanChaptersStatus;
  plan: SessionPlan | null;
};

function parseWelcomeStatus(raw: unknown): SessionPlanChaptersStatus {
  if (raw === "exists" || raw === "empty" || raw === "failed") return raw;
  return "failed";
}

function parseWelcomePlan(raw: unknown): SessionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as { steps?: unknown; sessionId?: unknown; session_id?: unknown };
  const steps = rec.steps;
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return raw as SessionPlan;
}

/** Shipped client entry that welcome load + Confirm Settings call. */
export async function fetchWelcomeChapterSnapshot(
  sessionId: string,
  guestAccessBody: Record<string, unknown> = {},
): Promise<WelcomeChapterSnapshot> {
  try {
    const res = await fetch(SESSION_PLAN_HAS_CHAPTERS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...guestAccessBody }),
    });
    if (!res.ok) return { status: "failed", plan: null };
    const json = (await res.json()) as { status?: unknown; plan?: unknown };
    const plan = parseWelcomePlan(json.plan);
    const status =
      plan && (plan.steps?.length ?? 0) > 0
        ? "exists"
        : parseWelcomeStatus(json.status);
    return { status, plan };
  } catch {
    return { status: "failed", plan: null };
  }
}

export async function fetchSessionPlanChaptersStatus(
  sessionId: string,
  guestAccessBody: Record<string, unknown> = {},
): Promise<SessionPlanChaptersStatus> {
  const snapshot = await fetchWelcomeChapterSnapshot(sessionId, guestAccessBody);
  return snapshot.status;
}

/**
 * Confirm create `force`: empty → replace; exists → only if user opted in;
 * failed/unknown → do not create.
 */
export function createForceFromChapterStatus(
  status: ChapterPlanStatus | SessionPlanChaptersStatus,
  regenerateChapters: boolean,
): CreateForceDecision {
  if (status === "failed" || status === "unknown") {
    return { action: "abort", reason: status };
  }
  if (status === "exists") {
    return { action: "create", force: regenerateChapters };
  }
  return { action: "create", force: true };
}

/** Hydrate miss must not paint “no chapters” after a successful exists/failed check. */
export function chapterStatusAfterHydrate(
  cheap: SessionPlanChaptersStatus,
  hydratedPlan: { steps?: unknown[] } | null,
): ChapterPlanStatus {
  if (cheap === "failed") return "failed";
  if (cheap === "exists") return "exists";
  if (
    hydratedPlan &&
    Array.isArray(hydratedPlan.steps) &&
    hydratedPlan.steps.length > 0
  ) {
    return "exists";
  }
  return "empty";
}
