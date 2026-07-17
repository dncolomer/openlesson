"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AdminError } from "@/components/admin/AdminStatus";
import {
  adminBtnClass,
  adminCardPaddedClass,
  adminInputClass,
  adminLabelClass,
  adminPageTitleClass,
  adminSelectClass,
} from "@/components/admin/styles";

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
        setError(data.error || "Failed to load blocks");
        return;
      }
      setSessions(data.sessions || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error("Load sessions error:", err instanceof Error ? err.message : err);
      setError("Failed to load blocks");
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
    return <AdminError message={error} />;
  }

  return (
    <div className="space-y-6">
        <div>
          <p className={`mb-2 ${adminLabelClass}`}>Activity</p>
          <h1 className={adminPageTitleClass}>Sessions</h1>
          <p className="mt-1 text-sm text-neutral-400">{totalCount} total blocks</p>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={adminCardPaddedClass}>
            <div className="text-2xl font-semibold text-white">{totalCount}</div>
            <div className={`mt-1 ${adminLabelClass}`}>Total Blocks</div>
          </div>
          <div className={adminCardPaddedClass}>
            <div className="text-2xl font-semibold text-white">
              {sessions.filter(s => s.status === "completed").length}
            </div>
            <div className={`mt-1 ${adminLabelClass}`}>Completed (this page)</div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <span className="text-blue-400">Active: {sessions.filter(s => s.status === "active").length}</span>
              <span className="text-yellow-400">Paused: {sessions.filter(s => s.status === "paused").length}</span>
            </div>
          </div>
          <div className={adminCardPaddedClass}>
            <div className="text-2xl font-semibold text-white">
              {sessions.length > 0
                ? formatDuration(sessions.reduce((sum, s) => sum + s.duration_ms, 0) / sessions.length)
                : "—"}
            </div>
            <div className={`mt-1 ${adminLabelClass}`}>Avg Duration (this page)</div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <span className="text-neutral-400">
                Total: {sessions.length > 0 ? formatDuration(sessions.reduce((sum, s) => sum + s.duration_ms, 0)) : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <input
              type="text"
              placeholder={t('admin.searchByProblem')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={adminInputClass}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={adminSelectClass}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                <th className="p-4 text-left font-medium">User</th>
                <th className="p-4 text-left font-medium">Problem</th>
                <th 
                  className="cursor-pointer p-4 text-left font-medium hover:text-white"
                  onClick={() => handleSort("created_at")}
                >
                  Date {sortField === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th 
                  className="cursor-pointer p-4 text-left font-medium hover:text-white"
                  onClick={() => handleSort("duration_ms")}
                >
                  Duration {sortField === "duration_ms" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-4 text-center font-medium">Status</th>
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
                    No blocks found
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
