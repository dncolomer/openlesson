"use client";

import { useMemo, useState } from "react";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  SimulationCollectionAddAllButton,
  SimulationCollectionAddButton,
  useSimulationCollectionAdd,
} from "@/components/SimulationCollectionAddButton";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import { simulationCollectionItemKey } from "@/lib/workspace-simulation-collection";

/**
 * Map multi-select Simulation drawer body: generate probes across the
 * selected blocks and deposit into the workspace Simulation collection
 * (curated on the Sim tab).
 */
export function WorkspaceMultiBlockSimulationPanel({
  workspaceId,
  blockIds,
  blockTitles = [],
  ayclToken,
  locale = "en",
}: {
  workspaceId?: string;
  blockIds: string[];
  blockTitles?: string[];
  ayclToken?: string;
  locale?: string;
}) {
  const [modifierPrompt, setModifierPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [exercises, setExercises] = useState<string[]>([]);
  const [deposited, setDeposited] = useState(false);
  const origin = useMemo(
    () => ({
      kind: "multi_block" as const,
      blockIds,
      blockTitles: blockTitles.length ? blockTitles : null,
    }),
    [blockIds, blockTitles],
  );
  const collectionAdd = useSimulationCollectionAdd({
    workspaceId,
    ayclToken,
    origin,
    modifierPrompt,
  });

  const titles =
    blockTitles.length === blockIds.length
      ? blockTitles
      : blockIds.map((id, i) => blockTitles[i] || id.slice(0, 8));

  const canGenerate =
    Boolean(workspaceId) && blockIds.length >= 2 && !generating;

  const generate = async () => {
    if (!workspaceId || blockIds.length < 2 || generating) return;
    setGenerating(true);
    setError(null);
    setDeposited(false);
    try {
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;

      const allQ: string[] = [];
      const allE: string[] = [];
      for (const bid of blockIds) {
        const res = await fetch("/api/workspace/simulation-samples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            scope: "block",
            blockId: bid,
            model,
            locale,
            modifierPrompt: modifierPrompt.trim() || undefined,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          questions?: string[];
          exercises?: string[];
        };
        if (!res.ok) {
          throw new Error(errorMessageFromBody(data, "Multi-block generate failed"));
        }
        for (const q of data.questions || []) {
          if (typeof q === "string" && q.trim()) allQ.push(q.trim());
        }
        for (const e of data.exercises || []) {
          if (typeof e === "string" && e.trim()) allE.push(e.trim());
        }
      }
      if (allQ.length === 0 && allE.length === 0) {
        throw new Error("No samples returned");
      }
      setQuestions(allQ);
      setExercises(allE);

      const depositedResult = await collectionAdd.addMany({
        questions: allQ,
        exercises: allE,
      });
      if (depositedResult.ok) {
        setDeposited(true);
      } else {
        setError(
          depositedResult.error ||
            "Generated samples, but could not add them to the curated collection.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      data-multi-block-simulation
      data-multi-block-simulation-pane
      data-simulation-multi-block
      data-simulation-block-count={blockIds.length}
      className="space-y-3"
    >
      <ul
        className="max-h-28 space-y-1 overflow-y-auto"
        data-multi-block-simulation-list
      >
        {blockIds.map((id, i) => (
          <li
            key={id}
            data-multi-block-simulation-block={id}
            className="rounded-none border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-neutral-300"
          >
            {titles[i] || id.slice(0, 8)}
          </li>
        ))}
      </ul>

      <label className="block space-y-1" data-simulation-modifier>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Modifier prompt
        </span>
        <textarea
          value={modifierPrompt}
          onChange={(e) => setModifierPrompt(e.target.value)}
          rows={2}
          disabled={generating}
          placeholder="Optional: influence generation across these blocks…"
          data-simulation-modifier-input
          data-multi-block-simulation-modifier
          className="w-full resize-none rounded-none border border-neutral-700 bg-black/60 px-2.5 py-2 text-[12px] text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>

      <button
        type="button"
        data-multi-block-simulation-generate
        data-simulation-generate
        disabled={!canGenerate}
        onClick={() => void generate()}
        className="w-full rounded-none border border-white/15 bg-white/[0.08] px-3 py-2 text-[12px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {generating
          ? "Generating…"
          : `Generate for ${blockIds.length} blocks`}
      </button>

      {error ? (
        <p className="text-[11px] text-neutral-300/90" data-simulation-error>
          {error}
        </p>
      ) : null}
      {deposited ? (
        <p
          className="text-[10px] text-neutral-500"
          data-multi-block-simulation-deposited
        >
          Added to Simulation tab collection.
        </p>
      ) : null}
      {collectionAdd.error ? (
        <p
          className="text-[11px] text-neutral-300/90"
          data-simulation-collection-add-error
        >
          {collectionAdd.error}
        </p>
      ) : null}
      {questions.length + exercises.length > 0 ? (
        <SimulationCollectionAddAllButton
          count={questions.length + exercises.length}
          added={
            questions.every((q) => collectionAdd.isAdded("question", q)) &&
            exercises.every((ex) => collectionAdd.isAdded("exercise", ex))
          }
          busy={collectionAdd.busyKey === "__all__"}
          disabled={!workspaceId}
          onClick={() => {
            void collectionAdd.addMany({ questions, exercises }).then((r) => {
              if (r.ok) setDeposited(true);
            });
          }}
        />
      ) : null}

      {(questions.length > 0 || exercises.length > 0) && (
        <div
          className="grid grid-cols-1 gap-3"
          data-multi-block-simulation-results
        >
          <section data-simulation-questions>
            <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Questions ({questions.length})
            </h4>
            <ul className="mt-1.5 space-y-1.5">
              {questions.map((q, i) => (
                <li
                  key={`q-${i}`}
                  data-simulation-question={i}
                  className="flex items-start justify-between gap-2 rounded-none border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] leading-snug text-neutral-300"
                >
                  <span className="min-w-0 flex-1">{q}</span>
                  <SimulationCollectionAddButton
                    added={collectionAdd.isAdded("question", q)}
                    busy={
                      collectionAdd.busyKey ===
                      simulationCollectionItemKey("question", q)
                    }
                    disabled={!workspaceId}
                    onClick={() => {
                      void collectionAdd.addOne("question", q);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
          <section data-simulation-exercises>
            <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Exercises ({exercises.length})
            </h4>
            <ul className="mt-1.5 space-y-1.5">
              {exercises.map((ex, i) => (
                <li
                  key={`ex-${i}`}
                  data-simulation-exercise={i}
                  className="flex items-start justify-between gap-2 rounded-none border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] leading-snug text-neutral-300"
                >
                  <span className="min-w-0 flex-1">{ex}</span>
                  <SimulationCollectionAddButton
                    added={collectionAdd.isAdded("exercise", ex)}
                    busy={
                      collectionAdd.busyKey ===
                      simulationCollectionItemKey("exercise", ex)
                    }
                    disabled={!workspaceId}
                    onClick={() => {
                      void collectionAdd.addOne("exercise", ex);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
