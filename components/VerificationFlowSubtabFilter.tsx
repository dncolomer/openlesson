"use client";

import {
  filterKnowledgeRowsByVerificationFlow,
  type VerificationKnowledgeRow,
} from "@/lib/verification-flow";

export type VerificationFlowFilterState = {
  enabled: boolean;
  flows: Array<{ id: string; topic: string }>;
  flowId: string | null;
  rows: VerificationKnowledgeRow[];
  onFlowId: (flowId: string | null) => void;
};

export function VerificationFlowSubtabFilter({
  subtab,
  filter,
}: {
  subtab: "ranking" | "strengths_gaps" | "lwm" | "embeddings";
  filter?: VerificationFlowFilterState | null;
}) {
  if (!filter?.enabled) return null;
  const visible = filterKnowledgeRowsByVerificationFlow(filter.rows, filter.flowId);
  return (
    <div
      className="mb-3 space-y-2 border border-neutral-800 bg-neutral-950/80 p-3"
      data-verification-flow-filter
      data-knowledge-subtab-filter={subtab}
    >
      <label className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
        Verification flow
        <select
          value={filter.flowId || ""}
          data-verification-flow-select
          onChange={(event) => filter.onFlowId(event.target.value || null)}
          className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white"
        >
          <option value="">All flows</option>
          {filter.flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.topic}
            </option>
          ))}
        </select>
      </label>
      {filter.flowId ? (
        <ul className="space-y-1 text-xs text-neutral-200" data-knowledge-flow-rows>
          {visible.length === 0 ? (
            <li data-knowledge-flow-empty>No results for this verification flow.</li>
          ) : (
            visible.map((row) => (
              <li key={row.id} data-knowledge-flow-row={row.flowId || ""}>
                <span className="text-neutral-400">{row.label}</span>
                {row.detail ? ` — ${row.detail}` : ""}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
