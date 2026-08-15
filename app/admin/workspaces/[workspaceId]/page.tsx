"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import {
  adminBackLinkClass,
  adminItemClass,
  adminLabelClass,
  adminPageTitleClass,
} from "@/components/admin/styles";
import {
  ADMIN_SESSION_HORIZON_LABELS,
  adminSessionProductLabel,
} from "@/lib/admin/product-labels";

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
  interaction_kind?: string | null;
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
        return "bg-white/[0.06] text-white";
      case "completed":
        return "bg-white/[0.06] text-white";
      case "paused":
      case "pending":
        return "bg-white/[0.06] text-white";
      default:
        return "bg-neutral-700 text-neutral-400";
    }
  };

  if (loading) {
    return <AdminLoading />;
  }

  if (error) {
    return <AdminError message={error} />;
  }

  const completedNodes = nodes.filter((n) => n.status === "completed").length;

  return (
    <div className="space-y-6">
      <Link href="/admin/workspaces" className={adminBackLinkClass}>
        &larr; Back to workspaces
      </Link>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-5 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className={`mb-2 ${adminLabelClass}`}>Workspace</p>
            <h1 className={adminPageTitleClass}>{plan?.display_topic}</h1>
            {plan?.owner && (
              <Link href={`/admin/users/${plan.user_id}`} className="mt-1 inline-block text-sm text-white hover:text-neutral-200">
                {plan.owner.username || plan.owner.email}
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            <span className={`px-2 py-1 text-xs rounded ${plan?.is_public ? "bg-white/[0.06] text-white" : "bg-neutral-800 text-neutral-500"}`}>
              {plan?.is_public ? "Public" : "Private"}
            </span>
            <span className={`px-2 py-1 text-xs rounded ${plan?.is_agent_workspace ? "bg-white/[0.06] text-white" : "bg-neutral-800 text-neutral-500"}`}>
              {plan?.is_agent_workspace ? "Agent" : "User"}
            </span>
          </div>
        </div>

        {plan?.notes && (
          <p className="text-sm text-neutral-400 mb-4 line-clamp-4">{plan.notes}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className={adminLabelClass}>Created</div>
            <div className="text-neutral-200">{formatDate(plan?.created_at || null)}</div>
          </div>
          <div>
            <div className={adminLabelClass}>Status</div>
            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(plan?.status || "")}`}>
              {plan?.status}
            </span>
          </div>
          <div>
            <div className={adminLabelClass}>Blocks</div>
            <div className="text-neutral-200">{completedNodes} / {nodes.length} completed</div>
          </div>
          <div>
            <div className={adminLabelClass}>{ADMIN_SESSION_HORIZON_LABELS.timed}</div>
            <div className="text-neutral-200">{tapSessions.length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
          <h2 className="mb-4 text-sm font-medium text-white">Blocks ({nodes.length})</h2>
          {nodes.length === 0 ? (
            <p className="text-sm text-neutral-500">No blocks found</p>
          ) : (
            <div className="max-h-[500px] space-y-2 overflow-y-auto">
              {nodes.map((node) => (
                <div key={node.id} className={adminItemClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-neutral-200">{node.title}</div>
                      {node.description && (
                        <div className="mt-1 line-clamp-2 text-xs text-neutral-500">{node.description}</div>
                      )}
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${getStatusColor(node.status)}`}>
                      {node.status}
                    </span>
                  </div>
                  {node.is_start && <div className="mt-1 text-[10px] text-white">Start block</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
            <h2 className="mb-4 text-sm font-medium text-white">
              {ADMIN_SESSION_HORIZON_LABELS.openEnded} ({sessions.length})
            </h2>
            {sessions.length === 0 ? (
              <p className="text-sm text-neutral-500">No open-ended sessions linked</p>
            ) : (
              <div className="max-h-[220px] space-y-3 overflow-y-auto">
                {sessions.map((session) => (
                  <Link key={session.id} href={`/admin/sessions/${session.id}`} className={`block ${adminItemClass}`}>
                    <div className="mb-1 flex items-start justify-between">
                      <div className="line-clamp-1 text-sm text-neutral-200">{session.problem}</div>
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span>{formatDate(session.created_at)}</span>
                      {session.duration_ms > 0 && <span>{formatDuration(session.duration_ms)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
            <h2 className="mb-4 text-sm font-medium text-white">
              {ADMIN_SESSION_HORIZON_LABELS.timed} ({tapSessions.length})
            </h2>
            {tapSessions.length === 0 ? (
              <p className="text-sm text-neutral-500">No Drill sessions yet</p>
            ) : (
              <div className="max-h-[220px] space-y-3 overflow-y-auto">
                {tapSessions.map((session) => {
                  const productLabel = adminSessionProductLabel({
                    technicalKind: "tap",
                    interaction_kind: session.interaction_kind,
                  });
                  return (
                    <Link
                      key={session.id}
                      href={`/admin/sessions/${session.id}`}
                      className={`block ${adminItemClass}`}
                    >
                      <div className="mb-1 flex items-start justify-between">
                        <div className="text-sm text-neutral-200">
                          {productLabel}
                          {session.requested_duration_seconds
                            ? ` · ${session.requested_duration_seconds / 60} min`
                            : ""}
                        </div>
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span>{formatDate(session.created_at)}</span>
                        {session.overall_score != null && <span>Score: {session.overall_score}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}