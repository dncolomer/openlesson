"use client";

import { useState } from "react";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  appendGeneratedFlows,
  appendGeneratedGoals,
  type ContextFlowCandidate,
  type ContextGenerationKind,
  type ContextGoalCandidate,
} from "@/lib/context-generation";

export function ContextGenerationPool({
  workspaceId,
  ayclToken,
  kind,
  onUseGoal,
  onUseFlow,
}: {
  workspaceId: string;
  ayclToken?: string | null;
  kind: ContextGenerationKind;
  onUseGoal?: (text: string) => void | Promise<void>;
  onUseFlow?: (draft: { topic: string; questions: string[] }) => void;
}) {
  const [goals, setGoals] = useState<ContextGoalCandidate[]>([]);
  const [flows, setFlows] = useState<ContextFlowCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modifier, setModifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pool = kind === "goals" ? goals : flows;

  function clearPool() {
    setSelectedId(null);
    setError(null);
    if (kind === "goals") setGoals([]);
    else setFlows([]);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const avoid = kind === "goals" ? goals.map((goal) => goal.text) : flows.map((flow) => flow.topic);
      const response = await fetch("/api/workspace/context-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          kind,
          avoid,
          modifier: modifier.trim(),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not generate from context"));
      }
      if (kind === "goals") {
        setGoals((current) => appendGeneratedGoals(current, payload.goals || []));
      } else {
        setFlows((current) => appendGeneratedFlows(current, payload.flows || []));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate from context");
    } finally {
      setBusy(false);
    }
  }

  const label = kind === "goals" ? "Generate goals from context" : "Generate topic + questions from context";
  const action = kind === "goals" ? "data-generate-goals-from-context" : "data-generate-flow-from-context";
  const poolAttr = kind === "goals" ? "data-context-goal-pool" : "data-context-flow-pool";
  const candidateAttr = kind === "goals" ? "data-context-goal-candidate" : "data-context-flow-candidate";

  return (
    <section className="space-y-3 border border-neutral-800 bg-neutral-950/60 p-3" data-context-generation={kind}>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Modifier prompt
        </span>
        <input
          value={modifier}
          onChange={(event) => setModifier(event.target.value)}
          disabled={busy}
          placeholder="Optional"
          data-context-generation-modifier
          className="mt-1 w-full border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:border-neutral-500 disabled:opacity-50"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Generation pool
          <span className="ml-2 font-mono text-neutral-400" data-context-generation-count={pool.length}>
            {pool.length}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearPool}
            disabled={busy || pool.length === 0}
            data-context-generation-clear
            className="rounded-none border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear pool
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            {...{ [action]: "" }}
            data-context-generation-submit={kind}
            className="rounded-none border border-white/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Generating…" : label}
          </button>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-red-300" data-context-generation-error>
          {error}
        </p>
      ) : null}
      {pool.length === 0 ? (
        <p className="text-xs text-neutral-500" data-context-generation-empty>
          Generate as many times as you want. Each result stays in this pool.
        </p>
      ) : (
        <ul className="space-y-2" {...{ [poolAttr]: "" }}>
          {kind === "goals"
            ? goals.map((goal) => (
                <li
                  key={goal.id}
                  className="flex items-start justify-between gap-3 border border-neutral-800 px-3 py-2"
                  {...{ [candidateAttr]: goal.id }}
                  data-context-generation-selected={selectedId === goal.id ? "true" : "false"}
                >
                  <p className="min-w-0 flex-1 text-sm text-neutral-100">{goal.text}</p>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-white underline"
                    data-context-goal-use={goal.id}
                    onClick={() => {
                      setSelectedId(goal.id);
                      void onUseGoal?.(goal.text);
                    }}
                  >
                    Use goal
                  </button>
                </li>
              ))
            : flows.map((flow) => (
                <li
                  key={flow.id}
                  className="space-y-1 border border-neutral-800 px-3 py-2"
                  {...{ [candidateAttr]: flow.id }}
                  data-context-generation-selected={selectedId === flow.id ? "true" : "false"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm text-white">{flow.topic}</p>
                    <button
                      type="button"
                      className="shrink-0 text-[11px] text-white underline"
                      data-context-flow-use={flow.id}
                      onClick={() => {
                        setSelectedId(flow.id);
                        onUseFlow?.({ topic: flow.topic, questions: flow.questions });
                      }}
                    >
                      Use topic
                    </button>
                  </div>
                  <ul className="space-y-0.5 text-[11px] text-neutral-400">
                    {flow.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </li>
              ))}
        </ul>
      )}
    </section>
  );
}
