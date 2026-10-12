"use client";

import { useState } from "react";
import { policySuggestionIsRawLabel, type SessionPolicyInference } from "@/lib/session-policy-infer";
import type { SessionMarkMode } from "@/lib/session-marks";

const TAB_CLASS =
  "min-w-0 rounded-none px-2 py-1 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.22em]";

function learnerPolicyLine(label: string): string {
  const text = label.trim();
  if (!text || policySuggestionIsRawLabel(text)) return "";
  return text;
}

/** Sidebar focus. Learn keeps policy and the next step as two tabs of one panel. */
export function SessionPolicyFocusView({
  mode,
  entries,
  suggestion,
  preparing = false,
  failedMessage = null,
}: {
  mode: SessionMarkMode | null;
  entries: readonly SessionPolicyInference[];
  suggestion?: string | null;
  preparing?: boolean;
  failedMessage?: string | null;
}) {
  const [tab, setTab] = useState<"policy" | "focus">("focus");
  const sentence =
    mode === "learn" && suggestion && !policySuggestionIsRawLabel(suggestion)
      ? suggestion.trim()
      : "";
  const history = (
    <ol data-session-policy-history className="flex list-none flex-col gap-2 p-0">
      {entries.map((entry, index) => {
        const line = learnerPolicyLine(entry.label);
        return (
          <li
            key={`${index}:${entry.action}:${entry.confidence}`}
            data-session-policy-inference={entry.action}
            data-session-policy-confidence={entry.confidence}
            className="border border-neutral-700 px-3 py-2 font-mono text-sm leading-snug text-white"
          >
            <p>
              {line ? <span data-session-policy-line>{line}</span> : null}
              {line ? " " : null}
              {entry.confidence}
            </p>
          </li>
        );
      })}
    </ol>
  );
  const status = (
    <>
      {preparing ? (
        <p data-session-branch-preparing className="px-1 py-2 font-mono text-[11px] leading-snug text-neutral-300">
          Preparing the field for this session.
        </p>
      ) : null}
      {failedMessage ? (
        <p data-session-branch-failed className="px-1 py-2 font-mono text-[11px] leading-snug text-neutral-300">
          {failedMessage}
        </p>
      ) : null}
    </>
  );
  if (mode !== "learn") {
    return (
      <div data-session-actions className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-2 py-2">
        {status}
        {history}
      </div>
    );
  }
  const policyOpen = tab === "policy";
  return (
    <div data-session-actions className="flex h-full min-h-0 flex-col overflow-hidden">
      <div role="tablist" className="flex shrink-0 items-center gap-2 border-b border-white/30 bg-black px-2 py-1 pl-3">
        <span aria-hidden className="font-mono text-[9px] tracking-[0.28em] text-white/45">
          02
        </span>
        <button
          type="button"
          role="tab"
          data-session-policy-learn-tab="policy"
          aria-selected={policyOpen}
          onClick={() => setTab("policy")}
          className={`${TAB_CLASS} ${policyOpen ? "bg-white text-neutral-950" : "text-white/45"}`}
        >
          policy
        </button>
        <button
          type="button"
          role="tab"
          data-session-policy-learn-tab="focus"
          aria-selected={!policyOpen}
          onClick={() => setTab("focus")}
          className={`${TAB_CLASS} ${policyOpen ? "text-white/45" : "bg-white text-neutral-950"}`}
        >
          focus
        </button>
        <span aria-hidden className="ml-auto font-mono text-[8px] tracking-[0.35em] text-white/35">
          ////
        </span>
      </div>
      <section
        data-session-policy-section="policy"
        className={policyOpen ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "hidden"}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {status}
          {history}
        </div>
      </section>
      <section
        data-session-policy-section="focus"
        data-session-policy-focus
        className={policyOpen ? "hidden" : "flex min-h-0 flex-1 flex-col overflow-hidden bg-black"}
      >
        {sentence ? (
          <div className="p-2">
            <p
              data-session-policy-suggestion
              className="border border-white bg-white px-3 py-3 font-mono text-sm leading-snug text-neutral-950"
            >
              {sentence}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
