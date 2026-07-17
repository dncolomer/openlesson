"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import {
  adminBackLinkClass,
  adminItemClass,
  adminLabelClass,
} from "@/components/admin/styles";

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
  workspace_id: string | null;
  block_id: string | null;
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

interface BlockContext {
  id: string;
  workspace_id: string;
  title: string;
  plan?: PlanContext;
}

type SessionPayload =
  | { kind: "tutoring"; session: IleSessionDetail; block: BlockContext | null }
  | {
      kind: "tap";
      session: TapSessionDetail;
      plan: PlanContext | null;
      block: { id: string; workspace_id: string; title: string } | null;
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
    const { session, plan, block, owner } = payload;
    return (
      <div className="space-y-6">
        <Link href="/admin/sessions" className={adminBackLinkClass}>
          ← Back to sessions
        </Link>

        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-5 backdrop-blur-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className={`mb-2 ${adminLabelClass}`}>TAP session</p>
              <h1 className="text-xl font-medium tracking-[-0.3px] text-white">
                {block?.title || plan?.display_topic || "Think Aloud Protocol"}
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

        {(plan || block) && (
          <div className="rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm p-6">
            <h2 className="mb-4 text-lg font-medium text-white">Linked workspace</h2>
            {plan && (
              <Link href={`/admin/workspaces/${plan.id}`} className={`block ${adminItemClass}`}>
                <div className="text-sm text-blue-400">{plan.display_topic || plan.root_topic}</div>
                {block && <div className="mt-1 text-xs text-neutral-500">Block: {block.title}</div>}
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  const { session, block } = payload;

  return (
    <div className="space-y-6">
      <Link href="/admin/sessions" className={adminBackLinkClass}>
        ← Back to sessions
      </Link>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-5 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="mr-4 flex-1">
            <p className={`mb-2 ${adminLabelClass}`}>ILE session</p>
            <h1 className="mb-2 text-xl font-medium tracking-[-0.3px] text-white">{session.problem}</h1>
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

      {block && (
        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm p-6">
          <h2 className="mb-4 text-lg font-medium text-white">Linked workspace</h2>
          <Link href={`/admin/workspaces/${block.workspace_id}`} className={`block ${adminItemClass}`}>
            <div className="mb-1 text-sm text-blue-400">
              {block.plan?.display_topic || block.plan?.root_topic || "Unknown workspace"}
            </div>
            <div className="text-xs text-neutral-500">Block: {block.title}</div>
          </Link>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className={adminLabelClass}>{label}</div>
      <div className={`text-neutral-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}