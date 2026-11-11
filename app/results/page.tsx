"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  saveSession,
  getIlePostSessionPath,
  type Session,
} from "@/lib/storage";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";
import { SessionPerformanceChat } from "@/components/SessionPerformanceChat";
import { TutorBackground } from "@/components/TutorBackground";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { ConsolePage } from "@/components/ui/console-frame";

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
          sessionId: s.id,
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

  const handleStartFollowUp = async (suggestion: FollowUpSuggestion) => {
    setStartingSession(suggestion.title);
    try {
      const res = await fetch("/api/play/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "learn", prompt: suggestion.title }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        href?: string;
        sessionId?: string;
        error?: { message?: string } | string;
      };
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || t("problemInput.sessionLimitReached");
        alert(message);
        return;
      }
      router.push(data.href || `/session?id=${data.sessionId}`);
    } catch (err) {
      console.error("Failed to start follow-up session:", err);
      alert("Failed to start block. Please try again.");
    } finally {
      setStartingSession(null);
    }
  };

  if (loading) {
    return (
      <ConsolePage label="End">
        <div className="flex flex-1 items-center justify-center">
          <LoadingStatusMessage message={t("common.loading")} />
        </div>
      </ConsolePage>
    );
  }

  if (!session) {
    return (
      <ConsolePage label="End">
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <h1 className="text-2xl font-bold text-white mb-4">{t('results.notFound')}</h1>
          <p className="text-neutral-500 mb-8 text-sm">
            {t('results.notFoundDesc')}
          </p>
          <Link
            href="/"
            className="border border-white/40 bg-black px-5 py-2.5 text-sm text-white transition-colors hover:bg-white hover:text-black"
          >
            {t('results.goToDashboard')}
          </Link>
        </div>
      </ConsolePage>
    );
  }

  return (
    <ConsolePage label="End">
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
              <div className="flex-1 flex flex-col items-center justify-center h-full rounded-none">
                <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-neutral-800/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center">
                  <span className="text-xl font-serif text-neutral-400">H</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full" />
                  <LoadingStatusMessage tone="subtle" message={t("results.generatingReport")} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Suggestions & Plan Generation */}
        <div className="lg:w-1/2 flex flex-col overflow-y-auto">
          <div className="flex-1 p-4 space-y-4">
            {/* Follow-up Session Suggestions */}
            <div className="rounded-none border border-neutral-800 bg-neutral-900/50 p-4">
              <h3 className="text-sm font-medium text-neutral-300 mb-1">{t('results.continueLearningSuggestions')}</h3>
              <p className="text-[11px] text-neutral-500 mb-3">{t('results.continueLearningSuggestionsDesc')}</p>
              
              {followUpsLoading ? (
                <div className="flex items-center gap-3 py-3 justify-center">
                  <div className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-transparent rounded-full" />
                  <LoadingStatusMessage size="sm" tone="subtle" message={t("results.generatingFollowUps")} />
                </div>
              ) : followUps.length > 0 ? (
                <div className="space-y-2">
                  {followUps.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStartFollowUp(suggestion)}
                      disabled={startingSession !== null}
                      className="w-full text-left p-3 rounded-none border border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 hover:border-white/60 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium text-white group-hover:text-white transition-colors">
                            {suggestion.title}
                          </h4>
                          <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">
                            {suggestion.description}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {startingSession === suggestion.title ? (
                            <div className="animate-spin w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full" />
                          ) : (
                            <svg className="w-4 h-4 text-neutral-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          </div>
        </div>
      </div>
    </ConsolePage>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <ConsolePage label="End">
          <div className="flex flex-1 items-center justify-center">
            <LoadingStatusMessage message="Loading" />
          </div>
        </ConsolePage>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
