"use client";

import { useCallback, useEffect, useState } from "react";
import { writeSimulationCollection } from "@/lib/simulation-collection-client";
import type { SimulationProbe } from "@/lib/block-simulation";
import {
  simulationCollectionItemKey,
  type SimulationCollectionItem,
  type SimulationCollectionItemKind,
  type SimulationCollectionOrigin,
} from "@/lib/workspace-simulation-collection";

export function useSimulationCollectionAdd(opts: {
  workspaceId?: string | null;
  ayclToken?: string | null;
  origin: SimulationCollectionOrigin;
  modifierPrompt?: string | null;
  seedItems?: SimulationCollectionItem[];
}) {
  const { workspaceId, ayclToken, origin, modifierPrompt, seedItems } = opts;
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seedItems?.length) return;
    setAddedKeys((prev) => {
      const next = new Set(prev);
      for (const item of seedItems) {
        if (item.removed) continue;
        next.add(simulationCollectionItemKey(item.kind, item.text));
      }
      return next;
    });
  }, [seedItems]);

  const markAdded = useCallback((items: SimulationCollectionItem[]) => {
    setAddedKeys((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (item.removed) continue;
        next.add(simulationCollectionItemKey(item.kind, item.text));
      }
      return next;
    });
  }, []);

  const isAdded = useCallback(
    (kind: SimulationCollectionItemKind, text: string) =>
      addedKeys.has(simulationCollectionItemKey(kind, text)),
    [addedKeys],
  );

  const addOne = useCallback(
    async (kind: SimulationCollectionItemKind, text: string, coachCue?: string | null) => {
      if (!workspaceId) {
        const msg = "Workspace required to add to collection";
        setError(msg);
        return { ok: false, error: msg, items: [] as SimulationCollectionItem[] };
      }
      const key = simulationCollectionItemKey(kind, text);
      if (addedKeys.has(key)) return { ok: true, error: null, items: [] };
      setBusyKey(key);
      setError(null);
      const result = await writeSimulationCollection({
        workspaceId,
        ayclToken,
        action: "create",
        kind,
        text,
        coachCue,
        origin,
        modifierPrompt,
      });
      setBusyKey(null);
      if (!result.ok) {
        setError(result.error || "Failed to add to collection");
        return result;
      }
      markAdded(result.items);
      setAddedKeys((prev) => new Set(prev).add(key));
      return result;
    },
    [addedKeys, ayclToken, markAdded, modifierPrompt, origin, workspaceId],
  );

  const addMany = useCallback(
    async (payload: {
      questions?: string[];
      exercises?: string[];
      probes?: SimulationProbe[];
    }) => {
      if (!workspaceId) {
        const msg = "Workspace required to add to collection";
        setError(msg);
        return { ok: false, error: msg, items: [] as SimulationCollectionItem[] };
      }
      setBusyKey("__all__");
      setError(null);
      const result = await writeSimulationCollection({
        workspaceId,
        ayclToken,
        action: "deposit",
        questions: payload.questions,
        exercises: payload.exercises,
        probes: payload.probes,
        origin,
        modifierPrompt,
      });
      setBusyKey(null);
      if (!result.ok) {
        setError(result.error || "Failed to add to collection");
        return result;
      }
      markAdded(result.items);
      setAddedKeys((prev) => {
        const next = new Set(prev);
        for (const q of payload.questions || []) {
          next.add(simulationCollectionItemKey("question", q));
        }
        for (const ex of payload.exercises || []) {
          next.add(simulationCollectionItemKey("exercise", ex));
        }
        for (const p of payload.probes || []) {
          const kind =
            p.kind === "exercise" || p.difficulty === "stretch"
              ? "exercise"
              : "question";
          next.add(simulationCollectionItemKey(kind, p.question));
        }
        return next;
      });
      return result;
    },
    [ayclToken, markAdded, modifierPrompt, origin, workspaceId],
  );

  return {
    addedKeys,
    busyKey,
    error,
    isAdded,
    addOne,
    addMany,
    markAdded,
    setError,
  };
}

export function SimulationCollectionAddButton({
  added,
  busy = false,
  disabled = false,
  onClick,
  label = "Add to collection",
}: {
  added: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      data-simulation-add-to-collection
      data-simulation-add-state={added ? "added" : busy ? "busy" : "idle"}
      disabled={disabled || busy || added}
      onClick={onClick}
      className="shrink-0 rounded-none border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-neutral-200 transition hover:border-white/25 hover:bg-white/[0.1] disabled:cursor-default disabled:opacity-40"
    >
      {added ? "Added" : busy ? "Adding…" : label}
    </button>
  );
}

export function SimulationCollectionAddAllButton({
  added,
  busy = false,
  disabled = false,
  onClick,
  count,
}: {
  added: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      data-simulation-add-all-to-collection
      data-simulation-add-state={added ? "added" : busy ? "busy" : "idle"}
      disabled={disabled || busy || added || count < 1}
      onClick={onClick}
      className="rounded-none border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {added
        ? "All added to collection"
        : busy
          ? "Adding…"
          : `Add all to collection (${count})`}
    </button>
  );
}
