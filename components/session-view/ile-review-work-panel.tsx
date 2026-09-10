"use client";

import { useMemo, useState } from "react";
import {
  ILE_POW_COUNTER_LABELS,
  ILE_POW_DISPLAY_COUNTER_TYPES,
  type IlePowDisplayCounterType,
} from "@/lib/ile-pow-counters";
import {
  ILE_REVIEW_WORK_LABEL,
  listIleUnsubmittedReviewItems,
  type IleReviewWorkThought,
} from "@/lib/ile-review-work";
import { IlePowTypeIcon } from "@/components/session-view/ile-pow-icons";

export function IleReviewWorkPanel({
  thoughts = [],
  formingText = "",
  notebookDirty = false,
  notebookContent = "",
  canvasDirty = false,
}: {
  thoughts?: readonly IleReviewWorkThought[];
  formingText?: string | null;
  notebookDirty?: boolean;
  notebookContent?: string | null;
  canvasDirty?: boolean;
}) {
  const items = useMemo(
    () =>
      listIleUnsubmittedReviewItems({
        thoughts,
        formingText,
        notebookDirty,
        notebookContent,
        canvasDirty,
      }),
    [thoughts, formingText, notebookDirty, notebookContent, canvasDirty],
  );
  const [activeType, setActiveType] = useState<IlePowDisplayCounterType>("thoughts");
  const activeItems = items[activeType] ?? [];

  return (
    <div
      data-ile-review-work-panel
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {ILE_REVIEW_WORK_LABEL}
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          Inspect unsubmitted proof of work before End turn.
        </p>
      </div>
      <div
        data-ile-review-work-tabs
        className="flex min-w-0 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-neutral-800 px-1 py-1"
      >
        {ILE_POW_DISPLAY_COUNTER_TYPES.map((type) => {
          const count = items[type]?.length ?? 0;
          const active = activeType === type;
          return (
            <button
              key={type}
              type="button"
              data-ile-review-work-tab={type}
              data-ile-review-work-tab-active={active ? "true" : undefined}
              title={ILE_POW_COUNTER_LABELS[type]}
              onClick={() => setActiveType(type)}
              className={`flex shrink-0 items-center gap-1 rounded-none px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                active
                  ? "bg-white text-neutral-950"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              }`}
            >
              <IlePowTypeIcon type={type} />
              <span>{ILE_POW_COUNTER_LABELS[type]}</span>
              <span
                data-ile-review-work-tab-count={type}
                className={
                  count > 0
                    ? active
                      ? "text-red-600"
                      : "text-red-400"
                    : active
                      ? "text-neutral-400"
                      : "text-neutral-600"
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeItems.length === 0 ? (
          <div
            data-ile-review-work-empty={activeType}
            className="rounded-none border border-dashed border-neutral-800 px-3 py-8 text-center text-xs text-neutral-600"
          >
            No unsubmitted {ILE_POW_COUNTER_LABELS[activeType].toLowerCase()}.
          </div>
        ) : (
          <ul className="space-y-2">
            {activeItems.map((item) => (
              <li
                key={item.id}
                data-ile-review-work-item={item.id}
                className="rounded-none border border-neutral-800 bg-black/30 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    {item.label}
                  </span>
                  {item.live ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-red-400">
                      Live
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-red-400/80">
                      Unsubmitted
                    </span>
                  )}
                </div>
                {item.detail && item.detail !== item.label ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                    {item.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
