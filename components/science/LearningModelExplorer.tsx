"use client";

import { useMemo, useState } from "react";
import { LEARNING_MODEL_CATALOG_4 } from "@/lib/learning-model";
import { SCIENCE_LEARNING_MODEL_EXAMPLE } from "@/lib/science/learning-model-copy";

type ExampleState = (typeof SCIENCE_LEARNING_MODEL_EXAMPLE.hiddenStates)[number];

const ORDER = SCIENCE_LEARNING_MODEL_EXAMPLE.hiddenStates.map((row) => row.id);

function nextState(focus: ExampleState, actionId: string): ExampleState {
  const index = Math.max(0, ORDER.indexOf(focus.id));
  if (actionId === "forage") {
    const next = SCIENCE_LEARNING_MODEL_EXAMPLE.hiddenStates[Math.min(index + 1, ORDER.length - 1)]!;
    return next;
  }
  if (actionId === "avoid") {
    const next = SCIENCE_LEARNING_MODEL_EXAMPLE.hiddenStates[Math.max(index - 1, 0)]!;
    return next;
  }
  return focus;
}

export function LearningModelExplorer() {
  const opening = SCIENCE_LEARNING_MODEL_EXAMPLE.hiddenStates[0]!;
  const [focusId, setFocusId] = useState<string>(opening.id);
  const [log, setLog] = useState("Occupying hidden state Heat in. Take an action.");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const focus = useMemo(
    () => SCIENCE_LEARNING_MODEL_EXAMPLE.hiddenStates.find((row) => row.id === focusId) ?? opening,
    [focusId, opening],
  );

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]"
      data-learning-model-explorer
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Generative model · {SCIENCE_LEARNING_MODEL_EXAMPLE.generativeModel}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          State factor · {SCIENCE_LEARNING_MODEL_EXAMPLE.stateFactor}
        </p>
        <ol className="mt-4 flex flex-col gap-2">
          {SCIENCE_LEARNING_MODEL_EXAMPLE.hiddenStates.map((state, index) => {
            const active = state.id === focus.id;
            return (
              <li
                key={state.id}
                data-explorer-hidden-state={state.id}
                data-explorer-focus={active ? "true" : undefined}
                className={`border px-4 py-3 ${
                  active ? "border-white bg-white/10 text-white" : "border-white/20 text-zinc-400"
                }`}
                style={{ marginLeft: index * 16 }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  Hidden state s{index + 1}
                </p>
                <p className="mt-1 text-sm">{state.title}</p>
                {active ? (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    Likelihood p(o|s): {state.likelihood}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Policy π · 4 actions
        </p>
        {LEARNING_MODEL_CATALOG_4.map((action) => (
          <button
            key={action.id}
            type="button"
            data-explorer-action={action.id}
            onClick={() => {
              const next = nextState(focus, action.id);
              setFocusId(next.id);
              setLastAction(action.id);
              if (action.id === "infer") {
                setLog(
                  `Projection: Infer. Posterior report on ${focus.title}. Likelihood held as the predicted observation.`,
                );
                return;
              }
              if (action.id === "exploit") {
                setLog(`Projection: Exploit. ${focus.title} is treated as settled. Pragmatic value.`);
                return;
              }
              if (next.id === focus.id) {
                setLog(`Projection: ${action.label}. Still occupying ${focus.title}.`);
                return;
              }
              setLog(
                `Projection: ${action.label}. Occupied hidden state ${next.title} on state factor ${SCIENCE_LEARNING_MODEL_EXAMPLE.stateFactor}.`,
              );
            }}
            className={`border px-3 py-3 text-left text-sm ${
              lastAction === action.id
                ? "border-white bg-white/10 text-white"
                : "border-white/25 text-zinc-200 hover:border-white"
            }`}
          >
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              {action.kind} · {action.efe}
            </span>
            <span className="mt-1 block">{action.label}</span>
          </button>
        ))}
        <p
          className="mt-1 border border-white/15 px-3 py-3 text-xs leading-relaxed text-zinc-300"
          data-explorer-projection
        >
          {log}
        </p>
      </div>
    </div>
  );
}
