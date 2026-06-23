"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

interface UserProfile {
  id: string;
  username: string | null;
  email: string | null;
}

interface Session {
  id: string;
  user_id: string;
  problem: string;
  status: string;
  created_at: string;
  duration_ms: number;
  user?: UserProfile;
}

type SortField = "created_at" | "duration_ms";
type SortDirection = "asc" | "desc";

export default function SessionsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const PAGE_SIZE = 25;

  useEffect(() => {
    checkAdminAndLoadSessions();
  }, [page, statusFilter, sortField, sortDirection]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      loadSessions();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const checkAdminAndLoadSessions = async () => {
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

      loadSessions();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        status: statusFilter,
        search: searchQuery.trim(),
        sort: sortField,
        direction: sortDirection,
      });
      const res = await fetch(`/api/admin/sessions?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load sessions");
        return;
      }
      setSessions(data.sessions || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error("Load sessions error:", err instanceof Error ? err.message : err);
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
          <h1 className="text-2xl font-bold text-white mt-2">Sessions</h1>
          <p className="text-neutral-400 text-sm">{totalCount} total sessions</p>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <div className="text-neutral-500 text-xs mt-1">Total Sessions</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">
              {sessions.filter(s => s.status === "completed").length}
            </div>
            <div className="text-neutral-500 text-xs mt-1">Completed (this page)</div>
            <div className="flex gap-2 mt-2 text-[11px]">
              <span className="text-blue-400">Active: {sessions.filter(s => s.status === "active").length}</span>
              <span className="text-yellow-400">Paused: {sessions.filter(s => s.status === "paused").length}</span>
            </div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">
              {sessions.length > 0
                ? formatDuration(sessions.reduce((sum, s) => sum + s.duration_ms, 0) / sessions.length)
                : "—"}
            </div>
            <div className="text-neutral-500 text-xs mt-1">Avg Duration (this page)</div>
            <div className="flex gap-2 mt-2 text-[11px]">
              <span className="text-neutral-400">
                Total: {sessions.length > 0 ? formatDuration(sessions.reduce((sum, s) => sum + s.duration_ms, 0)) : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder={t('admin.searchByProblem')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left p-4 text-neutral-400 text-sm font-medium">User</th>
                <th className="text-left p-4 text-neutral-400 text-sm font-medium">Problem</th>
                <th 
                  className="text-left p-4 text-neutral-400 text-sm font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort("created_at")}
                >
                  Date {sortField === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th 
                  className="text-left p-4 text-neutral-400 text-sm font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort("duration_ms")}
                >
                  Duration {sortField === "duration_ms" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-center p-4 text-neutral-400 text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400">
                    Loading...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                    <td className="p-4">
                      <Link href={`/admin/users/${session.user_id}`} className="block hover:opacity-80">
                        <div className="text-blue-400 hover:text-blue-300 text-sm">
                          {session.user?.email || session.user_id?.slice(0, 8)}
                        </div>
                        {session.user?.username && (
                          <div className="text-neutral-500 text-xs">
                            @{session.user.username}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="p-4">
                      <Link href={`/admin/sessions/${session.id}`} className="text-neutral-300 text-sm max-w-[260px] truncate block hover:text-white" title={session.problem}>
                        {session.problem}
                      </Link>
                    </td>
                    <td className="p-4 text-neutral-400 text-sm">
                      {formatDate(session.created_at)}
                    </td>
                    <td className="p-4 text-neutral-400 text-sm">
                      {formatDuration(session.duration_ms)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        session.status === "active" ? "bg-green-500/20 text-green-400" :
                        session.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                        "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {session.status}
                      </span>
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
