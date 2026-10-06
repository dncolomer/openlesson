"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS } from "@/components/ui/console-frame";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSessions, deleteSession, restartSession, getWorkspaces, getIlePostSessionPath, type Session, type Workspace } from "@/lib/storage";
import { DEFAULT_PROMPTS, PROMPT_META, type PromptKey, type UserPrompts } from "@/lib/prompts";
import { useI18n } from "@/lib/i18n";
import { formatPlanMonthlyPrice, hasAgentApiKeyPlan, type PlanId } from "@/lib/plans";
import { dashboardUsesAgenticKeys } from "@/lib/dashboard-agent-access";
import { OrganizationDashboardTab } from "@/components/OrganizationDashboardTab";
import { DashboardConfigTab } from "@/components/dashboard/dashboard-config-tab";
import { DashboardIntegrationsTab } from "@/components/dashboard/dashboard-integrations-tab";
import { DashboardPlansTab } from "@/components/dashboard/dashboard-plans-tab";
import { DashboardSessionsTab } from "@/components/dashboard/dashboard-sessions-tab";
import { DashboardUsageTab } from "@/components/dashboard/dashboard-usage-tab";
import { WorkspaceDashboardCard } from "@/components/WorkspaceDashboardCard";
import { fetchAestheticPackages } from "@/lib/aesthetics";
import { buildMcpClientConfig } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { IntegrationQuickAccess } from "@/components/IntegrationQuickAccess";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  loadPinnedWorkspaceIds,
  savePinnedWorkspaceIds,
  sortWorkspacesPinnedFirst,
  togglePinnedWorkspaceId,
} from "@/lib/dashboard-workspace-pins";
import {
  dashboardHasNoWorkspaces,
  isDashboardWorkspaceListFilter,
  isDashboardWorkspaceTypeFilter,
  workspaceMatchesDashboardListFilter,
  workspaceMatchesDashboardTypeFilter,
  type DashboardWorkspaceListFilter,
  type DashboardWorkspaceTypeFilter,
} from "@/lib/dashboard-workspace-filters";

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
    id?: string;
    email?: string;
    plan?: string;
    isAdmin?: boolean;
  } | null>(null);
  /** User-scoped pinned workspace ids (persisted in localStorage). */
  const [pinnedWorkspaceIds, setPinnedWorkspaceIds] = useState<Set<string>>(
    () => new Set(),
  );

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
  /** Filter workspace cards by visibility or AYCL listing: all | public | private | aycl */
  const [workspaceVisibilityFilter, setWorkspaceVisibilityFilter] =
    useState<DashboardWorkspaceListFilter>("all");
  const [workspaceTypeFilter, setWorkspaceTypeFilter] =
    useState<DashboardWorkspaceTypeFilter>("all");
  const [archivingWorkspaceId, setArchivingPlanId] = useState<string | null>(null);
  const [workspacePage, setPlanPage] = useState(1);
  const workspacePageSize = 10;
  /** Images from /api/aesthetics: org custom set, or the system folder listing. */
  const [workspaceCoverPool, setWorkspaceCoverPool] = useState<string[] | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        const images = packages.flatMap((pkg) => pkg.images).filter(Boolean);
        if (images.length > 0) setWorkspaceCoverPool(images);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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

      setUser({ id: authUser.id, email: authUser.email });
      setPinnedWorkspaceIds(loadPinnedWorkspaceIds(authUser.id));

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata, plan, is_admin, subscription_status, current_period_end")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser({
          id: authUser.id,
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
            tapSessionsUsed: usageResult.tapSessionsUsed ?? 0,
            ileSessionsUsed: usageResult.ileSessionsUsed ?? 0,
            apiMeteredInvoice: usageResult.apiMeteredInvoice ?? null,
            xaiUsage: usageResult.xaiUsage ?? null,
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
    if (plan === "api_metered") return "API Metered";
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

  const filteredWorkspaces = useMemo(() => {
    const filtered = workspaces.filter((p) => {
      const matchesSearch =
        workspaceSearch === "" ||
        p.root_topic.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
        (p.title || "").toLowerCase().includes(workspaceSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (!workspaceMatchesDashboardListFilter(p, workspaceVisibilityFilter)) return false;
      return workspaceMatchesDashboardTypeFilter(p, workspaceTypeFilter);
    });
    return sortWorkspacesPinnedFirst(filtered, pinnedWorkspaceIds);
  }, [
    workspaces,
    workspaceSearch,
    workspaceVisibilityFilter,
    workspaceTypeFilter,
    pinnedWorkspaceIds,
  ]);

  const totalPlanPages = Math.ceil(filteredWorkspaces.length / workspacePageSize);
  const paginatedPlans = filteredWorkspaces.slice(
    (workspacePage - 1) * workspacePageSize,
    workspacePage * workspacePageSize
  );

  const handleTogglePin = (workspace: Workspace) => {
    setPinnedWorkspaceIds((prev) => {
      const next = togglePinnedWorkspaceId(prev, workspace.id);
      savePinnedWorkspaceIds(user?.id, next);
      return next;
    });
  };

  const setDashboardTab = (tab: Tab) => {
    setActiveTab(tab);
    router.replace(`/dashboard?tab=${tab}`, { scroll: false });
  };

  if (loading) {
    return (
      <div
        data-console-frame=""
        data-workspace-shell=""
        className="relative flex min-h-screen items-center justify-center overflow-hidden border border-white/40 bg-black bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${DASHBOARD_BACKGROUND})` }}
      >
        <SessionConsoleScan />
        <SessionConsoleMarks />
        <p data-console-frame-label="" className={`absolute left-3 top-3 z-[4] ${CONSOLE_LABEL_CLASS}`}>
          Home
        </p>
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
      className="relative min-h-screen border border-white/40 bg-black bg-cover bg-fixed bg-center text-white"
      style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${DASHBOARD_BACKGROUND})` }}
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <div className="relative z-[2]">
      <Navbar />
      <p data-console-frame-label="" className={`pointer-events-none px-4 pt-2 sm:px-6 ${CONSOLE_LABEL_CLASS}`}>
        Home
      </p>

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

        {/* Plans Tab */}
        {activeTab === "plans" && (
          <DashboardPlansTab
            archivingWorkspaceId={archivingWorkspaceId}
            filteredWorkspaces={filteredWorkspaces}
            formatDate={formatDate}
            handleArchivePlan={handleArchivePlan}
            handleRestorePlan={handleRestorePlan}
            handleTogglePin={handleTogglePin}
            paginatedPlans={paginatedPlans}
            pinnedWorkspaceIds={pinnedWorkspaceIds}
            setPlanPage={setPlanPage}
            setPlanSearch={setPlanSearch}
            setShowArchivedPlans={setShowArchivedPlans}
            setWorkspaceTypeFilter={setWorkspaceTypeFilter}
            setWorkspaceVisibilityFilter={setWorkspaceVisibilityFilter}
            setWorkspaces={setWorkspaces}
            showArchivedWorkspaces={showArchivedWorkspaces}
            t={t}
            totalPlanPages={totalPlanPages}
            workspaceCoverPool={workspaceCoverPool}
            workspacePage={workspacePage}
            workspacePageSize={workspacePageSize}
            workspaceSearch={workspaceSearch}
            workspaceTypeFilter={workspaceTypeFilter}
            workspaceVisibilityFilter={workspaceVisibilityFilter}
            workspaces={workspaces}
          />
        )}

        {activeTab === "organization" && <OrganizationDashboardTab />}

        {/* Usage Tab */}
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
  );
}
