"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applySessionPress,
  calibrateQuestions,
  emptySessionMarkState,
  freezeMistakeList,
  learningPointer,
  mergeFrozenMistakes,
  selectionSlice,
  verificationGap,
  setCalibrateSure,
  type SessionMarkButtonId,
  type SessionMarkMode,
  type SessionMarkState,
  SESSION_MARK_BUTTONS,
} from "@/lib/session-marks";
import {
  recommendSessionBranchAction,
  sessionBranchById,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import { SessionPolicyFocusView } from "@/components/session-view/session-policy-focus";
import {
  usePublishSessionPolicy,
  useSessionBranchSlot,
  useSessionCanvasEffectReady,
  useSessionMarkCanvasEffects,
  useSessionMarkDraft,
  useSessionPolicyInferences,
  useSessionPolicySuggestion,
} from "@/components/session-view/session-policy-context";
import type { SessionPolicyInference } from "@/lib/session-policy-infer";
import { sessionActionsMayCommit } from "@/lib/session-canvas-effect-gate";
import type { SessionMarkCanvasEffect } from "@/lib/session-mark-canvas";
import { sessionActionPricesVisible } from "@/lib/session-field-gate";
import { AccelerandoMark } from "@/components/AccelerandoGlyphs";

const MARK_BUTTON_CLASS =
  "pointer-events-auto min-w-0 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-center font-mono text-[11px] leading-tight text-white hover:border-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

const ACTION_BUTTON_CLASS =
  "pointer-events-auto flex w-full min-w-0 items-center rounded-none border border-neutral-600 bg-neutral-900 px-3 py-3 text-left font-mono text-sm leading-tight text-white hover:border-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

export function SessionMarkControls({
  mode,
  questions,
  listKey = null,
  branchModel = null,
  selectionActive: _selectionActive,
  selectedTexts,
  speech,
  onState,
  onCanvasEffect,
}: {
  mode: SessionMarkMode;
  questions: readonly { id?: string | null; text?: string | null }[];
  /** When set, growing the question list keeps presses. A new key replaces the list. */
  listKey?: string | null;
  /** Prepared field. Prices sit on the buttons. The opening text stays on the canvas. */
  branchModel?: SessionBranchModel | null;
  selectionActive: boolean;
  selectedTexts: readonly string[];
  speech: string;
  onState?: (state: SessionMarkState) => void;
  /** Keep locks and frames the selection. Discard removes it. Every press can advance the field. */
  onCanvasEffect?: (effect: SessionMarkCanvasEffect) => void;
}) {
  const publishPolicy = usePublishSessionPolicy();
  const canvasEffects = useSessionMarkCanvasEffects();
  const canvasReady = useSessionCanvasEffectReady();
  const slot = useSessionBranchSlot();
  const actionsReady = sessionActionsMayCommit({
    bridge: canvasEffects != null,
    ready: canvasReady,
    direct: Boolean(onCanvasEffect),
  });
  const model = branchModel ?? (slot?.status === "ready" ? slot.model : null);
  const seedKey = useMemo(
    () => JSON.stringify(questions.map((question) => [question.id || "", question.text || ""])),
    [questions],
  );
  const [state, setState] = useState<SessionMarkState>(() =>
    emptySessionMarkState(freezeMistakeList(questions)),
  );
  const [aimedId, setAimedId] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const listKeyRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const hasModelRef = useRef(false);
  hasModelRef.current = model != null;

  useEffect(() => {
    const reset = !listKey || listKey !== listKeyRef.current;
    listKeyRef.current = listKey ?? null;
    const next = mergeFrozenMistakes(stateRef.current, questions, reset);
    if (next !== stateRef.current) {
      setState(next);
      onState?.(next);
      publishPolicy(next);
    }
    if (!hasModelRef.current) setAimedId(next.mistakes[0]?.id ?? null);
    setRefused(null);
    // The list grows when a branch opens. A new list key replaces it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, listKey, mode]);

  useEffect(() => {
    if (model?.focusId) setAimedId(model.focusId);
  }, [model?.focusId]);

  const focus = model ? sessionBranchById(model, model.focusId) : null;
  const showPrices = sessionActionPricesVisible(mode);
  const priced = showPrices && model ? recommendSessionBranchAction(model, model.focusId) : null;
  const pointer = showPrices && !model ? learningPointer(state) : null;
  const recommendedId = priced?.id ?? pointer?.button ?? null;
  const sureById = new Map(state.calibrate.map((row) => [row.mistakeId, row.sure]));

  function commit(button: SessionMarkButtonId) {
    if (!actionsReady) return;
    const aim = model?.focusId ?? aimedId;
    const result = applySessionPress(state, {
      button,
      aimedMistakeId: button === "try" ? aim : null,
      slice: selectionSlice({ selectedTexts, speech }),
    });
    if (!result.ok) {
      setRefused("Insight can be pressed once.");
      return;
    }
    setState(result.state);
    setRefused(result.press.earlyInsight ? "That insight is early. The drawing stays as it is." : null);
    onState?.(result.state);
    publishPolicy(result.state);
    const effect: SessionMarkCanvasEffect = { kind: button, branchId: aim };
    if (onCanvasEffect) onCanvasEffect(effect);
    else canvasEffects?.apply(effect);
  }

  return (
    <div
      className="pointer-events-auto flex w-full flex-col gap-1.5"
      data-session-marks={mode}
      data-session-actions-ready={actionsReady ? "true" : "false"}
    >
      {mode !== "learn" && slot?.status === "preparing" ? (
        <p data-session-branch-preparing className="px-0.5 font-mono text-[11px] leading-snug text-neutral-300">
          Preparing the field for this session.
        </p>
      ) : null}
      {mode !== "learn" && slot?.status === "failed" ? (
        <p data-session-branch-failed className="px-0.5 font-mono text-[11px] leading-snug text-neutral-300">
          {slot.error || "The field could not be prepared."}
        </p>
      ) : null}
      {model ? null : (
      <ul className="flex flex-col gap-1" data-session-mistake-list>
        {state.mistakes.map((mistake) => {
          const aimed = aimedId === mistake.id;
          return (
            <li key={mistake.id} className="flex items-start gap-1">
              <button
                type="button"
                data-session-mistake={mistake.id}
                data-session-mistake-status={mistake.status}
                aria-pressed={aimed}
                onClick={() => setAimedId(mistake.id)}
                className={`min-w-0 flex-1 rounded-none border px-2 py-1 text-left text-[11px] leading-snug ${
                  aimed
                    ? "border-white bg-neutral-800 text-white"
                    : "border-neutral-700 bg-neutral-950 text-neutral-300"
                }`}
              >
                <span className="block text-neutral-500">
                  {mistake.status === "open" ? "Open" : "Closed"}
                </span>
                {mistake.text}
              </button>
            </li>
          );
        })}
      </ul>
      )}
      {mode === "calibrate" ? (
        <div className="flex flex-col gap-1" data-session-calibrate-questions>
          {calibrateQuestions(state).map((mistake) => (
            <div key={mistake.id} className="flex items-center gap-1" data-calibrate-sure={mistake.id}>
              <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-300">{mistake.text}</span>
              <button
                type="button"
                data-calibrate-sure-yes={mistake.id}
                aria-pressed={sureById.get(mistake.id) === true}
                className={MARK_BUTTON_CLASS}
                onClick={() => {
                  const next = setCalibrateSure(state, mistake.id, true);
                  setState(next);
                  onState?.(next);
                  publishPolicy(next);
                }}
              >
                Sure
              </button>
              <button
                type="button"
                data-calibrate-sure-no={mistake.id}
                aria-pressed={sureById.get(mistake.id) === false}
                className={MARK_BUTTON_CLASS}
                onClick={() => {
                  const next = setCalibrateSure(state, mistake.id, false);
                  setState(next);
                  onState?.(next);
                  publishPolicy(next);
                }}
              >
                Not sure
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-2" data-session-mark-buttons>
        {SESSION_MARK_BUTTONS.map((button) => {
          const recommended = recommendedId === button.id;
          const disabled = !actionsReady || (button.id === "insight" && state.insightPressed);
          const price = showPrices
            ? focus?.actions.find((action) => action.id === button.id)?.price
            : undefined;
          return (
            <button
              key={button.id}
              type="button"
              data-session-mark={button.id}
              data-session-mark-disabled={disabled ? "true" : "false"}
              data-session-mark-pointed={recommended ? "true" : undefined}
              data-session-mark-recommended={recommended ? "true" : undefined}
              disabled={disabled}
              className={`${ACTION_BUTTON_CLASS} ${recommended ? "border-white" : ""}`}
              onClick={() => commit(button.id)}
            >
              <AccelerandoMark text={button.label} className="mr-2 h-4 w-4" />
              {button.label}
              {price != null ? (
                <span data-session-branch-price={price}>{` · ${price}`}</span>
              ) : null}
              {recommended ? <span className="ml-2 text-neutral-400"> (recommended)</span> : null}
            </button>
          );
        })}
      </div>
      {mode === "verification" && state.insightPressed ? (
        <p className="text-[11px] text-neutral-300" data-session-verification-gap>
          Open at the insight: {verificationGap(state) ?? 0}
        </p>
      ) : null}
      {refused ? (
        <p className="text-[11px] text-neutral-400" data-session-mark-note>
          {refused}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sidebar focus for Learn, Calibrate, and Verification.
 * The discrete actions stay internal. This list is what the session inferred.
 */
export function SessionActionsPanel({
  mode,
  entries,
  suggestion,
}: {
  mode?: SessionMarkMode | null;
  entries?: readonly SessionPolicyInference[];
  suggestion?: string | null;
}) {
  const draft = useSessionMarkDraft();
  const slot = useSessionBranchSlot();
  const inferred = useSessionPolicyInferences();
  const liveSuggestion = useSessionPolicySuggestion();
  const resolvedMode = mode !== undefined ? mode : (draft?.mode ?? null);
  const resolvedEntries = entries !== undefined ? entries : inferred;
  const resolvedSuggestion = suggestion !== undefined ? suggestion : liveSuggestion;
  return (
    <SessionPolicyFocusView
      mode={resolvedMode}
      entries={resolvedEntries}
      suggestion={resolvedSuggestion}
      preparing={slot?.status === "preparing"}
      failedMessage={
        slot?.status === "failed" ? slot.error || "The field could not be prepared." : null
      }
    />
  );
}
