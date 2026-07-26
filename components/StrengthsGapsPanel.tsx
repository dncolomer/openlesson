"use client";

import { useMemo, useState } from "react";
import type { KnowledgeRankingCard } from "@/lib/pow-api/knowledge-ranking";
import {
  buildStrengthsGapsBrowseModel,
  severityStackFractions,
  type BrowsableGap,
  type BrowsableStrength,
  type CohortThemeOverlap,
  type LinkedPowAction,
} from "@/lib/pow-api/strengths-gaps-analysis";

type StrengthsGapsPanelProps = {
  cards: KnowledgeRankingCard[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

function severityClass(severity: BrowsableGap["severity"]): string {
  if (severity === "high") return "border-red-900/50 bg-red-950/30 text-red-200";
  if (severity === "low") return "border-emerald-900/40 bg-emerald-950/20 text-emerald-200";
  return "border-amber-900/40 bg-amber-950/20 text-amber-100";
}

function actionKindLabel(kind: LinkedPowAction["kind"]): string {
  switch (kind) {
    case "proof_of_work_evidence":
      return "PoW evidence";
    case "next_step_event":
      return "PoW action";
    case "next_step_direction":
      return "Direction";
    case "suggested_repair":
      return "Repair";
    default:
      return kind;
  }
}

function formatSubjectList(labels: string[], max = 4): string {
  if (labels.length === 0) return "";
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

function SeverityMiniBar({
  severity,
}: {
  severity: CohortThemeOverlap["severity"];
}) {
  const stack = severityStackFractions(severity);
  if (stack.total <= 0) return null;
  return (
    <div
      className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-900"
      data-severity-stack
      title={`H ${severity?.high ?? 0} · M ${severity?.medium ?? 0} · L ${severity?.low ?? 0}`}
    >
      {stack.high > 0 ? (
        <span
          className="h-full bg-red-500/80"
          style={{ width: `${stack.high * 100}%` }}
          data-severity-high-frac={stack.high}
        />
      ) : null}
      {stack.medium > 0 ? (
        <span
          className="h-full bg-amber-500/80"
          style={{ width: `${stack.medium * 100}%` }}
          data-severity-medium-frac={stack.medium}
        />
      ) : null}
      {stack.low > 0 ? (
        <span
          className="h-full bg-emerald-600/70"
          style={{ width: `${stack.low * 100}%` }}
          data-severity-low-frac={stack.low}
        />
      ) : null}
    </div>
  );
}

function shortLabel(label: string): string {
  const t = label.trim();
  if (!t) return "?";
  const parts = t.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

/**
 * Mini Venn: overlapping circles for subjects who share a theme.
 * 2 circles for pairs; 3-circle layout for 3+ (center shows full count).
 * Ghost outline shows rest of cohort so overlap vs total is readable.
 */
function ThemeVennDiagram({
  kind,
  subjectCount,
  subjectsWithReports,
  subjectLabels,
  themeLabel,
}: {
  kind: "gap" | "strength";
  subjectCount: number;
  subjectsWithReports: number;
  subjectLabels: string[];
  themeLabel: string;
}) {
  const fill = kind === "gap" ? "rgb(245 158 11)" : "rgb(16 185 129)"; // amber-500 / emerald-500
  const n = Math.max(0, subjectCount);
  const denom = Math.max(subjectsWithReports, n, 1);
  const coveragePct = Math.round((n / denom) * 100);
  const labels = subjectLabels.slice(0, 3).map(shortLabel);
  const extra = Math.max(0, n - 3);

  // Classic layouts in viewBox 0 0 160 100
  const circles2 = [
    { cx: 58, cy: 50, r: 34 },
    { cx: 102, cy: 50, r: 34 },
  ];
  const circles3 = [
    { cx: 62, cy: 42, r: 30 },
    { cx: 98, cy: 42, r: 30 },
    { cx: 80, cy: 68, r: 30 },
  ];
  const circles = n <= 2 ? circles2 : circles3;
  const shown = n <= 2 ? Math.min(n, 2) : 3;

  return (
    <svg
      viewBox="0 0 160 100"
      className="mx-auto h-auto w-full max-w-[11rem]"
      role="img"
      aria-label={`${themeLabel}: ${n} of ${denom} subjects overlap (${coveragePct}%)`}
      data-theme-venn
      data-theme-venn-kind={kind}
      data-theme-venn-subjects={n}
      data-theme-venn-coverage={coveragePct}
    >
      {/* Ghost cohort ring — full report population */}
      <circle
        cx="80"
        cy="50"
        r="46"
        fill="none"
        stroke="rgb(64 64 64)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.55"
        data-theme-venn-cohort-ring
      />
      {circles.slice(0, shown).map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={fill}
          fillOpacity={0.28 + i * 0.04}
          stroke={fill}
          strokeOpacity={0.55}
          strokeWidth="1.25"
          data-theme-venn-circle={i}
        />
      ))}
      {/* Intersection / count badge */}
      <circle cx="80" cy={n <= 2 ? 50 : 48} r="14" fill="rgb(10 10 10)" fillOpacity="0.72" />
      <text
        x="80"
        y={n <= 2 ? 54 : 52}
        textAnchor="middle"
        className="fill-white"
        style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
        data-theme-venn-count
      >
        {n}
      </text>
      {labels.slice(0, shown).map((lab, i) => {
        const pos =
          n <= 2
            ? [
                { x: 40, y: 54 },
                { x: 120, y: 54 },
              ][i]
            : [
                { x: 42, y: 40 },
                { x: 118, y: 40 },
                { x: 80, y: 88 },
              ][i];
        if (!pos) return null;
        return (
          <text
            key={`lab-${i}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            style={{
              fontSize: "9px",
              fontFamily: "ui-monospace, monospace",
              fill: "rgb(212 212 216)",
            }}
            data-theme-venn-label={lab}
          >
            {lab}
          </text>
        );
      })}
      {extra > 0 ? (
        <text
          x="80"
          y="96"
          textAnchor="middle"
          style={{ fontSize: "8px", fontFamily: "ui-monospace, monospace", fill: "rgb(115 115 115)" }}
        >
          +{extra} more
        </text>
      ) : null}
    </svg>
  );
}

function CohortVennGrid({
  gapThemes,
  strengthThemes,
  subjectsWithReports,
}: {
  gapThemes: CohortThemeOverlap[];
  strengthThemes: CohortThemeOverlap[];
  subjectsWithReports: number;
}) {
  const gaps = gapThemes.slice(0, 4);
  const strengths = strengthThemes.slice(0, 4);
  const empty = gaps.length === 0 && strengths.length === 0;

  if (empty) {
    return (
      <div
        className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/40 px-4 py-6 text-center"
        data-cohort-coverage-chart
        data-cohort-venn-grid
        data-cohort-coverage-empty="true"
      >
        <p className="text-xs text-neutral-500">
          No multi-subject themes yet — shared gaps and strengths appear here as Venn-style
          overlap diagrams.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 sm:p-5"
      data-cohort-coverage-chart
      data-cohort-venn-grid
      data-cohort-coverage-empty="false"
      data-cohort-coverage-rows={gaps.length + strengths.length}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-500">
            Overlap map
          </p>
          <p className="mt-0.5 text-sm text-neutral-300">
            Venn-style view of who shares each theme
            {subjectsWithReports > 0 ? ` · ${subjectsWithReports} subjects with reports` : ""}.
            Dashed ring = full cohort; filled circles = people on that theme.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wide text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500/80" /> Gaps
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500/80" /> Strengths
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2" data-cohort-venn-columns>
        <div data-cohort-venn-col="gaps">
          <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-amber-500/80">
            Shared gaps
          </p>
          {gaps.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">No shared gap themes yet.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {gaps.map((theme) => {
                const coveragePct =
                  subjectsWithReports > 0
                    ? Math.round((theme.subjectCount / subjectsWithReports) * 100)
                    : 0;
                return (
                  <li
                    key={theme.themeKey}
                    className="rounded-lg border border-neutral-800 bg-black/25 p-3"
                    data-cohort-coverage-row={theme.themeKey}
                    data-cohort-coverage-kind="gap"
                    data-cohort-coverage-pct={coveragePct}
                    data-cohort-venn-card={theme.themeKey}
                  >
                    <ThemeVennDiagram
                      kind="gap"
                      subjectCount={theme.subjectCount}
                      subjectsWithReports={subjectsWithReports}
                      subjectLabels={theme.subjectLabels}
                      themeLabel={theme.label}
                    />
                    <p className="mt-2 line-clamp-2 text-center text-xs font-medium text-neutral-100">
                      {theme.label}
                    </p>
                    <p className="mt-0.5 text-center font-mono text-[10px] tabular-nums text-amber-200/80">
                      {theme.subjectCount} overlap · {coveragePct}% cohort
                    </p>
                    <p
                      className="mt-1 truncate text-center text-[10px] text-neutral-500"
                      title={theme.subjectLabels.join(", ")}
                    >
                      {formatSubjectList(theme.subjectLabels, 3)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div data-cohort-venn-col="strengths">
          <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-emerald-500/80">
            Shared strengths
          </p>
          {strengths.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">No shared strength themes yet.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {strengths.map((theme) => {
                const coveragePct =
                  subjectsWithReports > 0
                    ? Math.round((theme.subjectCount / subjectsWithReports) * 100)
                    : 0;
                return (
                  <li
                    key={theme.themeKey}
                    className="rounded-lg border border-neutral-800 bg-black/25 p-3"
                    data-cohort-coverage-row={theme.themeKey}
                    data-cohort-coverage-kind="strength"
                    data-cohort-coverage-pct={coveragePct}
                    data-cohort-venn-card={theme.themeKey}
                  >
                    <ThemeVennDiagram
                      kind="strength"
                      subjectCount={theme.subjectCount}
                      subjectsWithReports={subjectsWithReports}
                      subjectLabels={theme.subjectLabels}
                      themeLabel={theme.label}
                    />
                    <p className="mt-2 line-clamp-2 text-center text-xs font-medium text-neutral-100">
                      {theme.label}
                    </p>
                    <p className="mt-0.5 text-center font-mono text-[10px] tabular-nums text-emerald-200/80">
                      {theme.subjectCount} overlap · {coveragePct}% cohort
                    </p>
                    <p
                      className="mt-1 truncate text-center text-[10px] text-neutral-500"
                      title={theme.subjectLabels.join(", ")}
                    >
                      {formatSubjectList(theme.subjectLabels, 3)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function StrengthsGapsPanel({
  cards,
  loading = false,
  error = null,
  onRefresh,
}: StrengthsGapsPanelProps) {
  const model = useMemo(
    () =>
      buildStrengthsGapsBrowseModel(
        cards.map((c) => ({
          subjectKey: c.subjectKey,
          subjectLabel: c.label,
          report: c.report,
        })),
      ),
    [cards],
  );

  const [focus, setFocus] = useState<"analysis" | "strengths" | "gaps">("analysis");
  const [selectedGapId, setSelectedGapId] = useState<string | null>(null);
  const [selectedStrengthId, setSelectedStrengthId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<"all" | BrowsableGap["severity"]>(
    "all",
  );

  const filteredGaps = useMemo(() => {
    if (severityFilter === "all") return model.gaps;
    return model.gaps.filter((g) => g.severity === severityFilter);
  }, [model.gaps, severityFilter]);

  const selectedGap: BrowsableGap | null = useMemo(() => {
    if (filteredGaps.length === 0) return null;
    if (selectedGapId && filteredGaps.some((g) => g.id === selectedGapId)) {
      return filteredGaps.find((g) => g.id === selectedGapId) ?? null;
    }
    return filteredGaps[0] ?? null;
  }, [filteredGaps, selectedGapId]);

  const selectedStrength: BrowsableStrength | null = useMemo(() => {
    if (model.strengths.length === 0) return null;
    if (
      selectedStrengthId &&
      model.strengths.some((s) => s.id === selectedStrengthId)
    ) {
      return model.strengths.find((s) => s.id === selectedStrengthId) ?? null;
    }
    return model.strengths[0] ?? null;
  }, [model.strengths, selectedStrengthId]);

  const { analysis } = model;

  return (
    <section
      data-section="strengths-gaps"
      data-strengths-gaps-layout="browse-analysis"
      className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden"
      aria-label="Strengths and gaps"
    >
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            Strengths &amp; Gaps
          </p>
          <p className="mt-0.5 text-sm text-neutral-400">
            Browse strengths and gaps from latest snapshots — link gaps to PoW evidence and next
            actions, with cohort analysis.
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            data-strengths-gaps-refresh
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          className="shrink-0 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300"
          data-strengths-gaps-error
        >
          {error}
        </div>
      ) : null}

      {loading && cards.length === 0 ? (
        <p className="text-xs text-neutral-500" data-strengths-gaps-loading>
          Loading strengths &amp; gaps…
        </p>
      ) : cards.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-neutral-700 bg-neutral-950/40 px-5 py-8 text-center"
          data-strengths-gaps-empty
        >
          <p className="text-sm font-medium text-neutral-200">No snapshot data yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-neutral-500">
            Generate LWM Snapshots from the Learning World Model tab to populate strengths, gaps,
            and PoW-linked analysis.
          </p>
        </div>
      ) : (
        <>
          <div
            className="flex shrink-0 gap-1 border-b border-neutral-800/80 pb-px"
            data-strengths-gaps-analysis
            data-strength-count={analysis.strengthCount}
            data-gap-count={analysis.gapCount}
            data-pow-linkage-rate={String(analysis.powLinkageRate)}
            data-shared-gap-theme-count={analysis.sharedGapThemes.length}
            data-shared-strength-theme-count={analysis.sharedStrengthThemes.length}
          >
            {(
              [
                ["analysis", "Cohort patterns"],
                ["gaps", `Gaps (${model.gaps.length})`],
                ["strengths", `Strengths (${model.strengths.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFocus(id)}
                data-strengths-gaps-focus={id}
                data-active={focus === id ? "true" : "false"}
                className={`rounded-t-md px-3 py-1.5 text-xs transition ${
                  focus === id
                    ? "bg-neutral-900 text-white ring-1 ring-neutral-700"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {focus === "gaps" ? (
            <div className="flex min-h-0 flex-1 gap-3">
              <aside className="flex w-64 shrink-0 flex-col overflow-hidden sm:w-72">
                <div className="mb-2 flex flex-wrap gap-1">
                  {(["all", "high", "medium", "low"] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverityFilter(sev)}
                      data-severity-filter={sev}
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        severityFilter === sev
                          ? "border-cyan-700/60 bg-cyan-950/40 text-cyan-100"
                          : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
                <ul
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5"
                  data-gaps-list
                  data-gaps-count={filteredGaps.length}
                >
                  {filteredGaps.length === 0 ? (
                    <li className="text-xs text-neutral-500">No gaps for this filter.</li>
                  ) : (
                    filteredGaps.map((gap) => {
                      const selected = selectedGap?.id === gap.id;
                      return (
                        <li key={gap.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedGapId(gap.id)}
                            data-gap-card={gap.id}
                            data-gap-severity={gap.severity}
                            data-gap-selected={selected ? "true" : "false"}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                              selected
                                ? "border-amber-700/60 bg-amber-950/25 ring-1 ring-amber-800/40"
                                : "border-neutral-800/90 bg-neutral-950/70 hover:border-neutral-600"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-mono uppercase ${severityClass(gap.severity)}`}
                              >
                                {gap.severity}
                              </span>
                              <span className="font-mono text-[10px] text-neutral-500">
                                {gap.linkedActions.length} link
                                {gap.linkedActions.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm font-medium text-neutral-100">
                              {gap.title}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                              {gap.subjectLabel}
                            </p>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </aside>

              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-xl border border-neutral-800/90 bg-neutral-950/50 p-4 sm:p-5"
                data-gap-detail
                data-gap-detail-id={selectedGap?.id ?? ""}
              >
                {selectedGap ? (
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase ${severityClass(selectedGap.severity)}`}
                        >
                          {selectedGap.severity}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {selectedGap.subjectLabel}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-medium text-white">{selectedGap.title}</h3>
                    </div>

                    {selectedGap.proofOfWork ? (
                      <div data-gap-pow-evidence>
                        <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-500">
                          Proof of work
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-neutral-300">
                          {selectedGap.proofOfWork}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500" data-gap-pow-evidence-empty>
                        No PoW evidence text on this gap.
                      </p>
                    )}

                    {selectedGap.suggestedRepair ? (
                      <div data-gap-suggested-repair>
                        <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-500">
                          Suggested repair
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-neutral-300">
                          {selectedGap.suggestedRepair}
                        </p>
                      </div>
                    ) : null}

                    <div data-gap-pow-links data-gap-pow-link-count={selectedGap.linkedActions.length}>
                      <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-500">
                        Linked PoW actions
                      </p>
                      {selectedGap.linkedActions.length === 0 ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          No linked actions derived for this gap.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {selectedGap.linkedActions.map((action) => (
                            <li
                              key={action.id}
                              data-gap-pow-link={action.id}
                              data-gap-pow-link-kind={action.kind}
                              className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2"
                            >
                              <p className="font-mono text-[10px] uppercase tracking-[1.2px] text-cyan-300/80">
                                {actionKindLabel(action.kind)}
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-neutral-200">
                                {action.detail}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Select a gap to inspect linked PoW.</p>
                )}
              </div>
            </div>
          ) : null}

          {focus === "strengths" ? (
            <div className="flex min-h-0 flex-1 gap-3">
              <aside className="flex w-64 shrink-0 flex-col overflow-hidden sm:w-72">
                <ul
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5"
                  data-strengths-gaps-list
                  data-strengths-count={model.strengths.length}
                >
                  {model.strengths.length === 0 ? (
                    <li className="text-xs text-neutral-500">No strengths listed on snapshots.</li>
                  ) : (
                    model.strengths.map((s) => {
                      const selected = selectedStrength?.id === s.id;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedStrengthId(s.id)}
                            data-strength-card={s.id}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                              selected
                                ? "border-emerald-700/60 bg-emerald-950/25 ring-1 ring-emerald-800/40"
                                : "border-neutral-800/90 bg-neutral-950/70 hover:border-neutral-600"
                            }`}
                          >
                            <p className="line-clamp-3 text-sm text-neutral-100">{s.text}</p>
                            <p className="mt-1 truncate text-[10px] text-neutral-500">
                              {s.subjectLabel}
                            </p>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </aside>
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-neutral-800/90 bg-neutral-950/50 p-4 sm:p-5"
                data-strength-detail
              >
                {selectedStrength ? (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-500">
                      Strength · {selectedStrength.subjectLabel}
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-neutral-100">
                      {selectedStrength.text}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">No strength selected.</p>
                )}
              </div>
            </div>
          ) : null}

          {focus === "analysis" ? (
            <div
              className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-xl border border-neutral-800/90 bg-neutral-950/50 p-4 sm:p-5"
              data-strengths-gaps-analysis-detail
              data-cohort-overlap-analysis
            >
              <p className="text-sm leading-relaxed text-neutral-400">
                Cross-user patterns use normalized title/text match (trim, case, whitespace) across the
                same latest-per-subject snapshots as Ranking. Themes shared by two or more people
                surface cohort gaps and common strengths without re-clustering free text.
              </p>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-neutral-800 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Subjects in roster
                  </dt>
                  <dd className="mt-1 font-mono text-lg text-neutral-100">
                    {analysis.subjectCount}
                  </dd>
                </div>
                <div className="rounded-lg border border-neutral-800 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-neutral-500">
                    With snapshot reports
                  </dt>
                  <dd className="mt-1 font-mono text-lg text-neutral-100">
                    {analysis.subjectsWithReports}
                  </dd>
                </div>
                <div className="rounded-lg border border-neutral-800 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Shared gap themes
                  </dt>
                  <dd className="mt-1 font-mono text-lg text-amber-100">
                    {analysis.sharedGapThemes.length}
                  </dd>
                </div>
                <div className="rounded-lg border border-neutral-800 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Shared strength themes
                  </dt>
                  <dd className="mt-1 font-mono text-lg text-emerald-200">
                    {analysis.sharedStrengthThemes.length}
                  </dd>
                </div>
              </dl>

              <CohortVennGrid
                gapThemes={analysis.sharedGapThemes}
                strengthThemes={analysis.sharedStrengthThemes}
                subjectsWithReports={analysis.subjectsWithReports}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <div data-shared-gaps-detail data-shared-gaps-section>
                  <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-500">
                    Gap patterns across users
                  </p>
                  {analysis.sharedGapThemes.length === 0 ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      No gap title shared by 2+ subjects yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2" data-shared-gap-themes>
                      {analysis.sharedGapThemes.map((theme) => (
                        <li
                          key={theme.themeKey}
                          data-shared-gap-theme={theme.themeKey}
                          data-theme-subject-count={theme.subjectCount}
                          className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-medium text-neutral-100">{theme.label}</p>
                            <span className="font-mono text-[11px] tabular-nums text-amber-200/90">
                              {theme.subjectCount} subjects
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                            {formatSubjectList(theme.subjectLabels, 8)}
                          </p>
                          <SeverityMiniBar severity={theme.severity} />
                          {theme.severity ? (
                            <p className="mt-1 font-mono text-[10px] text-neutral-500">
                              severity H{theme.severity.high} · M{theme.severity.medium} · L
                              {theme.severity.low}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div data-shared-strengths-detail data-shared-strengths-section>
                  <p className="font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-500">
                    Strength patterns across users
                  </p>
                  {analysis.sharedStrengthThemes.length === 0 ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      No strength text shared by 2+ subjects yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2" data-shared-strength-themes>
                      {analysis.sharedStrengthThemes.map((theme) => (
                        <li
                          key={theme.themeKey}
                          data-shared-strength-theme={theme.themeKey}
                          data-theme-subject-count={theme.subjectCount}
                          className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-medium text-neutral-100">{theme.label}</p>
                            <span className="font-mono text-[11px] tabular-nums text-emerald-200/90">
                              {theme.subjectCount} subjects
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                            {formatSubjectList(theme.subjectLabels, 8)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
