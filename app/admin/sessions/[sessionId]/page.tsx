"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";

interface SessionOwner {
  id: string;
  username: string | null;
  email: string | null;
}

interface IleSessionDetail {
  id: string;
  user_id: string;
  problem: string;
  status: string;
  created_at: string;
  duration_ms: number;
  owner?: SessionOwner;
}

interface TapSessionDetail {
  id: string;
  plan_id: string | null;
  plan_node_id: string | null;
  user_id: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  requested_duration_seconds: number | null;
  duration_seconds: number | null;
  overall_score: number | null;
  summary: string | null;
  mode: string | null;
  owner?: SessionOwner | null;
}

interface PlanContext {
  id: string;
  title: string | null;
  root_topic: string | null;
  display_topic?: string;
}

interface PlanNodeContext {
  id: string;
  plan_id: string;
  title: string;
  plan?: PlanContext;
}

type SessionPayload =
  | { kind: "tutoring"; session: IleSessionDetail; planNode: PlanNodeContext | null }
  | {
      kind: "tap";
      session: TapSessionDetail;
      plan: PlanContext | null;
      planNode: { id: string; plan_id: string; title: string } | null;
      owner: SessionOwner | null;
    };

export default function AdminSessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SessionPayload | null>(null);

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

      setPayload(data as SessionPayload);
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

  const formatSeconds = (seconds: number | null) => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${minutes}m ${rem}s`;
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

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;

  if (!payload) return <AdminError message="Session not found" />;

  if (payload.kind === "tap") {
    const { session, plan, planNode, owner } = payload;
    return (
      <main>
        <Link href="/admin/sessions" className="mb-4 inline-block text-sm text-neutral-400 hover:text-white">
          ← Back to sessions
        </Link>

        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">TAP session</p>
              <h1 className="text-xl font-semibold text-white">
                {planNode?.title || plan?.display_topic || "Think Aloud Protocol"}
              </h1>
              {owner && (
                <Link href={`/admin/users/${session.user_id}`} className="text-sm text-blue-400 hover:text-blue-300">
                  {owner.email || owner.username}
                </Link>
              )}
            </div>
            <span className={`rounded px-2 py-1 text-xs ${getStatusColor(session.status)}`}>{session.status}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Created" value={formatDate(session.created_at)} />
            <Field label="Completed" value={formatDate(session.completed_at)} />
            <Field label="Duration" value={formatSeconds(session.duration_seconds)} />
            <Field label="Score" value={session.overall_score != null ? String(session.overall_score) : "-"} />
            <Field label="Mode" value={session.mode || "-"} />
            <Field label="Session ID" value={`${session.id.slice(0, 12)}…`} mono />
          </div>

          {session.summary && (
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-950/60 p-3 text-sm text-neutral-300">
              {session.summary}
            </div>
          )}
        </div>

        {(plan || planNode) && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-lg font-medium text-white">Linked workspace</h2>
            {plan && (
              <Link href={`/admin/plans/${plan.id}`} className="block rounded-lg bg-neutral-800/50 p-3 hover:bg-neutral-800/70">
                <div className="text-sm text-blue-400">{plan.display_topic || plan.root_topic}</div>
                {planNode && <div className="mt-1 text-xs text-neutral-500">Block: {planNode.title}</div>}
              </Link>
            )}
          </div>
        )}
      </main>
    );
  }

  const { session, planNode } = payload;

  return (
    <main>
      <Link href="/admin/sessions" className="mb-4 inline-block text-sm text-neutral-400 hover:text-white">
        ← Back to sessions
      </Link>

      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="mr-4 flex-1">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">ILE session</p>
            <h1 className="mb-2 text-xl font-semibold text-white">{session.problem}</h1>
            {session.owner && (
              <Link href={`/admin/users/${session.user_id}`} className="text-sm text-blue-400 hover:text-blue-300">
                {session.owner.email || session.owner.username}
              </Link>
            )}
          </div>
          <span className={`rounded px-2 py-1 text-xs ${getStatusColor(session.status)}`}>{session.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Created" value={formatDate(session.created_at)} />
          <Field label="Duration" value={formatDuration(session.duration_ms || 0)} />
          <Field label="Session ID" value={`${session.id.slice(0, 12)}…`} mono />
          <Field label="User ID" value={`${session.user_id.slice(0, 12)}…`} mono />
        </div>
      </div>

      {planNode && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-4 text-lg font-medium text-white">Linked workspace</h2>
          <Link href={`/admin/plans/${planNode.plan_id}`} className="block rounded-lg bg-neutral-800/50 p-3 hover:bg-neutral-800/70">
            <div className="mb-1 text-sm text-blue-400">
              {planNode.plan?.display_topic || planNode.plan?.root_topic || "Unknown workspace"}
            </div>
            <div className="text-xs text-neutral-500">Block: {planNode.title}</div>
          </Link>
        </div>
      )}
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-neutral-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}