"use client";

import { useState } from "react";
import {
  LEARNING_MODEL_CATALOG_16,
  LEARNING_MODEL_CATALOG_4,
  LEARNING_MODEL_CATALOG_8,
  LEARNING_MODEL_SIZE_COPY,
  type LearningModelSize,
} from "@/lib/learning-model";
import {
  SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES,
  SCIENCE_LEARNING_MODEL_COPY,
} from "@/lib/science/learning-model-copy";
import { LearningModelActionGlyph } from "@/components/science/LearningModelMarks";
import { LearningModelFactorCopy } from "@/components/science/LearningModelFactorCopy";

const CATALOGS = [
  { size: 4 as const, actions: LEARNING_MODEL_CATALOG_4 },
  { size: 8 as const, actions: LEARNING_MODEL_CATALOG_8 },
  { size: 16 as const, actions: LEARNING_MODEL_CATALOG_16 },
];

export function LearningModelCatalogs() {
  const [size, setSize] = useState<LearningModelSize>(4);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Historical action catalogs">
        {CATALOGS.map((catalog) => {
          const selected = size === catalog.size;
          return (
            <button
              key={catalog.size}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSize(catalog.size)}
              className={`console-button px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] ${
                selected ? "border-white text-white" : "text-zinc-400 hover:border-white/70 hover:text-white"
              }`}
            >
              {LEARNING_MODEL_SIZE_COPY[catalog.size].title}
            </button>
          );
        })}
      </div>
      {CATALOGS.map((catalog) => (
        <article
          key={catalog.size}
          hidden={size !== catalog.size}
          data-learning-model-catalog={catalog.size}
          className="console-copy p-5 sm:p-6"
        >
          <p className="text-sm leading-relaxed text-zinc-400">
            {catalog.size === 4
              ? SCIENCE_LEARNING_MODEL_COPY.fourLead
              : catalog.size === 8
                ? SCIENCE_LEARNING_MODEL_COPY.eightLead
                : SCIENCE_LEARNING_MODEL_COPY.sixteenLead}
          </p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {catalog.actions.map((action) => (
              <li
                key={`${catalog.size}-${action.id}`}
                data-learning-model-action={action.id}
                className="flex items-start gap-3 border border-white/15 px-3 py-3 sm:px-4 sm:py-4"
              >
                <span className="relative mt-0.5 h-8 w-8 shrink-0 overflow-clip border border-white/25 text-zinc-200 [clip-path:inset(0)]">
                  <LearningModelActionGlyph id={action.id} />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {action.label} · {action.kind}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
                    {action.meaning}
                  </span>
                  <span className="mt-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    On Integrals
                  </span>
                  <span
                    className="mt-1 block text-xs leading-relaxed text-zinc-300 sm:text-[13px]"
                    data-learning-model-action-example={action.id}
                  >
                    <LearningModelFactorCopy
                      text={SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES[action.id]}
                    />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
