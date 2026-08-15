"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceSimulationBlockRef } from "@/lib/workspace-simulation-overview";
import type { SimulationCollectionItem } from "@/lib/workspace-simulation-collection";
import { DEFAULT_MODEL } from "@/lib/xai-models";

/**
 * Workspace Simulation **tab** — entire-workspace generation + durable
 * curation collection only.
 *
 * Block / multi-block simulation lives on the map:
 * - single block → Block Simulation drawer (block detail)
 * - multi select → Simulation drawer on the multi-block surface
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
  void workspaceDescription;
  void workspaceNotes;
  void blocks;
  const title = String(workspaceTitle || rootTopic || "").trim() || "Workspace";

  const [modifierPrompt, setModifierPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [exercises, setExercises] = useState<string[]>([]);
  const [collectionItems, setCollectionItems] = useState<
    SimulationCollectionItem[]
  >([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const canGenerate = Boolean(workspaceId) && !generating;

  const loadCollection = useCallback(async () => {
    if (!workspaceId) return;
    setCollectionLoading(true);
    try {
      const res = await fetch(
        `/api/workspace/simulation-collection?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        items?: SimulationCollectionItem[];
        error?: string;
      };
      if (res.ok && Array.isArray(data.items)) {
        setCollectionItems(data.items);
      }
    } catch {
      /* optional until migration applied */
    } finally {
      setCollectionLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  const deposit = useCallback(
    async (payload: {
      questions: string[];
      exercises: string[];
      origin: Record<string, unknown>;
    }) => {
      if (!workspaceId) return;
      try {
        const res = await fetch("/api/workspace/simulation-collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            action: "deposit",
            questions: payload.questions,
            exercises: payload.exercises,
            origin: payload.origin,
            modifierPrompt: modifierPrompt.trim() || null,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          items?: SimulationCollectionItem[];
        };
        if (res.ok && Array.isArray(data.items)) {
          setCollectionItems(data.items);
        } else {
          void loadCollection();
        }
      } catch {
        /* non-fatal */
      }
    },
    [ayclToken, loadCollection, modifierPrompt, workspaceId],
  );

  const generate = async () => {
    if (!workspaceId || generating) return;
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
          scope: "workspace",
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
      await deposit({
        questions: nextQ,
        exercises: nextE,
        origin: { kind: "workspace" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = async (itemId: string) => {
    if (!workspaceId || !editText.trim()) return;
    try {
      const res = await fetch("/api/workspace/simulation-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "update",
          itemId,
          text: editText.trim(),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: SimulationCollectionItem[];
      };
      if (res.ok && Array.isArray(data.items)) {
        setCollectionItems(data.items);
      }
      setEditingId(null);
      setEditText("");
    } catch {
      setError("Failed to update item");
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!workspaceId) return;
    try {
      const res = await fetch("/api/workspace/simulation-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "delete",
          itemId,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: SimulationCollectionItem[];
      };
      if (res.ok && Array.isArray(data.items)) {
        setCollectionItems(data.items);
      }
    } catch {
      setError("Failed to delete item");
    }
  };

  return (
    <div
      data-workspace-simulation-section
      data-workspace-simulation-panel
      data-simulation-scope="workspace"
      data-simulation-scope-kind="workspace"
      data-simulation-collection
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-y-contain p-1 sm:p-2"
    >
      <header className="space-y-1" data-workspace-simulation-header>
        <h2 className="text-sm font-semibold tracking-tight text-white">
          Simulation
        </h2>
        <p className="max-w-2xl text-[12px] leading-relaxed text-neutral-400">
          Workspace-level generation of questions and exercises for{" "}
          <span className="text-neutral-200">{title}</span>
          {workspaceGoal ? (
            <>
              {" "}
              toward <span className="text-neutral-200">{workspaceGoal}</span>
            </>
          ) : null}
          . Curate the collection here; block and multi-block simulation run from
          the map drawers.
        </p>
      </header>

      <section
        className="rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-3 sm:px-4"
        data-workspace-simulation-scope
        data-simulation-scope-control
        data-simulation-scope-workspace
      >
        <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Entire workspace
        </h3>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
          Samples are grounded in workspace goal, notes, and the full map
          inventory — not a single block. For one block, open Block Simulation on
          the map; for several, select them and use the multi-block Simulation
          drawer.
        </p>

        <label className="mt-3 block space-y-1" data-simulation-modifier>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Modifier prompt
          </span>
          <textarea
            value={modifierPrompt}
            onChange={(e) => setModifierPrompt(e.target.value)}
            rows={2}
            disabled={generating}
            placeholder="Optional: influence generation (e.g. emphasize unknowns, domain edge cases)…"
            data-simulation-modifier-input
            className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-[12px] text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          data-simulation-generate
          data-simulation-generate-samples
          disabled={!canGenerate}
          onClick={() => void generate()}
          className="mt-3 w-full shrink-0 rounded-md border border-white/15 bg-white/[0.08] px-4 py-2 text-[12px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? "Generating…" : "Generate workspace samples"}
        </button>

        {error ? (
          <p className="mt-2 text-[11px] text-neutral-300/90" data-simulation-error>
            {error}
          </p>
        ) : null}
      </section>

      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3"
        data-simulation-samples-grid
        data-simulation-samples-layout="two-col"
        data-simulation-generating={generating ? "true" : "false"}
      >
        <section
          data-workspace-simulation-questions
          data-simulation-questions
          aria-busy={generating || undefined}
        >
          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Questions ({generating ? "…" : questions.length})
          </h3>
          {generating ? (
            <ul
              className="mt-1.5 space-y-1.5"
              data-simulation-questions-loading
              data-simulation-loading="questions"
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
          ) : questions.length === 0 ? (
            <p
              className="mt-1.5 text-[12px] text-neutral-600"
              data-simulation-questions-empty
            >
              No questions yet — generate workspace samples.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1.5" data-simulation-question-list>
              {questions.map((q, i) => (
                <li
                  key={`q-${i}`}
                  data-simulation-question={i}
                  className="rounded-md border border-white/10 bg-neutral-950/50 px-2.5 py-2 text-[12px] leading-snug text-neutral-300"
                >
                  {q}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section
          data-workspace-simulation-exercises
          data-simulation-exercises
          aria-busy={generating || undefined}
        >
          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Exercises ({generating ? "…" : exercises.length})
          </h3>
          {generating ? (
            <ul
              className="mt-1.5 space-y-1.5"
              data-simulation-exercises-loading
              data-simulation-loading="exercises"
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
          ) : exercises.length === 0 ? (
            <p
              className="mt-1.5 text-[12px] text-neutral-600"
              data-simulation-exercises-empty
            >
              No exercises yet — generate workspace samples.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1.5" data-simulation-exercise-list>
              {exercises.map((ex, i) => (
                <li
                  key={`ex-${i}`}
                  data-simulation-exercise={i}
                  className="rounded-md border border-white/10 bg-neutral-950/50 px-2.5 py-2 text-[12px] leading-snug text-neutral-300"
                >
                  {ex}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        className="rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-3 sm:px-4"
        data-simulation-collection-list
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Curated collection
            <span className="ml-1 font-mono text-neutral-600">
              ({collectionItems.length})
            </span>
          </h3>
          <button
            type="button"
            data-simulation-collection-refresh
            disabled={collectionLoading || !workspaceId}
            onClick={() => void loadCollection()}
            className="rounded-md border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300 hover:border-neutral-500 disabled:opacity-40"
          >
            {collectionLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Workspace, block, and multi-block generation all deposit here. Edit or
          delete items; Suggest from Simulation reads this collection.
        </p>
        {collectionItems.length === 0 ? (
          <p
            className="mt-2 text-[12px] text-neutral-600"
            data-simulation-collection-empty
          >
            Collection empty — generate here or from map Simulation drawers.
          </p>
        ) : (
          <ul className="mt-2 space-y-2" data-simulation-collection-items>
            {collectionItems.map((item) => (
              <li
                key={item.id}
                data-simulation-collection-item={item.id}
                data-simulation-collection-kind={item.kind}
                className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded border border-white/10 px-1 py-px text-[9px] uppercase tracking-wide text-neutral-500">
                    {item.kind}
                    {item.origin?.kind && item.origin.kind !== "workspace"
                      ? ` · ${item.origin.kind === "multi_block" ? "multi" : "block"}`
                      : ""}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      data-simulation-collection-edit={item.id}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditText(item.text);
                      }}
                      className="text-[10px] text-neutral-400 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      data-simulation-collection-delete={item.id}
                      onClick={() => void deleteItem(item.id)}
                      className="text-[10px] text-neutral-400 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {editingId === item.id ? (
                  <div
                    className="mt-1.5 space-y-1.5"
                    data-simulation-collection-edit-form
                  >
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      data-simulation-collection-edit-input
                      className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-[11px] text-neutral-100"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        data-simulation-collection-save={item.id}
                        onClick={() => void saveEdit(item.id)}
                        className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[10px] text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                        className="rounded-md border border-neutral-700 px-2 py-1 text-[10px] text-neutral-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[12px] leading-snug text-neutral-300">
                    {item.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
