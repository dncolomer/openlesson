"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface PlanOwner {
  id: string;
  username: string | null;
  email: string | null;
}

interface Block {
  id: string;
  title: string;
  description: string | null;
  is_start: boolean;
  status: string;
  created_at: string;
}

interface Session {
  id: string;
  problem: string;
  status: string;
  created_at: string;
  duration_ms: number;
}

interface TapSession {
  id: string;
  status: string;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
  requested_duration_seconds: number;
}

interface PlanDetail {
  id: string;
  user_id: string;
  title: string | null;
  root_topic: string;
  display_topic: string;
  status: string;
  is_public: boolean;
  is_agent_workspace: boolean;
  organization_id: string | null;
  created_at: string;
  notes: string | null;
  owner?: PlanOwner;
}

export default function AdminPlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [nodes, setNodes] = useState<Block[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tapSessions, setTapSessions] = useState<TapSession[]>([]);

  useEffect(() => {
    loadPlanDetail();
  }, [workspaceId]);

  const loadPlanDetail = async () => {
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(data.error || "Failed to load workspace");
        return;
      }

      setPlan(data.plan);
      setNodes(data.nodes || []);
      setSessions(data.sessions || []);
      setTapSessions(data.tapSessions || []);
    } catch (err) {
      console.error("Load plan error:", err);
      setError("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (ms: number) => {
    if (!ms) return "-";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "in_progress":
        return "bg-green-900/30 text-green-400";
      case "completed":
        return "bg-blue-900/30 text-blue-400";
      case "paused":
      case "pending":
        return "bg-yellow-900/30 text-yellow-400";
      default:
        return "bg-neutral-700 text-neutral-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">{error}</div>
        <Link href="/admin/workspaces" className="text-sm text-neutral-400 hover:text-white">
          Back to workspaces
        </Link>
      </div>
    );
  }

  const completedNodes = nodes.filter((n) => n.status === "completed").length;

  return (
    <main className="max-w-6xl mx-auto p-4 sm:px-6 py-8">
      <Link href="/admin/workspaces" className="text-sm text-neutral-400 hover:text-white mb-4 inline-block">
        &larr; Back to workspaces
      </Link>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{plan?.display_topic}</h1>
            {plan?.owner && (
              <Link href={`/admin/users/${plan.user_id}`} className="text-sm text-blue-400 hover:text-blue-300">
                {plan.owner.username || plan.owner.email}
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            <span className={`px-2 py-1 text-xs rounded ${plan?.is_public ? "bg-green-900/30 text-green-400" : "bg-neutral-800 text-neutral-500"}`}>
              {plan?.is_public ? "Public" : "Private"}
            </span>
            <span className={`px-2 py-1 text-xs rounded ${plan?.is_agent_workspace ? "bg-blue-900/30 text-blue-400" : "bg-neutral-800 text-neutral-500"}`}>
              {plan?.is_agent_workspace ? "Agent" : "User"}
            </span>
          </div>
        </div>

        {plan?.notes && (
          <p className="text-sm text-neutral-400 mb-4 line-clamp-4">{plan.notes}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-neutral-500">Created</div>
            <div className="text-neutral-200">{formatDate(plan?.created_at || null)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Status</div>
            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(plan?.status || "")}`}>
              {plan?.status}
            </span>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Blocks</div>
            <div className="text-neutral-200">{completedNodes} / {nodes.length} completed</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">TAP sessions</div>
            <div className="text-neutral-200">{tapSessions.length}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4 text-white">Blocks ({nodes.length})</h2>
          {nodes.length === 0 ? (
            <p className="text-neutral-500 text-sm">No blocks found</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {nodes.map((node) => (
                <div key={node.id} className="p-3 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-neutral-200">{node.title}</div>
                      {node.description && (
                        <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{node.description}</div>
                      )}
                    </div>
                    <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${getStatusColor(node.status)}`}>
                      {node.status}
                    </span>
                  </div>
                  {node.is_start && <div className="text-[10px] text-cyan-400 mt-1">Start block</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <h2 className="text-lg font-medium mb-4 text-white">Tutoring Blocks ({sessions.length})</h2>
            {sessions.length === 0 ? (
              <p className="text-neutral-500 text-sm">No linked tutoring blocks</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto">
                {sessions.map((session) => (
                  <Link key={session.id} href={`/admin/sessions/${session.id}`} className="block p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800/70 transition-colors">
                    <div className="flex items-start justify-between mb-1">
                      <div className="text-sm text-neutral-200 line-clamp-1">{session.problem}</div>
                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-neutral-500 items-center">
                      <span>{formatDate(session.created_at)}</span>
                      {session.duration_ms > 0 && <span>{formatDuration(session.duration_ms)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <h2 className="text-lg font-medium mb-4 text-white">TAP sessions ({tapSessions.length})</h2>
            {tapSessions.length === 0 ? (
              <p className="text-neutral-500 text-sm">No TAP sessions yet</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto">
                {tapSessions.map((session) => (
                  <div key={session.id} className="p-3 bg-neutral-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-1">
                      <div className="text-sm text-neutral-200">
                        {session.requested_duration_seconds / 60} min session
                      </div>
                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-neutral-500 items-center">
                      <span>{formatDate(session.created_at)}</span>
                      {session.overall_score != null && <span>Score: {session.overall_score}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}