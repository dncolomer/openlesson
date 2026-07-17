"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminTierSelect } from "@/components/AdminTierSelect";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { PowDetailsPanel } from "@/components/admin/PowDetailsPanel";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import {
  adminTierSelectValue,
  describePlanLimits,
  statusLabel,
  tierChangeWarning,
  tierLabel,
  type AdminTierId,
} from "@/lib/admin/tiers";
import type { AdminProofOfWorkDetails } from "@/lib/admin/proof-of-work";
import {
  adminBackLinkClass,
  adminItemClass,
  adminLabelClass,
  adminPageTitleClass,
} from "@/components/admin/styles";

interface Plan {
  id: string;
  root_topic: string;
  title?: string | null;
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
  const [proofOfWork, setProofOfWork] = useState<AdminProofOfWorkDetails[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [powPage, setPowPage] = useState(1);
  const [workspacePage, setPlanPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedPowId, setExpandedPowId] = useState<string | null>(null);
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
        setProofOfWork(data.proofOfWork || []);
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
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-white/[0.06] text-white";
      case "trial_expired":
        return "bg-orange-900/30 text-orange-300";
      case "inactive":
      case "canceled":
        return "bg-white/[0.04] text-neutral-300";
      case "completed":
        return "bg-white/[0.06] text-white";
      case "paused":
      case "past_due":
        return "bg-white/[0.06] text-white";
      default:
        return "bg-neutral-700 text-neutral-400";
    }
  };

  const filteredPow = proofOfWork.filter((row) => {
    if (typeFilter !== "all" && row.proofOfWorkType !== typeFilter) return false;
    return true;
  });

  const POW_PAGE_SIZE = 10;
  const powTotalPages = Math.ceil(filteredPow.length / POW_PAGE_SIZE) || 1;
  const paginatedPow = filteredPow.slice(
    (powPage - 1) * POW_PAGE_SIZE,
    powPage * POW_PAGE_SIZE
  );

  const PLAN_PAGE_SIZE = 10;
  const planTotalPages = Math.ceil(plans.length / PLAN_PAGE_SIZE) || 1;
  const paginatedPlans = plans.slice(
    (workspacePage - 1) * PLAN_PAGE_SIZE,
    workspacePage * PLAN_PAGE_SIZE
  );

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
  if (authError || error || !isAdmin)
    return <AdminError message={authError || error || "Admin access required"} />;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className={adminBackLinkClass}>
        ← Back to users
      </Link>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-5 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className={`mb-2 ${adminLabelClass}`}>User</p>
            <h1 className={adminPageTitleClass}>
              {user?.username || user?.email || "No name"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{user?.email}</p>
          </div>
          {user?.is_admin && (
            <span className="rounded border border-white/15 bg-white/[0.08] px-2 py-1 text-xs text-white">
              ADMIN
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <div className={adminLabelClass}>Plan</div>
            <div className="space-y-2">
              <AdminTierSelect
                value={user ? adminTierSelectValue(user) : "inactive"}
                disabled={tierUpdating || !user}
                onChange={applyTierChange}
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
              />
              {user && (
                <p className="text-[11px] text-neutral-500">
                  {describePlanLimits(user.plan, user.extra_lessons, user.extra_workspaces ?? 0)}
                  {user.plan !== adminTierSelectValue(user) && user.subscription_status !== "active"
                    ? ` · stored plan ${tierLabel(user.plan)}`
                    : ""}
                </p>
              )}
            </div>
          </div>
          <div>
            <div className={adminLabelClass}>Status</div>
            <span
              className={`rounded px-2 py-0.5 text-xs ${getStatusColor(user?.subscription_status || "")}`}
            >
              {statusLabel(user?.subscription_status || "inactive")}
            </span>
          </div>
          <div>
            <div className={adminLabelClass}>Extra workspaces</div>
            <div className="text-neutral-200">{user?.extra_workspaces ?? 0}</div>
          </div>
          <div>
            <div className={adminLabelClass}>PoW volume overage</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-neutral-200">{user?.extra_lessons ?? 0}</span>
                <span className="text-[10px] text-neutral-600">above plan base</span>
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
                        setUser((prev) => (prev ? { ...prev, extra_lessons: newTotal } : prev));
                      }
                    }}
                    className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-white/[0.1]"
                    title="Support grant (volume overage is normally set by Stripe subscription volume)"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-600">
                From volume tiers or support grants — not a customer pack product.
              </p>
            </div>
          </div>
          <div>
            <div className={adminLabelClass}>Token Tier</div>
            <div className="text-neutral-200">{user?.token_tier || "-"}</div>
          </div>
          <div>
            <div className={adminLabelClass}>Joined</div>
            <div className="text-neutral-200">{formatDate(user?.created_at || null)}</div>
          </div>
          <div>
            <div className={adminLabelClass}>Period Ends</div>
            <div className="text-neutral-200">{formatDate(user?.current_period_end || null)}</div>
          </div>
          {user?.stripe_customer_id && (
            <div>
              <div className={adminLabelClass}>Stripe</div>
              <a
                href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white hover:text-neutral-200"
              >
                View in Stripe →
              </a>
            </div>
          )}
          <div>
            <div className={adminLabelClass}>Proof of work</div>
            <div className="text-neutral-200">{proofOfWork.length}</div>
          </div>
          <div>
            <div className={adminLabelClass}>Workspaces</div>
            <div className="text-neutral-200">{plans.length}</div>
          </div>
          <div>
            <div className={adminLabelClass}>Organization</div>
            {user?.organization ? (
              <Link
                href={`/admin/organizations/${user.organization.id}`}
                className="text-white hover:text-neutral-200"
              >
                {user.organization.name}
                {user.is_org_admin && <span className="ml-1 text-white">(admin)</span>}
              </Link>
            ) : (
              <div className="text-neutral-500">-</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
          <h2 className="mb-4 text-sm font-medium text-white">
            Proof of work ({filteredPow.length})
          </h2>

          <div className="mb-4 flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPowPage(1);
              }}
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
            >
              <option value="all">Type: All</option>
              <option value="tool">Type: Tool</option>
              <option value="screen">Type: Screen</option>
              <option value="video">Type: Video</option>
              <option value="eeg">Type: EEG</option>
            </select>
          </div>

          {filteredPow.length === 0 ? (
            <p className="text-sm text-neutral-500">No proof of work found</p>
          ) : (
            <React.Fragment>
              <div className="space-y-2">
                {paginatedPow.map((row) => {
                  const expanded = expandedPowId === row.id;
                  return (
                    <div
                      key={row.id}
                      className="rounded-lg bg-neutral-800/50 transition-colors hover:bg-neutral-800/70"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedPowId(expanded ? null : row.id)}
                        className="flex w-full items-start justify-between gap-3 p-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-200">
                              {row.proofOfWorkType}
                            </span>
                            {row.toolName && (
                              <span className="text-xs text-neutral-400">{row.toolName}</span>
                            )}
                          </div>
                          <div className="truncate text-sm text-neutral-200">
                            {row.fileName}
                            {row.workspaceTitle ? (
                              <span className="text-neutral-500"> · {row.workspaceTitle}</span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {formatDate(row.createdAt)}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {expanded ? "Hide" : "Details"}
                        </span>
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3">
                          <PowDetailsPanel details={row} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {powTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-4">
                  <div className="text-xs text-neutral-500">
                    {(powPage - 1) * POW_PAGE_SIZE + 1}-
                    {Math.min(powPage * POW_PAGE_SIZE, filteredPow.length)} of {filteredPow.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPowPage((p) => Math.max(1, p - 1))}
                      disabled={powPage === 1}
                      className="px-2 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 text-xs text-neutral-500">
                      {powPage} / {powTotalPages}
                    </span>
                    <button
                      onClick={() => setPowPage((p) => Math.min(powTotalPages, p + 1))}
                      disabled={powPage === powTotalPages}
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

        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
          <h2 className="mb-4 text-sm font-medium text-white">Workspaces ({plans.length})</h2>
          {plans.length === 0 ? (
            <p className="text-sm text-neutral-500">No workspaces found</p>
          ) : (
            <React.Fragment>
              <div className="space-y-3">
                {paginatedPlans.map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/admin/workspaces/${plan.id}`}
                    className={`block ${adminItemClass}`}
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <div className="line-clamp-1 text-sm text-neutral-200">
                        {plan.title || plan.root_topic}
                      </div>
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-xs ${getStatusColor(plan.status)}`}
                      >
                        {plan.status}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-neutral-500">
                      <span>{formatDate(plan.created_at)}</span>
                      {plan.is_public && <span className="text-white">Public</span>}
                    </div>
                  </Link>
                ))}
              </div>

              {planTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-4">
                  <div className="text-xs text-neutral-500">
                    {(workspacePage - 1) * PLAN_PAGE_SIZE + 1}-
                    {Math.min(workspacePage * PLAN_PAGE_SIZE, plans.length)} of {plans.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                      disabled={workspacePage === 1}
                      className="px-2 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 text-xs text-neutral-500">
                      {workspacePage} / {planTotalPages}
                    </span>
                    <button
                      onClick={() => setPlanPage((p) => Math.min(planTotalPages, p + 1))}
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
    </div>
  );
}
