"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { AdminTierSelect } from "@/components/AdminTierSelect";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import {
  ADMIN_TIER_OPTIONS,
  adminTierSelectValue,
  planFilterBucket,
  statusLabel,
  tierChangeWarning,
  tierColor,
  tierLabel,
  type AdminTierId,
  type PlanFilterBucket,
} from "@/lib/admin/tiers";
import {
  adminBtnClass,
  adminCardPaddedClass,
  adminInputClass,
  adminLabelClass,
  adminPageTitleClass,
  adminSelectClass,
} from "@/components/admin/styles";

interface User {
  id: string;
  username: string | null;
  email: string | null;
  created_at: string;
  plan: string;
  is_admin: boolean;
  extra_lessons: number;
  subscription_status: string;
  current_period_end: string | null;
  email_confirmed_at: string | null;
  lessons_count: number;
  plans_count: number;
  organization_id: string | null;
  is_org_admin: boolean;
  organization: { id: string; name: string; slug: string } | null;
}

type TierOption = PlanFilterBucket;
type DateFilter = "all" | "7days" | "30days" | "90days" | "year";
type SortColumn = "username" | "lessons_count" | "plans_count" | "created_at" | "plan" | "subscription_status";

const PAGE_SIZE = 25;

export default function UsersPage() {
  const { t } = useI18n();
  const { loading: authLoading, error: authError, isAdmin } = useAdminGuard();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierOption>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");


  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, tierFilter, dateFilter]);

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load users");
      } else {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Load users error:", err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = async (user: User, tier: AdminTierId) => {
    const warning = tierChangeWarning(user, tier);
    if (warning && !window.confirm(warning)) return;

    setUpdatingUserId(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: tier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Tier change error:", data.error || res.statusText);
        return;
      }
      await loadUsers();
    } catch (err) {
      console.error("Tier change error:", err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getDateFilterStart = (filter: DateFilter): Date | null => {
    const now = new Date();
    switch (filter) {
      case "7days": now.setDate(now.getDate() - 7); return now;
      case "30days": now.setDate(now.getDate() - 30); return now;
      case "90days": now.setDate(now.getDate() - 90); return now;
      case "year": now.setFullYear(now.getFullYear() - 1); return now;
      default: return null;
    }
  };

  const kpiUsers = users;

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery || 
      (u.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTier = tierFilter === "all" || planFilterBucket(u) === tierFilter;
    
    const dateStart = getDateFilterStart(dateFilter);
    const userDate = new Date(u.created_at);
    const matchesDate = !dateStart || userDate >= dateStart;
    
    return matchesSearch && matchesTier && matchesDate;
  }).sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortColumn) {
      case "username":
        aVal = (a.username || a.email || "").toLowerCase();
        bVal = (b.username || b.email || "").toLowerCase();
        break;
      case "lessons_count":
        aVal = a.lessons_count || 0;
        bVal = b.lessons_count || 0;
        break;
      case "plans_count":
        aVal = a.plans_count || 0;
        bVal = b.plans_count || 0;
        break;
      case "created_at":
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      case "plan":
        aVal = a.plan;
        bVal = b.plan;
        break;
      case "subscription_status":
        aVal = a.subscription_status;
        bVal = b.subscription_status;
        break;
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-white/[0.06] text-white";
      case "inactive": return "bg-white/[0.04] text-neutral-300";
      case "trial_expired": return "bg-orange-900/30 text-orange-300";
      case "past_due": return "bg-white/[0.06] text-white";
      case "canceled": return "bg-neutral-800 text-neutral-400";
      default: return "bg-neutral-800 text-neutral-400";
    }
  };



  if (authLoading) return <AdminLoading />;
  if (authError || error || !isAdmin) return <AdminError message={authError || error || "Admin access required"} />;

  return (
    <div className="space-y-6">
        <div>
          <p className={`mb-2 ${adminLabelClass}`}>Directory</p>
          <h2 className={adminPageTitleClass}>Users</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {filteredUsers.length} users · trial_expired is the email cohort for churned trials
          </p>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={adminCardPaddedClass}>
            <div className="text-2xl font-semibold text-white">{kpiUsers.length}</div>
            <div className={`mt-1 ${adminLabelClass}`}>Total Users</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {ADMIN_TIER_OPTIONS.map((tier) => (
                <span key={tier.id} className={tierColor(tier.id)}>
                  {tier.label}: {kpiUsers.filter((u) => planFilterBucket(u) === tier.id).length}
                </span>
              ))}
              <span className="text-orange-300">
                Trial expired: {kpiUsers.filter((u) => planFilterBucket(u) === "trial_expired").length}
              </span>
            </div>
          </div>
          <div className={adminCardPaddedClass}>
            <div className="text-2xl font-semibold text-white">{kpiUsers.filter(u => u.subscription_status === "active").length}</div>
            <div className={`mt-1 ${adminLabelClass}`}>Active Subscriptions</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="text-neutral-300">Inactive: {kpiUsers.filter(u => u.subscription_status === "inactive" || !u.subscription_status).length}</span>
              <span className="text-orange-300">Trial expired: {kpiUsers.filter(u => u.subscription_status === "trial_expired").length}</span>
              <span className="text-white">Past Due: {kpiUsers.filter(u => u.subscription_status === "past_due").length}</span>
            </div>
          </div>
          <div className={adminCardPaddedClass}>
            <div className="text-2xl font-semibold text-white">{kpiUsers.reduce((sum, u) => sum + (u.lessons_count || 0), 0)}</div>
            <div className={`mt-1 ${adminLabelClass}`}>Total Blocks Created</div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <span className="text-neutral-400">Plans: {kpiUsers.reduce((sum, u) => sum + (u.plans_count || 0), 0)}</span>
              <span className="text-neutral-400">Admins: {users.filter(u => u.is_admin).length}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <input
              type="text"
              placeholder={t('admin.searchUsers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={adminInputClass}
            />
          </div>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierOption)}
            className={adminSelectClass}
          >
            <option value="all">All tiers</option>
            {ADMIN_TIER_OPTIONS.map((tier) => (
              <option key={tier.id} value={tier.id}>{tier.label}</option>
            ))}
            <option value="trial_expired">Trial expired</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className={adminSelectClass}
          >
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                <th className="p-4 text-left font-medium">User</th>
                <th 
                  className="cursor-pointer p-4 text-left font-medium hover:text-white"
                  onClick={() => handleSort("created_at")}
                >
                  Joined{getSortIcon("created_at")}
                </th>
                <th 
                  className="cursor-pointer p-4 text-right font-medium hover:text-white"
                  onClick={() => handleSort("lessons_count")}
                >
                  Lessons{getSortIcon("lessons_count")}
                </th>
                <th 
                  className="cursor-pointer p-4 text-right font-medium hover:text-white"
                  onClick={() => handleSort("plans_count")}
                >
                  Plans{getSortIcon("plans_count")}
                </th>
                <th 
                  className="cursor-pointer p-4 text-left font-medium hover:text-white"
                  onClick={() => handleSort("plan")}
                >
                  Tier{getSortIcon("plan")}
                </th>
                <th 
                  className="cursor-pointer p-4 text-left font-medium hover:text-white"
                  onClick={() => handleSort("subscription_status")}
                >
                  Status{getSortIcon("subscription_status")}
                </th>
                <th className="p-4 text-left font-medium">Organization</th>
                <th className="p-4 text-right font-medium" title="Volume-tier overage above plan base (not a purchased pack)">
                  PoW overage
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400">
                    Loading...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400">
                    No users found
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                    <td className="p-4">
                      <Link href={`/admin/users/${user.id}`} className="hover:text-white">
                        <div>
                          <div className="text-neutral-200 font-medium">
                            {user.username || user.email || "No name"}
                          </div>
                          <div className="text-xs text-neutral-500">{user.email}</div>
                          {user.is_admin && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded bg-white/[0.08] text-white border border-white/15">
                              ADMIN
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="p-4 text-neutral-400 text-sm">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="p-4 text-right text-neutral-300">
                      {user.lessons_count}
                    </td>
                    <td className="p-4 text-right text-neutral-300">
                      {user.plans_count}
                    </td>
                    <td className="p-4">
                      <AdminTierSelect
                        value={adminTierSelectValue(user)}
                        disabled={updatingUserId === user.id}
                        onChange={(tier) => handleTierChange(user, tier)}
                        className={`rounded border px-2 py-1 text-xs ${tierColor(user.plan)} bg-neutral-900 border-neutral-700`}
                      />
                      <div className="mt-1 text-[10px] text-neutral-500">{tierLabel(user.plan)}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(user.subscription_status)}`}>
                        {statusLabel(user.subscription_status)}
                      </span>
                    </td>
                    <td className="p-4">
                      {user.organization ? (
                        <Link href={`/admin/organizations/${user.organization.id}`} className="hover:text-white">
                          <div className="text-neutral-300 text-sm">{user.organization.name}</div>
                          {user.is_org_admin && (
                            <span className="text-[10px] text-white">admin</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-neutral-600 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-neutral-500 text-sm">
                        {(user.extra_lessons ?? 0) > 0 ? `+${user.extra_lessons}` : "—"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={adminBtnClass}
            >
              Previous
            </button>
            <span className="text-neutral-400 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={adminBtnClass}
            >
              Next
            </button>
          </div>
        )}
    </div>
  );
}