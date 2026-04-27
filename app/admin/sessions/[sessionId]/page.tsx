"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface SessionOwner {
  id: string;
  username: string | null;
  email: string | null;
}

interface SessionDetail {
  id: string;
  user_id: string;
  problem: string;
  status: string;
  created_at: string;
  duration_ms: number;
  plan_node_id: string | null;
  owner?: SessionOwner;
}

interface PlanNode {
  id: string;
  plan_id: string;
  label: string;
  plan?: {
    id: string;
    root_topic: string;
  };
}

export default function AdminSessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [planNode, setPlanNode] = useState<PlanNode | null>(null);

  useEffect(() => {
    loadSessionDetail();
  }, [sessionId]);

  const loadSessionDetail = async () => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(data.error || "Failed to load session");
        return;
      }

      setSession(data.session);
      setPlanNode(data.planNode);
    } catch (err) {
      console.error("Load session error:", err);
      setError("Failed to load session");
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
      hour: "2-digit",
      minute: "2-digit",
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
      case "active": return "bg-green-900/30 text-green-400";
      case "completed": return "bg-blue-900/30 text-blue-400";
      case "paused": return "bg-yellow-900/30 text-yellow-400";
      default: return "bg-neutral-700 text-neutral-400";
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
        <Link href="/admin/sessions" className="text-sm text-neutral-400 hover:text-white">
          Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-4 sm:px-6 py-8">
      <Link href="/admin/sessions" className="text-sm text-neutral-400 hover:text-white mb-4 inline-block">
        &larr; Back to sessions
      </Link>

      {/* Session Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 mr-4">
            <h1 className="text-xl font-semibold text-white mb-2">{session?.problem}</h1>
            {session?.owner && (
              <Link href={`/admin/${session.user_id}`} className="text-sm text-blue-400 hover:text-blue-300">
                {session.owner.email || session.owner.username}
              </Link>
            )}
          </div>
          <span className={`px-2 py-1 text-xs rounded ${getStatusColor(session?.status || "")}`}>
            {session?.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-neutral-500">Created</div>
            <div className="text-neutral-200">{formatDate(session?.created_at || null)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Duration</div>
            <div className="text-neutral-200">{formatDuration(session?.duration_ms || 0)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Session ID</div>
            <div className="text-neutral-200 text-xs font-mono">{session?.id.slice(0, 12)}...</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">User ID</div>
            <div className="text-neutral-200 text-xs font-mono">{session?.user_id.slice(0, 12)}...</div>
          </div>
        </div>
      </div>

      {/* Plan Info */}
      {planNode && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4 text-white">Linked Plan</h2>
          <div className="p-3 bg-neutral-800/50 rounded-lg">
            <Link href={`/admin/plans/${planNode.plan_id}`} className="block hover:opacity-80">
              <div className="text-sm text-blue-400 hover:text-blue-300 mb-1">
                {planNode.plan?.root_topic || "Unknown Plan"}
              </div>
              <div className="text-xs text-neutral-500">
                Node: {planNode.label}
              </div>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
