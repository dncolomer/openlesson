"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminTierSelect } from "@/components/AdminTierSelect";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import {
  ADMIN_TIER_OPTIONS,
  adminTierSelectValue,
  describePlanLimits,
  isGrandfatheredPlan,
  tierChangeWarning,
  tierLabel,
  type AdminTierId,
} from "@/lib/admin/tiers";

interface Lesson {
  id: string;
  problem: string;
  status: string;
  created_at: string;
  duration_ms: number;
  audio_path: string | null;
  report_generated_at: string | null;
  has_audio: boolean;
  has_eeg: boolean;
}

interface Plan {
  id: string;
  root_topic: string;
  status: string;
  created_at: string;
  is_public: boolean;
}

interface UserDetail {
  id: string;
  username: string | null;
  email: string | null;
  created_at: string;
  plan: string;
  is_admin: boolean;
  extra_lessons: number;
  extra_workspaces: number;
  subscription_status: string;
  current_period_end: string | null;
  token_tier: string | null;
  email_confirmed_at: string | null;
  stripe_customer_id: string | null;
  organization_id: string | null;
  is_org_admin: boolean;
  organization: { id: string; name: string; slug: string } | null;
}

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const { loading: authLoading, error: authError, isAdmin } = useAdminGuard();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  
  const [lessonPage, setLessonPage] = useState(1);
  const [workspacePage, setPlanPage] = useState(1);
  const [audioFilter, setAudioFilter] = useState<"all" | "yes" | "no">("all");
  const [transcriptFilter, setTranscriptFilter] = useState<"all" | "yes" | "no">("all");
  const [eegFilter, setEegFilter] = useState<"all" | "yes" | "no">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierUpdating, setTierUpdating] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadUserDetail();
  }, [userId, isAdmin]);

  const loadUserDetail = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load user");
      } else {
        setUser(data.user);
        setLessons(data.lessons || []);
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error("Load user error:", err);
      setError("Failed to load user");
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

  const filteredLessons = lessons.filter(l => {
    if (audioFilter === "yes" && !l.has_audio) return false;
    if (audioFilter === "no" && l.has_audio) return false;
    if (transcriptFilter === "yes" && !l.report_generated_at) return false;
    if (transcriptFilter === "no" && l.report_generated_at) return false;
    if (eegFilter === "yes" && !l.has_eeg) return false;
    if (eegFilter === "no" && l.has_eeg) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    return true;
  });

  const LESSON_PAGE_SIZE = 10;
  const lessonTotalPages = Math.ceil(filteredLessons.length / LESSON_PAGE_SIZE);
  const paginatedLessons = filteredLessons.slice((lessonPage - 1) * LESSON_PAGE_SIZE, lessonPage * LESSON_PAGE_SIZE);

  const PLAN_PAGE_SIZE = 10;
  const planTotalPages = Math.ceil(plans.length / PLAN_PAGE_SIZE);
  const paginatedPlans = plans.slice((workspacePage - 1) * PLAN_PAGE_SIZE, workspacePage * PLAN_PAGE_SIZE);

  const applyTierChange = async (tier: AdminTierId) => {
    if (!user) return;
    const warning = tierChangeWarning(user, tier);
    if (warning && !window.confirm(warning)) return;

    setTierUpdating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: tier }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser((prev) => (prev ? { ...prev, ...data.user } : prev));
      }
    } finally {
      setTierUpdating(false);
    }
  };

  if (authLoading || loading) return <AdminLoading />;
  if (authError || error || !isAdmin) return <AdminError message={authError || error || "Admin access required"} />;

  return (
    <main>
      <Link href="/admin/users" className="mb-4 inline-block text-sm text-neutral-400 hover:text-white">
        ← Back to users
      </Link>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">{user?.username || user?.email || "No name"}</h1>
            <p className="text-sm text-neutral-500">{user?.email}</p>
          </div>
          {user?.is_admin && (
            <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              ADMIN
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-neutral-500">Plan</div>
            <div className="space-y-2">
              <AdminTierSelect
                value={user ? adminTierSelectValue(user) : "free"}
                lockedLabel={user && isGrandfatheredPlan(user) ? tierLabel(user.plan) : undefined}
                disabled={tierUpdating || !user}
                onChange={applyTierChange}
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
              />
              {user && (
                <p className="text-[11px] text-neutral-500">
                  {describePlanLimits(user.plan, user.extra_lessons, user.extra_workspaces ?? 0)}
                </p>
              )}
              {user && isGrandfatheredPlan(user) && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-300">Migrate to</span>
                  <select
                    disabled={tierUpdating}
                    defaultValue=""
                    onChange={(e) => {
                      const tier = e.target.value as AdminTierId;
                      if (tier) void applyTierChange(tier);
                      e.target.value = "";
                    }}
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                  >
                    <option value="">Select tier…</option>
                    {ADMIN_TIER_OPTIONS.filter((t) => t.id !== "free").map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Status</div>
            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(user?.subscription_status || "")}`}>
              {user?.subscription_status}
            </span>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Extra workspaces</div>
            <div className="text-neutral-200">{user?.extra_workspaces ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Extra Proof-of-Work submissions</div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-200">{user?.extra_lessons ?? 0}</span>
              {[1, 10, 100].map((amount) => (
                <button
                  key={amount}
                  onClick={async () => {
                    const newTotal = (user?.extra_lessons ?? 0) + amount;
                    const res = await fetch("/api/admin/users", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: user?.id, extra_lessons: newTotal }),
                    });
                    if (res.ok) {
                      setUser((prev) => prev ? { ...prev, extra_lessons: newTotal } : prev);
                    }
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-800/50 rounded hover:bg-green-900/50 transition-colors"
                >
                  +{amount}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Token Tier</div>
            <div className="text-neutral-200">{user?.token_tier || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Joined</div>
            <div className="text-neutral-200">{formatDate(user?.created_at || null)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Period Ends</div>
            <div className="text-neutral-200">{formatDate(user?.current_period_end || null)}</div>
          </div>
          {user?.stripe_customer_id && (
            <div>
              <div className="text-xs text-neutral-500">Stripe</div>
              <a
                href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View in Stripe →
              </a>
            </div>
          )}
          <div>
            <div className="text-xs text-neutral-500">Lessons</div>
            <div className="text-neutral-200">{lessons.length}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Plans</div>
            <div className="text-neutral-200">{plans.length}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Organization</div>
            {user?.organization ? (
              <Link href={`/admin/organizations/${user.organization.id}`} className="text-blue-400 hover:text-blue-300">
                {user.organization.name}
                {user.is_org_admin && <span className="text-purple-400 ml-1">(admin)</span>}
              </Link>
            ) : (
              <div className="text-neutral-500">-</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">Lessons ({filteredLessons.length})</h2>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={audioFilter}
              onChange={(e) => { setAudioFilter(e.target.value as any); setLessonPage(1); }}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
            >
              <option value="all">Audio: All</option>
              <option value="yes">Audio: Yes</option>
              <option value="no">Audio: No</option>
            </select>
            <select
              value={transcriptFilter}
              onChange={(e) => { setTranscriptFilter(e.target.value as any); setLessonPage(1); }}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
            >
              <option value="all">Transcript: All</option>
              <option value="yes">Transcript: Yes</option>
              <option value="no">Transcript: No</option>
            </select>
            <select
              value={eegFilter}
              onChange={(e) => { setEegFilter(e.target.value as any); setLessonPage(1); }}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
            >
              <option value="all">EEG: All</option>
              <option value="yes">EEG: Yes</option>
              <option value="no">EEG: No</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setLessonPage(1); }}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
            >
              <option value="all">Status: All</option>
              <option value="active">Status: Active</option>
              <option value="paused">Status: Paused</option>
              <option value="completed">Status: Completed</option>
            </select>
          </div>

          {filteredLessons.length === 0 ? (
            <p className="text-neutral-500 text-sm">No lessons found</p>
          ) : (
            <React.Fragment>
              <div className="space-y-3">
                {paginatedLessons.map((lesson) => (
                <Link key={lesson.id} href={`/admin/sessions/${lesson.id}`} className="block p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800/70 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <div className="text-sm text-neutral-200 line-clamp-1">{lesson.problem}</div>
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${getStatusColor(lesson.status)}`}>
                      {lesson.status}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-neutral-500 items-center">
                    <span>{formatDate(lesson.created_at)}</span>
                    {lesson.duration_ms > 0 && <span>{formatDuration(lesson.duration_ms)}</span>}
                  </div>
                </Link>
                ))}
              </div>
              
              {lessonTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
                  <div className="text-xs text-neutral-500">
                    {(lessonPage - 1) * LESSON_PAGE_SIZE + 1}-{Math.min(lessonPage * LESSON_PAGE_SIZE, filteredLessons.length)} of {filteredLessons.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLessonPage(p => Math.max(1, p - 1))}
                      disabled={lessonPage === 1}
                      className="px-2 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 text-xs text-neutral-500">
                      {lessonPage} / {lessonTotalPages}
                    </span>
                    <button
                      onClick={() => setLessonPage(p => Math.min(lessonTotalPages, p + 1))}
                      disabled={lessonPage === lessonTotalPages}
                      className="px-2 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          )}
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">Workspaces ({plans.length})</h2>
          {plans.length === 0 ? (
            <p className="text-neutral-500 text-sm">No plans found</p>
          ) : (
            <React.Fragment>
              <div className="space-y-3">
                {paginatedPlans.map((plan) => (
                <Link key={plan.id} href={`/admin/workspaces/${plan.id}`} className="block p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800/70 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <div className="text-sm text-neutral-200 line-clamp-1">{plan.root_topic}</div>
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${getStatusColor(plan.status)}`}>
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-neutral-500">
                    <span>{formatDate(plan.created_at)}</span>
                    {plan.is_public && <span className="text-cyan-400">Public</span>}
                  </div>
                </Link>
                ))}
              </div>
              
              {planTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
                  <div className="text-xs text-neutral-500">
                    {(workspacePage - 1) * PLAN_PAGE_SIZE + 1}-{Math.min(workspacePage * PLAN_PAGE_SIZE, plans.length)} of {plans.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPlanPage(p => Math.max(1, p - 1))}
                      disabled={workspacePage === 1}
                      className="px-2 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 text-xs text-neutral-500">
                      {workspacePage} / {planTotalPages}
                    </span>
                    <button
                      onClick={() => setPlanPage(p => Math.min(planTotalPages, p + 1))}
                      disabled={workspacePage === planTotalPages}
                      className="px-2 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          )}
        </div>
      </div>
    </main>
  );
}