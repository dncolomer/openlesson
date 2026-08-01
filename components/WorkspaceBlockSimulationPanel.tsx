"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deriveBlockSimulation,
  normalizeSimulationPayload,
  type BlockSimulationResult,
} from "@/lib/block-simulation";
import {
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
} from "@/lib/prompt-workspace-context";
import { DEFAULT_MODEL } from "@/lib/xai-models";

/**
 * Simulation drawer: sample questions and exercises that might appear
 * when practicing this block. Local derivation seeds the list; regenerate
 * refreshes from the latest block text + local context via LLM.
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
}) {
  void canEdit;
  void blockStatus;
  void isStart;

  const localNorm = normalizeBlockLocalContext(localContext);

  const seedInput = useMemo(
    () => ({
      title: blockTitle,
      description: blockDescription,
      planningPrompt,
      localNotes: localContext?.notes ?? null,
      hasLocalContext: localNorm.hasLocalMaterials,
      hasPlanningPrompt: Boolean(planningPrompt?.trim()),
      lockUntilTitles: lockUntilTitles ?? null,
    }),
    [
      blockTitle,
      blockDescription,
      planningPrompt,
      localContext?.notes,
      localNorm.hasLocalMaterials,
      lockUntilTitles,
    ],
  );

  const [sim, setSim] = useState<BlockSimulationResult>(() =>
    deriveBlockSimulation(seedInput),
  );
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (regenerating) return;
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

  const finalQuestions = sim.probes
    .filter((p) => (p.kind ?? (p.difficulty === "stretch" ? "exercise" : "question")) === "question")
    .map((p) => p.question);
  const finalExercises = sim.probes
    .filter((p) => (p.kind ?? (p.difficulty === "stretch" ? "exercise" : "question")) === "exercise")
    .map((p) => p.question);

  return (
    <div data-block-simulation data-block-id={blockId} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-neutral-600">
          Examples of questions and exercises that might appear
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
        </p>
        {finalQuestions.length > 0 ? (
          <ul className="mt-1.5 space-y-1.5" data-block-example-questions>
            {finalQuestions.map((q) => (
              <li
                key={q}
                className="flex gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] leading-snug text-neutral-300"
              >
                <span
                  className="mt-1 h-1 w-1 shrink-0 rounded-full bg-white/30"
                  aria-hidden
                />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] text-neutral-600">
            No sample questions yet — regenerate after adding description or local
            context.
          </p>
        )}
      </div>

      <div data-simulation-exercises>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Exercises
        </p>
        {finalExercises.length > 0 ? (
          <ul className="mt-1.5 space-y-1.5" data-block-example-exercises>
            {finalExercises.map((ex) => (
              <li
                key={ex}
                className="flex gap-1.5 rounded-md border border-white/10 bg-neutral-950/50 px-2 py-1.5 text-[11px] leading-snug text-neutral-300"
              >
                <span
                  className="mt-1 h-1 w-1 shrink-0 rounded-full bg-white/20"
                  aria-hidden
                />
                <span>{ex}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] text-neutral-600">
            No sample exercises yet.
          </p>
        )}
      </div>
    </div>
  );
}

/** @deprecated Prefer WorkspaceBlockSimulationPanel */
export { WorkspaceBlockSimulationPanel as WorkspaceBlockContentSamplesPanel };
