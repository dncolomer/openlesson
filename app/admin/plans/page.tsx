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

interface LearningPlan {
  id: string;
  user_id: string;
  root_topic: string;
  status: string;
  is_public: boolean;
  is_agent_session: boolean;
  created_at: string;
  node_count: number;
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

  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  useEffect(() => {
    checkAdminAndLoadPlans();
  }, [page, visibilityFilter, sortField, sortDirection]);

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

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("learning_plans")
        .select("id, user_id, root_topic, status, is_public, is_agent_session, created_at", { count: "exact" });

      if (visibilityFilter === "public") {
        query = query.eq("is_public", true);
      } else if (visibilityFilter === "private") {
        query = query.eq("is_public", false);
      }

      if (searchQuery.trim()) {
        query = query.ilike("root_topic", `%${searchQuery.trim()}%`);
      }

      const { data: plansData, count, error: planError } = await query
        .order(sortField === "node_count" ? "created_at" : sortField, { ascending: sortDirection === "asc" })
        .range(from, to);

      if (planError) throw planError;

      setTotalCount(count || 0);

      if (!plansData || plansData.length === 0) {
        setPlans([]);
        return;
      }

      // Get node counts per plan
      const planIds = plansData.map((p: { id: string }) => p.id);
      const { data: nodesData } = await supabase
        .from("plan_nodes")
        .select("plan_id")
        .in("plan_id", planIds);

      const nodeCountMap = new Map<string, number>();
      nodesData?.forEach((n: { plan_id: string }) => {
        nodeCountMap.set(n.plan_id, (nodeCountMap.get(n.plan_id) || 0) + 1);
      });

      // Get user profiles
      const userIds = [...new Set(plansData.map((p: { user_id: string }) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", userIds);

      const userMap = new Map<string, PlanOwner>();
      profiles?.forEach((p: { id: string; username: string | null; email: string | null }) => {
        userMap.set(p.id, p);
      });

      const plansWithData: LearningPlan[] = plansData.map((p: { id: string; user_id: string; root_topic: string; status: string; is_public: boolean; is_agent_session: boolean; created_at: string }) => ({
        ...p,
        node_count: nodeCountMap.get(p.id) || 0,
        owner: userMap.get(p.user_id),
      }));

      if (sortField === "node_count") {
        plansWithData.sort((a, b) =>
          sortDirection === "desc" ? b.node_count - a.node_count : a.node_count - b.node_count
        );
      }

      setPlans(plansWithData);
    } catch (err) {
      console.error("Load plans error:", err instanceof Error ? err.message : err);
      setError("Failed to load plans");
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // KPI calculations
  const kpiPlans = plans;
  const publicCount = kpiPlans.filter(p => p.is_public).length;
  const agentCount = kpiPlans.filter(p => p.is_agent_session).length;
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
        <h1 className="text-2xl font-bold text-white mt-2">Learning Plans</h1>
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
          <div className="text-2xl font-bold text-blue-400">{agentCount}</div>
          <div className="text-neutral-500 text-xs mt-1">Agent-Created</div>
          <div className="flex gap-2 mt-2 text-[11px]">
            <span className="text-neutral-400">User-created: {kpiPlans.length - agentCount}</span>
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
              <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && plans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Loading...</td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No plans found</td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="px-4 py-3">
                    <Link href={`/admin/${plan.user_id}`} className="block hover:opacity-80">
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
                    <Link href={`/admin/plans/${plan.id}`} className="text-sm text-neutral-200 hover:text-white">
                      {plan.root_topic.length > 60 ? plan.root_topic.slice(0, 60) + "..." : plan.root_topic}
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
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      plan.is_agent_session
                        ? "bg-blue-900/30 text-blue-400"
                        : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {plan.is_agent_session ? "Agent" : "User"}
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
