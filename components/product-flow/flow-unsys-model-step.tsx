"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceUnsysSeedGraph } from "@/components/WorkspaceUnsysSeedGraph";
import { WorkspaceUnsysSeedInspector } from "@/components/WorkspaceUnsysSeedInspector";
import {
  addAuthorUnsysBranch,
  authorUnsysSeedForPersist,
  normalizeAuthorUnsysModel,
  removeAuthorUnsysBranch,
  setAuthorUnsysBranchFields,
  setAuthorUnsysEdgePrice,
} from "@/lib/author-unsys-model";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { parseFlowUnsysSeed, FLOW_UNSYS_SEED_PATH } from "@/lib/flow-unsys-seed";
import type { FlowArtifact } from "@/lib/flow-artifacts";
import type { ProductFlowKind } from "@/lib/product-flow";
import type { AuthorUnsysModelSeed } from "@/lib/author-unsys-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import {
  FLOW_FORM_TEXTAREA,
  FLOW_GHOST_BTN,
  FLOW_PRIMARY_BTN,
} from "@/components/product-flow/product-flow-form";

export function FlowUnsysModelStep({
  kind,
  name,
  problem,
  artifacts,
  seed,
  onChange,
  onBusyChange,
  actions,
}: {
  kind: ProductFlowKind;
  name: string;
  problem: string;
  artifacts: FlowArtifact[];
  seed: AuthorUnsysModelSeed | null;
  onChange: (seed: AuthorUnsysModelSeed | null) => void;
  onBusyChange?: (busy: boolean) => void;
  actions?: ReactNode;
}) {
  const parsed = parseFlowUnsysSeed(seed);
  const [model, setModel] = useState<SessionBranchModel | null>(parsed?.model ?? null);
  const [focusId, setFocusId] = useState(model?.rootId ?? "root");
  const [guidance, setGuidance] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [graphEpoch, setGraphEpoch] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    const next = parseFlowUnsysSeed(seed)?.model ?? null;
    setModel(next);
    setFocusId((focus) =>
      next?.branches.some((branch) => branch.id === focus) ? focus : next?.rootId ?? "root",
    );
  }, [seed]);

  const commit = (next: SessionBranchModel | null, nextFocus?: string) => {
    setModel(next);
    if (next) {
      const focus =
        nextFocus && next.branches.some((branch) => branch.id === nextFocus)
          ? nextFocus
          : next.rootId;
      setFocusId(focus);
      try {
        onChange(authorUnsysSeedForPersist(next));
      } catch {
        onChange(null);
      }
    } else {
      setFocusId("root");
      onChange(null);
    }
  };

  const generate = async (input?: { parentId?: string; prompt?: string }) => {
    const parentId = input?.parentId;
    setGenerating(true);
    onBusyChange?.(true);
    setError("");
    try {
      const response = await fetch(FLOW_UNSYS_SEED_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          problem,
          artifacts,
          guidance: input?.prompt ?? guidance,
          ...(parentId && model ? { parentId, seedModel: model } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(data, "The unsys model could not be generated."));
      }
      const sample = normalizeAuthorUnsysModel(data.model);
      if (!sample) throw new Error("The unsys field came back empty.");
      commit(sample, parentId || sample.rootId);
      if (!parentId) setGraphEpoch((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The unsys model could not be generated.");
    } finally {
      setGenerating(false);
      onBusyChange?.(false);
    }
  };

  useEffect(() => {
    if (autoStarted.current || model || !problem.trim()) return;
    autoStarted.current = true;
    void generate();
    // First visit only: generate from the authored problem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFile = async (file: File) => {
    setError("");
    try {
      const text = await file.text();
      const parsedJson = JSON.parse(text) as unknown;
      const imported = parseFlowUnsysSeed(parsedJson);
      if (!imported) throw new Error("That file is not an unsys model.");
      commit(imported.model, imported.model.rootId);
      setGraphEpoch((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be imported.");
    }
  };

  const disabled = generating;

  return (
    <div
      className="flex min-h-[32rem] flex-col overflow-hidden"
      data-flow-unsys-model=""
      data-flow-wizard-model=""
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-1 pb-3">
        <button
          type="button"
          data-flow-unsys-generate=""
          className={FLOW_GHOST_BTN}
          disabled={disabled || !problem.trim()}
          onClick={() => void generate()}
        >
          {generating ? "Generating…" : model ? "Regenerate" : "Generate"}
        </button>
        <button
          type="button"
          data-flow-unsys-import=""
          className={FLOW_GHOST_BTN}
          disabled={disabled}
          onClick={() => importRef.current?.click()}
        >
          Import file
        </button>
        {actions ? <div className="ml-auto flex flex-wrap gap-3">{actions}</div> : null}
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-flow-unsys-import-input=""
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importFile(file);
          }}
        />
      </div>

      <div className="mt-3 space-y-2">
        <textarea
          value={guidance}
          onChange={(event) => setGuidance(event.target.value)}
          placeholder="Tell the model how to adapt this unsys field"
          data-flow-unsys-prompt=""
          className={`${FLOW_FORM_TEXTAREA} min-h-[4.5rem]`}
          disabled={disabled}
        />
        <button
          type="button"
          data-flow-unsys-prompt-apply=""
          className={FLOW_PRIMARY_BTN}
          disabled={disabled || !guidance.trim() || !problem.trim()}
          onClick={() => void generate({ prompt: guidance.trim() })}
        >
          Apply prompt
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-300" data-flow-unsys-error="">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex min-h-[22rem] flex-1 flex-col overflow-hidden border border-white/20 lg:flex-row">
        <div className="relative min-h-[22rem] flex-1 overflow-hidden">
          <div
            className={
              generating
                ? "pointer-events-none absolute inset-0 select-none"
                : "absolute inset-0"
            }
            inert={generating ? true : undefined}
          >
            <WorkspaceUnsysSeedGraph
              key={`flow-unsys:${graphEpoch}`}
              model={model}
              focusId={focusId}
              disabled={disabled}
              onSelect={setFocusId}
            />
          </div>
          {generating ? (
            <div
              data-flow-unsys-generating=""
              aria-busy="true"
              className="absolute inset-0 z-10 cursor-wait bg-white/5 backdrop-blur-[1px]"
            />
          ) : null}
        </div>
        <aside className="flex max-h-[50vh] w-full shrink-0 flex-col overflow-hidden border-t border-white/10 bg-[#080808] lg:max-h-none lg:w-[18rem] lg:border-l lg:border-t-0">
          <WorkspaceUnsysSeedInspector
            model={model}
            focusId={focusId}
            disabled={disabled}
            onChangeTitle={(branchId, title) => {
              if (!model) return;
              commit(setAuthorUnsysBranchFields(model, branchId, { title }));
            }}
            onChangeQuestion={(branchId, question) => {
              if (!model) return;
              commit(setAuthorUnsysBranchFields(model, branchId, { question }));
            }}
            onChangeObservation={(branchId, observation) => {
              if (!model) return;
              commit(setAuthorUnsysBranchFields(model, branchId, { observation }));
            }}
            onChangePrice={(fromId, toId, price) => {
              if (!model) return;
              commit(setAuthorUnsysEdgePrice(model, fromId, toId, price));
            }}
            onAddBranch={(parentId) => {
              if (!model) return;
              const next = addAuthorUnsysBranch(model, parentId, { title: "New hidden state" });
              const added = next.branches.find(
                (branch) => !model.branches.some((row) => row.id === branch.id),
              );
              commit(next, added?.id || parentId);
            }}
            onGenerateDeeper={(parentId) => void generate({ parentId })}
            onRemoveBranch={(branchId) => {
              if (!model) return;
              const parentId =
                model.branches.find((branch) => branch.id === branchId)?.parentId ||
                model.rootId;
              commit(removeAuthorUnsysBranch(model, branchId), parentId);
            }}
          />
        </aside>
      </div>
    </div>
  );
}
