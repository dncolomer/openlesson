"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSessions, deleteSession, restartSession, getLearningPlans, type Session, type LearningPlan } from "@/lib/storage";
import { DEFAULT_PROMPTS, PROMPT_META, type PromptKey, type UserPrompts } from "@/lib/prompts";
import { buildContributionDays, contributionLevel, contributionMonthLabels, dateKey, groupContributionWeeks } from "@/lib/contributions";

import { useI18n } from "@/lib/i18n";
import { formatPlanMonthlyPrice, hasAgentApiKeyPlan, type PlanId } from "@/lib/plans";
import { InsightsDashboardTab } from "@/components/InsightsDashboardTab";
import {
  buildMcpClientConfig,
  buildMcpEndpointUrl,
  MCP_EVIDENCE_TOOL_CATALOG,
} from "@/lib/agent-v2/mcp-evidence-catalog";

const DASHBOARD_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";
const PROFILE_BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

type Tab = "overview" | "sessions" | "plans" | "usage" | "insights" | "config";

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
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "plans";
  const [activeTab, setActiveTab] = useState<Tab>(
    ["plans", "usage", "insights"].includes(initialTab) ? initialTab : "plans"
  );
  const learningMapScrollRef = useRef<HTMLDivElement>(null);

  // User state
  const [user, setUser] = useState<{
    email?: string;
    username?: string;
    plan?: string;
    isAdmin?: boolean;
    extraLessons?: number;
    displayName?: string;
    bio?: string;
    profileVisibility?: "public" | "private";
    publicActivityEnabled?: boolean;
    publicStatsEnabled?: boolean;
    publicSessionTitlesEnabled?: boolean;
  } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Usage tab
  const [usageData, setUsageData] = useState<{
    plan: string;
    used: number;
    personalUsed: number;
    limit: number | null;
    extraLessons: number;
    periodEnd: string | null;
    subscriptionStatus: string;
    organization: OrgUsageSummary | null;
    isAdmin: boolean;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Sessions tab
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<Set<string>>(new Set(["active", "paused"]));
  const [sessionPage, setSessionPage] = useState(1);
  const sessionPageSize = 10;

  // Plans tab
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);
  const [planSearch, setPlanSearch] = useState("");
  const [showArchivedPlans, setShowArchivedPlans] = useState(false);
  const [archivingPlanId, setArchivingPlanId] = useState<string | null>(null);
  const [planPage, setPlanPage] = useState(1);
  const planPageSize = 10;

  // Agentic tab
  const [apiKeys, setApiKeys] = useState<AgentApiKey[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [mcpCopiedField, setMcpCopiedField] = useState<string | null>(null);

  // Config tab
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [tutorModel, setTutorModel] = useState<string>("grok-4.3");
  const [askModel, setAskModel] = useState<string>("grok-4.3");
  const [plannerModel, setPlannerModel] = useState<string>("grok-4.3");
  const [coderModel, setCoderModel] = useState<string>("grok-4.3");
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
  }, [planSearch]);

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
        .select("username, display_name, bio, profile_visibility, public_activity_enabled, public_stats_enabled, public_session_titles_enabled, metadata, plan, is_admin, extra_lessons, subscription_status, current_period_end")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser({
          email: authUser.email,
          username: profile.username || undefined,
          plan: profile.plan || "free",
          isAdmin: profile.is_admin || false,
          extraLessons: profile.extra_lessons || 0,
          displayName: profile.display_name || "",
          bio: profile.bio || "",
          profileVisibility: profile.profile_visibility || "private",
          publicActivityEnabled: !!profile.public_activity_enabled,
          publicStatsEnabled: !!profile.public_stats_enabled,
          publicSessionTitlesEnabled: !!profile.public_session_titles_enabled,
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
        const plans = await getLearningPlans({ includeArchived: false });
        setLearningPlans(plans);

        // Load usage data
        try {
          const usageRes = await fetch("/api/check-usage");
          if (!usageRes.ok) {
            throw new Error(`HTTP ${usageRes.status}`);
          }
          const usageResult = await usageRes.json();
          setUsageData({
            plan: usageResult.plan || profile?.plan || "free",
            used: usageResult.used ?? 0,
            personalUsed: usageResult.personalUsed ?? usageResult.used ?? 0,
            limit: usageResult.isAdmin ? null : (usageResult.limit ?? null),
            extraLessons: profile?.extra_lessons ?? 0,
            periodEnd: profile?.current_period_end ?? null,
            subscriptionStatus: profile?.subscription_status ?? "inactive",
            organization: usageResult.organization ?? null,
            isAdmin: usageResult.isAdmin === true || profile?.is_admin === true,
          });
        } catch (err) {
          console.error("Failed to load usage data:", err);
        }

      // Load Agentic API keys (v2 for Teams, legacy for Pro)
      const plan = profile?.plan || "free";
      const useV2Keys = profile?.is_admin || plan === "pro_teams";
      try {
        const keysEndpoint = useV2Keys ? "/api/v2/agent/keys" : "/api/agent/keys";
        const keysRes = await fetch(keysEndpoint);
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

  const usesAgenticV2Keys = user?.plan === "pro_teams" || user?.isAdmin;

  const mcpOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://openlesson.academy";

  const mcpEndpointUrl = useMemo(() => {
    if (newKeyValue) {
      return buildMcpEndpointUrl(mcpOrigin, newKeyValue);
    }
    return buildMcpEndpointUrl(mcpOrigin);
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
    if (!hasAgentApiKeyPlan(user?.plan) && !user?.isAdmin) {
      alert(t('dashboard.apiKeysProOnly'));
      return;
    }
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const endpoint = usesAgenticV2Keys ? "/api/v2/agent/keys" : "/api/agent/keys";
      const res = await fetch(endpoint, {
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
      const endpoint = usesAgenticV2Keys ? `/api/v2/agent/keys/${id}` : `/api/agent/keys/${id}`;
      await fetch(endpoint, { method: "DELETE" });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const publicProfileUrl = user?.username && typeof window !== "undefined" ? `${window.location.origin}/u/${user.username}` : "";

  const usageCardClass = "rounded-md border border-neutral-800 bg-neutral-950/75 p-5 sm:p-6";
  const usageLabelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";

  function planDisplayName(plan: string, isAdmin?: boolean) {
    if (isAdmin) return "Platform admin";
    if (plan === "pro_teams") return "Pro / Teams";
    if (plan === "regular_2026") return "Regular";
    if (plan === "pro") return "Pro";
    if (plan === "regular") return "Regular";
    if (plan === "free") return "Free";
    return plan;
  }

  function planPriceLabel(plan: string, isAdmin?: boolean) {
    if (isAdmin) return "Unlimited platform access";
    if (plan === "pro") return t("dashboard.pricePro");
    if (plan === "regular") return t("dashboard.priceRegular");
    if (plan === "free") return t("dashboard.priceFree");
    return formatPlanMonthlyPrice(plan as PlanId);
  }

  function usageProgress(used: number, limit: number | null) {
    if (limit === null || limit <= 0) return 0;
    return Math.min((used / limit) * 100, 100);
  }

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: user.username?.trim() || null,
          display_name: user.displayName?.trim() || null,
          bio: user.bio?.trim() || null,
          profile_visibility: user.profileVisibility || "private",
          public_activity_enabled: !!user.publicActivityEnabled,
          public_stats_enabled: !!user.publicStatsEnabled,
          public_session_titles_enabled: !!user.publicSessionTitlesEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      alert(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

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

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const totalLearningMinutes = Math.round(sessions.reduce((sum, session) => sum + (session.durationMs || 0), 0) / 60000);
  const publicPlans = learningPlans.filter((plan) => (plan as any).is_public);
  const minutesByDate = sessions.reduce((days, session) => {
    const day = dateKey(new Date(session.startedAt));
    days.set(day, (days.get(day) || 0) + Math.round((session.durationMs || 0) / 60000));
    return days;
  }, new Map<string, number>());
  const contributionDays = buildContributionDays(
    Array.from(minutesByDate.entries()).map(([date, minutes]) => ({ date, minutes }))
  );
  const contributionWeeks = groupContributionWeeks(contributionDays);
  const contributionMonths = contributionMonthLabels(contributionWeeks);

  useEffect(() => {
    if (activeTab !== "overview") return;
    const scroller = learningMapScrollRef.current;
    if (!scroller) return;
    scroller.scrollLeft = scroller.scrollWidth;
  }, [activeTab, contributionWeeks.length]);

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
  const reloadLearningPlans = async (includeArchived = showArchivedPlans) => {
    const plans = await getLearningPlans({ includeArchived });
    setLearningPlans(plans);
  };

  useEffect(() => {
    if (activeTab !== "plans") return;
    void reloadLearningPlans(showArchivedPlans);
  }, [showArchivedPlans, activeTab]);

  const handleArchivePlan = async (planId: string) => {
    if (!confirm("Archive this workspace? It will be hidden from your dashboard but preserved for audit.")) {
      return;
    }
    setArchivingPlanId(planId);
    try {
      const res = await fetch(`/api/learning-plans/${planId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive workspace");
      setLearningPlans((plans) => plans.filter((plan) => plan.id !== planId));
    } catch (err) {
      console.error("Archive workspace error:", err);
      alert(err instanceof Error ? err.message : "Failed to archive workspace");
    } finally {
      setArchivingPlanId(null);
    }
  };

  const handleRestorePlan = async (planId: string) => {
    setArchivingPlanId(planId);
    try {
      const res = await fetch(`/api/learning-plans/${planId}/archive`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore workspace");
      await reloadLearningPlans(showArchivedPlans);
    } catch (err) {
      console.error("Restore workspace error:", err);
      alert(err instanceof Error ? err.message : "Failed to restore workspace");
    } finally {
      setArchivingPlanId(null);
    }
  };

  const filteredPlans = learningPlans.filter((p) => {
    const matchesSearch = planSearch === "" || 
      p.root_topic.toLowerCase().includes(planSearch.toLowerCase()) ||
      (p.title || "").toLowerCase().includes(planSearch.toLowerCase());
    return matchesSearch;
  });

  const totalPlanPages = Math.ceil(filteredPlans.length / planPageSize);
  const paginatedPlans = filteredPlans.slice(
    (planPage - 1) * planPageSize,
    planPage * planPageSize
  );

  const planTitlesById = useMemo(
    () =>
      learningPlans.reduce<Record<string, string>>((titles, plan) => {
        titles[plan.id] = plan.title || plan.root_topic;
        return titles;
      }, {}),
    [learningPlans]
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
        <div className="text-neutral-400">{t('common.loading')}</div>
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
        <div className="max-w-7xl mx-auto flex gap-1 px-4 sm:px-6 lg:px-8">
          {[
            { id: "plans", label: "Workspaces" },
            { id: "insights", label: "Insights" },
            { id: "usage", label: t("dashboard.usageApiMcpTab") },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDashboardTab(tab.id as Tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
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

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden p-4 py-8 sm:px-6 lg:px-8">
        {/* Profile Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
              <div
                className="relative overflow-hidden bg-cover bg-center p-6 sm:p-8"
                style={{ backgroundImage: `url(${PROFILE_BACKGROUND_IMAGES[(user?.username || user?.email || "openlesson").length % PROFILE_BACKGROUND_IMAGES.length]})` }}
              >
                <div className="absolute inset-0 bg-black/65 grayscale backdrop-blur-[1px]" />
                <div className="absolute inset-0 bg-black/35" />
                <div className="relative z-10">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 via-sky-500 to-violet-500 text-3xl font-bold">
                      {(user?.username || user?.email || "u").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight">{user?.displayName || user?.username || "Your learning profile"}</h1>
                      <p className="mt-1 text-sm text-neutral-400">{user?.username ? `@${user.username}` : "Choose a username to publish your profile"}</p>
                      <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs ${user?.profileVisibility === "public" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-neutral-700 bg-neutral-900 text-neutral-400"}`}>
                        {user?.profileVisibility === "public" ? "Public profile" : "Private profile"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user?.username && user.profileVisibility === "public" && (
                      <Link href={`/u/${user.username}`} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-900">
                        View public profile
                      </Link>
                    )}
                    {publicProfileUrl && user?.profileVisibility === "public" && (
                      <button
                        onClick={() => navigator.clipboard.writeText(publicProfileUrl)}
                        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
                      >
                        Copy share link
                      </button>
                    )}
                  </div>
                </div>
                </div>
              </div>
              <div className="grid gap-px bg-neutral-800 sm:grid-cols-4">
                {[
                  ["Blocks", sessions.length],
                  ["Completed", completedSessions.length],
                  ["Public workspaces", publicPlans.length],
                  ["Minutes", totalLearningMinutes],
                ].map(([label, value]) => (
                  <div key={label} className="bg-neutral-950 p-5">
                    <div className="text-2xl font-semibold">{value}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 rounded-md border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-semibold">Learning Map</h2>
                  <span className="text-xs text-neutral-500">{totalLearningMinutes} minutes in the last year</span>
                </div>
                <div ref={learningMapScrollRef} className="mt-5 max-w-full overflow-x-auto pb-2">
                  <div className="w-max min-w-full">
                    <div className="mb-2 ml-9 grid text-[11px] text-neutral-500" style={{ gridTemplateColumns: `repeat(${contributionWeeks.length}, 13px)`, columnGap: "4px" }}>
                      {contributionMonths.map((month) => <span key={month.index}>{month.label}</span>)}
                    </div>
                    <div className="flex gap-2">
                      <div className="grid grid-rows-7 gap-1 pt-[16px] text-[11px] text-neutral-500">
                        <span />
                        <span>Mon</span>
                        <span />
                        <span>Wed</span>
                        <span />
                        <span>Fri</span>
                        <span />
                      </div>
                      <div className="grid grid-flow-col grid-rows-7 gap-1">
                        {contributionWeeks.flatMap((week, weekIndex) =>
                          Array.from({ length: 7 }, (_, dayIndex) => {
                            const day = week[dayIndex] || null;
                            const level = contributionLevel(day?.minutes || 0);
                            return (
                              <div
                                key={`${weekIndex}-${dayIndex}`}
                                title={day ? `${day.minutes} minutes on ${formatDate(day.date)}` : ""}
                                className={[
                                  "h-[13px] w-[13px] rounded-[3px] border",
                                  level === 0 ? "border-neutral-800 bg-neutral-900" : "border-emerald-400/20",
                                  level === 1 ? "bg-emerald-950" : "",
                                  level === 2 ? "bg-emerald-800" : "",
                                  level === 3 ? "bg-emerald-500" : "",
                                  level === 4 ? "bg-emerald-300" : "",
                                ].join(" ")}
                              />
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1 text-xs text-neutral-500">
                      <span>Less</span>
                      {[0, 1, 2, 3, 4].map((level) => (
                        <span key={level} className={["h-[13px] w-[13px] rounded-[3px] border", level === 0 ? "border-neutral-800 bg-neutral-900" : "border-emerald-400/20", level === 1 ? "bg-emerald-950" : "", level === 2 ? "bg-emerald-800" : "", level === 3 ? "bg-emerald-500" : "", level === 4 ? "bg-emerald-300" : ""].join(" ")} />
                      ))}
                      <span>More</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 rounded-md border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
                <h2 className="font-semibold">Recent Activity</h2>
                <div className="mt-5 space-y-4">
                  {[...sessions.slice(0, 3), ...learningPlans.slice(0, 3)]
                    .sort((a: any, b: any) => new Date((b.startedAt || b.created_at) as string).getTime() - new Date((a.startedAt || a.created_at) as string).getTime())
                    .slice(0, 5)
                    .map((item: any) => (
                      <div key={item.id} className="flex min-w-0 gap-3">
                        <div className="mt-1 h-3 w-3 shrink-0 rounded-full border border-emerald-400 bg-emerald-400/30" />
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words text-sm text-neutral-200 sm:line-clamp-1">{item.problem || item.title || item.root_topic}</p>
                          <p className="mt-1 text-xs text-neutral-500">{formatDate(item.startedAt || item.created_at)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-800 bg-neutral-950 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Profile Settings</h2>
                  <p className="mt-1 text-sm text-neutral-500">Control your username, public profile, and what learning activity can be shared.</p>
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {profileSaving ? "Saving..." : profileSaved ? "Saved" : "Save"}
                </button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-neutral-300">Username</span>
                  <input value={user?.username || ""} onChange={(e) => setUser((prev) => prev ? { ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") } : prev)} className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600" placeholder="username" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-neutral-300">Display name</span>
                  <input value={user?.displayName || ""} onChange={(e) => setUser((prev) => prev ? { ...prev, displayName: e.target.value } : prev)} className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600" placeholder="Your name" />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm text-neutral-300">Bio</span>
                  <textarea value={user?.bio || ""} onChange={(e) => setUser((prev) => prev ? { ...prev, bio: e.target.value } : prev)} rows={3} className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600" placeholder="What are you learning?" />
                </label>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Make profile public", "profileVisibility"],
                  ["Show activity timeline", "publicActivityEnabled"],
                  ["Show aggregate stats", "publicStatsEnabled"],
                  ["Show completed block titles", "publicSessionTitlesEnabled"],
                ].map(([label, key]) => (
                  <label key={key} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={key === "profileVisibility" ? user?.profileVisibility === "public" : !!(user as any)?.[key]}
                      onChange={(e) => setUser((prev) => prev ? { ...prev, [key]: key === "profileVisibility" ? (e.target.checked ? "public" : "private") : e.target.checked } : prev)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}

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
                    href={isCompleted ? `/results?id=${session.id}` : `/session?id=${session.id}`}
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
                          {session.planTitle && (
                            <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] bg-purple-900/30 text-purple-400">
                              {session.planTitle}
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
                    Start with curiosity. Leave with a workspace.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
                    Turn any topic, repo, video, file, or hard question into a guided path toward your next aha moment.
                  </p>
                  <div className="mt-5 max-w-xl rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
                    <div className="font-mono text-[10px] uppercase tracking-[2px] text-white/70">Rabbit Hole</div>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="leading-relaxed text-neutral-400">Warm up with one question before building a full workspace.</p>
                      <Link href="/rabbit-hole" className="inline-flex h-9 shrink-0 items-center justify-center rounded-sm bg-white px-4 text-xs font-medium text-black transition hover:bg-neutral-200">Try it →</Link>
                    </div>
                  </div>
                </div>
                <Link
                  href="/"
                  className="inline-flex h-12 items-center justify-center rounded-sm bg-white px-6 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  Create a New Workspace →
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{t('dashboard.allPlans')}</h3>
              <label className="flex items-center gap-2 text-xs text-neutral-400">
                <input
                  type="checkbox"
                  checked={showArchivedPlans}
                  onChange={(e) => setShowArchivedPlans(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900"
                />
                Show archived
              </label>
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder={t('dashboard.searchPlans')}
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>

            {filteredPlans.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 border border-neutral-800 rounded-lg">
                <p className="text-sm">{t('dashboard.noMatchingPlans')}</p>
                <Link href="/" className="text-blue-400 hover:underline mt-2 inline-block text-sm">
                  {t('dashboard.createYourFirstPlan')}
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="group overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/75 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80"
                  >
                    <Link href={`/workspace/${plan.id}`} className="block">
                      <div className="relative h-36 bg-neutral-900">
                        {plan.cover_image_url ? (
                          <img src={plan.cover_image_url} alt="" className="h-full w-full object-cover opacity-70 grayscale transition group-hover:opacity-85" />
                        ) : (
                          <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_34%),linear-gradient(135deg,#171717,#050505)]" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute left-4 top-4 flex gap-2">
                          <span className="border border-white/10 bg-black/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300 backdrop-blur-sm">
                            {plan.source_type === "youtube" ? "Video" : "Workspace"}
                          </span>
                          {plan.is_group && (
                            <span className="border border-white/10 bg-black/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300 backdrop-blur-sm">
                              Group
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    <div className="p-4">
                      <Link href={`/workspace/${plan.id}`} className="block">
                        <h4 className="line-clamp-2 text-base font-medium leading-snug text-neutral-100 transition group-hover:text-white">
                          {plan.title || plan.root_topic}
                        </h4>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-500">
                          {plan.root_topic !== plan.title && plan.title ? plan.root_topic : plan.source_summary || "A guided path toward your next aha moment."}
                        </p>
                      </Link>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                        <span>{formatDate(plan.created_at)}</span>
                        <span>•</span>
                        <span
                          className={
                            plan.status === "archived"
                              ? "rounded border border-amber-500/30 px-1.5 py-0.5 text-amber-200"
                              : "capitalize"
                          }
                        >
                          {plan.status}
                        </span>
                        {(plan.remix_count ?? 0) > 0 && (
                          <>
                            <span>•</span>
                            <span>{plan.remix_count} remixes</span>
                          </>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-4">
                        <Link href={`/workspace/${plan.id}`} className="text-sm font-medium text-neutral-200 hover:text-white">
                          Open workspace →
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                      {plan.status === "archived" ? (
                        <button
                          type="button"
                          onClick={() => handleRestorePlan(plan.id)}
                          disabled={archivingPlanId === plan.id}
                          className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
                        >
                          {archivingPlanId === plan.id ? "Restoring…" : "Restore"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArchivePlan(plan.id)}
                          disabled={archivingPlanId === plan.id}
                          className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 transition hover:border-amber-500/40 hover:text-amber-200 disabled:opacity-50"
                        >
                          {archivingPlanId === plan.id ? "Archiving…" : "Archive"}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            const isPublic = (plan as any).is_public ?? false;
                            const res = await fetch(`/api/learning-plans/${plan.id}/visibility`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ is_public: !isPublic }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setLearningPlans((plans) =>
                                plans.map((p) =>
                                  p.id === plan.id ? { ...p, is_public: !isPublic } : p
                                )
                              );
                            }
                          } catch (err) {
                            console.error("Error toggling visibility:", err);
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          (plan as any).is_public
                            ? "bg-green-900/30 border-green-800 text-green-400 hover:bg-green-900/50"
                            : "bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-400"
                        }`}
                      >
                        {(plan as any).is_public ? t('dashboard.public') : t('dashboard.private')}
                      </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPlanPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                <p className="text-xs text-neutral-500">
                  {t('dashboard.showingResults', { start: String((planPage - 1) * planPageSize + 1), end: String(Math.min(planPage * planPageSize, filteredPlans.length)), total: String(filteredPlans.length) })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                    disabled={planPage === 1}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.previous')}
                  </button>
                  <button
                    onClick={() => setPlanPage((p) => Math.min(totalPlanPages, p + 1))}
                    disabled={planPage === totalPlanPages}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "insights" && <InsightsDashboardTab planTitles={planTitlesById} />}

        {/* Usage & API Tab */}
        {activeTab === "usage" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-neutral-800 bg-neutral-950/75 px-6 py-5">
              <div>
                <p className={usageLabelClass}>Account</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">{t("dashboard.yourSubscription")}</h2>
                <p className="mt-1 text-sm text-neutral-500">{t("dashboard.usageApiMcpSubtitle")}</p>
              </div>
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
              >
                View pricing →
              </Link>
            </div>
            {loadingUsage ? (
              <div className="text-center py-12 text-neutral-400">{t("common.loading")}</div>
            ) : usageData ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={usageCardClass}>
                    <div className="flex items-center justify-between gap-3">
                      <p className={usageLabelClass}>{t("dashboard.currentPlan")}</p>
                      {usageData.isAdmin ? (
                        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-200">
                          Admin
                        </span>
                      ) : usageData.plan === "pro_teams" ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                          Teams
                        </span>
                      ) : usageData.plan === "pro" ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                          {t("dashboard.pro")}
                        </span>
                      ) : usageData.plan === "regular" || usageData.plan === "regular_2026" ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                          {t("dashboard.regular")}
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                          {t("dashboard.free")}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 text-3xl font-medium tracking-[-1px] text-white">
                      {planDisplayName(usageData.plan, usageData.isAdmin)}
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">{planPriceLabel(usageData.plan, usageData.isAdmin)}</p>
                    {!usageData.isAdmin && usageData.subscriptionStatus !== "active" && usageData.plan !== "free" && (
                      <p className="mt-3 text-xs text-neutral-600">{t("dashboard.subscriptionNotActive")}</p>
                    )}
                  </div>

                  <div className={usageCardClass}>
                    <p className={usageLabelClass}>
                      {usageData.organization ? "Your blocks this period" : t("dashboard.sessionsThisPeriod")}
                    </p>
                    {(() => {
                      const displayUsed = usageData.organization ? usageData.personalUsed : usageData.used;
                      const displayLimit = usageData.isAdmin || usageData.limit === null ? null : usageData.organization ? null : usageData.limit;
                      return (
                        <>
                          <div className="mt-4 flex items-end gap-2">
                            <span className="text-3xl font-medium tracking-[-1px] text-white">{displayUsed}</span>
                            <span className="mb-1 text-sm text-neutral-500">
                              / {displayLimit === null ? t("dashboard.infinity") : displayLimit}
                            </span>
                          </div>
                          {displayLimit !== null && (
                            <div className="mt-4 h-1.5 w-full rounded-full bg-neutral-800">
                              <div
                                className={`h-1.5 rounded-full ${
                                  displayUsed >= displayLimit
                                    ? "bg-red-400"
                                    : displayUsed >= displayLimit * 0.8
                                    ? "bg-amber-400"
                                    : "bg-white"
                                }`}
                                style={{ width: `${usageProgress(displayUsed, displayLimit)}%` }}
                              />
                            </div>
                          )}
                          <p className="mt-3 text-xs text-neutral-500">
                            {usageData.isAdmin
                              ? "Unlimited blocks — admin access bypasses plan limits."
                              : usageData.organization
                              ? "Your personal contribution to the organization pool."
                              : displayLimit === null
                              ? t("dashboard.unlimitedSessions")
                              : t("dashboard.sessionsRemaining", { count: Math.max(displayLimit - displayUsed, 0) })}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  <div className={usageCardClass}>
                    <p className={usageLabelClass}>{t("dashboard.extraLessons")}</p>
                    <div className="mt-4 text-3xl font-medium tracking-[-1px] text-white">{usageData.extraLessons}</div>
                    <p className="mt-2 text-sm text-neutral-500">
                      {usageData.isAdmin || usageData.limit === null
                        ? "Extra blocks are optional when your plan is already unlimited."
                        : t("dashboard.purchasedCredits")}
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-4 inline-flex text-sm text-neutral-300 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
                    >
                      Buy more on pricing →
                    </Link>
                  </div>

                  <div className={usageCardClass}>
                    <p className={usageLabelClass}>{t("dashboard.billingPeriod")}</p>
                    {usageData.isAdmin ? (
                      <>
                        <div className="mt-4 text-lg font-medium text-white">No billing limits</div>
                        <p className="mt-2 text-sm text-neutral-500">Admin accounts are not metered against plan quotas.</p>
                      </>
                    ) : usageData.subscriptionStatus === "active" && usageData.periodEnd ? (
                      <>
                        <div className="mt-4 text-lg font-medium text-white">
                          {t("dashboard.resetsOn", {
                            date: new Date(usageData.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                          })}
                        </div>
                        <p className="mt-2 text-sm text-neutral-500">
                          {usageData.plan === "pro"
                            ? t("dashboard.unlimitedContinue")
                            : usageData.plan === "pro_teams"
                            ? "Organization block pool resets each billing period."
                            : t("dashboard.regularResetDesc")}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mt-4 text-lg font-medium text-white">
                          {usageData.plan === "free" ? t("dashboard.noSubscription") : t("dashboard.inactive")}
                        </div>
                        <p className="mt-2 text-sm text-neutral-500">
                          {usageData.plan === "free" ? t("dashboard.freeSessionAvailable") : t("dashboard.subscriptionNotActive")}
                        </p>
                      </>
                    )}
                    {!usageData.isAdmin && (usageData.plan === "free" || usageData.plan === "regular" || usageData.plan === "regular_2026") && (
                      <Link
                        href="/pricing"
                        className="mt-4 inline-flex text-sm text-neutral-300 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
                      >
                        {t("dashboard.upgradeToPro")} →
                      </Link>
                    )}
                  </div>
                </div>

                {usageData.organization && (
                  <div className={`${usageCardClass} border-white/10`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className={usageLabelClass}>Organization pool</p>
                        <h3 className="mt-2 text-xl font-medium text-white">{usageData.organization.name}</h3>
                        <p className="mt-2 text-xs text-neutral-500">
                          {usageData.organization.memberCount} members · {usageData.organization.guestCount} guests
                          {usageData.organization.isOrgAdmin ? " · Org admin" : " · Member"}
                        </p>
                      </div>
                      {usageData.organization.isOrgAdmin && (
                        <Link
                          href="/organization"
                          className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                        >
                          Manage organization →
                        </Link>
                      )}
                    </div>
                    <div className="mt-5 flex items-end gap-2">
                      <span className="text-3xl font-medium tracking-[-1px] text-white">{usageData.organization.used}</span>
                      <span className="mb-1 text-sm text-neutral-500">
                        / {usageData.organization.limit === null ? t("dashboard.infinity") : usageData.organization.limit} blocks this period
                      </span>
                    </div>
                    {usageData.organization.limit !== null && (
                      <div className="mt-4 h-1.5 w-full rounded-full bg-neutral-800">
                        <div
                          className={`h-1.5 rounded-full ${
                            usageData.organization.used >= usageData.organization.limit
                              ? "bg-red-400"
                              : usageData.organization.used >= usageData.organization.limit * 0.8
                              ? "bg-amber-400"
                              : "bg-white"
                          }`}
                          style={{ width: `${usageProgress(usageData.organization.used, usageData.organization.limit)}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-3 text-xs text-neutral-500">
                      Teams plans share one monthly block pool across all organization members.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-neutral-400">{t("dashboard.unableToLoadUsage")}</div>
            )}

            {/* Agentic API keys */}
            <div className={`${usageCardClass} space-y-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={usageLabelClass}>Integrations</p>
                  <h2 className="mt-2 text-xl font-medium text-white">Agentic API</h2>
                </div>
                <div className="flex items-center gap-3">
                  {usesAgenticV2Keys && (
                    <Link
                      href="/docs/agentic-v2"
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
                  ? "Create Verification Workspaces, issue GHL links, and read results via the Agentic API v2."
                  : t("dashboard.apiExperimentalDesc")}
              </p>
              {!hasAgentApiKeyPlan(user?.plan) && !user?.isAdmin && (
                <div className="rounded-md border border-neutral-800 bg-black/40 p-4 text-sm text-neutral-400">
                  {user?.plan === "regular" || user?.plan === "regular_2026"
                    ? "Agentic API keys require the Teams tier. "
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
                      <p className="text-xs text-neutral-400">{t("dashboard.mcpNewKeyUrl")}</p>
                      <code className="mt-2 block break-all rounded-md border border-neutral-800 bg-black p-3 font-mono text-[11px] text-neutral-300">
                        POST {mcpEndpointUrl}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyMcpText(mcpEndpointUrl, "mcp-new-key")}
                        className="mt-2 rounded-sm border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                      >
                        {mcpCopiedField === "mcp-new-key"
                          ? t("common.copied")
                          : t("dashboard.mcpCopyEndpoint")}
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

              <p className="text-xs text-neutral-600">Rate limit: 120 requests per minute per key.</p>
            </div>

            {usesAgenticV2Keys && (
              <div className={`${usageCardClass} space-y-5`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={usageLabelClass}>Integrations</p>
                    <h2 className="mt-2 text-xl font-medium text-white">{t("dashboard.mcpTitle")}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/docs/agentic-v2"
                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                      {t("dashboard.mcpDocsLink")} →
                    </Link>
                    <Link
                      href="/skill.md"
                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                      {t("dashboard.mcpSkillLink")} →
                    </Link>
                  </div>
                </div>
                <p className="text-sm text-neutral-500">{t("dashboard.mcpDescription")}</p>
                <p className="text-xs text-neutral-500">{t("dashboard.mcpDualNote")}</p>

                <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-4">
                  <h3 className="text-sm font-medium text-white">{t("dashboard.mcpRestTitle")}</h3>
                  <p className="mt-1 text-xs text-neutral-500">{t("dashboard.mcpRestHint")}</p>
                  <pre className="mt-3 overflow-x-auto rounded-md border border-neutral-800 bg-black/50 p-3 font-mono text-[11px] text-neutral-400">
{`Authorization: Bearer <api_key>
Content-Type: application/json

Base path: /api/v2/agent/...`}
                  </pre>
                </div>

                <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-4">
                  <h3 className="text-sm font-medium text-white">{t("dashboard.mcpEndpointTitle")}</h3>
                  <p className="mt-1 text-xs text-neutral-500">{t("dashboard.mcpEndpointHint")}</p>
                  <code className="mt-3 block overflow-x-auto rounded border border-neutral-800 bg-black/50 px-2 py-2 font-mono text-[11px] text-neutral-300">
                    POST {buildMcpEndpointUrl(mcpOrigin)}
                  </code>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void copyMcpText(buildMcpEndpointUrl(mcpOrigin), "mcp-endpoint")
                      }
                      className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                      {mcpCopiedField === "mcp-endpoint"
                        ? t("common.copied")
                        : t("dashboard.mcpCopyEndpoint")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void copyMcpText(buildMcpClientConfig(mcpOrigin), "mcp-config")
                      }
                      className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                      {mcpCopiedField === "mcp-config"
                        ? t("common.copied")
                        : t("dashboard.mcpCopyConfig")}
                    </button>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-neutral-300">{t("dashboard.mcpWorkflowTitle")}</p>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md border border-neutral-800 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-neutral-400">
                      {t("dashboard.mcpWorkflowSteps")}
                    </pre>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-neutral-300">{t("dashboard.mcpToolsTitle")}</p>
                    <ul className="mt-2 space-y-1.5">
                      {MCP_EVIDENCE_TOOL_CATALOG.map((tool) => (
                        <li
                          key={tool.name}
                          className="rounded-md border border-neutral-800/70 bg-black/30 px-3 py-2 text-xs text-neutral-400"
                        >
                          <span className="font-mono text-neutral-200">{tool.name}</span>
                          <span className="ml-2 rounded bg-neutral-800 px-1 py-0.5 font-mono text-[10px] text-neutral-500">
                            {tool.scope}
                          </span>
                          <p className="mt-1 text-neutral-500">{tool.summary}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-neutral-500">{t("dashboard.mcpScopeNote")}</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-neutral-300">{t("dashboard.mcpResourcesTitle")}</p>
                    <p className="mt-1 text-xs text-neutral-500">{t("dashboard.mcpResourcesHint")}</p>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-neutral-400">
                      <li>openlesson://integration-scope</li>
                      <li>openlesson://evidence-loop</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
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
                      Grok 4.3 <span className="text-neutral-500">(grok-4.3)</span>
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
