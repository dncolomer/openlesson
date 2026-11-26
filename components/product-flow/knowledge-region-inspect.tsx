"use client";

import { useEffect, useMemo, useState } from "react";
import { DataStudioInspectFields } from "@/components/data-studio/DataStudioInspect";
import { FLOW_FORM_LABEL } from "@/components/product-flow/product-flow-form";
import { WorkspaceUnsysSeedGraph } from "@/components/WorkspaceUnsysSeedGraph";
import {
  formatStudioHighDimDistance,
  type DataStudioInspectPayload,
} from "@/lib/data-studio-view";
import {
  formatKnowledgeRegionTimestamp,
  knowledgeRegionFigureTrack,
  knowledgeRegionPointKindLabel,
  parseKnowledgeRegionFigureMode,
  type KnowledgeRegionClusterDistance,
  type KnowledgeRegionFigureMode,
  type KnowledgeRegionIdentityPath,
} from "@/lib/knowledge-region-figure";
import type { KnowledgeRegionDetailsSample } from "@/lib/knowledge-region-details";
import {
  overlayToSessionBranchModel,
  walkSequenceNumbers,
  type KnowledgeRegionUncertaintyModelRender,
} from "@/lib/knowledge-region-unsys";

type InspectTab = "distances" | "path" | "record" | "unsys";

const TAB_CLASS =
  "border-b px-4 py-2 text-[11px] uppercase tracking-[0.16em]";
const TAB_ON = `${TAB_CLASS} border-white text-white`;
const TAB_OFF = `${TAB_CLASS} border-transparent text-neutral-500 hover:text-neutral-200`;

export function KnowledgeRegionInspect({
  inspect,
  sample,
  distances,
  path = null,
  unsysDistance = null,
  aiUseNearest = null,
  mode = "individual",
  productKind,
  identityLabel,
  unsysModel = null,
  onClose,
  onSelectStep,
}: {
  inspect: DataStudioInspectPayload;
  sample: KnowledgeRegionDetailsSample;
  distances: readonly KnowledgeRegionClusterDistance[];
  path?: KnowledgeRegionIdentityPath | null;
  unsysDistance?: number | null;
  aiUseNearest?: { label: string; formatted: string } | null;
  mode?: KnowledgeRegionFigureMode | string | null;
  productKind?: string | null;
  identityLabel?: string | null;
  unsysModel?: KnowledgeRegionUncertaintyModelRender | null;
  onClose: () => void;
  onSelectStep?: (id: string) => void;
}) {
  const shownIdentity =
    String(identityLabel || "").trim() || inspect.identity || sample.id;
  const figureMode = parseKnowledgeRegionFigureMode(mode);
  const figureTrack = knowledgeRegionFigureTrack(figureMode);
  const primaryTab: InspectTab = figureTrack === "path" ? "path" : "distances";
  const [tab, setTab] = useState<InspectTab>(primaryTab);

  useEffect(() => {
    setTab(primaryTab);
  }, [inspect.id, primaryTab]);

  const overlayModel = useMemo(
    () => overlayToSessionBranchModel(unsysModel?.overlay ?? null),
    [unsysModel],
  );
  const visitSequence = useMemo(
    () => walkSequenceNumbers(unsysModel?.overlay.walk ?? unsysModel?.mapped.sequence ?? []),
    [unsysModel],
  );
  const walkSteps = useMemo(
    () =>
      (unsysModel?.overlay.hidden_states ?? [])
        .filter((state) => state.visited)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [unsysModel],
  );
  const [hoverHid, setHoverHid] = useState<string | null>(null);
  const [selectedHid, setSelectedHid] = useState<string | null>(null);
  const highlightHid = hoverHid || selectedHid;

  useEffect(() => {
    setHoverHid(null);
    setSelectedHid(null);
  }, [inspect.id, unsysModel?.run_id, unsysModel?.observation_id]);

  return (
    <section
      className="select-text border border-white/15 bg-black/80"
      data-knowledge-region-inspect=""
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="truncate text-sm text-white">{shownIdentity}</p>
        <button
          type="button"
          className="text-[11px] text-neutral-500 hover:text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="flex" role="tablist" aria-label="Point inspect">
        {figureTrack === "path" ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "path"}
            className={tab === "path" ? TAB_ON : TAB_OFF}
            data-knowledge-region-inspect-tab="path"
            onClick={() => setTab("path")}
          >
            Path
          </button>
        ) : (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "distances"}
            className={tab === "distances" ? TAB_ON : TAB_OFF}
            data-knowledge-region-inspect-tab="distances"
            onClick={() => setTab("distances")}
          >
            Distances
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "unsys"}
          className={tab === "unsys" ? TAB_ON : TAB_OFF}
          data-knowledge-region-inspect-tab="unsys"
          onClick={() => setTab("unsys")}
        >
          Uncertainty model
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "record"}
          className={tab === "record" ? TAB_ON : TAB_OFF}
          data-knowledge-region-inspect-tab="record"
          onClick={() => setTab("record")}
        >
          Stored record
        </button>
      </div>
      {tab === "path" ? (
        <div className="space-y-4 p-4 text-sm text-neutral-300" data-knowledge-region-inspect-panel="path">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className={FLOW_FORM_LABEL}>Identity</dt>
            <dd className="text-white">{path?.label || shownIdentity}</dd>
            <dt className={FLOW_FORM_LABEL}>Observations</dt>
            <dd className="text-white">{path?.steps.length ?? 0}</dd>
          </dl>
          <div data-knowledge-region-path-table="">
            <p className={FLOW_FORM_LABEL}>Connected evolution</p>
            {path?.steps.length ? (
              <table className="mt-2 w-full text-left text-[12px]">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="pb-1 font-normal">#</th>
                    <th className="pb-1 font-normal">Created</th>
                    <th className="pb-1 font-normal">Cluster</th>
                    <th className="pb-1 text-right font-normal">Δ L2</th>
                  </tr>
                </thead>
                <tbody>
                  {path.steps.map((step, index) => {
                    const previous = index > 0 ? path.segments[index - 1] : null;
                    const current = step.id === sample.id;
                    return (
                      <tr
                        key={step.id}
                        className={`cursor-pointer ${current ? "text-white" : "text-neutral-300 hover:text-white"}`}
                        data-knowledge-region-path-row={step.id}
                        data-knowledge-region-path-row-current={String(current)}
                        onClick={() => onSelectStep?.(step.id)}
                      >
                        <td className="py-0.5 pr-3 font-mono">{step.index}</td>
                        <td className="py-0.5 pr-3 font-mono">
                          {formatKnowledgeRegionTimestamp(step.createdAt)}
                        </td>
                        <td className="py-0.5 pr-3">{step.clusterLabel || "—"}</td>
                        <td className="py-0.5 text-right font-mono">
                          {previous?.label ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-[12px] text-neutral-500">
                Select a named identity to follow its evolution.
              </p>
            )}
          </div>
        </div>
      ) : tab === "distances" ? (
        <div className="space-y-4 p-4 text-sm text-neutral-300" data-knowledge-region-inspect-panel="distances">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className={FLOW_FORM_LABEL}>Origin</dt>
            <dd className="text-white" data-knowledge-region-inspect-kind={sample.pointKind}>
              {knowledgeRegionPointKindLabel(sample.pointKind, productKind)}
            </dd>
            {sample.embedding.link_label ? (
              <>
                <dt className={FLOW_FORM_LABEL}>Link</dt>
                <dd className="text-white" data-knowledge-region-inspect-link="">
                  {sample.embedding.link_label}
                </dd>
              </>
            ) : null}
            <dt className={FLOW_FORM_LABEL}>Created</dt>
            <dd className="font-mono text-[12px] text-white" data-knowledge-region-inspect-created="">
              {formatKnowledgeRegionTimestamp(
                inspect.created_at || sample.embedding.created_at,
              )}
            </dd>
            <dt className={FLOW_FORM_LABEL}>Cluster</dt>
            <dd className="text-white">{sample.strategyName || "—"}</dd>
            <dt className={FLOW_FORM_LABEL}>Unsys</dt>
            <dd className="font-mono text-[12px] text-white" data-knowledge-region-inspect-unsys="">
              {typeof unsysDistance === "number" && Number.isFinite(unsysDistance)
                ? formatStudioHighDimDistance(unsysDistance)
                : "—"}
            </dd>
            {aiUseNearest ? (
              <>
                <dt className={FLOW_FORM_LABEL}>Nearest AI use</dt>
                <dd
                  className="font-mono text-[12px] text-white"
                  data-knowledge-region-inspect-ai-use-nearest=""
                >
                  {aiUseNearest.label} · {aiUseNearest.formatted}
                </dd>
              </>
            ) : null}
            <dt className={FLOW_FORM_LABEL}>flow_id</dt>
            <dd className="break-all font-mono text-[12px]">{inspect.flow_id || "—"}</dd>
            <dt className={FLOW_FORM_LABEL}>run_id</dt>
            <dd className="break-all font-mono text-[12px]">{inspect.run_id || "—"}</dd>
          </dl>
          <div data-knowledge-region-distance-table="">
            <p className={FLOW_FORM_LABEL}>‖x−c‖ to clusters</p>
            {distances.length ? (
              <table className="mt-2 w-full text-left text-[12px]">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="pb-1 font-normal">Cluster</th>
                    <th className="pb-1 text-right font-normal">L2</th>
                    <th className="pb-1 text-right font-normal">Member</th>
                  </tr>
                </thead>
                <tbody>
                  {distances.map((row) => (
                    <tr
                      key={row.clusterId}
                      className={row.nearest ? "text-white" : "text-neutral-300"}
                      data-knowledge-region-distance={row.clusterId}
                      data-knowledge-region-distance-nearest={String(row.nearest)}
                    >
                      <td className="py-0.5 pr-3">{row.label}</td>
                      <td className="py-0.5 text-right font-mono">{row.formatted}</td>
                      <td className="py-0.5 text-right font-mono text-neutral-500">
                        {row.inCluster ? "in" : "out"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-[12px] text-neutral-500">No cluster centroids to measure.</p>
            )}
          </div>
        </div>
      ) : tab === "unsys" ? (
        <div className="text-sm text-neutral-300" data-knowledge-region-inspect-panel="unsys">
          {overlayModel ? (
            <div
              className="flex h-[22rem] border-t border-white/10"
              data-knowledge-region-unsys=""
            >
              <div className="relative min-w-0 flex-1" data-knowledge-region-unsys-graph="">
                <WorkspaceUnsysSeedGraph
                  model={overlayModel}
                  focusId=""
                  highlightId={highlightHid}
                  draggableNodes={false}
                  visitSequence={visitSequence}
                  onSelect={setSelectedHid}
                  onHover={setHoverHid}
                />
              </div>
              <aside
                className="flex w-44 shrink-0 flex-col border-l border-white/10"
                data-knowledge-region-unsys-walk=""
              >
                <p className={`${FLOW_FORM_LABEL} px-3 py-2`}>Walk</p>
                {walkSteps.length ? (
                  <ol className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
                    {walkSteps.map((state) => {
                      const current = state.id === highlightHid;
                      return (
                        <li key={state.id}>
                          <button
                            type="button"
                            className={`flex w-full items-baseline gap-2 px-2 py-1.5 text-left font-mono text-[11px] ${
                              current
                                ? "bg-white/10 text-white"
                                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                            }`}
                            data-knowledge-region-unsys-step={state.sequence}
                            data-knowledge-region-unsys-step-id={state.id}
                            data-knowledge-region-unsys-step-current={String(current)}
                            onMouseEnter={() => setHoverHid(state.id)}
                            onMouseLeave={() => setHoverHid(null)}
                            onFocus={() => setHoverHid(state.id)}
                            onBlur={() => setHoverHid(null)}
                            onClick={() => setSelectedHid(state.id)}
                          >
                            <span
                              className={`w-5 shrink-0 tabular-nums ${
                                current ? "text-[#ffe14a]" : "text-neutral-500"
                              }`}
                            >
                              {state.sequence}
                            </span>
                            <span className="min-w-0 truncate uppercase tracking-[0.08em]">
                              {state.title || state.id}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="px-3 pb-3 text-[12px] text-neutral-500">
                    No hidden-state walk on this run.
                  </p>
                )}
              </aside>
            </div>
          ) : (
            <p className="p-4 text-neutral-500">No uncertainty model on this run.</p>
          )}
        </div>
      ) : (
        <div className="p-4 text-sm text-neutral-300" data-knowledge-region-inspect-panel="record">
          <DataStudioInspectFields inspect={inspect} inspectDistanceRays={[]} />
        </div>
      )}
    </section>
  );
}
