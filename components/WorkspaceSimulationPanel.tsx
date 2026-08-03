"use client";

import { useMemo, useState } from "react";
import {
  deriveWorkspaceSimulationOverview,
  type WorkspaceSimulationBlockRef,
} from "@/lib/workspace-simulation-overview";
import {
  validateWorkspaceSimulation,
  type WorkspaceValidationResult,
} from "@/lib/workspace-simulation-validation";

/**
 * Workspace-level Simulation tab: helps course authors understand how a
 * learner might navigate blocks (starts, locks, Explore/Drill, sample probes).
 * Distinct from the per-block "Block Simulation" drawer.
 *
 * Includes holistic workspace validation (name, goal, blocks, context) with
 * actionable improvement ideas — pure/deterministic, author-triggered.
 */
export function WorkspaceSimulationPanel({
  blocks,
  workspaceTitle,
  workspaceGoal,
  workspaceDescription,
  workspaceNotes,
  workspaceFileCount,
  externalResourceCount,
}: {
  blocks: readonly WorkspaceSimulationBlockRef[];
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  workspaceNotes?: string | null;
  workspaceFileCount?: number | null;
  externalResourceCount?: number | null;
}) {
  const overview = useMemo(
    () =>
      deriveWorkspaceSimulationOverview(blocks, {
        workspaceTitle,
        workspaceGoal,
        rootTopic: workspaceTitle,
        notes: workspaceNotes,
      }),
    [blocks, workspaceGoal, workspaceNotes, workspaceTitle],
  );

  const validationInput = useMemo(
    () => ({
      name: workspaceTitle,
      goal: workspaceGoal,
      description: workspaceDescription,
      notes: workspaceNotes,
      blocks,
      workspaceFileCount: workspaceFileCount ?? 0,
      externalResourceCount: externalResourceCount ?? 0,
    }),
    [
      blocks,
      externalResourceCount,
      workspaceDescription,
      workspaceFileCount,
      workspaceGoal,
      workspaceNotes,
      workspaceTitle,
    ],
  );

  const [validation, setValidation] = useState<WorkspaceValidationResult | null>(
    null,
  );

  const runValidation = () => {
    // Pure sync evaluation — same shipped path unit tests drive.
    setValidation(validateWorkspaceSimulation(validationInput));
  };

  const title = String(workspaceTitle || "").trim() || "Workspace";

  return (
    <div
      data-workspace-simulation-section
      data-workspace-simulation-panel
      data-simulation-block-count={overview.blockCount}
      data-simulation-start-count={overview.startCount}
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-y-contain p-1 sm:p-2"
    >
      <header className="space-y-1" data-workspace-simulation-header>
        <h2 className="text-sm font-semibold tracking-tight text-white">
          Simulation
        </h2>
        <p className="max-w-2xl text-[12px] leading-relaxed text-neutral-400">
          How a learner might interact with{" "}
          <span className="text-neutral-200">{title}</span> — entry points,
          practice modes, sample paths, and probes derived from your blocks.
          This is an author preview, not a live learner session.
        </p>
      </header>

      {/* Workspace validation */}
      <section
        className="rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-3 sm:px-4"
        data-workspace-simulation-validation
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Workspace validation
            </h3>
            <p className="text-[12px] leading-relaxed text-neutral-400">
              Holistic check of name, goal, blocks, context, and learner path —
              returns readiness findings and improvement ideas.
            </p>
          </div>
          <button
            type="button"
            data-simulation-validation-run
            onClick={runValidation}
            className="shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-neutral-100 transition hover:border-white/25 hover:bg-white/[0.1]"
          >
            Run validation
          </button>
        </div>

        {validation ? (
          <div
            className="mt-3 space-y-3"
            data-simulation-validation-result
            data-simulation-validation-score={validation.score}
            data-simulation-validation-criticals={validation.stats.criticalCount}
            data-simulation-validation-ideas={validation.stats.ideaCount}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[12px] text-white"
                data-simulation-validation-score-badge
              >
                Score {validation.score}
              </span>
              {validation.stats.criticalCount > 0 ? (
                <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">
                  {validation.stats.criticalCount} critical
                </span>
              ) : null}
              {validation.stats.warningCount > 0 ? (
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                  {validation.stats.warningCount} warning
                  {validation.stats.warningCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <p
              className="text-[12px] leading-relaxed text-neutral-300"
              data-simulation-validation-summary
            >
              {validation.summary}
            </p>

            <div className="space-y-1.5" data-simulation-validation-findings>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Findings
              </p>
              <ul className="space-y-1.5">
                {validation.findings.map((f) => (
                  <li
                    key={f.id}
                    data-simulation-validation-finding={f.id}
                    data-simulation-validation-dimension={f.dimension}
                    data-simulation-validation-severity={f.severity}
                    className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2"
                  >
                    <p className="text-[12px] font-medium text-neutral-100">
                      <span
                        className={
                          f.severity === "critical"
                            ? "text-rose-300"
                            : f.severity === "warning"
                              ? "text-amber-300"
                              : f.severity === "ok"
                                ? "text-emerald-400/90"
                                : "text-neutral-500"
                        }
                      >
                        {f.severity}
                      </span>
                      <span className="mx-1.5 text-neutral-600">·</span>
                      {f.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                      {f.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5" data-simulation-validation-ideas>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Improvement ideas
              </p>
              <ul className="space-y-1.5">
                {validation.ideas.map((idea) => (
                  <li
                    key={idea.id}
                    data-simulation-validation-idea={idea.id}
                    data-simulation-validation-idea-dimension={idea.dimension}
                    data-simulation-validation-idea-priority={idea.priority}
                    className="rounded-md border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-2"
                  >
                    <p className="text-[12px] font-medium text-sky-100/95">
                      <span className="text-[10px] uppercase tracking-wide text-sky-400/80">
                        {idea.priority}
                      </span>
                      <span className="mx-1.5 text-neutral-600">·</span>
                      {idea.action}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                      {idea.rationale}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p
            className="mt-2 text-[11px] text-neutral-600"
            data-simulation-validation-idle
          >
            Run validation to evaluate this workspace holistically.
          </p>
        )}
      </section>

      {/* Inventory stats */}
      <section
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        data-workspace-simulation-stats
      >
        {[
          { label: "Blocks", value: overview.blockCount, key: "blocks" },
          { label: "Starters", value: overview.startCount, key: "starts" },
          { label: "Locked", value: overview.lockedCount, key: "locked" },
          {
            label: "With local context",
            value: overview.withLocalContextCount,
            key: "local",
          },
        ].map((s) => (
          <div
            key={s.key}
            data-simulation-stat={s.key}
            className="rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              {s.label}
            </p>
            <p className="mt-0.5 font-mono text-lg text-white">{s.value}</p>
          </div>
        ))}
      </section>

      {/* Journey */}
      <section
        className="rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-3 sm:px-4"
        data-workspace-simulation-journey
      >
        <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Learner journey
        </h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-300">
          {overview.journeySummary}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" data-simulation-modes>
          {overview.interactionModes.map((mode) => (
            <span
              key={mode}
              data-simulation-mode={mode}
              className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-400"
            >
              {mode}
            </span>
          ))}
        </div>
      </section>

      {/* Sample paths */}
      <section className="space-y-2" data-workspace-simulation-paths>
        <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Sample paths
        </h3>
        {overview.samplePaths.length === 0 ? (
          <p className="text-[12px] text-neutral-600" data-simulation-paths-empty>
            No paths yet — add blocks and mark starters on the map.
          </p>
        ) : (
          overview.samplePaths.map((path, pi) => (
            <ol
              key={`path-${pi}-${path[0]?.blockId || pi}`}
              data-simulation-path={pi}
              className="space-y-1.5 rounded-lg border border-white/10 bg-neutral-950/50 p-2.5"
            >
              {path.map((step, si) => (
                <li
                  key={step.blockId}
                  data-simulation-path-step={step.blockId}
                  className="flex items-start gap-2 text-[12px]"
                >
                  <span className="mt-0.5 font-mono text-[10px] text-neutral-600">
                    {si + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-100">
                      {step.title}
                      {step.isStart ? (
                        <span className="ml-1.5 text-[9px] uppercase tracking-wide text-neutral-500">
                          start
                        </span>
                      ) : null}
                      {step.locked ? (
                        <span className="ml-1.5 text-[9px] uppercase tracking-wide text-amber-500/80">
                          locked
                        </span>
                      ) : null}
                    </p>
                    {step.locked && step.lockUntilTitles.length > 0 ? (
                      <p className="text-[10px] text-neutral-500">
                        Until: {step.lockUntilTitles.join(", ")}
                      </p>
                    ) : null}
                    <p className="text-[10px] text-neutral-600">
                      {step.practiceModes.join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ))
        )}
      </section>

      {/* Sample probes */}
      <section className="space-y-2" data-workspace-simulation-probes>
        <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Sample practice (from blocks)
        </h3>
        <p className="text-[11px] text-neutral-600">
          Preview questions and exercises a learner might see. For full 3+3
          probes and regenerate, open a block → Block Simulation.
        </p>
        {overview.sampleProbes.length === 0 ? (
          <p className="text-[12px] text-neutral-600" data-simulation-probes-empty>
            No probe samples until blocks exist.
          </p>
        ) : (
          overview.sampleProbes.map((group) => (
            <div
              key={group.blockId}
              data-simulation-probe-group={group.blockId}
              className="rounded-lg border border-white/10 bg-neutral-950/50 p-2.5"
            >
              <p className="text-[11px] font-medium text-neutral-200">
                {group.blockTitle}
              </p>
              <ul className="mt-1.5 space-y-1">
                {group.questions.map((q) => (
                  <li
                    key={q.id}
                    data-simulation-probe-kind="question"
                    className="text-[11px] leading-snug text-neutral-400"
                  >
                    <span className="text-neutral-600">Q · </span>
                    {q.question}
                  </li>
                ))}
                {group.exercises.map((ex) => (
                  <li
                    key={ex.id}
                    data-simulation-probe-kind="exercise"
                    className="text-[11px] leading-snug text-neutral-400"
                  >
                    <span className="text-neutral-600">Ex · </span>
                    {ex.question}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
