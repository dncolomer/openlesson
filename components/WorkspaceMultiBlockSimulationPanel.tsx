"use client";

import { useState } from "react";
import { DEFAULT_MODEL } from "@/lib/xai-models";

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
          throw new Error(data.error || "Multi-block generate failed");
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

      // Deposit into workspace collection for Sim-tab curation
      try {
        await fetch("/api/workspace/simulation-collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            action: "deposit",
            questions: allQ,
            exercises: allE,
            origin: {
              kind: "multi_block",
              blockIds,
              blockTitles: titles,
            },
            modifierPrompt: modifierPrompt.trim() || null,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        setDeposited(true);
      } catch {
        /* generation still shown; deposit optional if column missing */
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
      <p className="text-[11px] leading-relaxed text-neutral-400">
        Generate questions and exercises across{" "}
        <span className="text-neutral-200">{blockIds.length}</span> selected
        blocks. Results deposit into the workspace Simulation tab for curation
        and Suggest from Simulation.
      </p>

      <ul
        className="max-h-28 space-y-1 overflow-y-auto"
        data-multi-block-simulation-list
      >
        {blockIds.map((id, i) => (
          <li
            key={id}
            data-multi-block-simulation-block={id}
            className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-neutral-300"
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
          className="w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-2.5 py-2 text-[12px] text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>

      <button
        type="button"
        data-multi-block-simulation-generate
        data-simulation-generate
        disabled={!canGenerate}
        onClick={() => void generate()}
        className="w-full rounded-md border border-white/15 bg-white/[0.08] px-3 py-2 text-[12px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
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
          Deposited to Simulation tab collection.
        </p>
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
                  className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] leading-snug text-neutral-300"
                >
                  {q}
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
                  className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] leading-snug text-neutral-300"
                >
                  {ex}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
