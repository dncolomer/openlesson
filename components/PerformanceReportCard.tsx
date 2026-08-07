"use client";

import { useEffect, useMemo, useState } from "react";
import { MarkerRadarChart } from "@/components/MarkerRadarChart";
import { useI18n } from "@/lib/i18n";
import type { WorkspaceGoalSource } from "@/lib/pow-api/conversion-goal";
import { normalizePerformanceGapAnalysis } from "@/lib/pow-api/performance-context";
import type { PerformanceGapAnalysis, PerformanceReport } from "@/lib/pow-api/performance-report";

export type ScoreCardTab =
  | "overview"
  | "competency"
  | "markers"
  | "strengths"
  | "gaps"
  | "next_steps"
  | "history";

export type PerformanceReportSnapshot = {
  id: string;
  report: PerformanceReport;
  proofOfWorkCount: number;
  actionCount: number;
  simulatedDays: number;
  timestamp: Date;
};

export interface PerformanceReportCardProps {
  report: PerformanceReport;
  label?: string;
  layout?: "compact" | "spacious";
  reportHistory?: PerformanceReportSnapshot[];
  workspaceGoal?: string;
  workspaceGoalSource?: WorkspaceGoalSource;
  /** When true, tab panels grow to fill the parent flex column (workspace performance tab). */
  fillHeight?: boolean;
  /**
   * Initial / report-change tab. Falls back to first available tab if missing.
   * Use `"competency"` for spider-first (e.g. LWM panel beside dual score tiles).
   */
  defaultTab?: ScoreCardTab;
  /**
   * Hide the large primary score chrome — when a sibling UI already shows skill scores
   * (LWM overview tiles). Overview tab still shows goal/summary without the giant number.
   */
  hidePrimaryScore?: boolean;
}

function severityColor(severity: "low" | "medium" | "high") {
  switch (severity) {
    case "high":
      return "border-zinc-500 bg-zinc-900 text-white";
    case "medium":
      return "border-zinc-700 bg-zinc-950 text-zinc-200";
    default:
      return "border-zinc-800 bg-black/30 text-zinc-300";
  }
}

function severityAccentBorder(severity: "low" | "medium" | "high") {
  switch (severity) {
    case "high":
      return "border-l-zinc-400";
    case "medium":
      return "border-l-zinc-600";
    default:
      return "border-l-zinc-800";
  }
}

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceLabel(
  confidence: PerformanceReport["confidence"],
  t: (key: string) => string,
) {
  switch (confidence) {
    case "well-connected":
      return t("performanceReportCard.confidenceWellConnected");
    case "clear":
      return t("performanceReportCard.confidenceClear");
    case "developing":
      return t("performanceReportCard.confidenceDeveloping");
    default:
      return t("performanceReportCard.confidenceEmerging");
  }
}

function ghcConfidenceLabel(
  confidence: PerformanceReport["ghc_confidence"] | undefined,
  t: (key: string) => string,
) {
  switch (confidence) {
    case "high":
      return t("performanceReportCard.ghcConfidenceHigh");
    case "medium":
      return t("performanceReportCard.ghcConfidenceMedium");
    case "low":
      return t("performanceReportCard.ghcConfidenceLow");
    default:
      return t("performanceReportCard.ghcConfidenceNone");
  }
}

export function getScoreCardMetrics(report: PerformanceReport | null) {
  if (!report) return null;
  const gapAnalysis = normalizePerformanceGapAnalysis(report.gap_analysis);
  return {
    gapAnalysis,
    gaps: gapAnalysis.gaps.length,
    directions: gapAnalysis.next_steps.directions.length,
    events: gapAnalysis.next_steps.events.length,
    nextSteps: gapAnalysis.next_steps.directions.length + gapAnalysis.next_steps.events.length,
  };
}

function GapsPanel({
  gapAnalysis,
  spacious = false,
}: {
  gapAnalysis: PerformanceGapAnalysis;
  spacious?: boolean;
}) {
  const { t } = useI18n();
  const textClass = spacious ? "text-base sm:text-lg" : "text-xs";
  const titleClass = spacious ? "text-base font-medium text-zinc-100 sm:text-lg" : "font-medium";

  if (gapAnalysis.gaps.length === 0) {
    return (
      <p className={`${textClass} leading-relaxed text-zinc-500`}>{t("performanceReportCard.gapsEmpty")}</p>
    );
  }

  return (
    <div className="w-full space-y-4">
      <p className={`${textClass} leading-relaxed text-zinc-400`}>{gapAnalysis.summary}</p>
      <ul className={spacious ? "space-y-5" : "space-y-2"}>
        {gapAnalysis.gaps.map((gap) => (
          <li
            key={gap.title}
            className={
              spacious
                ? `border-l-2 py-1 pl-5 ${textClass} ${severityAccentBorder(gap.severity)}`
                : `rounded-md border px-3 py-2 ${textClass} ${severityColor(gap.severity)}`
            }
          >
            <div className={titleClass}>{gap.title}</div>
            <p className={`mt-2 leading-relaxed ${spacious ? "opacity-90" : "opacity-80"}`}>
              {gap.proof_of_work}
            </p>
            <p className={`mt-2 ${spacious ? "text-zinc-400" : "opacity-70"}`}>
              {t("performanceReportCard.repair")}: {gap.suggested_repair}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextStepsPanel({
  gapAnalysis,
  spacious = false,
}: {
  gapAnalysis: PerformanceGapAnalysis;
  spacious?: boolean;
}) {
  const { t } = useI18n();
  const textClass = spacious ? "text-base text-zinc-300 sm:text-lg" : "text-xs text-zinc-400";
  const headingClass = spacious
    ? "font-mono text-xs uppercase tracking-[1.5px] text-zinc-600"
    : "font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600";
  const { directions, events } = gapAnalysis.next_steps;

  return (
    <div className={`w-full ${spacious ? "space-y-8" : "space-y-4"}`}>
      <div>
        <div className={headingClass}>{t("performanceReportCard.directionGoals")}</div>
        {directions.length > 0 ? (
          <ul className={`mt-3 space-y-2 ${textClass}`}>
            {directions.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-zinc-500">◎</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`mt-3 ${textClass} text-zinc-500`}>{t("performanceReportCard.directionEmpty")}</p>
        )}
      </div>

      <div>
        <div className={headingClass}>{t("performanceReportCard.granularEvents")}</div>
        {events.length > 0 ? (
          <ul className={`mt-3 space-y-2 ${textClass}`}>
            {events.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-zinc-500">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`mt-3 ${textClass} text-zinc-500`}>{t("performanceReportCard.eventsEmpty")}</p>
        )}
      </div>
    </div>
  );
}

function ScoreEvolution({ history, flat = false }: { history: PerformanceReportSnapshot[]; flat?: boolean }) {
  const { t } = useI18n();

  return (
    <div className={flat ? "space-y-4" : "rounded-md border border-zinc-800 bg-black/30 p-3"}>
      {!flat ? (
        <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
          {t("performanceReportCard.scoreEvolution")}
        </div>
      ) : null}
      <ol className={flat ? "space-y-4" : "mt-3 space-y-2"}>
        {history.map((snapshot, index) => (
          <li
            key={snapshot.id}
            className={
              flat
                ? `border-b border-zinc-800/60 pb-4 text-sm last:border-b-0 ${
                    index === history.length - 1 ? "text-zinc-200" : "text-zinc-400"
                  }`
                : `rounded-md border px-3 py-2 text-xs ${
                    index === history.length - 1
                      ? "border-zinc-600 bg-zinc-900 text-zinc-200"
                      : "border-zinc-800/80 text-zinc-400"
                  }`
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-300">
                {t("performanceReportCard.historyCheck", {
                  check: index + 1,
                  days: snapshot.simulatedDays,
                  actionCount: snapshot.actionCount,
                  actionLabel:
                    snapshot.actionCount === 1
                      ? t("performanceReportCard.historyActionOne")
                      : t("performanceReportCard.historyActionMany"),
                })}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {typeof snapshot.report.score === "number" ? (
                  <span className="rounded-full border border-zinc-600 px-2 py-0.5 font-mono text-[10px] text-white">
                    {Math.round(snapshot.report.score)}/100
                  </span>
                ) : null}
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-400">
                  {confidenceLabel(snapshot.report.confidence, t)}
                </span>
              </div>
            </div>
            <p className={`mt-2 leading-relaxed opacity-90 ${flat ? "text-sm" : ""}`}>
              {snapshot.report.summary}
            </p>
            {(() => {
              const metrics = getScoreCardMetrics(snapshot.report);
              if (!metrics) return null;
              return (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                  {t("performanceReportCard.historyMetrics", {
                    gaps: metrics.gaps,
                    goals: metrics.directions,
                    events: metrics.events,
                  })}
                </p>
              );
            })()}
          </li>
        ))}
      </ol>
    </div>
  );
}

function getAvailableScoreCardTabs(
  report: PerformanceReport,
  reportHistory: PerformanceReportSnapshot[] = [],
): ScoreCardTab[] {
  const tabs: ScoreCardTab[] = ["overview"];
  const markerScores = report.marker_scores ?? [];
  if (markerScores.length > 0) {
    tabs.push("competency", "markers");
  }
  if (report.strengths.length > 0) tabs.push("strengths");
  tabs.push("gaps", "next_steps");
  if (reportHistory.length > 0) tabs.push("history");
  return tabs;
}

function scoreCardTabBadge(
  tab: ScoreCardTab,
  gapAnalysis: PerformanceGapAnalysis,
  report: PerformanceReport,
  reportHistory: PerformanceReportSnapshot[],
): string | undefined {
  const markerScores = report.marker_scores ?? [];
  switch (tab) {
    case "markers":
      return markerScores.length > 0 ? String(markerScores.length) : undefined;
    case "strengths":
      return report.strengths.length > 0 ? String(report.strengths.length) : undefined;
    case "gaps":
      return gapAnalysis.gaps.length > 0 ? String(gapAnalysis.gaps.length) : undefined;
    case "next_steps": {
      const count = gapAnalysis.next_steps.directions.length + gapAnalysis.next_steps.events.length;
      return count > 0 ? String(count) : undefined;
    }
    case "history":
      return reportHistory.length > 0 ? String(reportHistory.length) : undefined;
    default:
      return undefined;
  }
}

function ScoreCardTabBar({
  tabs,
  activeTab,
  onChange,
  gapAnalysis,
  report,
  reportHistory,
}: {
  tabs: ScoreCardTab[];
  activeTab: ScoreCardTab;
  onChange: (tab: ScoreCardTab) => void;
  gapAnalysis: PerformanceGapAnalysis;
  report: PerformanceReport;
  reportHistory: PerformanceReportSnapshot[];
}) {
  const { t } = useI18n();
  const tabLabels: Record<ScoreCardTab, string> = {
    overview: t("performanceReportCard.tabOverview"),
    competency: t("performanceReportCard.tabCompetency"),
    markers: t("performanceReportCard.tabMarkers"),
    strengths: t("performanceReportCard.tabStrengths"),
    gaps: t("performanceReportCard.tabGaps"),
    next_steps: t("performanceReportCard.tabNextSteps"),
    history: t("performanceReportCard.tabHistory"),
  };

  return (
    <div className="border-b border-zinc-800">
      <div
        className="-mb-px flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t("performanceReportCard.sectionsAriaLabel")}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const badge = scoreCardTabBadge(tab, gapAnalysis, report, reportHistory);
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-left transition ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              <span className="whitespace-nowrap text-sm font-medium">{tabLabels[tab]}</span>
              {badge ? (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function resolveDefaultScoreCardTab(
  availableTabs: ScoreCardTab[],
  preferred?: ScoreCardTab,
): ScoreCardTab {
  if (preferred && availableTabs.includes(preferred)) return preferred;
  // Prefer spider (competency) when requested path is missing but markers exist
  if (preferred === "competency" && availableTabs.includes("markers")) {
    return "markers";
  }
  return availableTabs[0] ?? "overview";
}

export function PerformanceReportCard({
  report,
  label,
  layout = "compact",
  reportHistory = [],
  workspaceGoal: workspaceGoalProp,
  workspaceGoalSource,
  fillHeight = false,
  defaultTab,
  hidePrimaryScore = false,
}: PerformanceReportCardProps) {
  const { t } = useI18n();
  const cardLabel = label ?? t("performanceReportCard.defaultLabel");
  const primaryScore = clampScore(report.score);
  const workspaceGoalText =
    workspaceGoalProp?.trim() || report.workspace_goal?.trim() || null;
  // Sole product strategy — always surface as LWM Snapshot (GHC is secondary on the card).
  const verticalLabel = t("performanceReportCard.verification");
  const markerScores = report.marker_scores ?? [];
  const gapAnalysis = useMemo(
    () => normalizePerformanceGapAnalysis(report.gap_analysis),
    [report.gap_analysis],
  );
  const isSpacious = layout === "spacious";
  const availableTabs = useMemo(
    () => getAvailableScoreCardTabs(report, reportHistory),
    [report, reportHistory],
  );
  const [activeTab, setActiveTab] = useState<ScoreCardTab>(() =>
    resolveDefaultScoreCardTab(availableTabs, defaultTab),
  );
  const tabPanelClassName = fillHeight
    ? "min-h-0 flex-1 overflow-y-auto py-2"
    : "w-full py-2";

  useEffect(() => {
    setActiveTab(resolveDefaultScoreCardTab(availableTabs, defaultTab));
  }, [report, cardLabel, defaultTab, availableTabs]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(resolveDefaultScoreCardTab(availableTabs, defaultTab));
    }
  }, [activeTab, availableTabs, defaultTab]);

  if (isSpacious) {
    return (
      <div className={`flex w-full flex-col gap-4 ${fillHeight ? "h-full min-h-0" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm text-zinc-400">{cardLabel}</h3>
          <div className="flex flex-wrap items-center gap-3">
            {!hidePrimaryScore && primaryScore != null ? (
              <span className="font-mono text-2xl text-white">
                {primaryScore}
                <span className="ml-1 text-sm text-zinc-500">/100</span>
              </span>
            ) : null}
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {confidenceLabel(report.confidence, t)}
            </span>
          </div>
        </div>

        <ScoreCardTabBar
          tabs={availableTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          gapAnalysis={gapAnalysis}
          report={report}
          reportHistory={reportHistory}
        />

        <div role="tabpanel" className={tabPanelClassName}>
          {activeTab === "overview" ? (
            <div className="flex w-full flex-col items-center px-2 py-6 text-center sm:py-10">
              <div className="grid w-full grid-cols-1 gap-8 sm:max-w-md">
                {!hidePrimaryScore && primaryScore != null ? (
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[2px] text-zinc-500">
                      {verticalLabel}
                    </div>
                    <div className="mt-4 font-mono text-6xl font-medium tracking-tight text-white sm:text-7xl">
                      {primaryScore}
                    </div>
                    <div className="mt-2 font-mono text-base text-zinc-500">/ 100</div>
                  </div>
                ) : null}
              </div>
              {workspaceGoalText ? (
                <div className="mt-8 w-full text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[1.5px] text-zinc-600">
                      {t("performanceReportCard.workspaceGoal")}
                    </span>
                    {workspaceGoalSource ? (
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                        {workspaceGoalSource === "workspace"
                          ? t("performanceReportCard.sourceWorkspace")
                          : t("performanceReportCard.sourceInferred")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-center text-base leading-relaxed text-zinc-300 sm:text-lg">
                    {workspaceGoalText}
                  </p>
                </div>
              ) : null}
              <p className="mt-8 w-full text-left text-base leading-relaxed text-zinc-300 sm:text-lg">
                {report.summary}
              </p>
              {report.growth_areas.length > 0 ? (
                <div className="mt-6 w-full text-left">
                  <div className="font-mono text-xs uppercase tracking-[1.5px] text-zinc-600">
                    {t("performanceReportCard.growthAreas")}
                  </div>
                  <ul className="mt-3 space-y-2 text-base text-zinc-400 sm:text-lg">
                    {report.growth_areas.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-zinc-500">↑</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.suggestions.length > 0 ? (
                <div className="mt-6 w-full text-left">
                  <div className="font-mono text-xs uppercase tracking-[1.5px] text-zinc-600">
                    {t("performanceReportCard.suggestions")}
                  </div>
                  <ul className="mt-3 space-y-2 text-base text-zinc-400 sm:text-lg">
                    {report.suggestions.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-zinc-500">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "competency" && markerScores.length > 0 ? (
            <div className="flex h-full w-full items-center justify-center px-2 py-4">
              <MarkerRadarChart
                markers={markerScores}
                variant="large"
                ariaLabel={t("performanceReportCard.competencyAriaLabel")}
                className="aspect-square h-auto w-full max-w-[min(100%,36rem)]"
              />
            </div>
          ) : null}

          {activeTab === "markers" && markerScores.length > 0 ? (
            <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {markerScores.map((marker) => (
                <div key={marker.id} className="border-b border-zinc-800/60 pb-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-base font-medium text-zinc-200 sm:text-lg">{marker.label}</span>
                    <span className="font-mono text-2xl text-white">{marker.score}</span>
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-zinc-400">{marker.rationale}</p>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "strengths" && report.strengths.length > 0 ? (
            <ul className="w-full space-y-4 text-base leading-relaxed text-zinc-300 sm:text-lg">
              {report.strengths.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-zinc-500">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {activeTab === "gaps" ? <GapsPanel gapAnalysis={gapAnalysis} spacious /> : null}

          {activeTab === "next_steps" ? <NextStepsPanel gapAnalysis={gapAnalysis} spacious /> : null}

          {activeTab === "history" && reportHistory.length > 0 ? (
            <ScoreEvolution history={reportHistory} flat />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-white">{cardLabel}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {primaryScore != null ? (
            <span className="rounded-full border border-zinc-600 bg-zinc-950 px-3 py-0.5 font-mono text-sm text-white">
              {primaryScore}
              <span className="ml-1 text-[10px] text-zinc-500">/100</span>
            </span>
          ) : null}
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
            {confidenceLabel(report.confidence, t)}
          </span>
        </div>
      </div>

      {workspaceGoalText ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            {t("performanceReportCard.workspaceGoal")}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{workspaceGoalText}</p>
        </div>
      ) : null}

      {markerScores.length > 0 ? (
        <div className="rounded-md border border-zinc-800 bg-black/20 px-3 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            {t("performanceReportCard.competencyProfile")}
          </div>
          <div className="mt-3 flex justify-center overflow-hidden">
            <MarkerRadarChart
              markers={markerScores}
              ariaLabel={t("performanceReportCard.competencyAriaLabel")}
              className="aspect-square h-auto w-full max-w-[15rem]"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {markerScores.map((marker) => (
              <div
                key={marker.id}
                className="rounded-md border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-300">{marker.label}</span>
                  <span className="font-mono text-sm text-white">{marker.score}</span>
                </div>
                <p className="mt-1.5 leading-relaxed text-zinc-500">{marker.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-zinc-300">{report.summary}</p>

      <div className="space-y-4">
        {report.strengths.length > 0 ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              {t("performanceReportCard.tabStrengths")}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {report.strengths.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-zinc-500">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {report.growth_areas.length > 0 ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              {t("performanceReportCard.growthAreas")}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {report.growth_areas.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-zinc-500">↑</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {report.suggestions.length > 0 ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              {t("performanceReportCard.suggestions")}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {report.suggestions.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-zinc-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            {t("performanceReportCard.tabGaps")}
          </div>
          <div className="mt-2">
            <GapsPanel gapAnalysis={gapAnalysis} />
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            {t("performanceReportCard.tabNextSteps")}
          </div>
          <div className="mt-2">
            <NextStepsPanel gapAnalysis={gapAnalysis} />
          </div>
        </div>
      </div>
    </div>
  );
}