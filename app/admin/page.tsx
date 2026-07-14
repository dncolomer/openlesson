"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { useAdminGuard } from "@/components/admin/useAdminGuard";

interface Stats {
  totalUsers: number;
  monthlyActiveUsers: number;
  totalIleSessions: number;
  totalTapSessions: number;
  combinedSessions: number;
  completedIleSessions: number;
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

const NAV_CARDS = [
  {
    href: "/admin/users",
    title: "Users",
    description: "Plans, usage extras, grandfathered legacy tiers, and org membership.",
  },
  {
    href: "/admin/organizations",
    title: "Organizations",
    description: "Teams orgs, members, invite links, and guest access.",
  },
  {
    href: "/admin/workspaces",
    title: "Workspaces",
    description: "Verification workspaces, blocks, and TAP activity.",
  },
  {
    href: "/admin/sessions",
    title: "Sessions",
    description: "ILE tutoring sessions across the platform.",
  },
  {
    href: "/admin/leads",
    title: "Leads",
    description: "Enterprise and solutions-page inbound leads.",
  },
  {
    href: "/admin/partners",
    title: "Partners",
    description: "Partner program stakes, referrals, and payouts.",
  },
  {
    href: "/admin/prompts",
    title: "Prompts",
    description: "Read-only inventory of every LLM prompt — registry, routes, and builders.",
  },
] as const;

export default function AdminPage() {
  const { loading, error, isAdmin } = useAdminGuard();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

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

  if (loading) return <AdminLoading />;
  if (error || !isAdmin) return <AdminError message={error || "Admin access required"} />;

  return (
    <div>
      <p className="mb-6 text-sm text-neutral-400">
        Platform overview. Legacy <code className="text-neutral-300">regular</code> and{" "}
        <code className="text-neutral-300">pro</code> subscribers keep grandfathered limits until migrated.
      </p>

      {statsError && <p className="mb-4 text-sm text-red-400">{statsError}</p>}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Users" value={stats?.totalUsers ?? 0} />
        <StatCard label="MAU (ILE)" value={stats?.monthlyActiveUsers ?? 0} />
        <StatCard label="Active subs" value={stats?.activeSubscriptions ?? 0} />
        <StatCard label="Organizations" value={stats?.totalOrganizations ?? 0} />
        <StatCard label="ILE sessions" value={stats?.totalIleSessions ?? 0} />
        <StatCard label="TAP sessions" value={stats?.totalTapSessions ?? 0} />
        <StatCard label="Workspaces" value={stats?.totalWorkspaces ?? 0} />
        <StatCard label="Proof-of-work uploads" value={stats?.totalEvidence ?? 0} />
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700"
          >
            <h2 className="mb-2 text-lg font-semibold text-white">{card.title}</h2>
            <p className="text-sm text-neutral-400">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}