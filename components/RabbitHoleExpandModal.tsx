"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ExpandSourceIdentity } from "@/lib/expand-block-from-source";
import {
  canFinishRabbitHoleExpandEarly,
  createRabbitHoleExpandState,
  createSummaryState,
  finishRabbitHoleExpandEarly,
  getConfirmedCandidates,
  pickQuestion,
  questionsNeededForRound,
  receiveQuestions,
  restartRabbitHoleExpand,
  toggleSummaryCandidate,
  type RabbitHoleExpandState,
  type RabbitHoleExpandSummaryState,
} from "@/lib/rabbit-hole-expand";

export type RabbitHoleExpandModalProps = {
  open: boolean;
  source: ExpandSourceIdentity;
  /** Active selection size = generation outline target. */
  outlineTarget: number;
  workspaceId: string;
  locale?: string;
  ayclToken?: string | null;
  onClose: () => void;
  /** Confirmed ordered candidate questions for expand multi-create. */
  onConfirm: (candidates: string[]) => void;
};

/**
 * Rabbit-hole expansion modal: dive questions → pick path → summary select → confirm.
 * Sidebar tracks depth and remaining candidates vs outline. No step-back; restart only.
 */
export function RabbitHoleExpandModal({
  open,
  source,
  outlineTarget,
  workspaceId,
  locale = "en",
  ayclToken,
  onClose,
  onConfirm,
}: RabbitHoleExpandModalProps) {
  const [state, setState] = useState<RabbitHoleExpandState>(() =>
    createRabbitHoleExpandState(outlineTarget),
  );
  const [summary, setSummary] = useState<RabbitHoleExpandSummaryState | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Client-only: portal target is document.body (SSR-safe). */
  const [mounted, setMounted] = useState(false);
  const loadGenRef = useRef(0);
  const seedTitle = String(source.title || "").trim() || "Untitled block";

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchQuestions = useCallback(
    async (forState: RabbitHoleExpandState) => {
      if (forState.phase === "complete") return;
      const gen = ++loadGenRef.current;
      setLoading(true);
      setError(null);
      const count = questionsNeededForRound(forState.depth);
      try {
        const res = await fetch("/api/workspace/rabbit-hole-expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            seedTitle: source.title,
            seedDescription: source.description,
            path: forState.candidates,
            depth: forState.depth,
            count,
            locale,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || "Failed to generate rabbit-hole questions",
          );
        }
        const data = await res.json();
        if (gen !== loadGenRef.current) return;
        const questions = Array.isArray(data.questions)
          ? data.questions.map((q: unknown) => String(q ?? "").trim())
          : [];
        setState((prev) => receiveQuestions(prev, questions));
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate rabbit-hole questions",
        );
      } finally {
        if (gen === loadGenRef.current) setLoading(false);
      }
    },
    [
      ayclToken,
      locale,
      source.description,
      source.title,
      workspaceId,
    ],
  );

  // Reset + load initial questions when modal opens or outline/seed changes.
  useEffect(() => {
    if (!open) return;
    loadGenRef.current += 1;
    const next = createRabbitHoleExpandState(outlineTarget);
    setState(next);
    setSummary(null);
    setError(null);
    void fetchQuestions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open gate; seed/outline in deps
  }, [open, outlineTarget, source.id, source.title]);

  // When process completes, build summary selection.
  useEffect(() => {
    if (state.phase === "complete" && state.candidates.length > 0) {
      setSummary(createSummaryState(state.candidates));
    } else if (state.phase !== "complete") {
      setSummary(null);
    }
  }, [state.phase, state.candidates]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = (index: number) => {
    if (loading || state.phase === "complete") return;
    const next = pickQuestion(state, index);
    if (next === state) return;
    setState(next);
    if (next.phase === "choosing") {
      void fetchQuestions(next);
    }
  };

  const handleRegenerate = () => {
    if (!state.canRegenerate || loading) return;
    // Keep depth 0 / empty candidates; re-fetch initial 3
    const base = {
      ...state,
      currentQuestions: [] as string[],
    };
    setState(base);
    void fetchQuestions(base);
  };

  const handleRestart = () => {
    loadGenRef.current += 1;
    const next = restartRabbitHoleExpand(state);
    setState(next);
    setSummary(null);
    setError(null);
    void fetchQuestions(next);
  };

  const handleFinishEarly = () => {
    if (!canFinishRabbitHoleExpandEarly(state)) return;
    // Cancel in-flight question fetch so it cannot overwrite summary state.
    loadGenRef.current += 1;
    setLoading(false);
    setError(null);
    setState(finishRabbitHoleExpandEarly(state));
  };

  const confirmed = summary ? getConfirmedCandidates(summary) : [];
  const showSummary = state.phase === "complete" && summary !== null;
  const canStopHere = canFinishRabbitHoleExpandEarly(state);

  // Portal to body so map minimap / layer chrome cannot paint above this dialog.
  if (!mounted || typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      data-rabbit-hole-expand-modal
      data-rabbit-hole-outline={outlineTarget}
      data-rabbit-hole-seed-id={source.id ?? ""}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rabbit-hole-expand-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Fixed height cap so collected path scrolls instead of growing off-screen */}
      <div
        className="flex h-[min(90vh,720px)] max-h-[min(90vh,720px)] w-full max-w-3xl min-h-0 overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl"
        data-rabbit-hole-expand-panel
      >
        {/* Sidebar: depth + remaining; path list scrolls when deep */}
        <aside
          className="flex h-full min-h-0 w-44 shrink-0 flex-col overflow-hidden border-r border-neutral-800 bg-neutral-950/80 p-3 sm:w-52"
          data-rabbit-hole-expand-sidebar
        >
          <div className="shrink-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Rabbit hole
            </p>
            <p
              className="mt-2 line-clamp-3 text-[11px] leading-snug text-neutral-300"
              data-rabbit-hole-seed-label
              title={seedTitle}
            >
              {seedTitle}
            </p>

            <div className="mt-4 space-y-3">
              <div data-rabbit-hole-depth>
                <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                  Depth
                </p>
                <p className="font-mono text-lg text-white">{state.depth}</p>
              </div>
              <div data-rabbit-hole-remaining>
                <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                  Remaining
                </p>
                <p className="font-mono text-lg text-white">
                  {state.remaining}
                  <span className="text-sm text-neutral-500">
                    {" "}
                    / {state.outlineTarget}
                  </span>
                </p>
              </div>
              <div data-rabbit-hole-collected>
                <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                  Collected
                </p>
                <p className="font-mono text-lg text-white">
                  {state.candidates.length}
                </p>
              </div>
            </div>
          </div>

          <ol
            className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain"
            data-rabbit-hole-path-list
          >
            {state.candidates.map((c, i) => (
              <li
                key={`${i}-${c.slice(0, 24)}`}
                className="rounded-md border border-neutral-800 bg-neutral-900/80 px-1.5 py-1 text-[10px] leading-snug text-neutral-400"
                data-rabbit-hole-path-item
              >
                <span className="mr-1 font-mono text-neutral-600">
                  {i + 1}.
                </span>
                {c}
              </li>
            ))}
          </ol>

          <div className="mt-3 flex shrink-0 flex-col gap-1.5">
            {canStopHere ? (
              <button
                type="button"
                data-rabbit-hole-finish-early
                onClick={handleFinishEarly}
                className="w-full rounded-md border border-white/25 bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/15"
                title="Stop diving and review the topics collected so far"
              >
                Stop &amp; review collection
              </button>
            ) : null}
            <button
              type="button"
              data-rabbit-hole-restart
              onClick={handleRestart}
              disabled={loading && state.candidates.length === 0}
              className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              Restart from top
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
            <div>
              <h2
                id="rabbit-hole-expand-title"
                className="text-sm font-semibold text-white"
              >
                Rabbit Hole Expansion
              </h2>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Pick questions to grow neighbors around the source. No stepping
                back — restart clears the path.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-neutral-500 transition hover:bg-white/5 hover:text-white"
              aria-label="Close"
              data-rabbit-hole-close
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {error ? (
              <p
                className="mb-3 text-xs text-red-400/90"
                data-rabbit-hole-error
              >
                {error}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void fetchQuestions(state)}
                >
                  Retry
                </button>
              </p>
            ) : null}

            {showSummary && summary ? (
              <div data-rabbit-hole-summary className="space-y-3">
                <p className="text-xs text-neutral-400">
                  {state.remaining > 0
                    ? `Stopped early with ${summary.candidates.length} of ${state.outlineTarget} outline slots. Modify selection, then confirm to expand into the selected map slots.`
                    : "Outline met. Modify which candidates become expansion blocks, then confirm to place them into the selected slots."}
                </p>
                <ul className="space-y-2" data-rabbit-hole-summary-list>
                  {summary.candidates.map((c, i) => (
                    <li key={`sum-${i}`}>
                      <label
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2 transition hover:border-neutral-600"
                        data-rabbit-hole-summary-item
                      >
                        <input
                          type="checkbox"
                          checked={summary.selected[i] ?? false}
                          onChange={() =>
                            setSummary((prev) =>
                              prev ? toggleSummaryCandidate(prev, i) : prev,
                            )
                          }
                          className="mt-0.5 accent-white"
                          data-rabbit-hole-summary-toggle
                        />
                        <span className="text-xs leading-snug text-neutral-200">
                          {c}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div data-rabbit-hole-questions className="space-y-3">
                <p className="text-xs text-neutral-400">
                  {state.depth === 0
                    ? "Choose one opening question on this topic (or regenerate a new set of 3)."
                    : "Choose one follow-up question to go deeper."}
                </p>
                {loading && state.currentQuestions.length === 0 ? (
                  <p
                    className="text-xs text-neutral-500"
                    data-rabbit-hole-loading
                  >
                    Generating questions…
                  </p>
                ) : (
                  <ul className="space-y-2" data-rabbit-hole-question-list>
                    {state.currentQuestions.map((q, i) => (
                      <li key={`q-${i}-${q.slice(0, 20)}`}>
                        <button
                          type="button"
                          data-rabbit-hole-question
                          data-rabbit-hole-question-index={i}
                          disabled={loading}
                          onClick={() => handlePick(i)}
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950/60 px-3 py-2.5 text-left text-xs leading-snug text-neutral-100 transition hover:border-white/30 hover:bg-white/5 disabled:opacity-50"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {state.canRegenerate ? (
                  <button
                    type="button"
                    data-rabbit-hole-regenerate
                    disabled={loading}
                    onClick={handleRegenerate}
                    className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
                  >
                    Generate 3 more
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-neutral-800 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5"
              data-rabbit-hole-cancel
            >
              Cancel
            </button>
            {canStopHere ? (
              <button
                type="button"
                data-rabbit-hole-finish-early
                onClick={handleFinishEarly}
                className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-neutral-100 transition hover:bg-white/15"
              >
                Stop &amp; review ({state.candidates.length})
              </button>
            ) : null}
            {showSummary ? (
              <button
                type="button"
                data-rabbit-hole-confirm
                disabled={confirmed.length === 0}
                onClick={() => onConfirm(confirmed)}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                {confirmed.length === 0
                  ? "Select at least one"
                  : confirmed.length === 1
                    ? "Expand 1 block"
                    : `Expand ${confirmed.length} blocks`}
              </button>
            ) : null}
          </footer>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
