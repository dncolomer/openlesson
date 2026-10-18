import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import {
  FREE_WEEKLY_SESSION_LIMIT,
  canStartFreeSession,
  freeWeeklySessionLimitMessage,
  utcMondayWeekWindow,
} from "@/lib/free-tier";
import { createAdminClient } from "@/lib/supabase/admin";
import { countUserSessionsSince } from "@/lib/usage-metrics";

async function sessionCountClient(fallback: SupabaseClient): Promise<SupabaseClient> {
  try {
    return createAdminClient();
  } catch {
    return fallback;
  }
}

export async function loadFreeWeeklySessionUsage(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<{ used: number; resetAt: Date }> {
  const { start, resetAt } = utcMondayWeekWindow(now);
  const client = await sessionCountClient(supabase);
  const used = await countUserSessionsSince(client, userId, start);
  return { used, resetAt };
}

/** 429 when a Free user has already started this week's sessions. */
export async function rejectIfFreeWeeklySessionLimit(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<NextResponse | null> {
  const { used, resetAt } = await loadFreeWeeklySessionUsage(supabase, userId, now);
  if (canStartFreeSession(used)) return null;
  return jsonError(
    429,
    freeWeeklySessionLimitMessage(resetAt),
    "usage_limit_reached",
    {
      weeklySessionsUsed: used,
      weeklySessionsLimit: FREE_WEEKLY_SESSION_LIMIT,
      weeklySessionsResetAt: resetAt.toISOString(),
    },
  );
}
