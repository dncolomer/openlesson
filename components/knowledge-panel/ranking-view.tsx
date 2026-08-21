"use client";

import { MarkerRadarChart } from "@/components/MarkerRadarChart";
import { formatRankingScore } from "@/lib/pow-api/knowledge-ranking";
import { normalizePerformanceGapAnalysis } from "@/lib/pow-api/performance-context";
import { useKnowledgeRanking } from "@/components/knowledge-panel/use-knowledge-ranking";
import type { KnowledgeRankingViewProps } from "@/components/knowledge-panel/types";

export function KnowledgeRankingView({
  workspaceId,
  currentUserId = null,
  ayclToken,
  canInspectOthers,
}: KnowledgeRankingViewProps) {
  const {
    rankingCards,
    rankingLoading,
    rankingError,
    selectedRankingCard,
    selectedRankingReport,
    setSelectedRankingKey,
    loadRanking,
  } = useKnowledgeRanking({
    workspaceId,
    currentUserId,
    ayclToken,
    canInspectOthers,
  });

  return (
    <section
      data-section="ranking"
      data-ranking-layout="list-detail"
      className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden"
      aria-label="Knowledge ranking"
    >
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            Ranking
          </p>
          <p className="mt-0.5 text-sm text-neutral-400">
            Latest Snapshot + GHC per person
            {canInspectOthers ? " — select a card for spider, strengths, and gaps" : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRanking()}
          disabled={rankingLoading}
          data-ranking-refresh
          className="inline-flex items-center gap-1.5 rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
        >
          {rankingLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {rankingError ? (
        <div
          className="shrink-0 rounded-none border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300"
          data-ranking-error
        >
          {rankingError}
        </div>
      ) : null}

      {rankingLoading && rankingCards.length === 0 ? (
        <p className="text-xs text-neutral-500" data-ranking-loading>
          Loading ranking…
        </p>
      ) : rankingCards.length === 0 ? (
        <div
          className="rounded-none border border-dashed border-neutral-700 bg-neutral-950/40 px-5 py-8 text-center"
          data-ranking-empty
        >
          <p className="text-sm font-medium text-neutral-200">No subjects yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-neutral-500">
            Generate LWM Snapshots from the Learning Profiles tab to populate ranks.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          <aside
            className="flex w-64 shrink-0 flex-col overflow-hidden sm:w-72"
            data-ranking-sidebar
          >
            <ol
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5"
              data-ranking-list
              data-ranking-count={rankingCards.length}
            >
              {rankingCards.map((card) => {
                const selected =
                  (selectedRankingCard?.subjectKey ?? rankingCards[0]?.subjectKey) ===
                  card.subjectKey;
                return (
                  <li key={card.subjectKey}>
                    <button
                      type="button"
                      onClick={() => setSelectedRankingKey(card.subjectKey)}
                      className={`w-full rounded-none border px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-neutral-700/70 bg-neutral-950/30 ring-1 ring-neutral-800/40"
                          : "border-neutral-800/90 bg-neutral-950/70 hover:border-neutral-600 hover:bg-neutral-900/60"
                      }`}
                      data-ranking-card={card.subjectKey}
                      data-ranking-rank={card.rank}
                      data-ranking-has-snapshot={card.hasSnapshot ? "true" : "false"}
                      data-ranking-selected={selected ? "true" : "false"}
                      aria-pressed={selected}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-[1.2px] text-neutral-500">
                          #{card.rank}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
                          <span
                            className="rounded-full border border-neutral-800/50 bg-neutral-950/40 px-1.5 py-0.5 text-neutral-200"
                            data-ranking-snapshot-score
                          >
                            {formatRankingScore(card.snapshotScore)}
                          </span>
                          <span
                            className="rounded-full border border-neutral-800/50 bg-neutral-950/40 px-1.5 py-0.5 text-neutral-200"
                            data-ranking-ghc-score
                          >
                            {formatRankingScore(card.ghcScore)}
                          </span>
                        </div>
                      </div>
                      <p
                        className="mt-1 truncate text-sm font-medium text-neutral-100"
                        data-ranking-label
                        title={card.label}
                      >
                        {card.label}
                      </p>
                      {card.ranAt ? (
                        <p className="mt-0.5 text-[10px] text-neutral-500" data-ranking-ran-at>
                          {new Date(card.ranAt).toLocaleString()}
                        </p>
                      ) : (
                        <p
                          className="mt-0.5 text-[10px] text-neutral-600"
                          data-ranking-no-snapshot
                        >
                          No snapshot yet
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-none border border-neutral-800/90 bg-neutral-950/50"
            data-ranking-detail
            data-ranking-detail-subject={selectedRankingCard?.subjectKey ?? ""}
          >
            {selectedRankingCard ? (
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[1.2px] text-neutral-500">
                      #{selectedRankingCard.rank} · detail
                    </p>
                    <h3
                      className="mt-0.5 truncate text-lg font-medium text-white"
                      data-ranking-detail-label
                    >
                      {selectedRankingCard.label}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-none border border-neutral-800/40 bg-neutral-950/20 px-3 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-300/80">
                        Snapshot
                      </p>
                      <p className="font-mono text-xl font-semibold tabular-nums text-neutral-200">
                        {formatRankingScore(selectedRankingCard.snapshotScore)}
                      </p>
                    </div>
                    <div className="rounded-none border border-neutral-800/40 bg-neutral-950/20 px-3 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-300/80">
                        GHC
                      </p>
                      <p className="font-mono text-xl font-semibold tabular-nums text-neutral-200">
                        {formatRankingScore(selectedRankingCard.ghcScore)}
                      </p>
                    </div>
                  </div>
                </div>

                {!selectedRankingCard.hasSnapshot || !selectedRankingReport ? (
                  <div
                    className="rounded-none border border-dashed border-neutral-700 px-4 py-8 text-center text-sm text-neutral-500"
                    data-ranking-detail-empty
                  >
                    {selectedRankingCard.hasSnapshot
                      ? "This snapshot has no report body (spider / strengths / gaps unavailable)."
                      : "No snapshot for this person yet — generate one from Learning Profiles."}
                  </div>
                ) : (
                  <>
                    <div
                      className="rounded-none border border-neutral-800 bg-black/20 px-3 py-4"
                      data-ranking-detail-spider
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                        Competency profile
                      </div>
                      {(selectedRankingReport.marker_scores ?? []).length > 0 ? (
                        <div className="mt-3 flex justify-center">
                          <MarkerRadarChart
                            markers={selectedRankingReport.marker_scores ?? []}
                            variant="large"
                            ariaLabel="Competency marker scores"
                            className="aspect-square h-auto w-full max-w-[min(100%,22rem)]"
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-neutral-500">
                          No marker scores on this snapshot.
                        </p>
                      )}
                    </div>

                    <div data-ranking-detail-strengths>
                      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                        Strengths
                      </div>
                      {(selectedRankingReport.strengths ?? []).length > 0 ? (
                        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-neutral-300">
                          {selectedRankingReport.strengths.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="text-emerald-500/80">+</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-neutral-500">No strengths listed.</p>
                      )}
                    </div>

                    <div data-ranking-detail-gaps>
                      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                        Gaps
                      </div>
                      {(() => {
                        const gapAnalysis = normalizePerformanceGapAnalysis(
                          selectedRankingReport.gap_analysis,
                        );
                        if (gapAnalysis.gaps.length === 0) {
                          return (
                            <p className="mt-2 text-xs text-neutral-500">
                              {gapAnalysis.summary || "No gaps identified."}
                            </p>
                          );
                        }
                        return (
                          <div className="mt-2 space-y-2">
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
                                  data-ranking-gap={gap.title}
                                >
                                  <div className="font-medium text-neutral-200">{gap.title}</div>
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
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
