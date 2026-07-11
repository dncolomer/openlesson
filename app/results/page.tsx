"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  saveSession,
  createSession,
  getIlePostSessionPath,
  type Session,
} from "@/lib/storage";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";
import { FileDropZone, type AttachedFile } from "@/components/FileDropZone";
import { SessionPerformanceChat } from "@/components/SessionPerformanceChat";
import { TutorBackground } from "@/components/TutorBackground";

interface FollowUpSuggestion {
  title: string;
  description: string;
}

function ResultsContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [startingSession, setStartingSession] = useState<string | null>(null);
  
  // Plan generation state
  const [planTopic, setPlanTopic] = useState("");
  const [planWeeks, setPlanWeeks] = useState(4);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showFileZone, setShowFileZone] = useState(false);
  const [suggestedPlanTopic, setSuggestedPlanTopic] = useState<string | null>(null);
  const [suggestingTopic, setSuggestingTopic] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const loadSession = async () => {
      const s = await getSession(sessionId);
      if (s?.metadata?.workspace_id) {
        router.replace(getIlePostSessionPath(s));
        return;
      }

      setSession(s);
      setLoading(false);

      if (s && s.status === "completed") {
        if (!s.report) generateAndSaveReport(s);
      }
    };

    loadSession();
  }, [sessionId, router]);

  const generateAndSaveReport = async (s: Session) => {
    setReportLoading(true);
    try {
      const durationMin = Math.round(s.durationMs / 60000);

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: s.problem,
          duration: `${durationMin} minutes`,
          probeCount: s.probes.length,
          avgGapScore: s.probes.length > 0 
            ? s.probes.reduce((acc, p) => acc + p.gapScore, 0) / s.probes.length 
            : 0,
          probesSummary: s.probes
            .map((p, i) => `Probe ${i + 1}: ${p.text}`)
            .join("\n"),
          eegContext: undefined,
        }),
      });

      if (!res.ok) return;

      const { report } = await res.json();
      if (!report) return;

      const updatedSession = { ...s, report, reportGeneratedAt: new Date().toISOString() };
      setSession(updatedSession);
      await saveSession(updatedSession);
    } catch (err) {
      console.error("Report generation failed:", err);
    } finally {
      setReportLoading(false);
    }
  };

  // Fetch follow-up suggestions when session has a report
  useEffect(() => {
    if (!session || !session.report || followUps.length > 0 || followUpsLoading) return;
    
    const fetchFollowUps = async () => {
      setFollowUpsLoading(true);
      try {
        const durationMin = Math.round(session.durationMs / 60000);
        const gapsSummary = session.probes
          .map((p, i) => `${i + 1}. ${p.text} (gap: ${p.gapScore.toFixed(2)})`)
          .join("\n");

        const res = await fetch("/api/generate-follow-ups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            problem: session.problem,
            duration: `${durationMin} minutes`,
            gapsSummary,
            reportSummary: session.report?.substring(0, 500) || "",
          }),
        });

        if (res.ok) {
          const { suggestions } = await res.json();
          if (suggestions && Array.isArray(suggestions)) {
            setFollowUps(suggestions);
          }
        }
      } catch (err) {
        console.error("Failed to fetch follow-up suggestions:", err);
      } finally {
        setFollowUpsLoading(false);
      }
    };

    fetchFollowUps();
  }, [session, sessionId, followUps.length, followUpsLoading]);

  // Fetch suggested plan topic when session has a report
  useEffect(() => {
    if (!session || !session.report || suggestedPlanTopic !== null || suggestingTopic) return;
    
    const fetchSuggestedTopic = async () => {
      setSuggestingTopic(true);
      try {
        const res = await fetch("/api/suggest-plan-topic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            problem: session.problem,
            report: session.report,
          }),
        });

        if (res.ok) {
          const { suggestion } = await res.json();
          if (suggestion) {
            setSuggestedPlanTopic(suggestion);
          }
        }
      } catch (err) {
        console.error("Failed to fetch suggested plan topic:", err);
      } finally {
        setSuggestingTopic(false);
      }
    };

    fetchSuggestedTopic();
  }, [session, sessionId, suggestedPlanTopic, suggestingTopic]);

  const handleUseSuggestedTopic = () => {
    if (suggestedPlanTopic) {
      setPlanTopic(suggestedPlanTopic);
    }
  };

  const handleStartFollowUp = async (suggestion: FollowUpSuggestion) => {
    setStartingSession(suggestion.title);
    try {
      // Check usage first
      const usageRes = await fetch("/api/check-usage");
      if (usageRes.ok) {
        const usage = await usageRes.json();
        if (!usage.allowed) {
          alert(t("problemInput.sessionLimitReached"));
          return;
        }
      }

      // Create the new session with the suggested topic
      const newSession = await createSession(suggestion.title);
      
      // Track usage
      fetch("/api/check-usage", { method: "POST" }).catch(() => {});
      
      // Navigate to the new session
      router.push(`/session?id=${newSession.id}`);
    } catch (err) {
      console.error("Failed to start follow-up session:", err);
      alert("Failed to start block. Please try again.");
    } finally {
      setStartingSession(null);
    }
  };

  const handleGeneratePlan = async () => {
    if (!planTopic.trim()) {
      setPlanError(t("planMode.enterTopic"));
      return;
    }
    setPlanError(null);
    setGeneratingPlan(true);
    
    try {
      const body: Record<string, unknown> = {
        topic: planTopic.trim(),
        days: planWeeks * 7,
      };

      // Include attached files if any
      if (attachedFiles.length > 0) {
        body.files = attachedFiles.map((f) => ({
          name: f.name,
          mimeType: f.mimeType,
          data: f.data,
        }));
      }

      const response = await fetch("/api/workspace/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate plan");
      }
      
      const data = await response.json();
      router.push(`/workspace/${data.workspaceId}`);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : t("planMode.somethingWrong"));
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0a0a0a]">
        <h1 className="text-2xl font-bold text-white mb-4">{t('results.notFound')}</h1>
        <p className="text-neutral-500 mb-8 text-sm">
          {t('results.notFoundDesc')}
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm rounded-xl transition-colors"
        >
          {t('results.goToDashboard')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar 
        breadcrumbs={[
          { label: t('results.breadcrumb') }
        ]}
      />

      {/* Session header */}
      <div className="px-4 sm:px-6 py-4 border-b border-neutral-800/50">
        <h2 className="text-lg font-semibold text-white mb-1">{session.problem}</h2>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>
            {new Date(session.startedAt).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>•</span>
          <span>{Math.round(session.durationMs / 60000)} min</span>
          <span>•</span>
          <span>{session.probes.length} probes</span>
        </div>
      </div>

      {/* 50/50 Split Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left side - Helios Performance Chat with background */}
        <div className="relative lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-neutral-800/50 min-h-[400px] lg:min-h-0 overflow-hidden">
          {/* Frosted glass background */}
          <TutorBackground />
          
          <div className="relative z-10 flex-1 p-4">
            {session.report || !reportLoading ? (
              <SessionPerformanceChat 
                sessionId={sessionId!} 
                sessionTopic={session.problem}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center h-full rounded-xl">
                <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-violet-500/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center">
                  <span className="text-xl font-serif text-neutral-400">H</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full" />
                  <p className="text-sm text-neutral-500">{t('results.generatingReport')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Suggestions & Plan Generation */}
        <div className="lg:w-1/2 flex flex-col overflow-y-auto">
          <div className="flex-1 p-4 space-y-4">
            {/* Follow-up Session Suggestions */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <h3 className="text-sm font-medium text-neutral-300 mb-1">{t('results.continueLearningSuggestions')}</h3>
              <p className="text-[11px] text-neutral-500 mb-3">{t('results.continueLearningSuggestionsDesc')}</p>
              
              {followUpsLoading ? (
                <div className="flex items-center gap-2 py-3 justify-center">
                  <div className="animate-spin w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                  <p className="text-xs text-neutral-500">{t('results.generatingFollowUps')}</p>
                </div>
              ) : followUps.length > 0 ? (
                <div className="space-y-2">
                  {followUps.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStartFollowUp(suggestion)}
                      disabled={startingSession !== null}
                      className="w-full text-left p-3 rounded-lg border border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 hover:border-emerald-600/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium text-white group-hover:text-emerald-400 transition-colors">
                            {suggestion.title}
                          </h4>
                          <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">
                            {suggestion.description}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {startingSession === suggestion.title ? (
                            <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
                          ) : (
                            <svg className="w-4 h-4 text-neutral-600 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500 text-center py-3">{t('results.noFollowUpSuggestions')}</p>
              )}
            </div>

            {/* Generate Learning Plan Section */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <h3 className="text-sm font-medium text-neutral-300 mb-1">{t('results.createWorkspace')}</h3>
              <p className="text-[11px] text-neutral-500 mb-3">{t('results.createWorkspaceDesc')}</p>
              
              {/* AI Suggested Topic */}
              {(suggestingTopic || suggestedPlanTopic) && (
                <div className="mb-3">
                  {suggestingTopic ? (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full" />
                      {t('results.suggestingTopic')}
                    </div>
                  ) : suggestedPlanTopic && !planTopic ? (
                    <button
                      onClick={handleUseSuggestedTopic}
                      disabled={generatingPlan}
                      className="w-full text-left p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-blue-400 mb-0.5">{t('results.aiSuggestedTopic')}</p>
                          <p className="text-xs text-white group-hover:text-blue-300 transition-colors">{suggestedPlanTopic}</p>
                        </div>
                        <span className="text-[10px] text-blue-400/70 flex-shrink-0">{t('results.clickToUse')}</span>
                      </div>
                    </button>
                  ) : null}
                </div>
              )}
              
              <div className="space-y-3">
                <textarea
                  value={planTopic}
                  onChange={(e) => {
                    setPlanTopic(e.target.value);
                    if (planError) setPlanError(null);
                  }}
                  placeholder={t('results.planTopicPlaceholder')}
                  rows={2}
                  disabled={generatingPlan}
                  className="w-full px-3 py-2.5 border rounded-xl text-white text-sm focus:outline-none resize-none transition-colors bg-neutral-800/50 border-neutral-700 focus:border-neutral-600 placeholder-neutral-600"
                />
                
                {/* Tool row: Attachments + Duration + Generate */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Attach files button */}
                  <button
                    type="button"
                    onClick={() => setShowFileZone((v) => !v)}
                    disabled={generatingPlan}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border rounded-lg transition-colors ${
                      attachedFiles.length > 0
                        ? "text-blue-400 border-blue-500/40 bg-blue-500/10"
                        : "text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 border-neutral-700 hover:border-neutral-600"
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    {attachedFiles.length > 0
                      ? `${attachedFiles.length} ${attachedFiles.length === 1 ? t("workspaceFiles.fileAttached") : t("workspaceFiles.filesAttached")}`
                      : t("workspaceFiles.attachFiles")}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-neutral-500">
                      {t('planMode.howLongPlan')}
                    </label>
                    <select
                      value={planWeeks}
                      onChange={(e) => setPlanWeeks(Number(e.target.value))}
                      disabled={generatingPlan}
                      className="appearance-none bg-neutral-800/50 border border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 focus:outline-none rounded-lg pl-2 pr-5 py-1 text-[11px] text-neutral-200 cursor-pointer transition-colors"
                    >
                      <option value={1}>{t('planMode.week1')}</option>
                      <option value={2}>{t('planMode.week2')}</option>
                      <option value={4}>{t('planMode.month1')}</option>
                      <option value={8}>{t('planMode.month2')}</option>
                      <option value={12}>{t('planMode.month3')}</option>
                      <option value={26}>{t('planMode.month6')}</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleGeneratePlan}
                    disabled={!planTopic.trim() || generatingPlan}
                    className="ml-auto py-1.5 px-3 text-xs font-medium rounded-lg bg-slate-200 text-slate-900 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {generatingPlan ? (
                      <>
                        <div className="animate-spin w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full" />
                        {t('planMode.analyzing')}
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {t('home.generatePlan')}
                      </>
                    )}
                  </button>
                </div>

                {/* File drop zone (expanded) */}
                {showFileZone && (
                  <div className="space-y-2">
                    <FileDropZone
                      files={attachedFiles}
                      onChange={setAttachedFiles}
                    />
                    {attachedFiles.length > 0 && (
                      <p className="text-[10px] text-neutral-500 leading-snug">
                        {t("home.attachmentsHint")}
                      </p>
                    )}
                  </div>
                )}
                
                {planError && (
                  <p className="text-xs text-red-400">{planError}</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
