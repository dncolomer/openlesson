"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deriveBlockSimulation,
  normalizeSimulationPayload,
  partitionSimulationProbes,
  SIMULATION_EXERCISE_COUNT,
  SIMULATION_QUESTION_COUNT,
  type BlockSimulationResult,
  type SimulationProbe,
} from "@/lib/block-simulation";
import {
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
} from "@/lib/prompt-workspace-context";
import { DEFAULT_MODEL } from "@/lib/xai-models";

/** Compact influence chips under a probe — minimal footprint. */
function ContextInfluenceChips({
  sources,
}: {
  sources?: string[] | null;
}) {
  if (!sources?.length) return null;
  return (
    <div
      className="mt-1 flex flex-wrap gap-1"
      data-simulation-context-sources
    >
      {sources.map((s) => (
        <span
          key={s}
          data-context-source-chip
          title={s}
          className="max-w-[9rem] truncate rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[9px] leading-tight text-neutral-500"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function ProbeList({
  items,
  kind,
  empty,
}: {
  items: SimulationProbe[];
  kind: "question" | "exercise";
  empty: string;
}) {
  if (!items.length) {
    return <p className="mt-1.5 text-[11px] text-neutral-600">{empty}</p>;
  }
  return (
    <ul
      className="mt-1.5 space-y-1.5"
      data-block-example-questions={kind === "question" ? "true" : undefined}
      data-block-example-exercises={kind === "exercise" ? "true" : undefined}
    >
      {items.map((p) => (
        <li
          key={p.id}
          data-simulation-probe={p.id}
          data-simulation-probe-kind={kind}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5"
        >
          <div className="flex gap-1.5 text-[11px] leading-snug text-neutral-300">
            <span
              className="mt-1 h-1 w-1 shrink-0 rounded-full bg-white/30"
              aria-hidden
            />
            <span className="min-w-0 flex-1">{p.question}</span>
          </div>
          <ContextInfluenceChips sources={p.contextSources} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Simulation drawer: exactly 3 questions + 3 exercises.
 * Compact context-influence chips when known; omitted when sparse.
 */
export function WorkspaceBlockSimulationPanel({
  workspaceId,
  blockId,
  blockTitle,
  blockDescription,
  planningPrompt,
  localContext,
  blockStatus,
  isStart,
  lockUntilTitles,
  canEdit = false,
  ayclToken,
  locale = "en",
  workspaceGoal,
  workspaceTitle,
  rootTopic,
  workspaceNotes,
}: {
  workspaceId?: string;
  blockId: string;
  blockTitle: string;
  blockDescription?: string | null;
  planningPrompt?: string | null;
  localContext?: BlockLocalContextInput | null;
  blockStatus?: string | null;
  isStart?: boolean | null;
  lockUntilTitles?: string[];
  canEdit?: boolean;
  ayclToken?: string;
  locale?: string;
  /** Workspace goal — same grounding live Explore/Drill use. */
  workspaceGoal?: string | null;
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceNotes?: string | null;
}) {
  void canEdit;
  void blockStatus;
  void isStart;

  const localNorm = normalizeBlockLocalContext(localContext);
  // normalizeBlockLocalContext returns fresh arrays every call — depend on
  // content fingerprints, not array identity, or useEffect loops forever.
  const localFileNamesKey = [
    ...localNorm.globalFileRefs,
    ...localNorm.localFiles.map((f) => f.name),
  ].join("\0");
  const externalIdsKey = localNorm.externalResourceIds.join("\0");
  const lockTitlesKey = (lockUntilTitles ?? []).join("\0");

  const seedInput = useMemo(
    () => ({
      title: blockTitle,
      description: blockDescription,
      planningPrompt,
      localNotes: localContext?.notes ?? null,
      hasLocalContext: localNorm.hasLocalMaterials,
      hasPlanningPrompt: Boolean(planningPrompt?.trim()),
      lockUntilTitles: lockTitlesKey ? lockTitlesKey.split("\0") : null,
      localFileNames: localFileNamesKey ? localFileNamesKey.split("\0") : [],
      externalLabels: externalIdsKey
        ? externalIdsKey.split("\0").map((id) => id.slice(0, 8))
        : null,
      workspaceGoal: workspaceGoal ?? null,
      workspaceTitle: workspaceTitle ?? null,
      rootTopic: rootTopic ?? null,
      notes: workspaceNotes ?? null,
    }),
    [
      blockTitle,
      blockDescription,
      planningPrompt,
      localContext?.notes,
      localNorm.hasLocalMaterials,
      localFileNamesKey,
      externalIdsKey,
      lockTitlesKey,
      workspaceGoal,
      workspaceTitle,
      rootTopic,
      workspaceNotes,
    ],
  );

  // Empty Q/E until xAI regenerate — no pure-template seed list.
  const [sim, setSim] = useState<BlockSimulationResult>(() =>
    deriveBlockSimulation(seedInput),
  );
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (regenerating) return;
    // Reset chrome/readiness from block fields; keep probes empty (no pure shells).
    setSim(deriveBlockSimulation(seedInput));
    setError(null);
  }, [blockId, seedInput, regenerating]);

  const regenerate = async () => {
    if (!workspaceId || regenerating) return;
    setRegenerating(true);
    setError(null);
    try {
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      const res = await fetch("/api/workspace/block-content-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          title: blockTitle,
          description: blockDescription ?? "",
          planningPrompt: planningPrompt ?? "",
          localContext: localContext ?? null,
          model,
          locale,
          mode: "simulation",
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate simulation");
      }
      const next = normalizeSimulationPayload(data, seedInput);
      if (!next.probes.length && !next.topics.length) {
        throw new Error("No simulation content returned");
      }
      setSim(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  };

  const { questions, exercises } = partitionSimulationProbes(sim.probes);

  return (
    <div
      data-block-simulation
      data-block-id={blockId}
      data-simulation-question-count={questions.length}
      data-simulation-exercise-count={exercises.length}
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-neutral-600">
          {SIMULATION_QUESTION_COUNT} questions · {SIMULATION_EXERCISE_COUNT}{" "}
          exercises · chips show influencing context when known
        </p>
        <button
          type="button"
          data-simulation-regenerate
          data-content-samples-regenerate
          disabled={!workspaceId || regenerating}
          onClick={() => void regenerate()}
          className="shrink-0 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {error ? (
        <p className="text-[11px] text-amber-300/90" data-simulation-error>
          {error}
        </p>
      ) : null}

      <div data-simulation-questions>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Questions
          <span className="ml-1 font-mono text-neutral-600">
            ({questions.length})
          </span>
        </p>
        <ProbeList
          items={questions}
          kind="question"
          empty="No sample questions yet — click Regenerate."
        />
      </div>

      <div data-simulation-exercises>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Exercises
          <span className="ml-1 font-mono text-neutral-600">
            ({exercises.length})
          </span>
        </p>
        <ProbeList
          items={exercises}
          kind="exercise"
          empty="No sample exercises yet."
        />
      </div>
    </div>
  );
}

/** @deprecated Prefer WorkspaceBlockSimulationPanel */
export { WorkspaceBlockSimulationPanel as WorkspaceBlockContentSamplesPanel };
