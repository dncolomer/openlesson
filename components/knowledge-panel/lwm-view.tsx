"use client";

import { MarkerRadarChart } from "@/components/MarkerRadarChart";
import { UserPicker } from "@/components/knowledge-panel/widgets";
import { LwmSnapshotModal } from "@/components/knowledge-panel/lwm-snapshot-modal";
import { useKnowledgeLwm } from "@/components/knowledge-panel/use-knowledge-lwm";
import type { KnowledgeLwmViewProps } from "@/components/knowledge-panel/types";
import { normalizePerformanceGapAnalysis } from "@/lib/pow-api/performance-context";
import {
  lwmPrimaryBandLabel,
  LWM_CLIENT_LABELS,
} from "@/lib/pow-api/lwm-snapshot-interpretability";

export function KnowledgeLwmView({
  workspaceId,
  currentUserId = null,
  isOwner,
  ayclToken,
  canInspectOthers,
  lockSubjectToSelf,
}: KnowledgeLwmViewProps) {
  const {
    adhocGoal,
    availableSubjects,
    closeSnapshotModal,
    displayGhcScore,
    displaySnapScore,
    generateSnapshot,
    generateSnapshotAll,
    goalCatalog,
    goalMode,
    kc,
    lwmDetailTab,
    lwmError,
    lwmExplanation,
    lwmGuestUserId,
    lwmHistoryLoading,
    lwmHistoryRuns,
    lwmLoading,
    lwmScope,
    lwmUpdatedLabel,
    lwmUserId,
    openSnapshotModal,
    selectedGoalIds,
    selectedLwmRun,
    selectedRunReport,
    setAdhocGoal,
    setGoalMode,
    setLwmDetailTab,
    setLwmGuestUserId,
    setLwmUserId,
    setSelectedGoalIds,
    setSelectedLwmRunId,
    setShowScoreExplainModal,
    setSnapshotModalMode,
    showScoreExplainModal,
    snapshotAllProgress,
    snapshotAllProgressText,
    snapshotAllRunning,
    snapshotEligibility,
    snapshotError,
    snapshotLoading,
    snapshotModalMode,
    wm,
  } = useKnowledgeLwm({
    workspaceId,
    currentUserId,
    ayclToken,
    canInspectOthers,
    lockSubjectToSelf,
    isOwner,
  });

  return (
        <section
          data-section="lwm"
          data-lwm-layout="profile-zones"
          className="flex w-full min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2"
        >
          {lwmError ? (
            <div className="rounded-none border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-300">
              {lwmError}
            </div>
          ) : null}

          {/* ── A. Compact toolbar: user + generate ─────────────────── */}
          <div
            className="flex flex-wrap items-center gap-1.5"
            data-lwm-zone="control"
            data-lwm-filters
          >
            <div
              className="min-w-[10rem] max-w-xs flex-1"
              data-lwm-controls-column
              data-picker="lwm"
            >
              <UserPicker
                ariaLabel="Learning world model user"
                compact
                valueUserId={lwmUserId}
                valueGuestUserId={lwmGuestUserId}
                currentUserId={currentUserId}
                availableSubjects={availableSubjects}
                canInspectOthers={canInspectOthers}
                onChange={({ userId, guestUserId }) => {
                  setLwmUserId(userId);
                  setLwmGuestUserId(guestUserId);
                  setSelectedLwmRunId(null);
                }}
              />
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-lwm-snapshot-controls
            >
              <button
                type="button"
                onClick={() => openSnapshotModal("single")}
                disabled={
                  snapshotLoading ||
                  snapshotAllRunning ||
                  (!currentUserId && !lwmUserId && !lwmGuestUserId)
                }
                title="Choose a goal and generate a Learning World Model Snapshot for the selected user"
                className="rounded-none bg-white px-2.5 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                data-lwm-generate-snapshot
              >
                {snapshotLoading ? "Generating…" : "Generate new snapshot"}
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => openSnapshotModal("all")}
                  disabled={snapshotLoading || snapshotAllRunning}
                  title="Generate LWM Snapshots for every user/subject in this workspace (async with progress)"
                  className="rounded-none border border-white/80 bg-transparent px-2.5 py-1.5 text-xs font-medium text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  data-lwm-generate-snapshot-all
                >
                  {snapshotAllRunning
                    ? `All users… ${snapshotAllProgress.completed}/${Math.max(snapshotAllProgress.total, 1)}`
                    : "Snapshot all users"}
                </button>
              ) : null}
            </div>
            {snapshotAllRunning && snapshotModalMode === null ? (
              <p
                className="w-full text-[10px] text-neutral-500"
                data-lwm-snapshot-all-running-hint
              >
                Snapshotting all users…{" "}
                <button
                  type="button"
                  className="text-neutral-300 underline-offset-2 hover:underline"
                  onClick={() => setSnapshotModalMode("all")}
                >
                  Show progress
                </button>
              </p>
            ) : null}
          </div>

          {/* Generate modal: goal selection + progress (keeps control bar compact) */}
          {snapshotModalMode ? (
            <LwmSnapshotModal
              snapshotModalMode={snapshotModalMode}
              closeSnapshotModal={closeSnapshotModal}
              snapshotLoading={snapshotLoading}
              snapshotAllRunning={snapshotAllRunning}
              goalMode={goalMode}
              setGoalMode={setGoalMode}
              adhocGoal={adhocGoal}
              setAdhocGoal={setAdhocGoal}
              selectedGoalIds={selectedGoalIds}
              setSelectedGoalIds={setSelectedGoalIds}
              goalCatalog={goalCatalog}
              snapshotEligibility={snapshotEligibility}
              snapshotAllProgress={snapshotAllProgress}
              snapshotAllProgressText={snapshotAllProgressText}
              snapshotError={snapshotError}
              generateSnapshot={generateSnapshot}
              generateSnapshotAll={generateSnapshotAll}
            />
          ) : null}

          {/* ── B–C. Snapshot list + profile (single frame) ─────────── */}
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            data-lwm-primary
            data-lwm-card-column
            data-lwm-zone="results"
          >
            {lwmLoading && !wm && lwmHistoryRuns.length === 0 ? (
              <p className="text-xs text-neutral-500">Loading learning world model…</p>
            ) : !selectedLwmRun && !wm && lwmHistoryRuns.length === 0 ? (
              <div
                className="rounded-none border border-dashed border-neutral-700 bg-neutral-950/40 px-4 py-6 text-center"
                data-lwm-empty
              >
                <p className="text-sm font-medium text-neutral-200">No snapshots yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-neutral-500">
                  Pick a person above, then{" "}
                  <span className="text-neutral-300">Generate new snapshot</span> to choose a goal
                  after proof of work.
                </p>
              </div>
            ) : (
              <div
                className="flex min-h-0 flex-1 overflow-hidden rounded-none border border-neutral-800 bg-neutral-950/80"
                data-lwm-results-layout="list-detail"
                data-lwm-selected-run={selectedLwmRun?.id || undefined}
              >
                {/* Side list: all snapshots for selected user */}
                <aside
                  className="flex w-52 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950/60 sm:w-56"
                  data-lwm-zone="history"
                  data-lwm-history-section
                  data-lwm-snapshot-sidebar
                >
                  <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-neutral-800 px-2.5 py-1.5">
                    <p className="text-[11px] font-medium text-neutral-300">Snapshots</p>
                    <p className="text-[10px] text-neutral-500" data-lwm-timeline-count>
                      {lwmHistoryLoading
                        ? "…"
                        : `${lwmHistoryRuns.length}`}
                    </p>
                  </div>
                  {lwmHistoryLoading && lwmHistoryRuns.length === 0 ? (
                    <p className="px-2.5 py-3 text-xs text-neutral-500">Loading…</p>
                  ) : lwmHistoryRuns.length === 0 ? (
                    <p
                      className="px-2.5 py-3 text-xs text-neutral-500"
                      data-lwm-timeline-empty
                    >
                      No snapshots for this person yet.
                    </p>
                  ) : (
                    <ol
                      className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1"
                      data-lwm-snapshot-list
                      role="listbox"
                      aria-label="Snapshots for selected user"
                    >
                      {lwmHistoryRuns.map((run, index) => {
                        const selected = selectedLwmRun?.id === run.id;
                        const ranLabel = (() => {
                          const ms = Date.parse(run.ran_at);
                          if (!Number.isFinite(ms)) return run.ran_at;
                          try {
                            return new Intl.DateTimeFormat(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(ms));
                          } catch {
                            return run.ran_at;
                          }
                        })();
                        return (
                          <li key={run.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => setSelectedLwmRunId(run.id)}
                              className={`w-full rounded-none px-2 py-1.5 text-left transition ${
                                selected
                                  ? "bg-white/10 ring-1 ring-white/25"
                                  : "hover:bg-neutral-900/80"
                              }`}
                              data-lwm-snapshot-item={run.id}
                              data-lwm-timeline-point={run.id}
                              data-lwm-snapshot-selected={selected ? "true" : "false"}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10px] font-medium text-neutral-500">
                                  #{index + 1}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-mono tabular-nums">
                                  <span
                                    className="rounded-none border border-neutral-600 bg-neutral-900 px-1 py-0.5 text-neutral-100"
                                    data-lwm-skill-score-chip
                                  >
                                    {Math.round(run.score)}
                                  </span>
                                  <span
                                    className="rounded-none border border-neutral-700 bg-neutral-900/80 px-1 py-0.5 text-neutral-300"
                                    data-lwm-ghc-score-chip
                                  >
                                    {run.ghc_score != null ? Math.round(run.ghc_score) : "—"}
                                  </span>
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-neutral-200" data-lwm-snapshot-ran-at>
                                {ranLabel}
                              </p>
                              {run.source ? (
                                <p className="truncate text-[10px] text-neutral-500">
                                  {run.source}
                                </p>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </aside>

                {/* Main: integrated detail (scores + spider, then tabs) */}
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-neutral-950/40"
                  data-lwm-zone="overview"
                  data-lwm-skill-card
                  data-lwm-detail
                >
                  {!selectedLwmRun && !wm ? (
                    <div className="px-5 py-10 text-center text-xs text-neutral-500">
                      Select a snapshot from the list.
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col">
                      {/* Header: person + dual scores */}
                      <div className="shrink-0 border-b border-neutral-800 px-3 py-2 sm:px-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-medium text-white"
                              data-lwm-group="person"
                            >
                              {lwmScope.label || "Selected user"}
                            </p>
                            <p
                              className="mt-0.5 text-[11px] text-neutral-500"
                              data-lwm-last-updated
                            >
                              {lwmUpdatedLabel || "Not yet"}
                            </p>
                          </div>
                          <div
                            className="flex flex-wrap items-center gap-2"
                            data-lwm-group="scores"
                          >
                            <div
                              className="min-w-[5.5rem] rounded-none border border-white/80 bg-white px-3 py-2 text-black"
                              data-lwm-skill-score
                            >
                              <p className="text-[10px] font-medium text-neutral-600">
                                {LWM_CLIENT_LABELS.primary_score_short}
                              </p>
                              <p className="font-mono text-2xl font-semibold tabular-nums leading-none text-black">
                                {displaySnapScore != null ? displaySnapScore : "—"}
                              </p>
                            </div>
                            <div
                              className="min-w-[5.5rem] rounded-none border border-white/60 bg-neutral-100 px-3 py-2 text-black"
                              data-lwm-ghc-score
                            >
                              <p className="text-[10px] font-medium text-neutral-600">
                                {LWM_CLIENT_LABELS.ghc_score_short}
                              </p>
                              <p className="font-mono text-2xl font-semibold tabular-nums leading-none text-black">
                                {displayGhcScore != null ? displayGhcScore : "—"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowScoreExplainModal(true)}
                              className="flex min-h-[3.25rem] min-w-[5.5rem] flex-col justify-center rounded-none border border-white/60 bg-transparent px-3 py-2 text-left transition hover:border-white hover:bg-white/10"
                              data-lwm-explain-scores
                              title="Explain skill readiness and authenticity scores"
                            >
                              <p className="text-[10px] font-medium text-neutral-400">
                                Explain
                              </p>
                              <p className="text-sm font-semibold leading-tight text-white">
                                Scores
                              </p>
                            </button>
                          </div>
                        </div>
                      </div>

                      {showScoreExplainModal ? (
                        <div
                          className="fixed inset-0 z-50 flex items-center justify-center p-4"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="lwm-score-explain-title"
                          data-lwm-score-explain-modal
                        >
                          <div
                            className="absolute inset-0 bg-black/70 backdrop-blur-md"
                            onClick={() => setShowScoreExplainModal(false)}
                          />
                          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-none border border-neutral-800 bg-neutral-900 shadow-2xl">
                            <div className="border-b border-neutral-800/70 px-5 pb-4 pt-5">
                              <h3
                                id="lwm-score-explain-title"
                                className="text-base font-semibold text-white"
                              >
                                Explain scores
                              </h3>
                              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
                                Skill / readiness and authenticity measure different
                                things. Both apply to this selected snapshot.
                              </p>
                              <div
                                className="mt-4 space-y-3"
                                data-lwm-score-explanations
                              >
                                <div
                                  className="rounded-none border border-neutral-800 bg-neutral-950/60 px-3.5 py-3"
                                  data-lwm-primary-explanation
                                >
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="text-[12px] font-medium text-neutral-200">
                                      {LWM_CLIENT_LABELS.primary_score}
                                    </p>
                                    <p className="font-mono text-sm font-semibold tabular-nums text-white">
                                      {displaySnapScore != null ? displaySnapScore : "—"}
                                    </p>
                                  </div>
                                  {lwmExplanation?.primary_meaning ? (
                                    <p
                                      className="mt-1.5 text-xs leading-relaxed text-neutral-400"
                                      data-lwm-primary-meaning
                                    >
                                      {lwmExplanation.primary_meaning}
                                    </p>
                                  ) : (
                                    <p className="mt-1.5 text-xs text-neutral-500">
                                      No skill explanation yet.
                                    </p>
                                  )}
                                  {lwmExplanation ? (
                                    <p
                                      className="mt-1.5 text-[11px] text-neutral-500"
                                      data-lwm-primary-band={lwmExplanation.primary_band}
                                    >
                                      Stage:{" "}
                                      {lwmPrimaryBandLabel(lwmExplanation.primary_band)}
                                    </p>
                                  ) : null}
                                </div>
                                <div
                                  className="rounded-none border border-neutral-800 bg-neutral-950/60 px-3.5 py-3"
                                  data-lwm-ghc-explanation
                                >
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="text-[12px] font-medium text-neutral-200">
                                      {LWM_CLIENT_LABELS.ghc_score}
                                    </p>
                                    <p className="font-mono text-sm font-semibold tabular-nums text-white">
                                      {displayGhcScore != null ? displayGhcScore : "—"}
                                    </p>
                                  </div>
                                  {lwmExplanation?.ghc_meaning ? (
                                    <p
                                      className="mt-1.5 text-xs leading-relaxed text-neutral-400"
                                      data-lwm-ghc-meaning
                                    >
                                      {lwmExplanation.ghc_meaning}
                                    </p>
                                  ) : (
                                    <p className="mt-1.5 text-xs text-neutral-500">
                                      No authenticity explanation yet.
                                    </p>
                                  )}
                                  {lwmExplanation?.ghc_confidence ? (
                                    <p className="mt-1.5 text-[11px] text-neutral-500">
                                      Confidence: {lwmExplanation.ghc_confidence}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end px-5 py-4">
                              <button
                                type="button"
                                onClick={() => setShowScoreExplainModal(false)}
                                className="rounded-none bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
                                data-lwm-score-explain-close
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Tab bar */}
                      <div
                        className="shrink-0 border-b border-neutral-800"
                        data-lwm-detail-tabs
                      >
                        <div
                          className="-mb-px flex gap-0.5 overflow-x-auto px-2"
                          role="tablist"
                          aria-label="Snapshot detail sections"
                        >
                          {(
                            [
                              { id: "profile" as const, label: "Profile" },
                              { id: "goals" as const, label: "Goals" },
                              { id: "summary" as const, label: "Summary" },
                              { id: "markers" as const, label: "Markers" },
                              { id: "strengths" as const, label: "Strengths" },
                              { id: "gaps" as const, label: "Gaps" },
                              { id: "next_steps" as const, label: "Next steps" },
                              { id: "details" as const, label: "Details" },
                            ] as const
                          ).map((tab) => {
                            const active = lwmDetailTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                data-lwm-detail-tab={tab.id}
                                data-active={active ? "true" : "false"}
                                onClick={() => setLwmDetailTab(tab.id)}
                                className={`shrink-0 border-b-2 px-2.5 py-1.5 text-xs font-medium transition ${
                                  active
                                    ? "border-white text-white"
                                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                                }`}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tab panels */}
                      <div
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
                        role="tabpanel"
                        data-lwm-detail-panel={lwmDetailTab}
                        data-lwm-report-body
                        data-lwm-zone="report"
                        data-lwm-selected-snapshot-report
                        data-lwm-report-column
                      >
                        {lwmDetailTab === "profile" ? (
                          <div className="flex flex-col gap-5" data-lwm-detail-profile>
                            <div
                              className="rounded-none border border-neutral-800 bg-black/20 px-3 py-4"
                              data-lwm-detail-spider
                            >
                              <p className="text-[11px] font-medium text-neutral-400">
                                Competency profile
                              </p>
                              {(selectedRunReport?.marker_scores ?? []).length > 0 ? (
                                <div className="mt-3 flex justify-center">
                                  <MarkerRadarChart
                                    markers={selectedRunReport?.marker_scores ?? []}
                                    variant="large"
                                    ariaLabel="Competency marker scores"
                                    className="aspect-square h-auto w-full max-w-[min(100%,24rem)]"
                                  />
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-neutral-500">
                                  No spider markers on this snapshot.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {lwmDetailTab === "goals" ? (
                          <div className="space-y-3" data-lwm-detail-goals>
                            <p className="text-[11px] font-medium text-neutral-400">
                              Goals used for this snapshot
                            </p>
                            {(selectedRunReport?.evaluated_goals ?? []).length > 0 ? (
                              <ul className="space-y-2" data-lwm-evaluated-goals>
                                {selectedRunReport!.evaluated_goals!.map((g, i) => (
                                  <li
                                    key={g.id || `${g.scope}-${i}`}
                                    className="rounded-none border border-neutral-800 bg-neutral-950/50 px-3 py-2"
                                    data-lwm-evaluated-goal={g.id || undefined}
                                    data-lwm-goal-scope={g.scope}
                                  >
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                      {g.scope}
                                      {g.block_id ? ` · block` : ""}
                                    </p>
                                    <p className="mt-0.5 text-sm leading-relaxed text-neutral-200">
                                      {g.text}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            ) : selectedRunReport?.workspace_goal?.trim() ||
                              wm?.inferred_goal?.text ? (
                              <div
                                className="rounded-none border border-neutral-800 bg-neutral-950/50 px-3 py-2"
                                data-lwm-workspace-goal
                              >
                                <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                  Goal
                                </p>
                                <p className="mt-0.5 text-sm leading-relaxed text-neutral-200">
                                  {selectedRunReport?.workspace_goal?.trim() ||
                                    wm?.inferred_goal?.text}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-500">
                                No goals recorded on this snapshot.
                              </p>
                            )}
                          </div>
                        ) : null}

                        {lwmDetailTab === "summary" ? (
                          <div className="space-y-4" data-lwm-detail-summary>
                            {selectedRunReport?.summary ? (
                              <div>
                                <p className="text-[11px] font-medium text-neutral-400">
                                  Summary
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-neutral-300">
                                  {selectedRunReport.summary}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-500">No summary on this snapshot.</p>
                            )}
                            {(selectedRunReport?.growth_areas ?? []).length > 0 ? (
                              <div>
                                <p className="text-[11px] font-medium text-neutral-400">
                                  Growth areas
                                </p>
                                <ul className="mt-1.5 space-y-1 text-sm text-neutral-400">
                                  {selectedRunReport!.growth_areas.map((item) => (
                                    <li key={item} className="flex gap-2">
                                      <span className="text-neutral-600">↑</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {(selectedRunReport?.suggestions ?? []).length > 0 ? (
                              <div>
                                <p className="text-[11px] font-medium text-neutral-400">
                                  Suggestions
                                </p>
                                <ul className="mt-1.5 space-y-1 text-sm text-neutral-400">
                                  {selectedRunReport!.suggestions.map((item) => (
                                    <li key={item} className="flex gap-2">
                                      <span className="text-neutral-600">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {lwmDetailTab === "markers" ? (
                          <div data-lwm-detail-markers>
                            {(selectedRunReport?.marker_scores ?? []).length > 0 ? (
                              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                                {selectedRunReport!.marker_scores.map((marker) => (
                                  <div
                                    key={marker.id}
                                    className="border-b border-neutral-800/60 pb-4"
                                  >
                                    <div className="flex items-baseline justify-between gap-3">
                                      <span className="text-sm font-medium text-neutral-200">
                                        {marker.label}
                                      </span>
                                      <span className="font-mono text-lg text-white">
                                        {marker.score}
                                      </span>
                                    </div>
                                    {marker.rationale ? (
                                      <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                                        {marker.rationale}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-500">No markers on this snapshot.</p>
                            )}
                          </div>
                        ) : null}

                        {lwmDetailTab === "strengths" ? (
                          <div data-lwm-detail-strengths>
                            {(selectedRunReport?.strengths ?? []).length > 0 ? (
                              <ul className="space-y-2 text-sm leading-relaxed text-neutral-300">
                                {selectedRunReport!.strengths.map((item) => (
                                  <li key={item} className="flex gap-2">
                                    <span className="text-neutral-500">+</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-neutral-500">No strengths listed.</p>
                            )}
                          </div>
                        ) : null}

                        {lwmDetailTab === "gaps" ? (
                          <div data-lwm-detail-gaps>
                            {(() => {
                              const gapAnalysis = normalizePerformanceGapAnalysis(
                                selectedRunReport?.gap_analysis,
                              );
                              if (gapAnalysis.gaps.length === 0) {
                                return (
                                  <p className="text-xs text-neutral-500">
                                    {gapAnalysis.summary || "No gaps identified."}
                                  </p>
                                );
                              }
                              return (
                                <div className="space-y-2">
                                  {gapAnalysis.summary ? (
                                    <p className="text-xs leading-relaxed text-neutral-400">
                                      {gapAnalysis.summary}
                                    </p>
                                  ) : null}
                                  <ul className="space-y-2">
                                    {gapAnalysis.gaps.map((gap) => (
                                      <li
                                        key={gap.title}
                                        className="rounded-none border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-xs"
                                      >
                                        <div className="font-medium text-neutral-200">
                                          {gap.title}
                                        </div>
                                        {gap.proof_of_work ? (
                                          <p className="mt-1 leading-relaxed text-neutral-400">
                                            {gap.proof_of_work}
                                          </p>
                                        ) : null}
                                        {gap.suggested_repair ? (
                                          <p className="mt-1 text-neutral-500">
                                            Repair: {gap.suggested_repair}
                                          </p>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}

                        {lwmDetailTab === "next_steps" ? (
                          <div data-lwm-detail-next-steps>
                            {(() => {
                              const gapAnalysis = normalizePerformanceGapAnalysis(
                                selectedRunReport?.gap_analysis,
                              );
                              const dirs = gapAnalysis.next_steps.directions ?? [];
                              const events = gapAnalysis.next_steps.events ?? [];
                              if (dirs.length === 0 && events.length === 0) {
                                return (
                                  <p className="text-xs text-neutral-500">
                                    No next steps on this snapshot.
                                  </p>
                                );
                              }
                              return (
                                <div className="space-y-4">
                                  {dirs.length > 0 ? (
                                    <div>
                                      <p className="text-[11px] font-medium text-neutral-400">
                                        Directions
                                      </p>
                                      <ul className="mt-1.5 space-y-1.5 text-sm text-neutral-300">
                                        {dirs.map((d) => (
                                          <li key={d} className="flex gap-2">
                                            <span className="text-neutral-600">→</span>
                                            <span>{d}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {events.length > 0 ? (
                                    <div>
                                      <p className="text-[11px] font-medium text-neutral-400">
                                        Events
                                      </p>
                                      <ul className="mt-1.5 space-y-1.5 text-sm text-neutral-300">
                                        {events.map((e) => (
                                          <li key={e} className="flex gap-2">
                                            <span className="text-neutral-600">•</span>
                                            <span>{e}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}

                        {lwmDetailTab === "details" ? (
                          <div className="space-y-3 text-xs text-neutral-400" data-lwm-detail-meta>
                            {(kc && !kc.empty) || selectedLwmRun?.source ? (
                              <div data-lwm-group="evidence">
                                <p className="font-medium text-neutral-300">Evidence</p>
                                {kc && !kc.empty ? (
                                  <p className="mt-1">
                                    Knowledge embedding confidence:{" "}
                                    {(kc.confidence * 100).toFixed(0)}% · {kc.pow_event_count}{" "}
                                    proof-of-work event
                                    {kc.pow_event_count === 1 ? "" : "s"}
                                  </p>
                                ) : null}
                                {selectedLwmRun?.source ? (
                                  <p className="mt-1">Source: {selectedLwmRun.source}</p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-neutral-500">No extra evidence metadata.</p>
                            )}
                            {wm &&
                            ((wm.learning_profile?.strengths?.length ?? 0) > 0 ||
                              (wm.evidence_appetite?.want_more?.length ?? 0) > 0 ||
                              (wm.evidence_appetite?.saturated?.length ?? 0) > 0) ? (
                              <div data-lwm-group="profile" data-lwm-profile-disclosure>
                                <p className="font-medium text-neutral-300">
                                  World-model notes
                                </p>
                                {wm.learning_profile?.strengths &&
                                wm.learning_profile.strengths.length > 0 ? (
                                  <p className="mt-1">
                                    Strengths: {wm.learning_profile.strengths.slice(0, 8).join(" · ")}
                                  </p>
                                ) : null}
                                {wm.evidence_appetite?.want_more &&
                                wm.evidence_appetite.want_more.length > 0 ? (
                                  <p className="mt-1">
                                    Could use more evidence on:{" "}
                                    {wm.evidence_appetite.want_more.slice(0, 6).join(" · ")}
                                  </p>
                                ) : null}
                                {wm.evidence_appetite?.saturated &&
                                wm.evidence_appetite.saturated.length > 0 ? (
                                  <p className="mt-1">
                                    Already well covered:{" "}
                                    {wm.evidence_appetite.saturated.slice(0, 4).join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </section>
  );
}
