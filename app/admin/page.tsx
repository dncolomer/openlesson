"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { PowDetailsPanel } from "@/components/admin/PowDetailsPanel";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import {
  activityTypeLabel,
  type ActiveUserRow,
  type ActivityEvent,
  type ActivityWindow,
} from "@/lib/admin/activity";

interface Stats {
  totalUsers: number;
  monthlyActiveUsers: number;
  totalIleSessions: number;
  totalTapSessions: number;
  totalWorkspaces: number;
  totalOrganizations: number;
  totalEvidence: number;
  activeSubscriptions: number;
  tierBreakdown: {
    free: number;
    trial: number;
    regular_2026: number;
    pro_teams: number;
    api_metered: number;
    legacy: number;
    inactive: number;
  };
}

const WINDOWS: Array<{ id: ActivityWindow; label: string }> = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

const SECTION_LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/sessions", label: "Sessions" },
] as const;

export default function AdminPage() {
  const { loading, error, isAdmin } = useAdminGuard();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [window, setWindow] = useState<ActivityWindow>("7d");
  const [activeUsers, setActiveUsers] = useState<ActiveUserRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [expandedActivityKey, setExpandedActivityKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/stats")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load stats");
        setStats(data);
      })
      .catch((err) => setStatsError(err instanceof Error ? err.message : "Failed to load stats"));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);

    fetch(`/api/admin/activity?window=${window}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load activity");
        if (cancelled) return;
        setActiveUsers(data.activeUsers || []);
        setRecentActivity(data.recentActivity || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setActivityError(err instanceof Error ? err.message : "Failed to load activity");
        }
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, window]);

  if (loading) return <AdminLoading />;
  if (error || !isAdmin) return <AdminError message={error || "Admin access required"} />;

  return (
    <div>
      <p className="mb-6 text-sm text-neutral-400">
        Active-user overview — who has been on the platform recently and what they did.
      </p>

      {statsError && <p className="mb-4 text-sm text-red-400">{statsError}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Users" value={stats?.totalUsers ?? 0} />
        <StatCard label="MAU" value={stats?.monthlyActiveUsers ?? 0} />
        <StatCard label="Active subs" value={stats?.activeSubscriptions ?? 0} />
        <StatCard label="Organizations" value={stats?.totalOrganizations ?? 0} />
        <StatCard label="ILE sessions" value={stats?.totalIleSessions ?? 0} />
        <StatCard label="TAP sessions" value={stats?.totalTapSessions ?? 0} />
        <StatCard label="Workspaces" value={stats?.totalWorkspaces ?? 0} />
        <StatCard label="Proof of work" value={stats?.totalEvidence ?? 0} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-white">Recent activity</h2>
        <div className="flex gap-1 rounded-md border border-neutral-800 bg-neutral-950/60 p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWindow(w.id)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                window === w.id
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {activityError && <p className="mb-4 text-sm text-red-400">{activityError}</p>}

      <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50">
          <div className="border-b border-neutral-800 px-4 py-3">
            <h3 className="text-sm font-medium text-white">Recently active users</h3>
            <p className="mt-0.5 text-xs text-neutral-500">Ranked by last activity in the selected window</p>
          </div>
          {activityLoading ? (
            <div className="p-6">
              <AdminLoading message="Loading users" />
            </div>
          ) : activeUsers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">No active users in this window</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Last seen</th>
                    <th className="px-4 py-2 font-medium">Activity</th>
                    <th className="px-4 py-2 font-medium">Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map((user) => (
                    <tr key={user.userId} className="border-b border-neutral-800/80 last:border-0">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/users/${user.userId}`}
                          className="font-medium text-white hover:underline"
                        >
                          {user.username || user.email || "Unknown"}
                        </Link>
                        {user.username && user.email && (
                          <div className="text-xs text-neutral-500">{user.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400 whitespace-nowrap">
                        {formatRelative(user.lastActiveAt)}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400">
                        <span className="text-neutral-300">{activityCountLabel(user)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">
                          {user.plan}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50">
          <div className="border-b border-neutral-800 px-4 py-3">
            <h3 className="text-sm font-medium text-white">Activity feed</h3>
            <p className="mt-0.5 text-xs text-neutral-500">ILE, TAP, workspaces, and proof-of-work</p>
          </div>
          {activityLoading ? (
            <div className="p-6">
              <AdminLoading message="Loading activity" />
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">No activity in this window</p>
          ) : (
            <ul className="divide-y divide-neutral-800/80">
              {recentActivity.map((event) => {
                const key = `${event.type}-${event.id}`;
                const isPow = event.type === "proof_of_work" && !!event.details;
                const expanded = expandedActivityKey === key;

                return (
                  <li key={key} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                            {activityTypeLabel(event.type)}
                          </span>
                          <span className="text-neutral-500">{formatRelative(event.createdAt)}</span>
                          {event.status && (
                            <span className="text-neutral-600">{event.status}</span>
                          )}
                        </div>
                        {isPow ? (
                          <button
                            type="button"
                            onClick={() => setExpandedActivityKey(expanded ? null : key)}
                            className="mt-1 block w-full truncate text-left text-sm text-white hover:underline"
                          >
                            {event.summary}
                          </button>
                        ) : (
                          <Link
                            href={event.href}
                            className="mt-1 block truncate text-sm text-white hover:underline"
                          >
                            {event.summary}
                          </Link>
                        )}
                        <div className="mt-0.5 text-xs text-neutral-500">
                          {event.user.id ? (
                            <Link
                              href={`/admin/users/${event.user.id}`}
                              className="hover:text-neutral-300 hover:underline"
                            >
                              {event.user.username || event.user.email || "Unknown user"}
                            </Link>
                          ) : (
                            <span>Guest / API</span>
                          )}
                        </div>
                        {isPow && expanded && event.details && (
                          <PowDetailsPanel details={event.details} />
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isPow && (
                          <button
                            type="button"
                            onClick={() => setExpandedActivityKey(expanded ? null : key)}
                            className="text-xs text-neutral-500 hover:text-white"
                          >
                            {expanded ? "Hide" : "Details"}
                          </button>
                        )}
                        <Link
                          href={event.href}
                          className="text-xs text-neutral-500 hover:text-white"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {stats?.tierBreakdown && (
        <div className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="mb-3 text-sm font-medium text-white">Plan breakdown</h2>
          <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
            <span>Free: {stats.tierBreakdown.free}</span>
            <span className="text-emerald-400">Trial: {stats.tierBreakdown.trial}</span>
            <span className="text-blue-400">Individual: {stats.tierBreakdown.regular_2026}</span>
            <span className="text-purple-400">Teams: {stats.tierBreakdown.pro_teams}</span>
            <span className="text-amber-200">API Metered: {stats.tierBreakdown.api_metered}</span>
            <span className="text-amber-300">Legacy: {stats.tierBreakdown.legacy}</span>
            <span>Inactive: {stats.tierBreakdown.inactive}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SECTION_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-700 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <div className="text-xl font-semibold text-white tabular-nums">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

function activityCountLabel(user: ActiveUserRow): string {
  const parts: string[] = [];
  if (user.ileSessions) parts.push(`${user.ileSessions} ILE`);
  if (user.tapSessions) parts.push(`${user.tapSessions} TAP`);
  if (user.proofOfWork) parts.push(`${user.proofOfWork} PoW`);
  if (user.workspacesCreated) parts.push(`${user.workspacesCreated} WS`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
