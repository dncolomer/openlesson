"use client";

import { useEffect, useState } from "react";
import { DataStudioInspectFields } from "@/components/data-studio/DataStudioInspect";
import { FLOW_FORM_LABEL } from "@/components/product-flow/product-flow-form";
import type { DataStudioInspectPayload } from "@/lib/data-studio-view";
import {
  formatKnowledgeRegionTimestamp,
  knowledgeRegionPointKindLabel,
  type KnowledgeRegionClusterDistance,
} from "@/lib/knowledge-region-figure";
import type { KnowledgeRegionDetailsSample } from "@/lib/knowledge-region-details";

type InspectTab = "distances" | "record";

const TAB_CLASS =
  "border-b px-4 py-2 text-[11px] uppercase tracking-[0.16em]";
const TAB_ON = `${TAB_CLASS} border-white text-white`;
const TAB_OFF = `${TAB_CLASS} border-transparent text-neutral-500 hover:text-neutral-200`;

export function KnowledgeRegionInspect({
  inspect,
  sample,
  distances,
  productKind,
  onClose,
}: {
  inspect: DataStudioInspectPayload;
  sample: KnowledgeRegionDetailsSample;
  distances: readonly KnowledgeRegionClusterDistance[];
  productKind?: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<InspectTab>("distances");

  useEffect(() => {
    setTab("distances");
  }, [inspect.id]);

  return (
    <section
      className="select-text border border-white/15 bg-black/80"
      data-knowledge-region-inspect=""
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="truncate text-sm text-white">{inspect.identity || sample.id}</p>
        <button
          type="button"
          className="text-[11px] text-neutral-500 hover:text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="flex" role="tablist" aria-label="Point inspect">
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
      {tab === "distances" ? (
        <div className="space-y-4 p-4 text-sm text-neutral-300" data-knowledge-region-inspect-panel="distances">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className={FLOW_FORM_LABEL}>Origin</dt>
            <dd className="text-white" data-knowledge-region-inspect-kind={sample.pointKind}>
              {knowledgeRegionPointKindLabel(sample.pointKind, productKind)}
            </dd>
            <dt className={FLOW_FORM_LABEL}>Created</dt>
            <dd className="font-mono text-[12px] text-white" data-knowledge-region-inspect-created="">
              {formatKnowledgeRegionTimestamp(
                inspect.created_at || sample.embedding.created_at,
              )}
            </dd>
            <dt className={FLOW_FORM_LABEL}>Cluster</dt>
            <dd className="text-white">{sample.strategyName || "—"}</dd>
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
      ) : (
        <div className="p-4 text-sm text-neutral-300" data-knowledge-region-inspect-panel="record">
          <DataStudioInspectFields inspect={inspect} inspectDistanceRays={[]} />
        </div>
      )}
    </section>
  );
}
