"use client";

import { inspectAuthorUnsysFocus } from "@/lib/author-unsys-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";

const FIELD_CLASS =
  "w-full border border-white/25 bg-black px-1.5 py-1 font-mono text-[11px] text-white focus:border-white/60 focus:outline-none disabled:opacity-50";
const ACTION_CLASS =
  "rounded-none border border-white/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-200 hover:border-white/40 disabled:opacity-40";

export function WorkspaceUnsysSeedInspector({
  model,
  focusId,
  disabled = false,
  onChangeTitle,
  onChangeQuestion,
  onChangeObservation,
  onChangePrice,
  onAddBranch,
  onGenerateDeeper,
  onRemoveBranch,
}: {
  model: SessionBranchModel | null;
  focusId: string;
  disabled?: boolean;
  onChangeTitle: (branchId: string, title: string) => void;
  onChangeQuestion: (branchId: string, question: string) => void;
  onChangeObservation: (branchId: string, observation: string) => void;
  onChangePrice: (branchId: string, toId: string, price: number) => void;
  onAddBranch: (parentId: string) => void;
  onGenerateDeeper: (parentId: string) => void;
  onRemoveBranch: (branchId: string) => void;
}) {
  const focus = inspectAuthorUnsysFocus(model, focusId);
  if (!model || !focus) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col p-3"
        data-author-unsys-inspector=""
        data-author-unsys-inspector-empty=""
      />
    );
  }
  const state = focus.hiddenState;
  const canRemove = state.id !== model.rootId;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
      data-author-unsys-inspector=""
      data-author-unsys-inspector-focus={state.id}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Title
        </span>
        <input
          data-author-unsys-branch-title
          value={state.title}
          disabled={disabled}
          onChange={(event) => onChangeTitle(state.id, event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Question
        </span>
        <textarea
          data-author-unsys-branch-question
          value={state.question}
          disabled={disabled}
          rows={3}
          onChange={(event) => onChangeQuestion(state.id, event.target.value)}
          className={`${FIELD_CLASS} resize-none`}
        />
      </label>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Observation
        </span>
        <textarea
          data-author-unsys-branch-observation
          value={state.observation}
          disabled={disabled}
          rows={3}
          onChange={(event) => onChangeObservation(state.id, event.target.value)}
          className={`${FIELD_CLASS} resize-none`}
        />
      </label>

      <div className="mt-4 flex flex-col gap-2" data-author-unsys-edge-weights="">
        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Edges
        </span>
        {state.edges.map((edge) => {
          const recommended = edge.toId === focus.recommendedToId;
          return (
            <div
              key={edge.toId}
              className={`flex flex-col gap-1 border px-2 py-1.5 ${
                recommended ? "border-white/50 bg-white/5" : "border-white/10"
              }`}
              data-author-unsys-edge={edge.toId}
            >
              <label className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-300">
                  {edge.title}
                </span>
                <input
                  data-author-unsys-action-price={edge.toId}
                  data-author-unsys-edge-price={edge.toId}
                  type="number"
                  min={0}
                  max={100}
                  value={edge.price}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangePrice(state.id, edge.toId, Number(event.target.value))
                  }
                  className="w-16 border border-white/25 bg-black px-1 py-0.5 text-center text-[11px] text-white focus:border-white/60 focus:outline-none disabled:opacity-50"
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        <button
          type="button"
          data-author-unsys-graph-deeper
          disabled={disabled}
          onClick={() => onGenerateDeeper(state.id)}
          className={ACTION_CLASS}
        >
          Deeper
        </button>
        <button
          type="button"
          data-author-unsys-graph-add
          disabled={disabled}
          onClick={() => onAddBranch(state.id)}
          className={ACTION_CLASS}
        >
          Add branch
        </button>
        {canRemove ? (
          <button
            type="button"
            data-author-unsys-graph-remove
            disabled={disabled}
            onClick={() => onRemoveBranch(state.id)}
            className={ACTION_CLASS}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
