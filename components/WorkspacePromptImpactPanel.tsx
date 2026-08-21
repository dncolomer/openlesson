"use client";

import {
  assemblePromptWorkspaceContext,
  type PromptBlockInventoryItem,
  type PromptImpactLayer,
  type PromptWorkspaceContextInput,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

/**
 * Clear, non-jargon view of how assembled context feeds TAP / ILE / TAPBench.
 * Readable by builders (creators) and buyers (consumers).
 */
export function WorkspacePromptImpactPanel({
  workspaceTitle,
  rootTopic,
  workspaceGoal,
  workspaceDescription,
  notes,
  files,
  blocks,
  focusedBlockId,
  blockTitle,
  blockDescription,
  blockLocalContext,
  unusableCells,
  compact,
  canEdit: _canEdit,
  /** When true, omit the "How context shapes practice" header (tab panels). */
  hideHeading,
}: {
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  files?: WorkspaceFileContextItem[] | null;
  blocks?: PromptBlockInventoryItem[] | null;
  focusedBlockId?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  blockLocalContext?: PromptWorkspaceContextInput["blockLocalContext"];
  unusableCells?: Array<{ row: number; col: number }> | null;
  compact?: boolean;
  canEdit?: boolean;
  hideHeading?: boolean;
}) {
  const ctx = assemblePromptWorkspaceContext({
    workspaceTitle,
    rootTopic,
    workspaceGoal,
    workspaceDescription,
    notes,
    files,
    blocks,
    focusedBlockId,
    blockTitle,
    blockDescription,
    blockLocalContext,
    unusableCells,
  });

  return (
    <div
      data-workspace-prompt-impact
      data-has-local-context={ctx.hasLocalContext ? "true" : "false"}
      data-has-domain-substance={ctx.hasDomainSubstance ? "true" : "false"}
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-none border border-neutral-800/80 bg-neutral-950/80 p-3 sm:p-4"
      }
    >
      {!hideHeading ? (
        <header className="space-y-1" data-prompt-impact-heading>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            How context shapes practice
          </p>
        </header>
      ) : null}

      <ul className="space-y-2" data-prompt-impact-layers>
        {ctx.promptImpactLayers.map((layer) => (
          <PromptImpactLayerRow key={layer.id} layer={layer} />
        ))}
      </ul>

      {ctx.hasLocalContext ? (
        <div
          data-local-context-preview
          className="rounded-none border border-white/10 bg-white/[0.03] p-2.5"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Local block context in prompts
          </p>
          <pre className="mt-1.5 max-h-28 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-neutral-300">
            {ctx.localContextLines.join("\n")}
          </pre>
        </div>
      ) : null}

      {!compact && ctx.contextBlock ? (
        <details className="group rounded-none border border-neutral-800/70 bg-black/30">
          <summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] text-neutral-400 hover:text-neutral-200">
            <span className="underline-offset-2 group-open:underline">
              Preview assembled context (what models see)
            </span>
          </summary>
          <pre
            data-assembled-context-preview
            className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-neutral-800/70 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-neutral-500"
          >
            {ctx.contextBlock}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function PromptImpactLayerRow({ layer }: { layer: PromptImpactLayer }) {
  return (
    <li
      data-prompt-impact-layer={layer.id}
      data-present={layer.present ? "true" : "false"}
      className={`rounded-none border px-2.5 py-2 ${
        layer.present
          ? "border-white/10 bg-white/[0.04]"
          : "border-neutral-800/60 bg-transparent opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-200">{layer.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{layer.summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {layer.feeds.map((feed) => (
            <span
              key={feed}
              data-prompt-feed={feed}
              className="rounded-none border border-neutral-700/80 bg-neutral-900/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-neutral-400"
            >
              {feed}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}
