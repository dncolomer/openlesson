import type { AdminProofOfWorkDetails } from "@/lib/admin/proof-of-work";
import { adminActivityTypeLabel } from "@/lib/admin/product-labels";

export type ActivityWindow = "24h" | "7d" | "30d";

export type ActivityType =
  | "ile_session"
  | "tap_session"
  | "proof_of_work"
  | "workspace_created";

export type ActivityUser = {
  id: string | null;
  username: string | null;
  email: string | null;
};

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  createdAt: string;
  summary: string;
  status?: string;
  href: string;
  userId: string | null;
  user: ActivityUser;
  /** Present for proof_of_work events — used by expandable feed rows. */
  details?: AdminProofOfWorkDetails;
  /** Optional product subtype for four-variant labels. */
  session_mode?: string | null;
  interaction_kind?: string | null;
};

export type ActiveUserRow = {
  userId: string;
  username: string | null;
  email: string | null;
  plan: string;
  lastActiveAt: string;
  /** Open-ended (technical ile) session count in window. */
  ileSessions: number;
  /** Timed (technical tap) session count in window. */
  tapSessions: number;
  proofOfWork: number;
  workspacesCreated: number;
};

export type RawActivityRow = {
  id: string;
  type: ActivityType;
  createdAt: string;
  summary: string;
  status?: string | null;
  href: string;
  userId: string | null;
  details?: AdminProofOfWorkDetails;
  session_mode?: string | null;
  interaction_kind?: string | null;
};

const WINDOW_MS: Record<ActivityWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function parseActivityWindow(value: string | null | undefined): ActivityWindow {
  if (value === "24h" || value === "7d" || value === "30d") return value;
  return "7d";
}

export function activityWindowStart(window: ActivityWindow, now = new Date()): Date {
  return new Date(now.getTime() - WINDOW_MS[window]);
}

/**
 * Operator-facing activity type label (product tool names / horizon rollups).
 * Prefer {@link activityTypeLabelForEvent} when subtype fields are available.
 */
export function activityTypeLabel(
  type: ActivityType,
  meta?: {
    session_mode?: string | null;
    interaction_kind?: string | null;
    preferFullProductName?: boolean;
  },
): string {
  return adminActivityTypeLabel(type, meta);
}

/** Label an activity event using any attached product subtype fields. */
export function activityTypeLabelForEvent(
  event: Pick<ActivityEvent, "type" | "session_mode" | "interaction_kind">,
): string {
  return adminActivityTypeLabel(event.type, {
    session_mode: event.session_mode,
    interaction_kind: event.interaction_kind,
    preferFullProductName: Boolean(event.session_mode || event.interaction_kind),
  });
}

/** Merge multi-source rows and sort newest first. */
export function mergeActivityEvents(
  rows: RawActivityRow[],
  userMap: Map<string, ActivityUser>,
  limit: number
): ActivityEvent[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return sorted.slice(0, Math.max(0, limit)).map((row) => {
    const profile = row.userId ? userMap.get(row.userId) : undefined;
    return {
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
      summary: row.summary,
      status: row.status || undefined,
      href: row.href,
      userId: row.userId,
      user: {
        id: row.userId,
        username: profile?.username ?? null,
        email: profile?.email ?? null,
      },
      details: row.details,
      session_mode: row.session_mode ?? null,
      interaction_kind: row.interaction_kind ?? null,
    };
  });
}

/** Rank users by last activity; aggregate counts from raw rows. */
export function rankActiveUsers(
  rows: RawActivityRow[],
  profiles: Map<string, { username: string | null; email: string | null; plan: string }>,
  limit: number
): ActiveUserRow[] {
  const byUser = new Map<
    string,
    {
      lastActiveAt: string;
      ileSessions: number;
      tapSessions: number;
      proofOfWork: number;
      workspacesCreated: number;
    }
  >();

  for (const row of rows) {
    if (!row.userId) continue;
    const existing = byUser.get(row.userId) || {
      lastActiveAt: row.createdAt,
      ileSessions: 0,
      tapSessions: 0,
      proofOfWork: 0,
      workspacesCreated: 0,
    };

    if (new Date(row.createdAt).getTime() > new Date(existing.lastActiveAt).getTime()) {
      existing.lastActiveAt = row.createdAt;
    }

    switch (row.type) {
      case "ile_session":
        existing.ileSessions += 1;
        break;
      case "tap_session":
        existing.tapSessions += 1;
        break;
      case "proof_of_work":
        existing.proofOfWork += 1;
        break;
      case "workspace_created":
        existing.workspacesCreated += 1;
        break;
    }

    byUser.set(row.userId, existing);
  }

  return [...byUser.entries()]
    .map(([userId, stats]) => {
      const profile = profiles.get(userId);
      return {
        userId,
        username: profile?.username ?? null,
        email: profile?.email ?? null,
        plan: profile?.plan ?? "inactive",
        lastActiveAt: stats.lastActiveAt,
        ileSessions: stats.ileSessions,
        tapSessions: stats.tapSessions,
        proofOfWork: stats.proofOfWork,
        workspacesCreated: stats.workspacesCreated,
      };
    })
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
    .slice(0, Math.max(0, limit));
}
