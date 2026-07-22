"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSessions, deleteSession, restartSession, getWorkspaces, getIlePostSessionPath, type Session, type Workspace } from "@/lib/storage";
import { DEFAULT_PROMPTS, PROMPT_META, type PromptKey, type UserPrompts } from "@/lib/prompts";
import { useI18n } from "@/lib/i18n";
import { formatPlanMonthlyPrice, hasAgentApiKeyPlan, type PlanId } from "@/lib/plans";
import { dashboardUsesAgenticKeys } from "@/lib/dashboard-agent-access";
import { OrganizationDashboardTab } from "@/components/OrganizationDashboardTab";
import { WorkspaceDashboardCard } from "@/components/WorkspaceDashboardCard";
import { buildMcpClientConfig } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { IntegrationQuickAccess } from "@/components/IntegrationQuickAccess";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

const DASHBOARD_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

type Tab =
  | "sessions"
  | "plans"
  | "usage"
  | "integrations"
  | "organization"
  | "config";

interface AvailableModel {
  id: string;
  label: string;
  description: string;
}

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
  const initialTab = (searchParams.get("tab") as Tab) || "plans";
  const [activeTab, setActiveTab] = useState<Tab>(
    ["plans", "usage", "integrations", "organization"].includes(initialTab)
      ? initialTab
      : "plans"
  );
  // User state
  const [user, setUser] = useState<{
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
    apiPowCallsUsed?: number;
    apiMeteredInvoice?: {
      platformCents: number;
      usageCents: number;
      totalCents: number;
      apiCallCount: number;
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

  // Plans tab
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceSearch, setPlanSearch] = useState("");
  const [showArchivedWorkspaces, setShowArchivedPlans] = useState(false);
  /** Filter workspace cards by visibility: all | public | private */
  const [workspaceVisibilityFilter, setWorkspaceVisibilityFilter] = useState<
    "all" | "public" | "private"
  >("all");
  const [archivingWorkspaceId, setArchivingPlanId] = useState<string | null>(null);
  const [snapshottingWorkspaceId, setSnapshottingWorkspaceId] = useState<string | null>(null);
  const [workspacePage, setPlanPage] = useState(1);
  const workspacePageSize = 10;

  // Agentic tab
  const [apiKeys, setApiKeys] = useState<AgentApiKey[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [mcpCopiedField, setMcpCopiedField] = useState<string | null>(null);

  // Config tab
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [tutorModel, setTutorModel] = useState<string>(DEFAULT_MODEL);
  const [askModel, setAskModel] = useState<string>(DEFAULT_MODEL);
  const [plannerModel, setPlannerModel] = useState<string>(DEFAULT_MODEL);
  const [coderModel, setCoderModel] = useState<string>(DEFAULT_MODEL);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);

  // AI Provider info
  const [providerInfo, setProviderInfo] = useState<{
    defaultModel: string;
    hasXAIKey: boolean;
  } | null>(null);

  const [userPrompts, setUserPrompts] = useState<UserPrompts>({});
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsSaved, setPromptsSaved] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  // Reset page when search or filter changes
  useEffect(() => {
    setSessionPage(1);
  }, [sessionSearch, sessionStatusFilter]);

  useEffect(() => {
    setPlanPage(1);
  }, [workspaceSearch]);

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser({ email: authUser.email });

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata, plan, is_admin, subscription_status, current_period_end")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser({
          email: authUser.email,
          plan: profile.plan || "inactive",
          isAdmin: profile.is_admin || false,
        });

        if (profile.metadata?.prompts) {
          setUserPrompts(profile.metadata.prompts as UserPrompts);
        }
        if (profile.metadata?.tutor_model) {
          setTutorModel(profile.metadata.tutor_model as string);
        }
        if (profile.metadata?.ask_model) {
          setAskModel(profile.metadata.ask_model as string);
        }
        if (profile.metadata?.planner_model) {
          setPlannerModel(profile.metadata.planner_model as string);
        }
        if (profile.metadata?.coder_model) {
          setCoderModel(profile.metadata.coder_model as string);
        }
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

        // Load learning plans (archived hidden by default)
        const plans = await getWorkspaces({ includeArchived: false });
        setWorkspaces(plans);

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
            apiMeteredInvoice: usageResult.apiMeteredInvoice ?? null,
            xaiUsage: usageResult.xaiUsage ?? null,
          });
          setXaiUsageOverride(null);
          setXaiPeriod("billing");
          // Keep user.plan aligned with org-resolved entitlement (not demoted personal plan)
          setUser((prev) => ({
            ...prev,
            email: authUser.email,
            plan: orgResolvedPlan,
            isAdmin: usageResult.isAdmin === true || profile?.is_admin === true || prev?.isAdmin,
          }));
        } catch (err) {
          console.error("Failed to load usage data:", err);
        }

      // Load Proof-of-Work API keys (v2 Teams tier)
      try {
        const keysRes = await fetch("/api/v3/pow/keys");
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

      // Load available models
      try {
        const modelsRes = await fetch("/api/models");
        const modelsData = await modelsRes.json();
        if (modelsData.models) {
          setAvailableModels(modelsData.models);
          setModelsLoading(false);
          if (!profile?.metadata?.tutor_model && modelsData.models.length > 0) {
            setTutorModel(modelsData.models[0].id);
          }
          if (!profile?.metadata?.ask_model && modelsData.models.length > 0) {
            setAskModel(modelsData.models[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to load models:", e);
        setModelsLoading(false);
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

  const handleSaveModels = async () => {
    setModelSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", authUser.id)
        .single();

      const currentMetadata = profile?.metadata || {};

      await supabase
        .from("profiles")
        .update({
          metadata: {
            ...currentMetadata,
            tutor_model: tutorModel,
            ask_model: askModel,
            planner_model: plannerModel,
            coder_model: coderModel,
          },
        })
        .eq("id", authUser.id);

      setModelSaved(true);
      setTimeout(() => setModelSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save models:", err);
    } finally {
      setModelSaving(false);
    }
  };

  const handleSavePrompts = async () => {
    setPromptsSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", authUser.id)
        .single();

      const currentMetadata = profile?.metadata || {};

      await supabase
        .from("profiles")
        .update({
          metadata: {
            ...currentMetadata,
            prompts: userPrompts,
          },
        })
        .eq("id", authUser.id);

      setPromptsSaved(true);
      setTimeout(() => setPromptsSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save prompts:", err);
    } finally {
      setPromptsSaving(false);
    }
  };

  const handleResetPrompt = (key: PromptKey) => {
    setUserPrompts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleResetAllPrompts = () => {
    setUserPrompts({});
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
      const res = await fetch("/api/v3/pow/keys", {
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
      await fetch(`/api/v3/pow/keys/${id}`, { method: "DELETE" });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const usageCardClass = "rounded-md border border-neutral-800 bg-neutral-950/75 p-5 sm:p-6";
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
    if (plan === "pro_teams") return "Pro / Teams";
    if (plan === "api_metered") return "API Metered";
    if (plan === "regular_2026") return "Individual";
    if (plan === "trial") return "3-Day Trial";
    if (plan === "inactive") return "Inactive";
    return plan;
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

  // Filter and paginate plans
  const reloadWorkspaces = async (includeArchived = showArchivedWorkspaces) => {
    const plans = await getWorkspaces({ includeArchived });
    setWorkspaces(plans);
  };

  useEffect(() => {
    if (activeTab !== "plans") return;
    void reloadWorkspaces(showArchivedWorkspaces);
  }, [showArchivedWorkspaces, activeTab]);

  const handleArchivePlan = async (workspaceId: string) => {
    if (!confirm("Archive this workspace? It will be hidden from your dashboard but preserved for audit.")) {
      return;
    }
    setArchivingPlanId(workspaceId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive workspace");
      setWorkspaces((plans) => plans.filter((plan) => plan.id !== workspaceId));
    } catch (err) {
      console.error("Archive workspace error:", err);
      alert(err instanceof Error ? err.message : "Failed to archive workspace");
    } finally {
      setArchivingPlanId(null);
    }
  };

  const handleRestorePlan = async (workspaceId: string) => {
    setArchivingPlanId(workspaceId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/archive`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore workspace");
      await reloadWorkspaces(showArchivedWorkspaces);
    } catch (err) {
      console.error("Restore workspace error:", err);
      alert(err instanceof Error ? err.message : "Failed to restore workspace");
    } finally {
      setArchivingPlanId(null);
    }
  };

  const handleSnapshotAll = async (workspace: Workspace) => {
    const title = workspace.title || workspace.root_topic || "this workspace";
    if (
      !confirm(
        `Run LWM Snapshot for all users of “${title}”? This may take a while and uses proof-of-work for each subject.`,
      )
    ) {
      return;
    }
    setSnapshottingWorkspaceId(workspace.id);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/snapshot-all`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to snapshot workspace users",
        );
      }
      const succeeded = Number(data.succeeded) || 0;
      const skipped = Number(data.skipped) || 0;
      const failed = Number(data.failed) || 0;
      const total = Number(data.total) || 0;
      alert(
        total === 0
          ? "No subjects found for this workspace."
          : `Snapshot complete: ${succeeded} succeeded, ${skipped} skipped, ${failed} failed (${total} subjects).`,
      );
    } catch (err) {
      console.error("Snapshot all error:", err);
      alert(err instanceof Error ? err.message : "Failed to snapshot workspace users");
    } finally {
      setSnapshottingWorkspaceId(null);
    }
  };

  const filteredWorkspaces = workspaces.filter((p) => {
    const matchesSearch =
      workspaceSearch === "" ||
      p.root_topic.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      (p.title || "").toLowerCase().includes(workspaceSearch.toLowerCase());
    if (!matchesSearch) return false;
    const isPublic = p.is_public ?? false;
    if (workspaceVisibilityFilter === "public") return isPublic;
    if (workspaceVisibilityFilter === "private") return !isPublic;
    return true;
  });

  const totalPlanPages = Math.ceil(filteredWorkspaces.length / workspacePageSize);
  const paginatedPlans = filteredWorkspaces.slice(
    (workspacePage - 1) * workspacePageSize,
    workspacePage * workspacePageSize
  );

  const setDashboardTab = (tab: Tab) => {
    setActiveTab(tab);
    router.replace(`/dashboard?tab=${tab}`, { scroll: false });
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#0a0a0a] bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${DASHBOARD_BACKGROUND})` }}
      >
        <LoadingStatusMessage message={t('common.loading')} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${DASHBOARD_BACKGROUND})` }}
    >
      <Navbar />

      {/* Tabs */}
      <div className="border-b border-neutral-800/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: "plans", label: "Workspaces" },
              { id: "usage", label: t("dashboard.usageTab") },
              { id: "organization", label: "Organization" },
              { id: "integrations", label: t("dashboard.integrationsTab") },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDashboardTab(tab.id as Tab)}
                className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden p-4 py-8 sm:px-6 lg:px-8">
        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('dashboard.allSessions')}</h2>
              <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                {t('dashboard.startNewSession')}
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder={t('dashboard.searchSessions')}
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                />
              </div>
              <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
                {[
                  { value: "active", label: t('dashboard.active') },
                  { value: "paused", label: t('dashboard.paused') },
                  { value: "completed", label: t('dashboard.completed') },
                ].map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={sessionStatusFilter.has(opt.value)}
                      onChange={() => {
                        setSessionStatusFilter((prev) => {
                          const next = new Set(prev);
                          if (next.has(opt.value)) {
                            next.delete(opt.value);
                          } else {
                            next.add(opt.value);
                          }
                          return next;
                        });
                      }}
                      className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-600 text-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-offset-0 accent-blue-500"
                    />
                    <span className="text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 border border-neutral-800 rounded-lg">
                <p className="text-sm">{t('dashboard.noMatchingSessions')}</p>
                <Link href="/" className="text-blue-400 hover:underline mt-2 inline-block text-sm">
                  {t('dashboard.startYourFirstSession')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedSessions.map((session) => {
                  const isCompleted = session.status === "completed";
                  return (
                  <Link
                    key={session.id}
                    href={isCompleted ? getIlePostSessionPath(session) : `/session?id=${session.id}`}
                    className="block rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">
                          {session.problem}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {formatDate(session.startedAt)} · {formatDuration(session.durationMs)} ·{" "}
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                              session.status === "completed"
                                ? "bg-green-900/30 text-green-400"
                                : "bg-yellow-900/30 text-yellow-400"
                            }`}
                          >
                            {session.status === "completed" ? t('dashboard.completed') : t('dashboard.active')}
                          </span>
                          {session.workspaceTitle && (
                            <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] bg-purple-900/30 text-purple-400">
                              {session.workspaceTitle}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center ml-4 gap-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/session/analytics?id=${session.id}`);
                          }}
                          className="p-1.5 text-neutral-600 hover:text-blue-400 transition-colors"
                          title={t('dashboard.sessionAnalytics')}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </button>
                        {isCompleted && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStartOverSession(session.id);
                            }}
                            className="p-1.5 text-neutral-600 hover:text-amber-400 transition-colors"
                            title={t('dashboard.startOver')}
                            aria-label={t('dashboard.startOver')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}

            {totalSessionPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                <p className="text-xs text-neutral-500">
                  {t('dashboard.showingResults', { start: String((sessionPage - 1) * sessionPageSize + 1), end: String(Math.min(sessionPage * sessionPageSize, filteredSessions.length)), total: String(filteredSessions.length) })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                    disabled={sessionPage === 1}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.previous')}
                  </button>
                  <button
                    onClick={() => setSessionPage((p) => Math.min(totalSessionPages, p + 1))}
                    disabled={sessionPage === totalSessionPages}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === "plans" && (
          <div className="space-y-6">
            <div className="border border-neutral-800 bg-neutral-950/75 px-6 py-7 sm:px-8 sm:py-8 backdrop-blur-sm">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                    Workspaces
                  </p>
                  <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
                    Verification, optimization, and augmentation — in one workspace.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
                    Define a skill or scenario, attach proof of work, and run every product on the same learning
                    world model: verify humans and agents before hire or deploy, optimize practice until gaps
                    close, and augment reasoning inside real workflows.
                  </p>
                </div>
                <Link
                  href="/workspace/new"
                  className="inline-flex h-12 items-center justify-center rounded-sm bg-white px-6 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  Create a New Workspace →
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{t('dashboard.allWorkspaces')}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className="flex items-center gap-2 text-xs text-neutral-400"
                  data-workspace-visibility-filter
                >
                  <span className="text-neutral-500">Visibility</span>
                  <select
                    value={workspaceVisibilityFilter}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "all" || next === "public" || next === "private") {
                        setWorkspaceVisibilityFilter(next);
                        setPlanPage(1);
                      }
                    }}
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                    aria-label="Filter workspaces by public or private"
                  >
                    <option value="all">All</option>
                    <option value="public">{t("dashboard.public")}</option>
                    <option value="private">{t("dashboard.private")}</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  <input
                    type="checkbox"
                    checked={showArchivedWorkspaces}
                    onChange={(e) => setShowArchivedPlans(e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-900"
                  />
                  Show archived
                </label>
              </div>
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder={t('dashboard.searchWorkspaces')}
                value={workspaceSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>

            {filteredWorkspaces.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 border border-neutral-800 rounded-lg">
                <p className="text-sm">{t('dashboard.noMatchingWorkspaces')}</p>
                <Link href="/workspace/new" className="text-blue-400 hover:underline mt-2 inline-block text-sm">
                  {t('dashboard.createYourFirstPlan')}
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2" data-workspace-cards-grid>
                {paginatedPlans.map((plan) => (
                  <WorkspaceDashboardCard
                    key={plan.id}
                    plan={plan}
                    formatDate={formatDate}
                    archivingWorkspaceId={archivingWorkspaceId}
                    snapshottingWorkspaceId={snapshottingWorkspaceId}
                    publicLabel={t("dashboard.public")}
                    privateLabel={t("dashboard.private")}
                    onArchive={handleArchivePlan}
                    onRestore={handleRestorePlan}
                    onToggleVisibility={async (workspace) => {
                      try {
                        const isPublic = workspace.is_public ?? false;
                        const res = await fetch(`/api/workspaces/${workspace.id}/visibility`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ is_public: !isPublic }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setWorkspaces((plans) =>
                            plans.map((entry) =>
                              entry.id === workspace.id ? { ...entry, is_public: !isPublic } : entry,
                            ),
                          );
                        }
                      } catch (err) {
                        console.error("Error toggling visibility:", err);
                      }
                    }}
                    onSnapshotAll={handleSnapshotAll}
                  />
                ))}
              </div>
            )}

            {totalPlanPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                <p className="text-xs text-neutral-500">
                  {t('dashboard.showingResults', { start: String((workspacePage - 1) * workspacePageSize + 1), end: String(Math.min(workspacePage * workspacePageSize, filteredWorkspaces.length)), total: String(filteredWorkspaces.length) })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                    disabled={workspacePage === 1}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.previous')}
                  </button>
                  <button
                    onClick={() => setPlanPage((p) => Math.min(totalPlanPages, p + 1))}
                    disabled={workspacePage === totalPlanPages}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "organization" && <OrganizationDashboardTab />}

        {/* Usage Tab */}
        {activeTab === "usage" && (() => {
          const isBillingBypass =
            usageData?.billingMode === "partner" ||
            usageData?.organization?.billingMode === "partner";

          const planBadge = (() => {
            if (isBillingBypass) {
              return (
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-violet-100/90">
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
            if (usageData?.plan === "pro_teams") {
              return (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                  Teams
                </span>
              );
            }
            if (usageData?.plan === "api_metered") {
              return (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-amber-100/90">
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
            if (usageData?.plan === "regular_2026") {
              return (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                  {t("dashboard.regular")}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border border-neutral-800 bg-neutral-950/75 px-6 py-5">
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
                    className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                  >
                    {usageData.organization.isOrgAdmin
                      ? "Manage organization →"
                      : "View organization →"}
                  </button>
                )}
                {!isBillingBypass && (
                  <Link
                    href="/pricing"
                    className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
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
                                ? "API usage is tallied through this date and added to your monthly invoice."
                                : usageData.plan === "pro_teams"
                                  ? "Organization Proof-of-Work pool resets each billing period."
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
                            usageData.plan === "regular_2026" ||
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
                                  ? "bg-amber-400"
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
                            ? "Your personal Proof-of-Work this period (TAP, ILE, and API)."
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
                                    ? "bg-amber-400"
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
                            : " · Shared monthly pool (TAP, ILE, API)"}
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
                                <p className="text-xs text-neutral-500">API submissions</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  {usageData.apiPowCallsUsed ?? 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Usage charges</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  $
                                  {(usageData.apiMeteredInvoice.usageCents / 100).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Est. monthly total</p>
                                <p className="mt-1 text-2xl font-medium text-white">
                                  $
                                  {(usageData.apiMeteredInvoice.totalCents / 100).toFixed(2)}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">
                                  Includes $99 platform + usage
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
                                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-violet-100/90">
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
                                    className={`rounded-sm border px-2.5 py-1 text-[11px] transition ${
                                      xaiPeriod === opt.id
                                        ? "border-white/20 bg-white/10 text-white"
                                        : "border-neutral-800 bg-black/30 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
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
                            <p className="mt-3 text-xs text-amber-200/80">
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
        })()}

        {/* Integrations Tab */}
        {activeTab === "integrations" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-neutral-800 bg-neutral-950/75 px-6 py-5">
              <div>
                <p className={usageLabelClass}>Integrations</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">{t("dashboard.integrationsTab")}</h2>
                <p className="mt-1 text-sm text-neutral-500">{t("dashboard.integrationsSubtitle")}</p>
              </div>
              {usesAgenticV2Keys && (
                <Link
                  href="/docs/proof-of-work-api"
                  className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                >
                  {t("dashboard.mcpDocsLink")} →
                </Link>
              )}
            </div>

            <div className={usageCardClass}>
              <IntegrationQuickAccess
                origin={mcpOrigin}
                apiKeyPlaceholder={newKeyValue || "YOUR_API_KEY"}
                showWorkspaceLevelNote
                idPrefix="dashboard"
              />
            </div>

            {/* Proof-of-Work API keys */}
            <div className={`${usageCardClass} space-y-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={usageLabelClass}>API keys</p>
                  <h2 className="mt-2 text-xl font-medium text-white">{t("dashboard.proofOfWorkApi")}</h2>
                </div>
                <div className="flex items-center gap-3">
                  {usesAgenticV2Keys && (
                    <Link
                      href="/docs/proof-of-work-api"
                      className="text-sm text-neutral-400 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
                    >
                      API docs →
                    </Link>
                  )}
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                    {usesAgenticV2Keys ? "Teams" : t("dashboard.experimental")}
                  </span>
                </div>
              </div>
              <p className="text-sm text-neutral-500">
                {usesAgenticV2Keys
                  ? t("dashboard.proofOfWorkApiDesc")
                  : t("dashboard.apiExperimentalDesc")}
              </p>
              {!usesAgenticV2Keys && (
                <div className="rounded-md border border-neutral-800 bg-black/40 p-4 text-sm text-neutral-400">
                  {effectivePlan === "regular_2026"
                    ? t("dashboard.proofOfWorkApiTeamsRequired")
                    : `${t("dashboard.apiKeysAvailableOnPro")} `}
                  <Link href="/pricing" className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white">
                    {t("dashboard.upgradeToPro")}
                  </Link>{" "}
                  {t("dashboard.toCreateApiKeys")}
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t("dashboard.enterKeyName")}
                  className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                />
                <button
                  onClick={handleCreateApiKey}
                  disabled={creatingKey}
                  className="inline-flex h-10 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
                >
                  {creatingKey ? t("dashboard.creating") : t("dashboard.createNewKey")}
                </button>
              </div>

              {newKeyValue && (
                <div className="rounded-md border border-white/15 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-neutral-300">{t("dashboard.yourNewApiKey")}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newKeyValue);
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }}
                      className="rounded-sm border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                    >
                      {keyCopied ? t("common.copied") : t("common.copy")}
                    </button>
                  </div>
                  <code className="mt-3 block break-all rounded-md border border-neutral-800 bg-black p-3 font-mono text-xs text-neutral-300">
                    {newKeyValue}
                  </code>
                  {usesAgenticV2Keys ? (
                    <div className="mt-4 border-t border-neutral-800 pt-4">
                      <p className="text-xs text-neutral-400">{t("dashboard.mcpNewKeyConfig")}</p>
                      <pre className="mt-2 overflow-x-auto rounded-md border border-neutral-800 bg-black p-3 font-mono text-[11px] text-neutral-300">
                        {mcpClientConfig}
                      </pre>
                      <button
                        type="button"
                        onClick={() => void copyMcpText(mcpClientConfig, "mcp-new-key")}
                        className="mt-2 rounded-sm border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                      >
                        {mcpCopiedField === "mcp-new-key"
                          ? t("common.copied")
                          : t("dashboard.mcpCopyConfig")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {apiKeys.length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-800 py-8 text-center text-sm text-neutral-500">
                  {t("dashboard.noApiKeysYet")}
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-md border border-neutral-800 bg-black/40 p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200">
                          {key.label || t('dashboard.unnamedKey')}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                          {key.key_prefix}...
                        </p>
                        {key.scopes && key.scopes.length > 0 && (
                          <p className="text-[10px] text-neutral-600 mt-1 font-mono">
                            {key.scopes.join(" · ")}
                          </p>
                        )}
                        <p className="text-xs text-neutral-600 mt-1">
                          {key.last_used_at
                            ? `Last used ${formatDate(key.last_used_at)}`
                            : "Not used yet"}
                          {" · "}
                          {t('dashboard.createdOn', { date: formatDate(key.created_at) })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="p-2 text-neutral-600 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-neutral-600">{t("dashboard.apiKeyRateLimit")}</p>
            </div>
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === "config" && (
          <div className="space-y-8">
            {/* AI Provider Status */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
              <h2 className="text-lg font-semibold mb-3">{t('dashboard.aiProvider')}</h2>
              {providerInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.982 10.622 20.54 3h-1.554l-5.693 6.618L8.745 3H3.5l6.876 10.007L3.5 21h1.554l6.012-6.989L15.868 21h5.245l-7.131-10.378Zm-2.128 2.474-.697-.997-5.543-7.93H8l4.474 6.4.697.996 5.815 8.318h-2.387l-4.745-6.787Z"/></svg>
                      xAI Direct
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t('dashboard.defaultModel')} <code className="text-neutral-400">{providerInfo.defaultModel}</code>
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className={providerInfo.hasXAIKey ? "text-emerald-500" : "text-red-500"}>
                      {providerInfo.hasXAIKey ? t('dashboard.xAiConfigured') : t('dashboard.xAiNotSet')}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">{t('dashboard.loadingProvider')}</p>
              )}
            </div>

            {/* Model Selection - LOCKED */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold">{t('dashboard.modelSelection')}</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t('dashboard.editableComingSoon')}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: t('dashboard.tutorModel'), desc: t('dashboard.tutorModelDesc') },
                  { label: t('dashboard.askingModel'), desc: t('dashboard.askingModelDesc') },
                  { label: t('dashboard.plannerModel'), desc: t('dashboard.plannerModelDesc') },
                  { label: t('dashboard.coderModel'), desc: t('dashboard.coderModelDesc') },
                ].map((slot) => (
                  <div key={slot.label} className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      {slot.label}
                    </label>
                    <p className="text-xs text-neutral-500 mb-3">{slot.desc}</p>
                    <div className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300">
                      Grok 4.5 <span className="text-neutral-500">({DEFAULT_MODEL})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prompt Customization - LOCKED */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold">{t('dashboard.promptModifications')}</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t('dashboard.editableComingSoon')}
                </span>
              </div>

              <div className="space-y-4">
                {(Object.keys(DEFAULT_PROMPTS) as PromptKey[]).map((key) => {
                  const meta = PROMPT_META[key];
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 opacity-60"
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm text-neutral-200 font-medium">{meta.label}</h4>
                          </div>
                          <p className="text-[11px] text-neutral-600 mt-0.5">{meta.description}</p>
                        </div>
                      </div>
                      <textarea
                        value={DEFAULT_PROMPTS[key]}
                        readOnly={true}
                        rows={6}
                        spellCheck={false}
                        className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3 text-xs text-neutral-500 font-mono leading-relaxed resize-none cursor-not-allowed"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
