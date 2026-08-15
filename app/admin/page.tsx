"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { PowDetailsPanel } from "@/components/admin/PowDetailsPanel";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import {
  adminCardClass,
  adminCardPaddedClass,
  adminLabelClass,
  adminPillClass,
  adminSectionTitleClass,
} from "@/components/admin/styles";
import {
  activityTypeLabelForEvent,
  type ActivityEvent,
  type ActivityWindow,
  type ActiveUserRow,
} from "@/lib/admin/activity";
import {
  ADMIN_SESSION_HORIZON_LABELS,
  adminActiveUserActivityLabel,
} from "@/lib/admin/product-labels";

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
    inactive: number;
    trial: number;
    api_metered: number;
    trial_expired: number;
  };
}

const WINDOWS: Array<{ id: ActivityWindow; label: string }> = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

const SECTION_LINKS = [
  { href: "/admin/users", label: "Users", description: "Accounts, plans, overage" },
  { href: "/admin/organizations", label: "Organizations", description: "Teams, invites, billing" },
  { href: "/admin/workspaces", label: "Workspaces", description: "Plans, visibility, sessions" },
  {
    href: "/admin/sessions",
    label: "Sessions",
    description: "Explore and Drill product runs",
  },
  {
    href: "/admin/data-studio",
    label: "Data Studio",
    description: "PoW, xAI, snapshots, regions, bulk LWM",
  },
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
    <div className="space-y-8">
      <div className={`${adminCardPaddedClass} sm:px-8 sm:py-8`}>
        <p className={`mb-3 ${adminLabelClass}`}>Overview</p>
        <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Who is on the platform — and what they just did.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          Active-user overview for support and ops. Jump into users, orgs, workspaces, or sessions
          from the nav or the cards below.
        </p>
      </div>

      {statsError && <p className="text-sm text-neutral-300">{statsError}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Users" value={stats?.totalUsers ?? 0} />
        <StatCard label="MAU" value={stats?.monthlyActiveUsers ?? 0} />
        <StatCard label="Active subs" value={stats?.activeSubscriptions ?? 0} />
        <StatCard label="Organizations" value={stats?.totalOrganizations ?? 0} />
        <StatCard
          label={ADMIN_SESSION_HORIZON_LABELS.openEnded}
          value={stats?.totalIleSessions ?? 0}
        />
        <StatCard
          label={ADMIN_SESSION_HORIZON_LABELS.timed}
          value={stats?.totalTapSessions ?? 0}
        />
        <StatCard label="Workspaces" value={stats?.totalWorkspaces ?? 0} />
        <StatCard label="Proof of work" value={stats?.totalEvidence ?? 0} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={adminSectionTitleClass}>Recent activity</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Ranked and filtered by window</p>
        </div>
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

      {activityError && <p className="text-sm text-neutral-300">{activityError}</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={adminCardClass}>
          <div className="border-b border-neutral-800 px-4 py-3 sm:px-5">
            <h3 className={adminSectionTitleClass}>Recently active users</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Ranked by last activity in the selected window
            </p>
          </div>
          {activityLoading ? (
            <div className="p-6">
              <AdminLoading message="Loading users" />
            </div>
          ) : activeUsers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              No active users in this window
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
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
                      <td className="whitespace-nowrap px-4 py-2.5 text-neutral-400">
                        {formatRelative(user.lastActiveAt)}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400">
                        <span className="text-neutral-300">
                          {adminActiveUserActivityLabel(user)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={adminPillClass}>{user.plan}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={adminCardClass}>
          <div className="border-b border-neutral-800 px-4 py-3 sm:px-5">
            <h3 className={adminSectionTitleClass}>Activity feed</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Sessions, workspaces, and proof-of-work
            </p>
          </div>
          {activityLoading ? (
            <div className="p-6">
              <AdminLoading message="Loading activity" />
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              No activity in this window
            </p>
          ) : (
            <ul className="divide-y divide-neutral-800/80">
              {recentActivity.map((event) => {
                const key = `${event.type}-${event.id}`;
                const isPow = event.type === "proof_of_work" && !!event.details;
                const expanded = expandedActivityKey === key;

                return (
                  <li key={key} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={adminPillClass}>{activityTypeLabelForEvent(event)}</span>
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
        <div className={adminCardPaddedClass}>
          <p className={`mb-3 ${adminLabelClass}`}>Plan breakdown</p>
          <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
            <span>Inactive: {stats.tierBreakdown.inactive}</span>
            <span className="text-white">Trial: {stats.tierBreakdown.trial}</span>
            <span className="text-neutral-200">API Metered: {stats.tierBreakdown.api_metered}</span>
            <span className="text-orange-300">
              Trial expired: {stats.tierBreakdown.trial_expired}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTION_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${adminCardPaddedClass} transition-colors hover:border-neutral-700`}
          >
            <p className={adminLabelClass}>{link.label}</p>
            <p className="mt-2 text-sm text-neutral-300">{link.description}</p>
            <p className="mt-3 text-xs text-neutral-500">Open →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={adminCardPaddedClass}>
      <div className="text-xl font-semibold tabular-nums text-white sm:text-2xl">
        {value.toLocaleString()}
      </div>
      <div className={`mt-1 ${adminLabelClass}`}>{label}</div>
    </div>
  );
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
