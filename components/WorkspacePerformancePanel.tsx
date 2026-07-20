"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PerformanceReport, ScoreVertical } from "@/lib/pow-api/performance-report";
import { formatEvalSubjectLabel } from "@/lib/pow-api/evaluation-subject";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { KnowledgeConfigTrajectoryPanel } from "@/components/KnowledgeConfigTrajectoryPanel";
import { ProofOfWorkStatsPanel } from "@/components/ProofOfWorkStatsPanel";
import { InsightsDashboardTab } from "@/components/InsightsDashboardTab";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";
import { SECTION_TAB_CONTENT_CLASS } from "@/lib/workspace-section-surface";

type PerformanceSubview = "score" | "pow" | "knowledge" | "lwm" | "insights";

interface EvalRunListItem {
  id: string;
  vertical: ScoreVertical;
  score: number;
  ghc_score: number | null;
  report: PerformanceReport;
  source: string;
  ran_at: string;
  workspace_goal: string | null;
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
}

interface EvalEligibilityStatus {
  vertical: ScoreVertical;
  allowed: boolean;
  last_eval_at: string | null;
  new_pow_count: number | null;
  message?: string;
}

type EvalEligibilityMap = Partial<Record<ScoreVertical, EvalEligibilityStatus>>;

interface WorkspacePerformancePanelProps {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
  /** Group workspaces allow non-owners self-eval. */
  isGroup?: boolean;
  /** @deprecated TAP/ILE guest links live in Settings; kept for call-site compat. */
  hideTap?: boolean;
  ayclToken?: string;
  /** Optional initial Knowledge subview (e.g. insights deep-link). */
  initialSubview?: PerformanceSubview;
}

const PERFORMANCE_SUBVIEWS: readonly PerformanceSubview[] = [
  "score",
  "knowledge",
  "lwm",
  "insights",
  "pow",
];

const VERTICALS: ScoreVertical[] = ["verification", "augmentation", "optimization"];

export function WorkspacePerformancePanel({
  workspaceId,
  isOwner,
  currentUserId,
  isGroup = false,
  hideTap: _hideTap = false,
  ayclToken,
  initialSubview,
}: WorkspacePerformancePanelProps) {
  void _hideTap;
  const { t } = useI18n();
  const [activeSubview, setActiveSubview] = useState<PerformanceSubview>(() => {
    if (initialSubview && (PERFORMANCE_SUBVIEWS as readonly string[]).includes(initialSubview)) {
      return initialSubview as PerformanceSubview;
    }
    return "score";
  });
  const [activeVertical, setActiveVertical] = useState<ScoreVertical>("verification");
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [evalRuns, setEvalRuns] = useState<EvalRunListItem[]>([]);
  const [evalEligibility, setEvalEligibility] = useState<EvalEligibilityMap>({});
  const [evalHistoryLoading, setEvalHistoryLoading] = useState(false);
  const [evalHistoryError, setEvalHistoryError] = useState<string | null>(null);
  const [inspectedRunId, setInspectedRunId] = useState<string | null>(null);
  /** Live scorecard from the latest run response — kept even if history archive fails. */
  const [liveReport, setLiveReport] = useState<{
    report: PerformanceReport;
    vertical: ScoreVertical;
    saved: boolean;
  } | null>(null);

  const subTabs: Array<{ id: PerformanceSubview; label: string }> = [
    { id: "score", label: t("planView.performanceSubTabScore") },
    { id: "knowledge", label: t("planView.performanceSubTabModels") },
    { id: "lwm", label: t("planView.performanceSubTabLwm") },
    { id: "insights", label: t("planView.performanceSubTabInsights") },
    { id: "pow", label: t("planView.performanceSubTabPow") },
  ];

  /**
   * Eval tab always scopes history + score runs to the current authenticated user.
   * No multi-user / everyone / member / guest targeting from this surface.
   */
  const historyQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("workspaceId", workspaceId);
    params.set("limit", "50");
    if (ayclToken) params.set("ayclToken", ayclToken);
    // Always address subject by unique user id.
    if (currentUserId) params.set("user_id", currentUserId);
    return params;
  }, [ayclToken, currentUserId, workspaceId]);

  /** Eval runs always target self — never send other-user or guest targeting fields. */
  const scoreSubjectBody = useMemo(() => ({} as Record<string, never>), []);

  const canRunForFocus = useMemo(() => Boolean(currentUserId), [currentUserId]);

  const loadEvalHistory = useCallback(async () => {
    if (!currentUserId) return;
    setEvalHistoryLoading(true);
    setEvalHistoryError(null);
    try {
      const response = await fetch(`/api/workspace/eval-history?${historyQueryParams.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("planView.performanceEvalHistoryLoadError"));
      const runs = Array.isArray(data.runs) ? (data.runs as EvalRunListItem[]) : [];
      setEvalRuns(runs);
      setEvalEligibility((data.eligibility as EvalEligibilityMap) || {});
    } catch (error) {
      setEvalHistoryError(
        error instanceof Error ? error.message : t("planView.performanceEvalHistoryLoadError"),
      );
    } finally {
      setEvalHistoryLoading(false);
    }
  }, [currentUserId, historyQueryParams, t]);

  useEffect(() => {
    if (activeSubview === "score" && currentUserId) {
      void loadEvalHistory();
    }
  }, [activeSubview, currentUserId, loadEvalHistory]);

  const canRunVertical = useCallback(
    (vertical: ScoreVertical) => {
      if (!canRunForFocus) return false;
      const status = evalEligibility[vertical];
      if (!status) return true;
      return status.allowed;
    },
    [canRunForFocus, evalEligibility],
  );

  const formatEvalWhen = useCallback((iso: string) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, []);

  const verticalTitle = useCallback(
    (vertical: ScoreVertical) => {
      if (vertical === "augmentation") return t("planView.performanceScoreTitleAugmentation");
      if (vertical === "optimization") return t("planView.performanceScoreTitleOptimization");
      return t("planView.performanceScoreTitleVerification");
    },
    [t],
  );

  const inspectedRun = useMemo(
    () => (inspectedRunId ? (evalRuns.find((r) => r.id === inspectedRunId) ?? null) : null),
    [evalRuns, inspectedRunId],
  );

  /** Prefer history inspect; else show live response report so save failures don't drop the scorecard. */
  const displayedScorecard = useMemo(() => {
    if (inspectedRun) {
      return {
        kind: "history" as const,
        report: inspectedRun.report,
        vertical: inspectedRun.vertical,
        workspaceGoal: inspectedRun.workspace_goal,
        ranAt: inspectedRun.ran_at,
        score: inspectedRun.score,
        subjectLabel: formatEvalSubjectLabel(inspectedRun),
        saved: true,
      };
    }
    if (liveReport) {
      return {
        kind: "live" as const,
        report: liveReport.report,
        vertical: liveReport.vertical,
        workspaceGoal: liveReport.report.workspace_goal ?? null,
        ranAt: null as string | null,
        score: liveReport.report.score,
        subjectLabel: null as string | null,
        saved: liveReport.saved,
      };
    }
    return null;
  }, [inspectedRun, liveReport]);

  const closeScorecard = useCallback(() => {
    setInspectedRunId(null);
    setLiveReport(null);
  }, []);

  useEffect(() => {
    if (!displayedScorecard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeScorecard();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeScorecard, displayedScorecard]);

  const fetchVerticalReport = useCallback(
    async (vertical: ScoreVertical): Promise<{ report: PerformanceReport; saved: boolean; saveError?: string }> => {
      const response = await fetch("/api/workspace/performance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          vertical,
          ...(ayclToken ? { ayclToken } : {}),
          ...scoreSubjectBody,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate score");
      if (!data.report) throw new Error("Score response missing report");
      return {
        report: data.report as PerformanceReport,
        saved: Boolean(data.eval_history_saved ?? data.eval_run_history_id),
        saveError:
          typeof data.eval_run_history_error === "string" ? data.eval_run_history_error : undefined,
      };
    },
    [ayclToken, scoreSubjectBody, workspaceId],
  );

  const generateScore = useCallback(
    async (vertical: ScoreVertical) => {
      if (!canRunForFocus) return;
      if (!canRunVertical(vertical)) {
        setReportError(
          evalEligibility[vertical]?.message || t("planView.performanceEvalNoNewPow"),
        );
        return;
      }
      setLoadingReport(true);
      setLoadingAll(false);
      setReportError(null);
      setSaveWarning(null);
      setActiveVertical(vertical);
      setInspectedRunId(null);
      try {
        const result = await fetchVerticalReport(vertical);
        // Always surface the generated scorecard — even when history save fails (RLS/migration).
        setLiveReport({
          report: result.report,
          vertical,
          saved: result.saved,
        });
        if (!result.saved) {
          setSaveWarning(
            result.saveError || t("planView.performanceEvalSaveFailed"),
          );
        }
        await loadEvalHistory();
      } catch (error) {
        setReportError(error instanceof Error ? error.message : "Failed to generate score");
      } finally {
        setLoadingReport(false);
      }
    },
    [canRunForFocus, canRunVertical, evalEligibility, fetchVerticalReport, loadEvalHistory, t],
  );

  const generateAllScores = useCallback(async () => {
    if (!canRunForFocus) return;
    const runnable = VERTICALS.filter((v) => canRunVertical(v));
    if (runnable.length === 0) {
      setReportError(t("planView.performanceEvalNoNewPow"));
      return;
    }

    setLoadingReport(true);
    setLoadingAll(true);
    setReportError(null);
    setSaveWarning(null);
    setInspectedRunId(null);

    const settled = await Promise.allSettled(runnable.map((v) => fetchVerticalReport(v)));

    const failures: string[] = [];
    let successCount = 0;
    let anyUnsaved = false;
    let lastOk: { report: PerformanceReport; vertical: ScoreVertical; saved: boolean } | null =
      null;
    settled.forEach((result, i) => {
      const vertical = runnable[i];
      if (result.status === "fulfilled") {
        successCount += 1;
        setActiveVertical(vertical);
        lastOk = {
          report: result.value.report,
          vertical,
          saved: result.value.saved,
        };
        if (!result.value.saved) anyUnsaved = true;
      } else {
        const message =
          result.reason instanceof Error ? result.reason.message : "Failed to generate score";
        failures.push(`${vertical}: ${message}`);
      }
    });

    if (lastOk) {
      setLiveReport(lastOk);
    }

    const skipped = VERTICALS.filter((v) => !canRunVertical(v));
    if (skipped.length > 0) {
      failures.push(
        ...skipped.map((v) => `${v}: ${t("planView.performanceEvalNoNewPowShort")}`),
      );
    }

    if (failures.length > 0) {
      setReportError(
        successCount === 0
          ? failures.join(" · ")
          : t("planView.performanceScorePartialError", { details: failures.join(" · ") }),
      );
    }
    if (anyUnsaved) {
      setSaveWarning(t("planView.performanceEvalSaveFailed"));
    }

    await loadEvalHistory();
    setLoadingReport(false);
    setLoadingAll(false);
  }, [canRunForFocus, canRunVertical, fetchVerticalReport, loadEvalHistory, t]);

  const roleHint = useMemo(() => {
    if (isOwner) return t("planView.performanceEvalRoleOwner");
    if (isGroup) return t("planView.performanceEvalRoleMember");
    return t("planView.performanceEvalRoleSelf");
  }, [isGroup, isOwner, t]);

  const secondaryBtnClass =
    "rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:border-neutral-500 disabled:opacity-40";
  const primaryBtnClass =
    "rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-knowledge-panel>
      <WorkspaceSectionSubTabs
        activeId={activeSubview}
        onChange={setActiveSubview}
        tabs={subTabs}
        ariaLabel={t("planView.performanceSectionsAriaLabel")}
        dataAttr="knowledge"
      />

      <div className={SECTION_TAB_CONTENT_CLASS} data-knowledge-tab-body={activeSubview}>
        {activeSubview === "score" && (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-knowledge-eval>
            {/* Header + role */}
            <div className="shrink-0 space-y-3">
              <div>
                <h2 className="text-sm font-medium text-white">
                  {t("planView.performanceScoreTitle")}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                  {t("planView.performanceScoreHint")}
                </p>
                <p className="mt-1 text-[11px] text-neutral-600">{roleHint}</p>
              </div>

              {/* Run controls — vertical picker + actions (always current-user subject) */}
              <div className="flex flex-wrap items-center gap-2" data-eval-self-only>
                <select
                  value={activeVertical}
                  onChange={(e) => setActiveVertical(e.target.value as ScoreVertical)}
                  disabled={loadingReport}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                  aria-label={t("planView.performanceEvalVerticalLabel")}
                >
                  {VERTICALS.map((v) => (
                    <option key={v} value={v}>
                      {verticalTitle(v)}
                      {!canRunVertical(v) && canRunForFocus
                        ? ` · ${t("planView.performanceEvalNoNewPowShort")}`
                        : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void generateScore(activeVertical)}
                  disabled={!canRunForFocus || loadingReport || !canRunVertical(activeVertical)}
                  title={
                    !canRunVertical(activeVertical)
                      ? evalEligibility[activeVertical]?.message ||
                        t("planView.performanceEvalNoNewPow")
                      : undefined
                  }
                  className={primaryBtnClass}
                  data-eval-run
                >
                  {loadingReport && !loadingAll
                    ? t("planView.performanceScoreGenerating")
                    : t("planView.performanceEvalRunSelected")}
                </button>
                <button
                  type="button"
                  onClick={() => void generateAllScores()}
                  disabled={
                    !canRunForFocus ||
                    loadingReport ||
                    !VERTICALS.some((v) => canRunVertical(v))
                  }
                  className={secondaryBtnClass}
                  data-eval-run-all
                >
                  {loadingAll
                    ? t("planView.performanceScoreGeneratingAll")
                    : t("planView.performanceScoreGenerateAll")}
                </button>
              </div>

              {reportError ? <p className="text-xs text-red-400">{reportError}</p> : null}
              {saveWarning ? (
                <p className="text-xs text-amber-400" data-eval-save-warning>
                  {saveWarning}
                </p>
              ) : null}
              {loadingReport ? (
                <LoadingStatusMessage
                  tone="subtle"
                  message={
                    loadingAll
                      ? t("planView.performanceScoreGeneratingAll")
                      : t("planView.performanceScoreGenerating")
                  }
                />
              ) : null}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {t("planView.performanceEvalHistoryTitle")}
                </h3>
                {currentUserId ? (
                  <button
                    type="button"
                    onClick={() => void loadEvalHistory()}
                    disabled={evalHistoryLoading}
                    className="text-[11px] text-neutral-500 transition hover:text-neutral-300 disabled:opacity-40"
                  >
                    {evalHistoryLoading
                      ? t("planView.performanceEvalHistoryLoading")
                      : t("planView.powStatsRefresh")}
                  </button>
                ) : null}
              </div>

              {evalHistoryError ? (
                <p className="mt-3 text-xs text-red-400">{evalHistoryError}</p>
              ) : null}

              {!currentUserId ? (
                <p className="mt-3 text-xs text-neutral-600">{t("planView.signInForTap")}</p>
              ) : evalHistoryLoading && evalRuns.length === 0 ? (
                <div className="mt-4">
                  <LoadingStatusMessage
                    size="sm"
                    tone="subtle"
                    message={t("planView.performanceEvalHistoryLoading")}
                  />
                </div>
              ) : evalRuns.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-600">
                  {t("planView.performanceEvalHistoryEmpty")}
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-neutral-800/80 rounded-lg border border-neutral-800 bg-neutral-950/40">
                  {evalRuns.map((run) => {
                    const isInspected = inspectedRunId === run.id;
                    return (
                      <li key={run.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setLiveReport(null);
                            setInspectedRunId(run.id);
                            setActiveVertical(run.vertical);
                          }}
                          className={`flex w-full flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-neutral-900/80 ${
                            isInspected ? "bg-neutral-900/90" : ""
                          }`}
                          aria-haspopup="dialog"
                          aria-expanded={isInspected}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-100">
                              {verticalTitle(run.vertical)}
                            </p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                              {t("planView.performanceEvalRanAt", {
                                when: formatEvalWhen(run.ran_at),
                              })}
                              {isOwner ? (
                                <>
                                  {" · "}
                                  <span className="font-mono text-neutral-400">
                                    {formatEvalSubjectLabel(run)}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-mono text-sm text-white">
                              {t("planView.performanceEvalScore", { score: run.score })}
                            </span>
                            <span className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] font-medium text-neutral-300">
                              {t("planView.performanceEvalInspect")}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {displayedScorecard ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="eval-scorecard-title"
                data-eval-scorecard={displayedScorecard.kind}
              >
                <div
                  className="absolute inset-0 bg-black/70 backdrop-blur-md"
                  onClick={closeScorecard}
                  aria-hidden="true"
                />
                <div className="relative z-10 flex h-[min(92vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-neutral-800/80 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <h3
                        id="eval-scorecard-title"
                        className="text-sm font-medium text-white sm:text-base"
                      >
                        {verticalTitle(displayedScorecard.vertical)}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        {displayedScorecard.ranAt
                          ? t("planView.performanceEvalRanAt", {
                              when: formatEvalWhen(displayedScorecard.ranAt),
                            })
                          : t("planView.performanceEvalJustRan")}{" "}
                        · {t("planView.performanceEvalScore", { score: displayedScorecard.score })}
                        {isOwner && displayedScorecard.subjectLabel ? (
                          <>
                            {" · "}
                            {displayedScorecard.subjectLabel}
                          </>
                        ) : null}
                        {!displayedScorecard.saved ? (
                          <span className="ml-1 text-amber-400">
                            · {t("planView.performanceEvalUnsavedBadge")}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeScorecard}
                      className={secondaryBtnClass}
                      data-eval-back-to-list
                    >
                      {t("common.close")}
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">
                    <PerformanceReportCard
                      report={displayedScorecard.report}
                      layout="spacious"
                      fillHeight
                      label={verticalTitle(displayedScorecard.vertical)}
                      workspaceGoal={displayedScorecard.workspaceGoal ?? undefined}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {activeSubview === "insights" && (
          <section className="min-h-0 flex-1 overflow-y-auto">
            <InsightsDashboardTab workspaceId={workspaceId} compact />
          </section>
        )}

        {activeSubview === "pow" && (
          <ProofOfWorkStatsPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            ayclToken={ayclToken}
          />
        )}

        {activeSubview === "knowledge" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
            panelView="models"
          />
        )}

        {activeSubview === "lwm" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
            panelView="lwm"
          />
        )}

      </div>
    </div>
  );
}
