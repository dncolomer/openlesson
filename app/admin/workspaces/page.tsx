"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

interface PlanOwner {
  id: string;
  username: string | null;
  email: string | null;
}

interface Workspace {
  id: string;
  user_id: string;
  root_topic: string;
  display_topic: string;
  status: string;
  is_public: boolean;
  is_agent_workspace: boolean;
  created_at: string;
  node_count: number;
  tap_session_count: number;
  owner?: PlanOwner;
}

type SortField = "created_at" | "root_topic" | "node_count";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 25;

export default function AdminPlansPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<Workspace[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  useEffect(() => {
    checkAdminAndLoadPlans();
  }, [page, visibilityFilter, statusFilter, sortField, sortDirection]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      loadPlans();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const checkAdminAndLoadPlans = async () => {
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

      loadPlans();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        visibility: visibilityFilter,
        status: statusFilter,
        search: searchQuery.trim(),
        sort: sortField,
        direction: sortDirection,
      });
      const res = await fetch(`/api/admin/workspaces?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load workspaces");
        return;
      }
      setPlans(data.plans || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error("Load plans error:", err instanceof Error ? err.message : err);
      setError("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // KPI calculations
  const kpiPlans = plans;
  const publicCount = kpiPlans.filter(p => p.is_public).length;
  const agentCount = kpiPlans.filter(p => p.is_agent_workspace).length;
  const avgNodes = kpiPlans.length > 0
    ? (kpiPlans.reduce((sum, p) => sum + p.node_count, 0) / kpiPlans.length).toFixed(1)
    : "—";

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
        <h1 className="text-2xl font-bold text-white mt-2">Workspaces</h1>
        <p className="text-neutral-400 text-sm">{totalCount} total plans</p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{kpiPlans.length}</div>
          <div className="text-neutral-500 text-xs mt-1">Plans (this page)</div>
          <div className="flex gap-2 mt-2 text-[11px]">
            <span className="text-green-400">Public: {publicCount}</span>
            <span className="text-neutral-400">Private: {kpiPlans.length - publicCount}</span>
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{avgNodes}</div>
          <div className="text-neutral-500 text-xs mt-1">Avg Nodes per Plan</div>
          <div className="flex gap-2 mt-2 text-[11px]">
            <span className="text-neutral-400">
              Total nodes: {kpiPlans.reduce((sum, p) => sum + p.node_count, 0)}
            </span>
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-cyan-400">
            {kpiPlans.reduce((sum, p) => sum + (p.tap_session_count || 0), 0)}
          </div>
          <div className="text-neutral-500 text-xs mt-1">TAP sessions (this page)</div>
          <div className="flex gap-2 mt-2 text-[11px]">
            <span className="text-blue-400">Agent-created: {agentCount}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={t('admin.searchByTopic')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
          />
        </div>
        <select
          value={visibilityFilter}
          onChange={(e) => {
            setVisibilityFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
        >
          <option value="all">All Visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
        >
          <option value="active">Hide archived</option>
          <option value="archived">Archived only</option>
          <option value="all">All statuses</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">User</th>
              <th
                className="text-left text-xs text-neutral-400 font-medium px-4 py-3 cursor-pointer hover:text-white"
                onClick={() => handleSort("root_topic")}
              >
                Topic{getSortIcon("root_topic")}
              </th>
              <th
                className="text-left text-xs text-neutral-400 font-medium px-4 py-3 cursor-pointer hover:text-white"
                onClick={() => handleSort("created_at")}
              >
                Created{getSortIcon("created_at")}
              </th>
              <th
                className="text-left text-xs text-neutral-400 font-medium px-4 py-3 cursor-pointer hover:text-white"
                onClick={() => handleSort("node_count")}
              >
                Nodes{getSortIcon("node_count")}
              </th>
              <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Visibility</th>
              <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">TAP</th>
              <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && plans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Loading...</td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No workspaces found</td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${plan.user_id}`} className="block hover:opacity-80">
                      <div className="text-blue-400 hover:text-blue-300 text-sm">
                        {plan.owner?.email || plan.user_id.slice(0, 8)}
                      </div>
                      {plan.owner?.username && (
                        <div className="text-neutral-500 text-xs">
                          @{plan.owner.username}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/workspaces/${plan.id}`} className="text-sm text-neutral-200 hover:text-white">
                      {(plan.display_topic || plan.root_topic).length > 60
                        ? `${(plan.display_topic || plan.root_topic).slice(0, 60)}...`
                        : (plan.display_topic || plan.root_topic)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{formatDate(plan.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-neutral-300">{plan.node_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      plan.is_public
                        ? "bg-green-900/30 text-green-400"
                        : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {plan.is_public ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-300">{plan.tap_session_count || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      plan.is_agent_workspace
                        ? "bg-blue-900/30 text-blue-400"
                        : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {plan.is_agent_workspace ? "Agent" : "User"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-neutral-500">
            Page {page} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
