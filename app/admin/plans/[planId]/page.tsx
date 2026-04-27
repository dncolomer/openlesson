"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface PlanOwner {
  id: string;
  username: string | null;
  email: string | null;
}

interface PlanNode {
  id: string;
  label: string;
  depth: number;
  status: string;
  session_id: string | null;
}

interface Session {
  id: string;
  problem: string;
  status: string;
  created_at: string;
  duration_ms: number;
}

interface PlanDetail {
  id: string;
  user_id: string;
  root_topic: string;
  status: string;
  is_public: boolean;
  is_agent_session: boolean;
  created_at: string;
  owner?: PlanOwner;
}

export default function AdminPlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [nodes, setNodes] = useState<PlanNode[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const supabase = createClient();

  useEffect(() => {
    checkAdminAndLoadPlan();
  }, [planId]);

  const checkAdminAndLoadPlan = async () => {
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

      loadPlanDetail();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadPlanDetail = async () => {
    try {
      // Load plan
      const { data: planData, error: planError } = await supabase
        .from("learning_plans")
        .select("id, user_id, root_topic, status, is_public, is_agent_session, created_at")
        .eq("id", planId)
        .single();

      if (planError) throw planError;

      // Load owner profile
      const { data: ownerData } = await supabase
        .from("profiles")
        .select("id, username, email")
        .eq("id", planData.user_id)
        .single();

      setPlan({ ...planData, owner: ownerData || undefined });

      // Load nodes
      const { data: nodesData } = await supabase
        .from("plan_nodes")
        .select("id, label, depth, status, session_id")
        .eq("plan_id", planId)
        .order("depth", { ascending: true });

      setNodes(nodesData || []);

      // Load sessions for this plan's nodes
      const sessionIds = (nodesData || [])
        .filter((n: PlanNode) => n.session_id)
        .map((n: PlanNode) => n.session_id);

      if (sessionIds.length > 0) {
        const { data: sessionsData } = await supabase
          .from("sessions")
          .select("id, problem, status, created_at, duration_ms")
          .in("id", sessionIds)
          .order("created_at", { ascending: false });

        setSessions(sessionsData || []);
      }
    } catch (err) {
      console.error("Load plan error:", err);
      setError("Failed to load plan");
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
      case "active": return "bg-green-900/30 text-green-400";
      case "completed": return "bg-blue-900/30 text-blue-400";
      case "paused": return "bg-yellow-900/30 text-yellow-400";
      case "not_started": return "bg-neutral-700 text-neutral-400";
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
        <Link href="/admin/plans" className="text-sm text-neutral-400 hover:text-white">
          Back to plans
        </Link>
      </div>
    );
  }

  const completedNodes = nodes.filter(n => n.status === "completed").length;
  const nodesWithSessions = nodes.filter(n => n.session_id).length;

  return (
    <main className="max-w-6xl mx-auto p-4 sm:px-6 py-8">
      <Link href="/admin/plans" className="text-sm text-neutral-400 hover:text-white mb-4 inline-block">
        &larr; Back to plans
      </Link>

      {/* Plan Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{plan?.root_topic}</h1>
            {plan?.owner && (
              <Link href={`/admin/${plan.user_id}`} className="text-sm text-blue-400 hover:text-blue-300">
                {plan.owner.username || plan.owner.email}
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            <span className={`px-2 py-1 text-xs rounded ${plan?.is_public ? "bg-green-900/30 text-green-400" : "bg-neutral-800 text-neutral-500"}`}>
              {plan?.is_public ? "Public" : "Private"}
            </span>
            <span className={`px-2 py-1 text-xs rounded ${plan?.is_agent_session ? "bg-blue-900/30 text-blue-400" : "bg-neutral-800 text-neutral-500"}`}>
              {plan?.is_agent_session ? "Agent" : "User"}
            </span>
          </div>
        </div>

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
            <div className="text-xs text-neutral-500">Total Nodes</div>
            <div className="text-neutral-200">{nodes.length}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Completed</div>
            <div className="text-neutral-200">{completedNodes} / {nodes.length}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Nodes */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4 text-white">Nodes ({nodes.length})</h2>
          {nodes.length === 0 ? (
            <p className="text-neutral-500 text-sm">No nodes found</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {nodes.map((node) => (
                <div key={node.id} className="p-3 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-600 text-xs">L{node.depth}</span>
                      <span className="text-sm text-neutral-200">{node.label}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(node.status)}`}>
                      {node.status}
                    </span>
                  </div>
                  {node.session_id && (
                    <div className="mt-1 text-xs text-neutral-500">
                      Session: {node.session_id.slice(0, 8)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4 text-white">Sessions ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <p className="text-neutral-500 text-sm">No sessions yet</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {sessions.map((session) => (
                <div key={session.id} className="p-3 bg-neutral-800/50 rounded-lg">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
