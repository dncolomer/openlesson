"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getSessions, deleteSession, restartSession, type Session } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { formatPlanMonthlyPrice, hasAgentApiKeyPlan, planDisplayName as formatPlanName, type PlanId } from "@/lib/plans";
import { dashboardUsesAgenticKeys } from "@/lib/dashboard-agent-access";
import { OrganizationDashboardTab } from "@/components/OrganizationDashboardTab";
import { DashboardAtmosphere } from "@/components/dashboard/dashboard-atmosphere";
import { DashboardConfigTab } from "@/components/dashboard/dashboard-config-tab";
import { DashboardHomeTab } from "@/components/dashboard/dashboard-home-tab";
import { DashboardIntegrationsTab } from "@/components/dashboard/dashboard-integrations-tab";
import { DashboardFlowsTab } from "@/components/dashboard/dashboard-flows-tab";
import { DashboardKnowledgeRegionsTab } from "@/components/dashboard/dashboard-knowledge-regions-tab";
import { DashboardDataStudioTab } from "@/components/dashboard/dashboard-data-studio-tab";
import { DashboardSessionsTab } from "@/components/dashboard/dashboard-sessions-tab";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardUsageTab } from "@/components/dashboard/dashboard-usage-tab";
import { buildMcpClientConfig } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  dashboardStudioProduct,
  isDashboardRegionsTab,
  isDashboardStudioTab,
  parseDashboardTab,
  type DashboardTab,
} from "@/lib/dashboard-nav";
import { clampDashboardTabForAccess } from "@/lib/free-tier";

interface AgentApiKey {
  id: string;
  key_prefix: string;
  label: string | null;
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
  scopes?: string[];
}

interface OrgUsageSummary {
  id: string;
  name: string;
  isOrgAdmin: boolean;
  memberCount: number;
  guestCount: number;
  used: number;
  limit: number | null;
  billingMode?: "subscription" | "partner";
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialTab = parseDashboardTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  useEffect(() => {
    const fromUrl = parseDashboardTab(searchParams.get("tab"));
    setActiveTab(fromUrl);
  }, [searchParams]);
  // User state
  const [user, setUser] = useState<{
    id?: string;
    email?: string;
    plan?: string;
    isAdmin?: boolean;
  } | null>(null);
  // Usage tab
  const [usageData, setUsageData] = useState<{
    plan: string;
    used: number;
    personalUsed: number;
    limit: number | null;
    proofOfWorkUsed: number;
    proofOfWorkPersonalUsed: number;
    proofOfWorkLimit: number | null;
    workspacesUsed: number;
    workspacesLimit: number | null;
    periodEnd: string | null;
    subscriptionStatus: string;
    organization: OrgUsageSummary | null;
    isAdmin: boolean;
    /** Org partner billing = Stripe bypass; hide commercial billing UI. */
    billingMode?: "subscription" | "partner" | null;
    canUseAgentApi?: boolean;
    /** External/API-direct PoW only (not TAP/TAP Learning-generated PoW). */
    apiPowCallsUsed?: number;
    tapSessionsUsed?: number;
    ileSessionsUsed?: number;
    apiMeteredInvoice?: {
      platformCents: number;
      usageCents: number;
      usageCentsRounded?: number;
      totalCents: number;
      externalPowCount?: number;
      tapSessionCount?: number;
      ileSessionCount?: number;
      externalPowCents?: number;
      tapSessionCents?: number;
      ileSessionCents?: number;
    } | null;
    /** Inference spend for the org's dedicated xAI API key (period-filtered). */
    xaiUsage?: {
      available: boolean;
      apiKeyId: string;
      apiKeyName: string | null;
      periodStart: string;
      periodEnd: string;
      totalUsd: number;
      lines: Array<{ description: string; usd: number }>;
      error?: string;
    } | null;
    hasPaidAccess?: boolean;
    freeTier?: boolean;
    weeklySessionsUsed?: number;
    weeklySessionsLimit?: number | null;
    weeklySessionsResetAt?: string | null;
    weeklySessionsAllowed?: boolean;
    creditBalance?: number;
    sessionCreditCost?: number;
    starterCreditGrant?: number;
    creditGrants?: Array<{ id: string; reason: string; amount: number; createdAt: string }>;
    creditDebits?: Array<{
      id: string;
      reason: string;
      amount: number;
      flowKind?: string | null;
      createdAt: string;
    }>;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  type XaiPeriodPreset = "7d" | "30d" | "90d" | "billing";
  type XaiUsageState = {
    available: boolean;
    apiKeyId: string;
    apiKeyName: string | null;
    periodStart: string;
    periodEnd: string;
    totalUsd: number;
    lines: Array<{ description: string; usd: number }>;
    error?: string;
  };
  const [xaiPeriod, setXaiPeriod] = useState<XaiPeriodPreset>("billing");
  const [xaiUsageOverride, setXaiUsageOverride] = useState<XaiUsageState | null>(null);
  const [xaiUsageLoading, setXaiUsageLoading] = useState(false);

  // Sessions tab
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<Set<string>>(new Set(["active", "paused"]));
  const [sessionPage, setSessionPage] = useState(1);
  const sessionPageSize = 10;

  // Agentic tab
  const [apiKeys, setApiKeys] = useState<AgentApiKey[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [mcpCopiedField, setMcpCopiedField] = useState<string | null>(null);

  // AI Provider info
  const [providerInfo, setProviderInfo] = useState<{
    defaultModel: string;
    hasXAIKey: boolean;
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  // Reset page when search or filter changes
  useEffect(() => {
    setSessionPage(1);
  }, [sessionSearch, sessionStatusFilter]);

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser({ id: authUser.id, email: authUser.email });

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, is_admin, subscription_status, current_period_end")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser({
          id: authUser.id,
          email: authUser.email,
          plan: profile.plan || "inactive",
          isAdmin: profile.is_admin || false,
        });
      }

      // Load AI provider info (for admin config tab)
      if (profile?.is_admin) {
        try {
          const provRes = await fetch("/api/ai-provider");
          if (provRes.ok) {
            const provData = await provRes.json();
            setProviderInfo(provData);
          }
        } catch (e) {
          console.error("Failed to fetch AI provider info:", e);
        }
      }

      // Load sessions
      const loadedSessions = await getSessions();
      setSessions(loadedSessions);

        // Load usage data
        try {
          const usageRes = await fetch("/api/check-usage");
          if (!usageRes.ok) {
            throw new Error(`HTTP ${usageRes.status}`);
          }
          const usageResult = await usageRes.json();
          const orgResolvedPlan = (usageResult.plan || "inactive") as string;
          setUsageData({
            plan: orgResolvedPlan,
            used: usageResult.used ?? 0,
            personalUsed: usageResult.personalUsed ?? usageResult.used ?? 0,
            limit: usageResult.isAdmin ? null : (usageResult.limit ?? null),
            proofOfWorkUsed: usageResult.proofOfWorkUsed ?? 0,
            proofOfWorkPersonalUsed: usageResult.proofOfWorkPersonalUsed ?? usageResult.proofOfWorkUsed ?? 0,
            proofOfWorkLimit: usageResult.isAdmin ? null : (usageResult.proofOfWorkLimit ?? null),
            workspacesUsed: usageResult.workspacesUsed ?? 0,
            workspacesLimit: usageResult.isAdmin ? null : (usageResult.workspacesLimit ?? null),
            periodEnd: usageResult.periodEnd ?? profile?.current_period_end ?? null,
            subscriptionStatus:
              usageResult.subscriptionStatus ?? profile?.subscription_status ?? "inactive",
            organization: usageResult.organization ?? null,
            isAdmin: usageResult.isAdmin === true || profile?.is_admin === true,
            billingMode:
              usageResult.billingMode ??
              usageResult.organization?.billingMode ??
              null,
            canUseAgentApi:
              usageResult.canUseAgentApi === true ||
              usageResult.isAdmin === true ||
              profile?.is_admin === true ||
              hasAgentApiKeyPlan(orgResolvedPlan),
            apiPowCallsUsed: usageResult.apiPowCallsUsed ?? 0,
            tapSessionsUsed: usageResult.tapSessionsUsed ?? 0,
            ileSessionsUsed: usageResult.ileSessionsUsed ?? 0,
            apiMeteredInvoice: usageResult.apiMeteredInvoice ?? null,
            xaiUsage: usageResult.xaiUsage ?? null,
            hasPaidAccess: usageResult.hasPaidAccess === true,
            freeTier: usageResult.freeTier === true || usageResult.hasPaidAccess === false,
            weeklySessionsUsed: usageResult.weeklySessionsUsed ?? 0,
            weeklySessionsLimit:
              usageResult.weeklySessionsLimit === undefined
                ? null
                : usageResult.weeklySessionsLimit,
            weeklySessionsResetAt: usageResult.weeklySessionsResetAt ?? null,
            weeklySessionsAllowed: usageResult.weeklySessionsAllowed !== false,
            creditBalance: usageResult.creditBalance ?? 0,
            sessionCreditCost: usageResult.sessionCreditCost,
            starterCreditGrant: usageResult.starterCreditGrant,
            creditGrants: usageResult.creditGrants ?? [],
            creditDebits: usageResult.creditDebits ?? [],
          });
          setXaiUsageOverride(null);
          setXaiPeriod("billing");
          // Keep user.plan aligned with org-resolved entitlement (not demoted personal plan)
          setUser((prev) => ({
            ...prev,
            id: authUser.id,
            email: authUser.email,
            plan: orgResolvedPlan,
            isAdmin: usageResult.isAdmin === true || profile?.is_admin === true || prev?.isAdmin,
          }));
        } catch (err) {
          console.error("Failed to load usage data:", err);
        }

      // Load Flow API keys (API Metered)
      try {
        const keysRes = await fetch("/api/dashboard/api-keys");
        if (keysRes.ok) {
          const keysPayload = await keysRes.json();
          const keys = (keysPayload.keys || []).filter((key: AgentApiKey) => key.is_active !== false);
          setApiKeys(
            keys.map((key: AgentApiKey) => ({
              ...key,
              usage_count: key.usage_count ?? 0,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load API keys:", err);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm(t('dashboard.deleteSessionConfirm'))) return;
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleStartOverSession = async (id: string) => {
    if (!confirm(t('dashboard.startOverConfirm'))) return;
    try {
      await restartSession(id);
      router.push(`/session?id=${id}`);
    } catch (err) {
      console.error("Failed to restart session:", err);
      alert(t('dashboard.startOverError'));
    }
  };

  // Prefer org-resolved plan from /api/check-usage (usageData), not demoted profiles.plan
  const effectivePlan = usageData?.plan || user?.plan || "inactive";
  const usesAgenticV2Keys = dashboardUsesAgenticKeys({
    usagePlan: usageData?.plan,
    canUseAgentApi: usageData?.canUseAgentApi,
    usageIsAdmin: usageData?.isAdmin,
    userIsAdmin: user?.isAdmin,
    userPlan: user?.plan,
  });

  const mcpOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://uncertain.systems";

  const mcpClientConfig = useMemo(() => {
    if (newKeyValue) {
      return buildMcpClientConfig(mcpOrigin, newKeyValue);
    }
    return buildMcpClientConfig(mcpOrigin);
  }, [mcpOrigin, newKeyValue]);

  const copyMcpText = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMcpCopiedField(field);
      setTimeout(() => setMcpCopiedField(null), 2000);
    } catch (err) {
      console.error("MCP copy failed:", err);
    }
  };

  const handleCreateApiKey = async () => {
    if (!usesAgenticV2Keys) {
      alert(t('dashboard.apiKeysProOnly'));
      return;
    }
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/dashboard/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newKeyName.trim() }),
      });
      const data = await res.json();
      const createdKey = data.key;
      const rawKey = data.api_key || data.key?.key;
      if (createdKey) {
        setApiKeys((prev) => [
          {
            id: createdKey.id,
            key_prefix: createdKey.key_prefix,
            label: createdKey.label,
            rate_limit: createdKey.rate_limit ?? 120,
            is_active: createdKey.is_active ?? true,
            created_at: createdKey.created_at,
            last_used_at: null,
            usage_count: 0,
            scopes: createdKey.scopes,
          },
          ...prev,
        ]);
        if (rawKey) {
          setNewKeyValue(rawKey);
          setTimeout(() => setNewKeyValue(null), 30000);
        }
        setNewKeyName("");
      } else if (data.error?.message) {
        alert(data.error.message);
      }
    } catch (err) {
      console.error("Failed to create key:", err);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm(t('dashboard.deleteApiKeyConfirm'))) return;
    try {
      await fetch(`/api/dashboard/api-keys/${id}`, { method: "DELETE" });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const usageCardClass = "console-copy rounded-none p-5 sm:p-6";
  const usageLabelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";

  const loadXaiUsage = async (period: XaiPeriodPreset) => {
    setXaiUsageLoading(true);
    try {
      const res = await fetch(
        `/api/organization/xai-usage?period=${encodeURIComponent(period)}`
      );
      const data = await res.json();
      if (!res.ok && !data.apiKeyId) {
        setXaiUsageOverride({
          available: false,
          apiKeyId: "",
          apiKeyName: null,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          totalUsd: 0,
          lines: [],
          error: data.error || "Failed to load xAI usage",
        });
        return;
      }
      setXaiUsageOverride({
        available: data.available === true,
        apiKeyId: data.apiKeyId || "",
        apiKeyName: data.apiKeyName ?? null,
        periodStart: data.periodStart || new Date().toISOString(),
        periodEnd: data.periodEnd || new Date().toISOString(),
        totalUsd: typeof data.totalUsd === "number" ? data.totalUsd : 0,
        lines: Array.isArray(data.lines) ? data.lines : [],
        error: data.error,
      });
    } catch (err) {
      console.error("Failed to load xAI usage:", err);
      setXaiUsageOverride((prev) =>
        prev
          ? { ...prev, available: false, error: "Failed to load xAI usage" }
          : {
              available: false,
              apiKeyId: "",
              apiKeyName: null,
              periodStart: new Date().toISOString(),
              periodEnd: new Date().toISOString(),
              totalUsd: 0,
              lines: [],
              error: "Failed to load xAI usage",
            }
      );
    } finally {
      setXaiUsageLoading(false);
    }
  };

  const handleXaiPeriodChange = (period: XaiPeriodPreset) => {
    setXaiPeriod(period);
    void loadXaiUsage(period);
  };

  function planDisplayName(plan: string, isAdmin?: boolean) {
    if (isAdmin) return "Platform admin";
    return formatPlanName(plan);
  }

  function planPriceLabel(plan: string, isAdmin?: boolean) {
    if (isAdmin) return "Unlimited platform access";
    if (plan === "inactive") return t("dashboard.priceFree");
    return formatPlanMonthlyPrice(plan as PlanId);
  }

  function usageProgress(used: number, limit: number | null) {
    if (limit === null || limit <= 0) return 0;
    return Math.min((used / limit) * 100, 100);
  }

  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Filter and paginate sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = sessionSearch === "" || 
      s.problem.toLowerCase().includes(sessionSearch.toLowerCase());
    const matchesStatus = sessionStatusFilter.size === 0 || sessionStatusFilter.has(s.status);
    return matchesSearch && matchesStatus;
  });

  const totalSessionPages = Math.ceil(filteredSessions.length / sessionPageSize);
  const paginatedSessions = filteredSessions.slice(
    (sessionPage - 1) * sessionPageSize,
    sessionPage * sessionPageSize
  );

  const accessKnown = usageData != null;
  const hasPaidAccess = usageData?.hasPaidAccess === true;

  const setDashboardTab = (tab: DashboardTab) => {
    const next = accessKnown ? clampDashboardTabForAccess(tab, hasPaidAccess) : tab;
    setActiveTab(next);
    router.replace(`/dashboard?tab=${next}`, { scroll: false });
  };

  useEffect(() => {
    if (!accessKnown) return;
    const next = clampDashboardTabForAccess(activeTab, hasPaidAccess);
    if (next === activeTab) return;
    setActiveTab(next);
    router.replace(`/dashboard?tab=${next}`, { scroll: false });
  }, [accessKnown, activeTab, hasPaidAccess, router]);

  if (loading) {
    return (
      <div
        data-console-frame=""
        data-workspace-shell=""
        className="relative flex min-h-screen items-center justify-center overflow-hidden border border-white/40 bg-black"
      >
        <DashboardAtmosphere />
        <div className="relative z-[2]">
          <LoadingStatusMessage message={t('common.loading')} />
        </div>
      </div>
    );
  }

  return (
    <div
      data-console-frame=""
      data-workspace-shell=""
      className="relative min-h-screen border border-white/40 bg-black text-white md:h-dvh md:max-h-dvh md:overflow-hidden"
    >
      <DashboardAtmosphere />
      <div
        className="relative z-[2] grid min-h-screen grid-cols-1 md:h-full md:min-h-0 md:grid-cols-[16rem_minmax(0,1fr)]"
        data-dashboard-platform
      >
      <DashboardSidebar
        activeTab={activeTab}
        onSelect={setDashboardTab}
        hasPaidAccess={hasPaidAccess}
      />

      <div
        className={
          isDashboardStudioTab(activeTab)
            ? "flex min-h-0 min-w-0 flex-col md:h-full md:overflow-hidden"
            : "min-w-0 md:min-h-0 md:overflow-y-auto"
        }
      >
      <main
        className={
          isDashboardStudioTab(activeTab)
            ? "flex h-full min-h-[70vh] flex-1 flex-col overflow-hidden p-0 md:min-h-0"
            : "overflow-x-hidden p-4 py-8 sm:px-6 lg:px-8"
        }
      >
        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <DashboardSessionsTab
            filteredSessions={filteredSessions}
            formatDate={formatDate}
            formatDuration={formatDuration}
            handleDeleteSession={handleDeleteSession}
            handleStartOverSession={handleStartOverSession}
            paginatedSessions={paginatedSessions}
            router={router}
            sessionPage={sessionPage}
            sessionPageSize={sessionPageSize}
            sessionSearch={sessionSearch}
            sessionStatusFilter={sessionStatusFilter}
            setSessionPage={setSessionPage}
            setSessionSearch={setSessionSearch}
            setSessionStatusFilter={setSessionStatusFilter}
            t={t}
            totalSessionPages={totalSessionPages}
          />
        )}

        {activeTab === "home" && <DashboardHomeTab />}

        {(activeTab === "verification" ||
          activeTab === "calibration" ||
          activeTab === "solve") && (
          <DashboardFlowsTab productTab={activeTab} formatDate={formatDate} />
        )}

        {isDashboardRegionsTab(activeTab) ? (
          <DashboardKnowledgeRegionsTab
            kind={
              activeTab === "calibration_regions"
                ? "calibration"
                : activeTab === "solve_regions"
                  ? "solve"
                  : "verification"
            }
            formatDate={formatDate}
          />
        ) : null}

        {isDashboardStudioTab(activeTab) && dashboardStudioProduct(activeTab) ? (
          <DashboardDataStudioTab product={dashboardStudioProduct(activeTab)!} />
        ) : null}

        {activeTab === "organization" && <OrganizationDashboardTab />}

        {activeTab === "usage" && (
          <DashboardUsageTab
            handleXaiPeriodChange={handleXaiPeriodChange}
            loadingUsage={loadingUsage}
            planDisplayName={planDisplayName}
            planPriceLabel={planPriceLabel}
            setDashboardTab={setDashboardTab}
            t={t}
            usageCardClass={usageCardClass}
            usageData={usageData}
            usageLabelClass={usageLabelClass}
            usageProgress={usageProgress}
            xaiPeriod={xaiPeriod}
            xaiUsageLoading={xaiUsageLoading}
            xaiUsageOverride={xaiUsageOverride}
          />
        )}

        {/* Integrations Tab */}
        {activeTab === "integrations" && (
          <DashboardIntegrationsTab
            apiKeys={apiKeys}
            copyMcpText={copyMcpText}
            creatingKey={creatingKey}
            formatDate={formatDate}
            handleCreateApiKey={handleCreateApiKey}
            handleDeleteApiKey={handleDeleteApiKey}
            keyCopied={keyCopied}
            mcpClientConfig={mcpClientConfig}
            mcpCopiedField={mcpCopiedField}
            mcpOrigin={mcpOrigin}
            newKeyName={newKeyName}
            newKeyValue={newKeyValue}
            setKeyCopied={setKeyCopied}
            setNewKeyName={setNewKeyName}
            t={t}
            usageCardClass={usageCardClass}
            usageLabelClass={usageLabelClass}
            usesAgenticV2Keys={usesAgenticV2Keys}
          />
        )}

        {/* Configuration Tab */}
        {activeTab === "config" && (
          <DashboardConfigTab
            providerInfo={providerInfo}
            t={t}
          />
        )}

      </main>
      </div>
      </div>
    </div>
  );
}
