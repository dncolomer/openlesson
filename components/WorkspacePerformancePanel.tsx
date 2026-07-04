"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";
import { PerformanceChat } from "@/components/PerformanceChat";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";

type PerformanceSubview = "score" | "tap" | "chat";

interface WorkspacePerformancePanelProps {
  planId: string;
  isOwner: boolean;
  currentUserId: string | null;
  isGroupPlan?: boolean;
}

function PerformanceSubviewTabs({
  activeSubview,
  onChange,
  tabs,
}: {
  activeSubview: PerformanceSubview;
  onChange: (tab: PerformanceSubview) => void;
  tabs: Array<{ id: PerformanceSubview; label: string }>;
}) {
  return (
    <div className="shrink-0 border-b border-neutral-800/80 px-4 md:px-6">
      <div
        className="-mb-px flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t("planView.performanceSectionsAriaLabel")}
      >
        {tabs.map((tab) => {
          const isActive = activeSubview === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              }`}
            >
              <span className="whitespace-nowrap text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkspacePerformancePanel({
  planId,
  isOwner,
  currentUserId,
  isGroupPlan = false,
}: WorkspacePerformancePanelProps) {
  const { t } = useI18n();
  const [activeSubview, setActiveSubview] = useState<PerformanceSubview>("score");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const subTabs: Array<{ id: PerformanceSubview; label: string }> = [
    { id: "score", label: t("planView.performanceSubTabScore") },
    { id: "tap", label: t("planView.performanceSubTabTap") },
    { id: "chat", label: t("planView.performanceSubTabChat") },
  ];

  const generateScore = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingReport(true);
    setReportError(null);
    try {
      const response = await fetch("/api/learning-plan/performance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate score");
      setReport(data.report);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Failed to generate score");
    } finally {
      setLoadingReport(false);
    }
  }, [currentUserId, planId]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PerformanceSubviewTabs activeSubview={activeSubview} onChange={setActiveSubview} tabs={subTabs} />

      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
        {activeSubview === "score" && (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-white">{t("planView.performanceScoreTitle")}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                  {t("planView.performanceScoreHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void generateScore()}
                disabled={!currentUserId || loadingReport}
                className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                {loadingReport ? t("planView.performanceScoreGenerating") : t("planView.performanceScoreGenerate")}
              </button>
            </div>
            {reportError && <p className="mt-3 shrink-0 text-xs text-red-400">{reportError}</p>}
            {loadingReport && !report ? (
              <p className="mt-6 text-sm text-neutral-500">{t("planView.performanceScoreGenerating")}</p>
            ) : null}
            {report ? (
              <div className="mt-4 min-h-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 md:p-5">
                <PerformanceReportCard
                  report={report}
                  layout="spacious"
                  fillHeight
                  label={t("planView.performanceScoreTitle")}
                />
              </div>
            ) : null}
          </section>
        )}

        {activeSubview === "tap" && (
          <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto">
            <h2 className="text-sm font-medium text-white">{t("planView.productTap")}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">{t("planView.productTapHint")}</p>
            {currentUserId ? (
              <Link
                href={`/workspace/${planId}/tap`}
                className="mt-6 inline-flex w-fit rounded-md bg-white px-4 py-2.5 text-xs font-medium text-black transition hover:bg-neutral-200"
              >
                {t("planView.startTap")}
              </Link>
            ) : (
              <p className="mt-6 text-xs text-neutral-600">{t("planView.signInForTap")}</p>
            )}
          </section>
        )}

        {activeSubview === "chat" && (
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <PerformanceChat
                planId={planId}
                isOwner={isOwner}
                currentUserId={currentUserId}
                isGroupPlan={isGroupPlan}
                compact
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}