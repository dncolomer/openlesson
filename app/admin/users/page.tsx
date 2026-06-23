"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AdminTierSelect } from "@/components/AdminTierSelect";
import {
  ADMIN_TIER_OPTIONS,
  normalizeAdminTier,
  tierColor,
  tierLabel,
  type AdminTierId,
} from "@/lib/admin/tiers";

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

type TierOption = "all" | AdminTierId;
type DateFilter = "all" | "7days" | "30days" | "90days" | "year";
type SortColumn = "username" | "lessons_count" | "plans_count" | "created_at" | "plan" | "subscription_status";

const PAGE_SIZE = 25;

export default function UsersPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
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
    checkAdminAndLoadUsers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, tierFilter, dateFilter]);

  const checkAdminAndLoadUsers = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", authUser.id)
        .single();

      if (!profile?.is_admin) {
        setError("Admin access required");
        setLoading(false);
        return;
      }

      loadUsers();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

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

  const handleTierChange = async (userId: string, tier: AdminTierId) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: tier }),
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
    
    const matchesTier = tierFilter === "all" || normalizeAdminTier(u) === tierFilter;
    
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
      case "active": return "bg-green-900/30 text-green-400";
      case "inactive": return "bg-red-900/30 text-red-400";
      case "past_due": return "bg-yellow-900/30 text-yellow-400";
      default: return "bg-neutral-800 text-neutral-400";
    }
  };



  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/admin" className="text-neutral-400 hover:text-white text-sm">
            ← Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">Users</h1>
          <p className="text-neutral-400 text-sm">{filteredUsers.length} users</p>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{kpiUsers.length}</div>
            <div className="text-neutral-500 text-xs mt-1">Total Users</div>
            <div className="flex gap-2 mt-2 text-[11px]">
              {ADMIN_TIER_OPTIONS.map((tier) => (
                <span key={tier.id} className={tierColor(tier.id)}>
                  {tier.label}: {kpiUsers.filter((u) => normalizeAdminTier(u) === tier.id).length}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{kpiUsers.filter(u => u.subscription_status === "active").length}</div>
            <div className="text-neutral-500 text-xs mt-1">Active Subscriptions</div>
            <div className="flex gap-2 mt-2 text-[11px]">
              <span className="text-red-400">Inactive: {kpiUsers.filter(u => u.subscription_status === "inactive" || !u.subscription_status).length}</span>
              <span className="text-yellow-400">Past Due: {kpiUsers.filter(u => u.subscription_status === "past_due").length}</span>
            </div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{kpiUsers.reduce((sum, u) => sum + (u.lessons_count || 0), 0)}</div>
            <div className="text-neutral-500 text-xs mt-1">Total Sessions Created</div>
            <div className="flex gap-2 mt-2 text-[11px]">
              <span className="text-neutral-400">Plans: {kpiUsers.reduce((sum, u) => sum + (u.plans_count || 0), 0)}</span>
              <span className="text-neutral-400">Admins: {users.filter(u => u.is_admin).length}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder={t('admin.searchUsers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
            />
          </div>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierOption)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Tiers</option>
            {ADMIN_TIER_OPTIONS.map((tier) => (
              <option key={tier.id} value={tier.id}>{tier.label}</option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left p-4 text-neutral-400 text-sm font-medium">User</th>
                <th 
                  className="text-left p-4 text-neutral-400 text-sm font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort("created_at")}
                >
                  Joined{getSortIcon("created_at")}
                </th>
                <th 
                  className="text-right p-4 text-neutral-400 text-sm font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort("lessons_count")}
                >
                  Lessons{getSortIcon("lessons_count")}
                </th>
                <th 
                  className="text-right p-4 text-neutral-400 text-sm font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort("plans_count")}
                >
                  Plans{getSortIcon("plans_count")}
                </th>
                <th 
                  className="text-left p-4 text-neutral-400 text-sm font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort("plan")}
                >
                  Tier{getSortIcon("plan")}
                </th>
                <th 
                  className="text-left p-4 text-neutral-400 text-sm font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort("subscription_status")}
                >
                  Status{getSortIcon("subscription_status")}
                </th>
                <th className="text-left p-4 text-neutral-400 text-sm font-medium">Organization</th>
                <th className="text-right p-4 text-neutral-400 text-sm font-medium">Actions</th>
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
                      <Link href={`/admin/users/${user.id}`} className="hover:text-blue-400">
                        <div>
                          <div className="text-neutral-200 font-medium">
                            {user.username || user.email || "No name"}
                          </div>
                          <div className="text-xs text-neutral-500">{user.email}</div>
                          {user.is_admin && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
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
                        value={normalizeAdminTier(user)}
                        disabled={updatingUserId === user.id}
                        onChange={(tier) => handleTierChange(user.id, tier)}
                        className={`px-2 py-1 text-xs rounded border ${tierColor(user.plan)} bg-neutral-900 border-neutral-700`}
                      />
                      <div className="text-[10px] text-neutral-500 mt-1">{tierLabel(user.plan)}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(user.subscription_status)}`}>
                        {user.subscription_status}
                      </span>
                    </td>
                    <td className="p-4">
                      {user.organization ? (
                        <Link href={`/admin/organizations/${user.organization.id}`} className="hover:text-blue-400">
                          <div className="text-neutral-300 text-sm">{user.organization.name}</div>
                          {user.is_org_admin && (
                            <span className="text-[10px] text-purple-400">admin</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-neutral-600 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-neutral-500 text-sm">{user.extra_lessons ?? 0} extra</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-neutral-700"
            >
              Previous
            </button>
            <span className="text-neutral-400 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-neutral-700"
            >
              Next
            </button>
          </div>
        )}
    </div>
  );
}