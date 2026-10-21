"use client";

import { useRef } from "react";
import {
  LEARN_SUGGESTION_ADD_LABEL,
  LEARN_SUGGESTION_DISMISS_LABEL,
  learnSuggestionToastAction,
  learnSuggestionToastClass,
  type LearnSuggestionToastPlacement,
} from "@/lib/learn-suggestion";

/** Learn note. Stays until dismiss or add. */
export function LearnSuggestionToast({
  text,
  placement,
  onAdd,
  onDone,
}: {
  text: string;
  placement: LearnSuggestionToastPlacement;
  onAdd: (text: string) => void;
  onDone: (text: string) => void;
}) {
  const onAddRef = useRef(onAdd);
  const onDoneRef = useRef(onDone);
  onAddRef.current = onAdd;
  onDoneRef.current = onDone;
  return (
    <div
      data-learn-suggestion
      data-learn-suggestion-placement={placement}
      role="status"
      className={`${learnSuggestionToastClass(placement)} border border-white bg-neutral-950 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)]`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-2 p-2">
        <p className="min-w-0 flex-1 font-mono text-[12px] leading-snug">{text}</p>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            data-learn-suggestion-dismiss
            className="border border-white/50 px-2 py-1 font-mono text-[11px] leading-tight text-white hover:border-white hover:bg-white/10"
            onClick={() => {
              const action = learnSuggestionToastAction("dismiss", text);
              onDoneRef.current(action.dismiss);
            }}
          >
            {LEARN_SUGGESTION_DISMISS_LABEL}
          </button>
          <button
            type="button"
            data-learn-suggestion-add
            className="border border-white bg-white px-2 py-1 font-mono text-[11px] leading-tight text-neutral-950 hover:bg-neutral-200"
            onClick={() => {
              const action = learnSuggestionToastAction("add", text);
              onDoneRef.current(action.dismiss);
              if (action.place) onAddRef.current(action.place);
            }}
          >
            {LEARN_SUGGESTION_ADD_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
