"use client";

import { useMemo, useState } from "react";
import type { WorkspaceSimulationBlockRef } from "@/lib/workspace-simulation-overview";
import type {
  SimulationSampleScope,
  SimulationSampleScopeKind,
} from "@/lib/workspace-simulation-samples";
import { DEFAULT_MODEL } from "@/lib/xai-models";

/**
 * Workspace Simulation tab: pick a block or the entire workspace, then
 * Generate sample Explore questions + Drill exercises from xAI.
 * Lists stay empty until Generate returns model text (no pure-template seed).
 */
export function WorkspaceSimulationPanel({
  workspaceId,
  blocks,
  workspaceTitle,
  workspaceGoal,
  workspaceDescription,
  workspaceNotes,
  rootTopic,
  ayclToken,
  locale = "en",
}: {
  workspaceId?: string | null;
  blocks: readonly WorkspaceSimulationBlockRef[];
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  workspaceNotes?: string | null;
  rootTopic?: string | null;
  ayclToken?: string | null;
  locale?: string;
}) {
  const title = String(workspaceTitle || rootTopic || "").trim() || "Workspace";

  const blockOptions = useMemo(
    () =>
      blocks.map((b) => ({
        id: b.id,
        title: String(b.title || "").trim() || "Untitled block",
      })),
    [blocks],
  );

  const [scopeKind, setScopeKind] = useState<SimulationSampleScopeKind>(
    () => (blockOptions.length > 0 ? "block" : "workspace"),
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string>(
    () => blockOptions[0]?.id ?? "",
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [exercises, setExercises] = useState<string[]>([]);
  const [generatedScope, setGeneratedScope] =
    useState<SimulationSampleScope | null>(null);

  const activeScope: SimulationSampleScope | null = useMemo(() => {
    if (scopeKind === "workspace") return { kind: "workspace" };
    if (!selectedBlockId) return null;
    return { kind: "block", blockId: selectedBlockId };
  }, [scopeKind, selectedBlockId]);

  const canGenerate =
    Boolean(workspaceId) &&
    !generating &&
    activeScope != null &&
    (activeScope.kind === "workspace" || Boolean(activeScope.blockId));

  // Display only xAI/API results — never pure-builder seed shells.
  const displayQuestions = questions;
  const displayExercises = exercises;

  const generate = async () => {
    if (!workspaceId || !activeScope || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      const res = await fetch("/api/workspace/simulation-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          scope: activeScope.kind,
          blockId:
            activeScope.kind === "block" ? activeScope.blockId : undefined,
          model,
          locale,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        questions?: string[];
        exercises?: string[];
        scope?: string;
        blockId?: string | null;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate samples");
      }
      const nextQ = Array.isArray(data.questions)
        ? data.questions.filter((q) => typeof q === "string" && q.trim())
        : [];
      const nextE = Array.isArray(data.exercises)
        ? data.exercises.filter((q) => typeof q === "string" && q.trim())
        : [];
      if (nextQ.length === 0 && nextE.length === 0) {
        throw new Error("No samples returned");
      }
      setQuestions(nextQ);
      setExercises(nextE);
      setGeneratedScope(activeScope);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const onScopeKindChange = (kind: SimulationSampleScopeKind) => {
    setScopeKind(kind);
    setError(null);
    // Keep prior results until regenerate so authors can compare; clear only
    // if they switch away from the scope that produced the last generate.
    if (
      generatedScope &&
      ((kind === "workspace" && generatedScope.kind !== "workspace") ||
        (kind === "block" && generatedScope.kind !== "block"))
    ) {
      setQuestions([]);
      setExercises([]);
      setGeneratedScope(null);
    }
  };

  const onBlockChange = (id: string) => {
    setSelectedBlockId(id);
    setError(null);
    if (
      generatedScope?.kind === "block" &&
      generatedScope.blockId !== id
    ) {
      setQuestions([]);
      setExercises([]);
      setGeneratedScope(null);
    }
  };

  return (
    <div
      data-workspace-simulation-section
      data-workspace-simulation-panel
      data-simulation-scope={scopeKind}
      data-simulation-block-count={blocks.length}
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-y-contain p-1 sm:p-2"
    >
      <header className="space-y-1" data-workspace-simulation-header>
        <h2 className="text-sm font-semibold tracking-tight text-white">
          Simulation
        </h2>
        <p className="max-w-2xl text-[12px] leading-relaxed text-neutral-400">
          Generate sample{" "}
          <span className="text-neutral-200">Explore questions</span> and{" "}
          <span className="text-neutral-200">Drill exercises</span> for{" "}
          <span className="text-neutral-200">{title}</span>. Lists stay empty
          until you generate.
        </p>
      </header>

      {/* Scope picker + generate */}
      <section
        className="rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-3 sm:px-4"
        data-workspace-simulation-scope
        data-simulation-scope-control
      >
        <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Scope
        </h3>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
          Samples are grounded in workspace goal and map context. Block scope
          also uses that block&apos;s text; entire workspace samples across the
          map.
        </p>

        <div
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          data-simulation-scope-picker
        >
          <fieldset className="min-w-0 flex-1 space-y-2">
            <legend className="sr-only">Simulation scope</legend>
            <label
              className="flex cursor-pointer items-start gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-2 has-[:checked]:border-white/25 has-[:checked]:bg-white/[0.06]"
              data-simulation-scope-option="workspace"
            >
              <input
                type="radio"
                name="simulation-scope"
                value="workspace"
                checked={scopeKind === "workspace"}
                onChange={() => onScopeKindChange("workspace")}
                data-simulation-scope-workspace
                className="mt-0.5"
              />
              <span>
                <span className="block text-[12px] font-medium text-neutral-100">
                  Entire workspace
                </span>
                <span className="block text-[11px] text-neutral-500">
                  Goal, notes, and map inventory
                </span>
              </span>
            </label>
            <label
              className="flex cursor-pointer items-start gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-2 has-[:checked]:border-white/25 has-[:checked]:bg-white/[0.06]"
              data-simulation-scope-option="block"
            >
              <input
                type="radio"
                name="simulation-scope"
                value="block"
                checked={scopeKind === "block"}
                onChange={() => onScopeKindChange("block")}
                disabled={blockOptions.length === 0}
                data-simulation-scope-block
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-neutral-100">
                  Single block
                </span>
                <span className="block text-[11px] text-neutral-500">
                  Focus one block plus shared workspace context
                </span>
                {scopeKind === "block" ? (
                  <select
                    data-simulation-block-select
                    value={selectedBlockId}
                    onChange={(e) => onBlockChange(e.target.value)}
                    disabled={blockOptions.length === 0}
                    className="mt-2 w-full max-w-md rounded-md border border-white/15 bg-neutral-900 px-2 py-1.5 text-[12px] text-neutral-100"
                  >
                    {blockOptions.length === 0 ? (
                      <option value="">No blocks yet</option>
                    ) : (
                      blockOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))
                    )}
                  </select>
                ) : null}
              </span>
            </label>
          </fieldset>

          <button
            type="button"
            data-simulation-generate
            data-simulation-generate-samples
            disabled={!canGenerate}
            onClick={() => void generate()}
            className="shrink-0 rounded-md border border-white/15 bg-white/[0.08] px-4 py-2 text-[12px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? "Generating…" : "Generate samples"}
          </button>
        </div>

        {!workspaceId ? (
          <p className="mt-2 text-[11px] text-amber-300/90">
            Workspace id missing — open this tab from a saved workspace to
            generate.
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[11px] text-amber-300/90" data-simulation-error>
            {error}
          </p>
        ) : null}
        {!generating &&
        questions.length === 0 &&
        exercises.length === 0 &&
        !error ? (
          <p
            className="mt-2 text-[11px] text-neutral-600"
            data-simulation-generate-hint
          >
            Click Generate samples for questions and exercises.
          </p>
        ) : null}
      </section>

      {/* Questions | Exercises — 2-col on desktop for a compact authoring view */}
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3"
        data-simulation-samples-grid
        data-simulation-samples-layout="two-col"
        data-simulation-generating={generating ? "true" : "false"}
      >
        {/* Questions (Explore) */}
        <section
          className="min-w-0 space-y-2"
          data-workspace-simulation-questions
          data-simulation-questions
          aria-busy={generating || undefined}
        >
          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Questions
            <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-600">
              Explore / dialogue
            </span>
            <span className="ml-1 font-mono text-neutral-600">
              ({generating ? "…" : displayQuestions.length})
            </span>
          </h3>
          {generating ? (
            <ul
              className="space-y-1.5"
              data-simulation-questions-loading
              data-simulation-loading="questions"
              aria-label="Generating questions"
            >
              {[0, 1, 2].map((i) => (
                <li
                  key={`q-skel-${i}`}
                  data-simulation-question-skeleton={i}
                  className="rounded-md border border-white/10 bg-neutral-950/50 px-2.5 py-2.5"
                >
                  <div className="h-2.5 w-[92%] animate-pulse rounded bg-white/10" />
                  <div className="mt-2 h-2.5 w-[68%] animate-pulse rounded bg-white/[0.07]" />
                </li>
              ))}
            </ul>
          ) : displayQuestions.length === 0 ? (
            <p
              className="text-[12px] text-neutral-600"
              data-simulation-questions-empty
            >
              No questions yet — click Generate samples.
            </p>
          ) : (
            <ul className="space-y-1.5" data-simulation-question-list>
              {displayQuestions.map((q, i) => (
                <li
                  key={`q-${i}`}
                  data-simulation-question={i}
                  data-simulation-probe-kind="question"
                  className="rounded-md border border-white/10 bg-neutral-950/50 px-2.5 py-2 text-[12px] leading-snug text-neutral-300"
                >
                  {q}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Exercises (Drill) */}
        <section
          className="min-w-0 space-y-2"
          data-workspace-simulation-exercises
          data-simulation-exercises
          aria-busy={generating || undefined}
        >
          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Exercises
            <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-600">
              Drill / solo
            </span>
            <span className="ml-1 font-mono text-neutral-600">
              ({generating ? "…" : displayExercises.length})
            </span>
          </h3>
          {generating ? (
            <ul
              className="space-y-1.5"
              data-simulation-exercises-loading
              data-simulation-loading="exercises"
              aria-label="Generating exercises"
            >
              {[0, 1, 2].map((i) => (
                <li
                  key={`ex-skel-${i}`}
                  data-simulation-exercise-skeleton={i}
                  className="rounded-md border border-white/10 bg-neutral-950/50 px-2.5 py-2.5"
                >
                  <div className="h-2.5 w-[88%] animate-pulse rounded bg-white/10" />
                  <div className="mt-2 h-2.5 w-[54%] animate-pulse rounded bg-white/[0.07]" />
                </li>
              ))}
            </ul>
          ) : displayExercises.length === 0 ? (
            <p
              className="text-[12px] text-neutral-600"
              data-simulation-exercises-empty
            >
              No exercises yet — click Generate samples.
            </p>
          ) : (
            <ul className="space-y-1.5" data-simulation-exercise-list>
              {displayExercises.map((ex, i) => (
                <li
                  key={`ex-${i}`}
                  data-simulation-exercise={i}
                  data-simulation-probe-kind="exercise"
                  className="rounded-md border border-white/10 bg-neutral-950/50 px-2.5 py-2 text-[12px] leading-snug text-neutral-300"
                >
                  {ex}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p
        className="text-[11px] leading-relaxed text-neutral-600"
        data-workspace-simulation-footer
      >
        Per-block full readiness and influence chips live in the block drawer →
        Block Simulation. This tab previews practice items for authors.
      </p>
    </div>
  );
}
