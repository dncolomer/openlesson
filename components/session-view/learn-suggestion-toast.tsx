"use client";

import { useEffect, useRef } from "react";
import {
  LEARN_SUGGESTION_ADD_LABEL,
  LEARN_SUGGESTION_TOAST_MS,
  learnSuggestionToastAction,
  learnSuggestionToastClass,
  type LearnSuggestionToastPlacement,
} from "@/lib/ile-learn-suggestion";

/** Ephemeral Learn note. The bar drains to zero, then the note unmounts. */
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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const action = learnSuggestionToastAction("timeout", text);
      onDoneRef.current(action.dismiss);
    }, LEARN_SUGGESTION_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [text]);
  return (
    <div
      data-ile-learn-suggestion
      data-ile-learn-suggestion-placement={placement}
      data-ile-learn-suggestion-ms={LEARN_SUGGESTION_TOAST_MS}
      role="status"
      className={`${learnSuggestionToastClass(placement)} border border-white bg-neutral-950 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)]`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-2 p-2">
        <p className="min-w-0 flex-1 font-mono text-[12px] leading-snug">{text}</p>
        <button
          type="button"
          data-ile-learn-suggestion-add
          className="shrink-0 border border-white bg-white px-2 py-1 font-mono text-[11px] leading-tight text-neutral-950 hover:bg-neutral-200"
          onClick={() => {
            const action = learnSuggestionToastAction("add", text);
            onDoneRef.current(action.dismiss);
            if (action.place) onAddRef.current(action.place);
          }}
        >
          {LEARN_SUGGESTION_ADD_LABEL}
        </button>
      </div>
      <div className="h-1 w-full overflow-hidden bg-white/20" aria-hidden>
        <div
          data-ile-learn-suggestion-bar
          className="h-full w-full origin-left bg-white"
          style={{
            transform: "scaleX(1)",
            animation: `ile-learn-suggestion-drain ${LEARN_SUGGESTION_TOAST_MS}ms linear forwards`,
          }}
        />
      </div>
      <style>{`@keyframes ile-learn-suggestion-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
    </div>
  );
}
