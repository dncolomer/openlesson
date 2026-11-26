"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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
import {
  FLOW_ARTIFACT_ACCEPT,
  FLOW_ARTIFACT_MAX_COUNT,
  parseFlowArtifacts,
  uploadFlowArtifact,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import {
  FLOW_UNSYS_EXPLAINER,
  FLOW_UNSYS_SCIENCE_HREF,
  FLOW_UNSYS_SEED_PATH,
  parseFlowUnsysSeed,
} from "@/lib/flow-unsys-seed";

import { flowOpeningCanvasHasContent } from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import type { AuthorUnsysModelSeed } from "@/lib/author-unsys-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import {
  FLOW_COMPACT_GHOST_BTN,
  FLOW_COMPACT_PRIMARY_BTN,
  FLOW_FORM_TEXTAREA,
} from "@/components/product-flow/product-flow-form";

export function FlowUnsysModelStep({
  name,
  problem,
  artifacts,
  openingCanvasScene = null,
  seed,
  onChange,
  onBusyChange,
  actions,
  fillViewport = false,
}: {
  name: string;
  problem: string;
  artifacts: FlowArtifact[];
  openingCanvasScene?: IleWorkCanvasScene | null;
  seed: AuthorUnsysModelSeed | null;
  onChange: (seed: AuthorUnsysModelSeed | null) => void;
  onBusyChange?: (busy: boolean) => void;
  actions?: ReactNode;
  fillViewport?: boolean;
}) {
  const parsed = parseFlowUnsysSeed(seed);
  const [model, setModel] = useState<SessionBranchModel | null>(parsed?.model ?? null);
  const [focusId, setFocusId] = useState(model?.rootId ?? "root");
  const [guidance, setGuidance] = useState("");
  const [promptFiles, setPromptFiles] = useState<FlowArtifact[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [graphEpoch, setGraphEpoch] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const generate = async (input?: {
    parentId?: string;
    prompt?: string;
    reset?: boolean;
  }) => {
    const parentId = input?.parentId;
    const reset = Boolean(input?.reset);
    setGenerating(true);
    onBusyChange?.(true);
    setError("");
    try {
      const prompt = reset ? "" : (input?.prompt ?? guidance);
      const contextFiles = reset
        ? artifacts
        : parseFlowArtifacts([...artifacts, ...promptFiles]);
      const response = await fetch(FLOW_UNSYS_SEED_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          problem,
          artifacts: contextFiles,
          openingCanvasScene,
          guidance: prompt,
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
      if (reset) {
        setGuidance("");
        setPromptFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The unsys model could not be generated.");
    } finally {
      setGenerating(false);
      onBusyChange?.(false);
    }
  };

  useEffect(() => {
    if (
      autoStarted.current ||
      model ||
      (!problem.trim() && !flowOpeningCanvasHasContent(openingCanvasScene))
    )
      return;
    autoStarted.current = true;
    void generate();
    // First visit only: generate from the authored problem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachPromptFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    setError("");
    try {
      const next = promptFiles.slice();
      for (const file of Array.from(list)) {
        if (next.length >= FLOW_ARTIFACT_MAX_COUNT) break;
        const uploaded = await uploadFlowArtifact({ file });
        if (next.some((row) => row.xaiFileId === uploaded.xaiFileId)) continue;
        next.push(uploaded);
      }
      setPromptFiles(parseFlowArtifacts(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be attached.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const disabled = generating || uploading;
  const canApply = Boolean(problem.trim()) && Boolean(guidance.trim() || promptFiles.length);

  return (
    <div
      className={
        fillViewport
          ? "flex h-full min-h-0 flex-col overflow-hidden lg:flex-row"
          : "flex min-h-[36rem] flex-col overflow-hidden lg:h-[min(68dvh,46rem)] lg:flex-row"
      }
      data-flow-unsys-model=""
      data-flow-wizard-model=""
      style={{ overflowAnchor: "none" }}
    >
      <aside
        className="flex min-h-0 w-full shrink-0 flex-col border-b border-white/10 bg-[#080808] lg:h-full lg:w-[22.5rem] lg:border-b-0 lg:border-r"
        data-flow-unsys-controls=""
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2 text-[12px] leading-relaxed text-neutral-400" data-flow-unsys-explainer="">
            <p>
              {FLOW_UNSYS_EXPLAINER.lead}{" "}
              <Link
                href={FLOW_UNSYS_SCIENCE_HREF}
                className="text-neutral-200 underline decoration-white/30 underline-offset-4 hover:text-white"
                data-flow-unsys-science=""
              >
                {FLOW_UNSYS_EXPLAINER.scienceLabel}
              </Link>
            </p>
            <p>{FLOW_UNSYS_EXPLAINER.modify}</p>
            <p>
              {FLOW_UNSYS_EXPLAINER.question} {FLOW_UNSYS_EXPLAINER.observation}{" "}
              {FLOW_UNSYS_EXPLAINER.reset}
            </p>
          </div>

          <textarea
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            placeholder="Tell the model how to adapt this unsys field"
            data-flow-unsys-prompt=""
            className={`${FLOW_FORM_TEXTAREA} mt-4 min-h-[5.5rem]`}
            disabled={disabled}
          />

          <div className="mt-3 space-y-2" data-flow-unsys-prompt-files="">
            {promptFiles.map((item) => (
              <div
                key={item.xaiFileId}
                className="flex items-center justify-between gap-2 border border-white/20 px-2 py-1.5"
                data-flow-unsys-prompt-file=""
              >
                <p className="min-w-0 truncate text-xs text-neutral-200">{item.name}</p>
                <button
                  type="button"
                  className={FLOW_COMPACT_GHOST_BTN}
                  disabled={disabled}
                  onClick={() =>
                    setPromptFiles(promptFiles.filter((row) => row.xaiFileId !== item.xaiFileId))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              data-flow-unsys-prompt-file-add=""
              className={FLOW_COMPACT_GHOST_BTN}
              disabled={disabled || promptFiles.length >= FLOW_ARTIFACT_MAX_COUNT}
              onClick={() => fileRef.current?.click()}
            >
              Add files
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={FLOW_ARTIFACT_ACCEPT}
              className="hidden"
              data-flow-unsys-prompt-file-input=""
              onChange={(event) => void attachPromptFiles(event.target.files)}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              data-flow-unsys-prompt-apply=""
              className={FLOW_COMPACT_PRIMARY_BTN}
              disabled={disabled || !canApply}
              onClick={() => void generate({ prompt: guidance.trim() })}
            >
              {generating ? "Generating…" : "Apply"}
            </button>
            <button
              type="button"
              data-flow-unsys-reset=""
              className={FLOW_COMPACT_GHOST_BTN}
              disabled={disabled || !problem.trim()}
              onClick={() => void generate({ reset: true })}
            >
              Reset
            </button>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-red-300" data-flow-unsys-error="">
              {error}
            </p>
          ) : null}

          <div className="mt-4 border-t border-white/10 pt-3">
            <WorkspaceUnsysSeedInspector
              model={model}
              focusId={focusId}
              disabled={disabled}
              showFieldHints
              embedded
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
          </div>
        </div>
        {actions ? (
          <div className="shrink-0 border-t border-white/10 px-4 py-2">{actions}</div>
        ) : null}
      </aside>

      <div className="relative min-h-[28rem] min-w-0 flex-1 overflow-hidden lg:min-h-0">
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
    </div>
  );
}
