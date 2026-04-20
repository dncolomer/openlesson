"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSessions, deleteSession, restartSession, getLearningPlans, type Session, type LearningPlan } from "@/lib/storage";
import { DEFAULT_PROMPTS, PROMPT_META, type PromptKey, type UserPrompts } from "@/lib/openrouter";

import { useI18n } from "@/lib/i18n";

type Tab = "sessions" | "plans" | "usage" | "config";

interface OpenRouterModel {
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
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "sessions";
  const [activeTab, setActiveTab] = useState<Tab>(
    ["sessions", "plans", "usage", "config"].includes(initialTab) ? initialTab : "sessions"
  );

  // User state
  const [user, setUser] = useState<{
    email?: string;
    username?: string;
    plan?: string;
    isAdmin?: boolean;
    extraLessons?: number;
  } | null>(null);

  // Usage tab
  const [usageData, setUsageData] = useState<{
    plan: string;
    used: number;
    limit: number | null;
    extraLessons: number;
    periodEnd: string | null;
    subscriptionStatus: string;
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
  const [planPage, setPlanPage] = useState(1);
  const planPageSize = 10;

  // Agentic tab
  const [apiKeys, setApiKeys] = useState<AgentApiKey[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);

  // Config tab
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
  const [tutorModel, setTutorModel] = useState<string>("x-ai/grok-4");
  const [askModel, setAskModel] = useState<string>("x-ai/grok-4");
  const [plannerModel, setPlannerModel] = useState<string>("x-ai/grok-4");
  const [coderModel, setCoderModel] = useState<string>("x-ai/grok-4");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);

  // AI Provider info
  const [providerInfo, setProviderInfo] = useState<{
    provider: string;
    label: string;
    defaultModel: string;
    chatUrl: string;
    hasXAIKey: boolean;
    hasOpenRouterKey: boolean;
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
        .select("username, metadata, plan, is_admin, extra_lessons, subscription_status, current_period_end")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser({
          email: authUser.email,
          username: profile.username || undefined,
          plan: profile.plan || "free",
          isAdmin: profile.is_admin || false,
          extraLessons: profile.extra_lessons || 0,
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

        // Load learning plans
        const plans = await getLearningPlans();
        setLearningPlans(plans);

        // Load usage data
        try {
          const usageRes = await fetch("/api/check-usage");
          if (!usageRes.ok) {
            throw new Error(`HTTP ${usageRes.status}`);
          }
          const usageResult = await usageRes.json();
          setUsageData({
            plan: usageResult.plan || "free",
            used: usageResult.used || 0,
            limit: usageResult.limit ?? null,
            extraLessons: profile?.extra_lessons ?? 0,
            periodEnd: profile?.current_period_end ?? null,
            subscriptionStatus: profile?.subscription_status ?? "inactive",
          });
        } catch (err) {
          console.error("Failed to load usage data:", err);
        }

      // Load API keys
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: keys } = await supabase
        .from("agent_api_keys")
        .select(`
          id,
          key_prefix,
          label,
          rate_limit,
          is_active,
          created_at,
          last_used_at
        `)
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });

      if (keys) {
        const keysWithUsage = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          keys.map(async (key: any) => {
            const { count } = await supabase
              .from("sessions")
              .select("*", { count: "exact", head: true })
              .eq("agent_api_key_id", key.id);

            return {
              ...key,
              usage_count: count || 0,
            } as AgentApiKey;
          })
        );
        setApiKeys(keysWithUsage);
      }

      // Load available models
      try {
        const modelsRes = await fetch("/api/openrouter/models");
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

  const handleCreateApiKey = async () => {
    // Check if user is Pro or admin
    if (user?.plan !== "pro" && !user?.isAdmin) {
      alert(t('dashboard.apiKeysProOnly'));
      return;
    }
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/agent/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newKeyName.trim() }),
      });
      const data = await res.json();
      if (data.key) {
        setApiKeys((prev) => [
          {
            id: data.key.id,
            key_prefix: data.key.key_prefix,
            label: data.key.label,
            rate_limit: data.key.rate_limit,
            is_active: data.key.is_active,
            created_at: data.key.created_at,
            last_used_at: null,
            usage_count: 0,
          },
          ...prev,
        ]);
        setNewKeyValue(data.key.key);
        setTimeout(() => setNewKeyValue(null), 30000);
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
      await fetch(`/api/agent/keys/${id}`, { method: "DELETE" });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error("Failed to delete key:", err);
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
  const filteredPlans = learningPlans.filter((p) => {
    const matchesSearch = planSearch === "" || 
      p.root_topic.toLowerCase().includes(planSearch.toLowerCase());
    return matchesSearch;
  });

  const totalPlanPages = Math.ceil(filteredPlans.length / planPageSize);
  const paginatedPlans = filteredPlans.slice(
    (planPage - 1) * planPageSize,
    planPage * planPageSize
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      {/* Tabs */}
      <div className="border-b border-neutral-800/60">
        <div className="max-w-5xl mx-auto flex gap-1 px-4 sm:px-6">
          {[
            { id: "sessions", label: t('dashboard.sessions') },
            { id: "plans", label: t('dashboard.plans') },
            { id: "usage", label: t('dashboard.usage') },
            ...(user?.isAdmin ? [{ id: "config", label: t('dashboard.config') }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
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
      <main className="max-w-5xl mx-auto p-4 sm:px-6 py-8">
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
                                : session.status === "paused"
                                ? "bg-yellow-900/30 text-yellow-400"
                                : "bg-neutral-700 text-neutral-400"
                            }`}
                          >
                            {session.status === "active" ? t('dashboard.active') : session.status === "paused" ? t('dashboard.paused') : t('dashboard.completed')}
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('dashboard.allPlans')}</h2>
              <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                {t('dashboard.createNewPlan')}
              </Link>
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
              <div className="space-y-2">
                {paginatedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/30 transition-colors"
                  >
                    <Link href={`/plan/${plan.id}`} className="flex-1">
                      <p className="text-sm font-medium text-neutral-200">{plan.title || plan.root_topic}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {plan.root_topic !== plan.title && plan.title ? `${plan.root_topic} · ` : ""}{t('dashboard.createdOn', { date: formatDate(plan.created_at) })}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2">
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

        {/* Usage Tab */}
        {activeTab === "usage" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('dashboard.yourSubscription')}</h2>
              <Link href="/pricing" className="text-sm text-emerald-400 hover:text-emerald-300">
                {t('dashboard.viewAllPlans')}
              </Link>
            </div>
            {loadingUsage ? (
              <div className="text-center py-12 text-neutral-400">{t('common.loading')}</div>
            ) : usageData ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-neutral-400">{t('dashboard.currentPlan')}</div>
                    {usageData.plan === "pro" && (
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">{t('dashboard.pro')}</span>
                    )}
                    {usageData.plan === "regular" && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">{t('dashboard.regular')}</span>
                    )}
                    {usageData.plan === "free" && (
                      <span className="px-2 py-1 bg-neutral-700 text-neutral-300 text-xs rounded-full">{t('dashboard.free')}</span>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-white mb-1 capitalize">{usageData.plan}</div>
                  <div className="text-sm text-neutral-500">
                    {usageData.plan === "pro" ? t('dashboard.pricePro') : usageData.plan === "regular" ? t('dashboard.priceRegular') : t('dashboard.priceFree')}
                  </div>
                </div>

                <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                  <div className="text-sm text-neutral-400 mb-4">{t('dashboard.sessionsThisPeriod')}</div>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-3xl font-bold text-white">{usageData.used}</span>
                    <span className="text-sm text-neutral-500 mb-1">/ {usageData.limit === null ? t('dashboard.infinity') : usageData.limit}</span>
                  </div>
                  {usageData.limit !== null && (
                    <div className="w-full bg-neutral-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          usageData.used >= usageData.limit
                            ? "bg-red-500"
                            : usageData.used >= usageData.limit * 0.8
                            ? "bg-yellow-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min((usageData.used / usageData.limit) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="mt-3 text-xs text-neutral-500">
                    {usageData.limit === null
                      ? t('dashboard.unlimitedSessions')
                      : t('dashboard.sessionsRemaining', { count: usageData.limit - usageData.used })}
                  </div>
                </div>

                <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                  <div className="text-sm text-neutral-400 mb-4">{t('dashboard.extraLessons')}</div>
                  <div className="text-3xl font-bold text-white mb-1">{usageData.extraLessons}</div>
                  <div className="text-sm text-neutral-500 mb-4">{t('dashboard.purchasedCredits')}</div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/stripe/create-checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ priceType: "extra_lesson" }),
                        });
                        const data = await res.json();
                        if (data.url) {
                          window.location.href = data.url;
                        }
                      } catch (err) {
                        console.error("Failed to create checkout:", err);
                      }
                    }}
                    className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors text-sm font-medium"
                  >
                    {t('dashboard.buyExtraLesson')}
                  </button>
                </div>

                <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                  <div className="text-sm text-neutral-400 mb-4">{t('dashboard.billingPeriod')}</div>
                  {usageData.subscriptionStatus === "active" && usageData.periodEnd ? (
                    <>
                      <div className="text-lg font-medium text-white mb-1">
                        {t('dashboard.resetsOn', { date: new Date(usageData.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" }) })}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {usageData.plan === "regular" && t('dashboard.regularResetDesc')}
                        {usageData.plan === "pro" && t('dashboard.unlimitedContinue')}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-medium text-white mb-1">
                        {usageData.plan === "free" ? t('dashboard.noSubscription') : t('dashboard.inactive')}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {usageData.plan === "free" ? t('dashboard.freeSessionAvailable') : t('dashboard.subscriptionNotActive')}
                      </div>
                    </>
                  )}
                  {(usageData.plan === "free" || usageData.plan === "regular") && (
                    <Link
                      href="/pricing"
                      className="mt-4 block w-full py-2 text-center border border-emerald-600 text-emerald-400 rounded-lg hover:bg-emerald-600/10 transition-colors text-sm font-medium"
                    >
                      {t('dashboard.upgradeToPro')}
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">{t('dashboard.unableToLoadUsage')}</div>
            )}

            {/* API Access Section (merged from Agentic Usage) */}
            <div className="border-t border-neutral-800/60 pt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">{t('dashboard.apiAccess')}</h2>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  {t('dashboard.experimental')}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mb-4">
                {t('dashboard.apiExperimentalDesc')}
              </p>
              {user?.plan !== "pro" && !user?.isAdmin && (
                <div className="mb-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                  <p className="text-sm text-yellow-400">
                    {t('dashboard.apiKeysAvailableOnPro')}{" "}
                    <button
                      onClick={() => window.location.href = "/pricing"}
                      className="underline hover:text-yellow-300"
                    >
                      {t('dashboard.upgradeToPro')}
                    </button>{" "}
                    {t('dashboard.toCreateApiKeys')}
                  </p>
                </div>
              )}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t('dashboard.enterKeyName')}
                  className="flex-1 px-3 py-1.5 text-sm bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={handleCreateApiKey}
                  disabled={creatingKey}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {creatingKey ? t('dashboard.creating') : t('dashboard.createNewKey')}
                </button>
              </div>

              {newKeyValue && (
                <div className="mb-4 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-green-400">
                      {t('dashboard.yourNewApiKey')}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newKeyValue);
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }}
                      className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded transition-colors"
                    >
                      {keyCopied ? t('common.copied') : t('common.copy')}
                    </button>
                  </div>
                  <code className="block text-xs text-neutral-300 bg-neutral-900 p-2 rounded font-mono break-all">
                    {newKeyValue}
                  </code>
                </div>
              )}

              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 border border-neutral-800 rounded-lg">
                  <p className="text-sm">{t('dashboard.noApiKeysYet')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-neutral-800 bg-neutral-900/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200">
                          {key.label || t('dashboard.unnamedKey')}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                          sk_{key.key_prefix}...
                        </p>
                        <p className="text-xs text-neutral-600 mt-1">
                          {key.usage_count} {t('dashboard.requests')} · {t('dashboard.createdOn', { date: formatDate(key.created_at) })}
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

              <div className="mt-6 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                <p className="text-sm text-neutral-400 mb-3">
                  {t('dashboard.apiKeyDescription')}
                </p>
                <div className="bg-neutral-950 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto">
                  <p className="text-neutral-500 mb-2">// {t('dashboard.exampleRequest')}</p>
                  <p>curl -X POST https://openlesson.academy/api/agent/session/analyze \</p>
                  <p className="pl-4">-H &quot;Authorization: Bearer YOUR_API_KEY&quot; \</p>
                  <p className="pl-4">-H &quot;Content-Type: application/json&quot; \</p>
                  <p className="pl-4">-d &apos;{`{"problem": "your problem", "audio": "base64..."}`}&apos;</p>
                </div>
                <p className="text-xs text-neutral-600 mt-3">
                  {t('dashboard.rateLimitInfo')}
                </p>
              </div>
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
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full ${
                      providerInfo.provider === "xai"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {providerInfo.provider === "xai" ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.982 10.622 20.54 3h-1.554l-5.693 6.618L8.745 3H3.5l6.876 10.007L3.5 21h1.554l6.012-6.989L15.868 21h5.245l-7.131-10.378Zm-2.128 2.474-.697-.997-5.543-7.93H8l4.474 6.4.697.996 5.815 8.318h-2.387l-4.745-6.787Z"/></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      )}
                      {providerInfo.label}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t('dashboard.defaultModel')} <code className="text-neutral-400">{providerInfo.defaultModel}</code>
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className={providerInfo.hasOpenRouterKey ? "text-emerald-500" : "text-red-500"}>
                      {providerInfo.hasOpenRouterKey ? t('dashboard.openRouterConfigured') : t('dashboard.openRouterMissing')}
                    </span>
                    <span className={providerInfo.hasXAIKey ? "text-emerald-500" : "text-neutral-600"}>
                      {providerInfo.hasXAIKey ? t('dashboard.xAiConfigured') : t('dashboard.xAiNotSet')}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    {t('dashboard.switchProviderInfo')}
                    {providerInfo.provider === "xai" && ` ${t('dashboard.nonGrokFallback')}`}
                  </p>
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
                      {providerInfo?.provider === "xai" ? (
                        <>Grok 4.20 Beta <span className="text-neutral-500">(grok-4.20-beta-0309-reasoning)</span></>
                      ) : (
                        <>Grok 4 <span className="text-neutral-500">(x-ai/grok-4)</span></>
                      )}
                    </div>
                  </div>
                ))}

                <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    {t('dashboard.audioVisionModel')}
                  </label>
                  <p className="text-xs text-neutral-500 mb-3">
                    {t('dashboard.audioVisionDesc')}
                  </p>
                  <div className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300">
                    Gemini 2.5 Flash <span className="text-neutral-500">(google/gemini-2.5-flash)</span>
                    <span className="text-[10px] text-neutral-600 ml-2">via OpenRouter</span>
                  </div>
                </div>
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
