"use client";

import { default as Link } from "next/link";
import type { OrgUsageSummary } from "@/lib/plans";

type XaiPeriodPreset = "7d" | "30d" | "90d" | "billing";

type DashboardTabId =
  | "sessions"
  | "plans"
  | "usage"
  | "integrations"
  | "organization"
  | "config";

export type DashboardUsageTabProps = {
  handleXaiPeriodChange: (period: XaiPeriodPreset) => void;
  loadingUsage: boolean;
  planDisplayName: (plan: string, isAdmin?: boolean) => string;
  planPriceLabel: (plan: string, isAdmin?: boolean) => string;
  setDashboardTab: (tab: DashboardTabId) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  usageCardClass: "console-copy rounded-none p-5 sm:p-6";
  usageData: { plan: string; used: number; personalUsed: number; limit: number | null; proofOfWorkUsed: number; proofOfWorkPersonalUsed: number; proofOfWorkLimit: number | null; workspacesUsed: number; workspacesLimit: number | null; periodEnd: string | null; subscriptionStatus: string; organization: OrgUsageSummary | null; isAdmin: boolean; billingMode?: "subscription" | "partner" | null; canUseAgentApi?: boolean; apiPowCallsUsed?: number; tapSessionsUsed?: number; ileSessionsUsed?: number; apiMeteredInvoice?: { platformCents: number; usageCents: number; usageCentsRounded?: number; totalCents: number; externalPowCount?: number; tapSessionCount?: number; ileSessionCount?: number; externalPowCents?: number; tapSessionCents?: number; ileSessionCents?: number; } | null; xaiUsage?: { available: boolean; apiKeyId: string; apiKeyName: string | null; periodStart: string; periodEnd: string; totalUsd: number; lines: Array<{ description: string; usd: number; }>; error?: string; } | null; } | null;
  usageLabelClass: "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
  usageProgress: (used: number, limit: number | null) => number;
  xaiPeriod: "7d" | "30d" | "90d" | "billing";
  xaiUsageLoading: boolean;
  xaiUsageOverride: { available: boolean; apiKeyId: string; apiKeyName: string | null; periodStart: string; periodEnd: string; totalUsd: number; lines: Array<{ description: string; usd: number; }>; error?: string; } | null;
};

export function DashboardUsageTab({
    handleXaiPeriodChange,
    loadingUsage,
    planDisplayName,
    planPriceLabel,
    setDashboardTab,
    t,
    usageCardClass,
    usageData,
    usageLabelClass,
    usageProgress,
    xaiPeriod,
    xaiUsageLoading,
    xaiUsageOverride,
}: DashboardUsageTabProps) {
          const isBillingBypass =
            usageData?.billingMode === "partner" ||
            usageData?.organization?.billingMode === "partner";

          const planBadge = (() => {
            if (isBillingBypass) {
              return (
                <span className="rounded-full border border-neutral-600/30 bg-neutral-800/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-200/90">
                  Bypass
                </span>
              );
            }
            if (usageData?.isAdmin) {
              return (
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-200">
                  Admin
                </span>
              );
            }
            if (usageData?.plan === "api_metered") {
              return (
                <span className="rounded-full border border-neutral-600/30 bg-neutral-800/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-200/90">
                  Metered
                </span>
              );
            }
            if (usageData?.plan === "trial") {
              return (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-emerald-100/90">
                  Trial
                </span>
              );
            }
            return (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                Inactive
              </span>
            );
          })();

          const personalUsed = usageData
            ? usageData.organization
              ? usageData.proofOfWorkPersonalUsed
              : usageData.proofOfWorkUsed
            : 0;
          const personalLimit = usageData
            ? usageData.isAdmin ||
              usageData.proofOfWorkLimit === null ||
              usageData.organization
              ? null
              : usageData.proofOfWorkLimit
            : 0;

          const xai = xaiUsageOverride || usageData?.xaiUsage || null;
          const periodOptions: { id: XaiPeriodPreset; label: string }[] = [
            { id: "billing", label: "Billing period" },
            { id: "7d", label: "7 days" },
            { id: "30d", label: "30 days" },
            { id: "90d", label: "90 days" },
          ];

          const sectionTitle = (kicker: string, title: string, hint?: string) => (
            <div className="mb-3">
              <p className={usageLabelClass}>{kicker}</p>
              <h3 className="mt-1 text-base font-medium text-white">{title}</h3>
              {hint ? <p className="mt-0.5 text-xs text-neutral-500">{hint}</p> : null}
            </div>
          );

          return (
          <div className="space-y-10">
            {/* Page header */}
            <div className="console-copy flex flex-wrap items-center justify-between gap-3 px-6 py-5">
              <div>
                <p className={usageLabelClass}>Account</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">
                  {isBillingBypass ? "Usage" : t("dashboard.yourSubscription")}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {isBillingBypass
                    ? "Proof-of-Work and inference spend for your organization."
                    : t("dashboard.usageSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {usageData?.organization && (
                  <button
                    type="button"
                    onClick={() => setDashboardTab("organization")}
                    className="inline-flex h-10 items-center justify-center rounded-none border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                  >
                    {usageData.organization.isOrgAdmin
                      ? "Manage organization →"
                      : "View organization →"}
                  </button>
                )}
                {!isBillingBypass && (
                  <Link
                    href="/pricing"
                    className="inline-flex h-10 items-center justify-center rounded-none border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                  >
                    View pricing →
                  </Link>
                )}
              </div>
            </div>

            {loadingUsage ? (
              <div className="text-center py-12 text-neutral-400">{t("common.loading")}</div>
            ) : usageData ? (
              <>
                {/* 1 · Plan & access */}
                <section>
                  {sectionTitle(
                    "1 · Plan & access",
                    isBillingBypass ? "What you have access to" : "Your plan",
                    isBillingBypass
                      ? "Product entitlement is complimentary (Stripe bypass)."
                      : "Subscription tier and billing cycle."
                  )}
                  <div className={`grid gap-4 ${isBillingBypass ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
                    <div className={usageCardClass}>
                      <div className="flex items-center justify-between gap-3">
                        <p className={usageLabelClass}>
                          {isBillingBypass ? "Access tier" : t("dashboard.currentPlan")}
                        </p>
                        {planBadge}
                      </div>
                      <div className="mt-4 text-3xl font-medium tracking-[-1px] text-white">
                        {planDisplayName(usageData.plan, usageData.isAdmin)}
                      </div>
                      {isBillingBypass ? (
                        <p className="mt-2 text-sm text-neutral-300">
                          Billing: <span className="font-medium text-white">Bypass</span>
                        </p>
                      ) : (
                        <>
                          <p className="mt-2 text-sm text-neutral-500">
                            {planPriceLabel(usageData.plan, usageData.isAdmin)}
                          </p>
                          {!usageData.isAdmin && usageData.subscriptionStatus !== "active" && (
                            <p className="mt-3 text-xs text-neutral-600">
                              {usageData.subscriptionStatus === "trial_expired"
                                ? "Your 3-day trial has ended. Upgrade to continue."
                                : t("dashboard.subscriptionNotActive")}
                            </p>
                          )}
                        </>
                      )}
                      {usageData.organization && (
                        <p className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
                          Organization:{" "}
                          <span className="text-neutral-300">{usageData.organization.name}</span>
                          {" · "}
                          {usageData.organization.isOrgAdmin ? "Org admin" : "Member"}
                          {" · "}
                          {usageData.organization.memberCount} members
                        </p>
                      )}
                    </div>

                    {!isBillingBypass && (
                      <div className={usageCardClass}>
                        <p className={usageLabelClass}>{t("dashboard.billingPeriod")}</p>
                        {usageData.isAdmin ? (
                          <>
                            <div className="mt-4 text-lg font-medium text-white">No billing limits</div>
                            <p className="mt-2 text-sm text-neutral-500">
                              Admin accounts are not metered against plan quotas.
                            </p>
                          </>
                        ) : usageData.subscriptionStatus === "active" && usageData.periodEnd ? (
                          <>
                            <div className="mt-4 text-lg font-medium text-white">
                              {t("dashboard.resetsOn", {
                                date: new Date(usageData.periodEnd).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                }),
                              })}
                            </div>
                            <p className="mt-2 text-sm text-neutral-500">
                              {usageData.plan === "api_metered"
                                ? "Usage (external API PoW, timed sessions, and Learning sessions) is tallied through this date and added to your monthly invoice."
                                : usageData.plan === "trial"
                                  ? "Trial access ends on this date."
                                  : t("dashboard.regularResetDesc")}
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="mt-4 text-lg font-medium text-white">
                              {usageData.subscriptionStatus === "trial_expired"
                                ? "Trial ended"
                                : t("dashboard.noSubscription")}
                            </div>
                            <p className="mt-2 text-sm text-neutral-500">
                              {usageData.subscriptionStatus === "trial_expired"
                                ? "Your 3-day trial has ended. Upgrade at pricing to continue."
                                : t("dashboard.subscriptionNotActive")}
                            </p>
                          </>
                        )}
                        {!usageData.isAdmin &&
                          (usageData.plan === "inactive" ||
                            usageData.subscriptionStatus === "trial_expired" ||
                            usageData.plan === "trial") && (
                            <Link
                              href="/pricing"
                              className="mt-4 inline-flex text-sm text-neutral-300 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
                            >
                              {t("dashboard.upgradeToPro")} →
                            </Link>
                          )}
                      </div>
                    )}
                  </div>
                </section>

                {/* 2 · Proof of Work */}
                <section>
                  {sectionTitle(
                    "2 · Proof of Work",
                    "Submission usage",
                    usageData.organization
                      ? "Your personal activity and the shared organization pool."
                      : "How many Proof-of-Work submissions you’ve used this period."
                  )}
                  <div
                    className={`grid gap-4 ${
                      usageData.organization ? "md:grid-cols-2" : "md:grid-cols-1 max-w-xl"
                    }`}
                  >
                    <div className={usageCardClass}>
                      <p className={usageLabelClass}>
                        {usageData.organization
                          ? "Your submissions"
                          : t("dashboard.proofOfWorkThisPeriod")}
                      </p>
                      <div className="mt-4 flex items-end gap-2">
                        <span className="text-3xl font-medium tracking-[-1px] text-white">
                          {personalUsed}
                        </span>
                        <span className="mb-1 text-sm text-neutral-500">
                          / {personalLimit === null ? t("dashboard.infinity") : personalLimit}
                        </span>
                      </div>
                      {personalLimit !== null && (
                        <div className="mt-4 h-1.5 w-full rounded-full bg-neutral-800">
                          <div
                            className={`h-1.5 rounded-full ${
                              personalUsed >= personalLimit
                                ? "bg-red-400"
                                : personalUsed >= personalLimit * 0.8
                                  ? "bg-neutral-200"
                                  : "bg-white"
                            }`}
                            style={{ width: `${usageProgress(personalUsed, personalLimit)}%` }}
                          />
                        </div>
                      )}
                      <p className="mt-3 text-xs text-neutral-500">
                        {usageData.isAdmin
                          ? "Unlimited Proof-of-Work submissions on admin accounts."
                          : usageData.organization
                            ? "Your personal Proof-of-Work this period (practice sessions and API)."
                            : personalLimit === null
                              ? t("dashboard.unlimitedProofOfWork")
                              : t("dashboard.proofOfWorkRemaining", {
                                  count: Math.max(personalLimit - personalUsed, 0),
                                })}
                      </p>
                    </div>

                    {usageData.organization && (
                      <div className={usageCardClass}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className={usageLabelClass}>Organization pool</p>
                            <p className="mt-1 text-sm text-neutral-300">
                              {usageData.organization.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDashboardTab("organization")}
                            className="text-xs text-neutral-400 underline decoration-neutral-700 underline-offset-2 transition hover:text-white"
                          >
                            {usageData.organization.isOrgAdmin ? "Manage" : "View"} →
                          </button>
                        </div>
                        <div className="mt-4 flex items-end gap-2">
                          <span className="text-3xl font-medium tracking-[-1px] text-white">
                            {usageData.organization.used}
                          </span>
                          <span className="mb-1 text-sm text-neutral-500">
                            /{" "}
                            {usageData.organization.limit === null
                              ? t("dashboard.infinity")
                              : usageData.organization.limit.toLocaleString()}
                          </span>
                        </div>
                        {usageData.organization.limit !== null && (
                          <div className="mt-4 h-1.5 w-full rounded-full bg-neutral-800">
                            <div
                              className={`h-1.5 rounded-full ${
                                usageData.organization.used >= usageData.organization.limit
                                  ? "bg-red-400"
                                  : usageData.organization.used >=
                                      usageData.organization.limit * 0.8
                                    ? "bg-neutral-200"
                                    : "bg-white"
                              }`}
                              style={{
                                width: `${usageProgress(
                                  usageData.organization.used,
                                  usageData.organization.limit
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                        <p className="mt-3 text-xs text-neutral-500">
                          {usageData.organization.memberCount} members ·{" "}
                          {usageData.organization.guestCount} guests
                          {isBillingBypass
                            ? " · Shared pool for this period"
                            : " · Org usage this period"}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* 3 · Spend */}
                {(xai ||
                  (!isBillingBypass &&
                    usageData.plan === "api_metered" &&
                    usageData.apiMeteredInvoice)) && (
                  <section>
                    {sectionTitle(
                      "3 · Spend",
                      isBillingBypass ? "Inference cost (xAI)" : "Billing & inference",
                      isBillingBypass
                        ? "Attributed to your organization’s dedicated xAI API key."
                        : "Product charges and optional org inference spend."
                    )}
                    <div className="space-y-4">
                      {!isBillingBypass &&
                        usageData.plan === "api_metered" &&
                        usageData.apiMeteredInvoice && (
                          <div className={usageCardClass}>
                            <p className={usageLabelClass}>API Metered invoice (this period)</p>
                            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                              <div>
                                <p className="text-xs text-neutral-500">External API PoW</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  {usageData.apiPowCallsUsed ?? 0}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">0.05¢ each</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Timed sessions</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  {usageData.tapSessionsUsed ??
                                    usageData.apiMeteredInvoice.tapSessionCount ??
                                    0}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">$1 each</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Learning sessions</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  {usageData.ileSessionsUsed ??
                                    usageData.apiMeteredInvoice.ileSessionCount ??
                                    0}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">$10 each</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-4 border-t border-neutral-800 pt-4 sm:grid-cols-2">
                              <div>
                                <p className="text-xs text-neutral-500">Usage charges</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  $
                                  {(
                                    (usageData.apiMeteredInvoice.usageCentsRounded ??
                                      usageData.apiMeteredInvoice.usageCents) / 100
                                  ).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Est. monthly total</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  $
                                  {(usageData.apiMeteredInvoice.totalCents / 100).toFixed(2)}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">
                                  Includes $99 platform + usage (practice-session PoW not billed as API PoW)
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                      {xai && (
                        <div className={usageCardClass}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className={usageLabelClass}>
                                {isBillingBypass
                                  ? "xAI inference spend"
                                  : "Org xAI inference spend"}
                              </p>
                              <h3 className="mt-2 text-3xl font-medium tracking-[-1px] text-white">
                                {xaiUsageLoading
                                  ? "…"
                                  : xai.available
                                    ? `$${xai.totalUsd.toFixed(2)}`
                                    : "—"}
                              </h3>
                              <p className="mt-1 text-xs text-neutral-500">
                                {xai.apiKeyName ? `${xai.apiKeyName} · ` : ""}
                                {new Date(xai.periodStart).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                                {" – "}
                                {new Date(xai.periodEnd).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {isBillingBypass && (
                                <span className="rounded-full border border-neutral-600/30 bg-neutral-800/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-200/90">
                                  Billing: Bypass
                                </span>
                              )}
                              <div className="flex flex-wrap justify-end gap-1">
                                {periodOptions.map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={xaiUsageLoading}
                                    onClick={() => handleXaiPeriodChange(opt.id)}
                                    className={`rounded-none border px-2.5 py-1 text-[11px] transition ${
                                      xaiPeriod === opt.id
                                        ? "border-white/20 bg-white/10 text-white"
                                        : "console-button text-neutral-400 hover:border-white/80 hover:text-neutral-200"
                                    } disabled:opacity-50`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          {xaiUsageLoading && (
                            <p className="mt-3 text-xs text-neutral-500">
                              Loading spend for selected period…
                            </p>
                          )}
                          {!xaiUsageLoading && !xai.available && (
                            <p className="mt-3 text-xs text-neutral-300/80">
                              {xai.error || "Could not load xAI usage for this key."}
                            </p>
                          )}
                          {!xaiUsageLoading && xai.available && xai.lines.length > 0 && (
                            <div className="mt-4 space-y-2 border-t border-neutral-800 pt-4">
                              <p className="mb-2 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">
                                Breakdown
                              </p>
                              {xai.lines.slice(0, 8).map((line) => (
                                <div
                                  key={line.description}
                                  className="flex items-center justify-between gap-3 text-sm"
                                >
                                  <span className="truncate text-neutral-400">
                                    {line.description}
                                  </span>
                                  <span className="shrink-0 font-mono text-neutral-200">
                                    ${line.usd.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!xaiUsageLoading &&
                            xai.available &&
                            xai.lines.length === 0 && (
                              <p className="mt-3 text-xs text-neutral-500">
                                No inference spend recorded for this org key in the selected
                                period.
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                {t("dashboard.unableToLoadUsage")}
              </div>
            )}
          </div>
          );
}
