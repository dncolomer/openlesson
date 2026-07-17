import type { AdminProofOfWorkDetails } from "@/lib/admin/proof-of-work";

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
};

export type ActiveUserRow = {
  userId: string;
  username: string | null;
  email: string | null;
  plan: string;
  lastActiveAt: string;
  ileSessions: number;
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

export function activityTypeLabel(type: ActivityType): string {
  switch (type) {
    case "ile_session":
      return "ILE session";
    case "tap_session":
      return "TAP session";
    case "proof_of_work":
      return "Proof of work";
    case "workspace_created":
      return "Workspace";
    default:
      return type;
  }
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
