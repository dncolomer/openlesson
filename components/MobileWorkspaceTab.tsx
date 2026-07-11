"use client";

import { useState } from "react";
import { type SessionPlan, type ToolAction } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { ConfirmDialog } from "./ui/ConfirmDialog";

interface MobilePlanTabProps {
  plan: SessionPlan | null;
  loading?: boolean;
  error?: string | null;
  onAdvanceStep?: (forceAdvance?: boolean) => Promise<void>;
  onRollbackToStep?: (stepIndex: number) => Promise<void>;
  onSkipToStep?: (stepIndex: number) => Promise<void>;
  onRegeneratePlan?: (reason?: string) => Promise<void>;
  autoAdvance?: boolean;
  onToggleAutoAdvance?: (value: boolean) => void;
  sessionId?: string;
  isSessionActive?: boolean;
  /** Mirror of the desktop SessionPlanViewer onToolEvent hook. Parents
   *  should wire this to logTool("session_plan", action, metadata) so
   *  mobile Complete-clicks, disagreements, and eval failures land in
   *  the same session_tool / xAI Files pipeline as desktop. */
  onToolEvent?: (action: ToolAction, metadata?: Record<string, unknown>) => void;
}

export function MobilePlanTab({
  plan,
  loading,
  error,
  onAdvanceStep,
  onRollbackToStep,
  onSkipToStep,
  onRegeneratePlan,
  autoAdvance = true,
  onToggleAutoAdvance,
  sessionId,
  isSessionActive = false,
  onToolEvent,
}: MobilePlanTabProps) {
  const { t } = useI18n();
  const [advancing, setAdvancing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackTargetIdx, setRollbackTargetIdx] = useState<number | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [advanceDialogReasoning, setAdvanceDialogReasoning] = useState("");
  const [analyzingAdvance, setAnalyzingAdvance] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipTargetIdx, setSkipTargetIdx] = useState<number | null>(null);
  // See desktop twin (SessionPlanViewer) for the separation-of-concerns
  // rationale between pending-confirm and in-flight state.
  const [skipPendingIdx, setSkipPendingIdx] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateReason, setRegenerateReason] = useState("");

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleAdvanceStep = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAdvanceStep || advancing) return;

    // Capture step context at click time (see SessionPlanViewer for the
    // rationale — same logging contract).
    const fromStepIndex = plan?.currentStepIndex ?? 0;
    const currentStep = plan?.steps?.[fromStepIndex];
    const clickMeta = {
      source: "client" as const,
      fromStepIndex,
      autoAdvance,
      via: "complete_button" as const,
      stepId: currentStep?.id,
      stepDescription: currentStep?.description,
      stepType: currentStep?.type,
    };
    onToolEvent?.("advance", clickMeta);

    if (autoAdvance) {
      setAdvancing(true);
      try {
        await onAdvanceStep();
      } finally {
        setAdvancing(false);
      }
    } else {
      setAnalyzingAdvance(true);
      try {
        const res = await fetch("/api/session-plan/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId,
            previousProbes: [],
            focusedProbes: [],
            openProbeCount: 0,
            lastProbeTimestamp: 0,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.canAutoAdvance) {
            setAdvancing(true);
            try {
              // Readiness already checked by /api/session-plan/update;
              // force the advance so /api/session-plan/advance-step doesn't
              // redundantly re-run the slow xAI eval (same 60s-timeout fix
              // we applied on desktop).
              await onAdvanceStep(true);
            } finally {
              setAdvancing(false);
            }
          } else {
            // Disagreement: student clicked Complete but LLM said "not yet".
            onToolEvent?.("advance_blocked_by_llm", {
              ...clickMeta,
              advanceReasoning: (data.advanceReasoning || "").slice(0, 500),
              gapScore: data.gapScore,
            });
            setAdvanceDialogReasoning(data.advanceReasoning || t('sessionPlan.aiSuggestsStayingDefault'));
            setShowAdvanceDialog(true);
          }
        } else {
          onToolEvent?.("advance_eval_failed", {
            ...clickMeta,
            httpStatus: res.status,
          });
          setAdvanceDialogReasoning(t('sessionPlan.unableToAnalyze'));
          setShowAdvanceDialog(true);
        }
      } catch (err) {
        onToolEvent?.("advance_eval_failed", {
          ...clickMeta,
          error: err instanceof Error ? err.message : String(err),
        });
        setAdvanceDialogReasoning(t('sessionPlan.unableToAnalyze'));
        setShowAdvanceDialog(true);
      } finally {
        setAnalyzingAdvance(false);
      }
    }
  };

  const handleForceAdvance = async () => {
    const fromStepIndex = plan?.currentStepIndex ?? 0;
    const currentStep = plan?.steps?.[fromStepIndex];
    onToolEvent?.("force_advance", {
      source: "client",
      fromStepIndex,
      via: "force_advance_dialog",
      stepId: currentStep?.id,
      stepDescription: currentStep?.description,
      stepType: currentStep?.type,
      reasoning: advanceDialogReasoning.slice(0, 120),
    });
    setShowAdvanceDialog(false);
    if (!onAdvanceStep) return;
    setAdvancing(true);
    try {
      // User explicitly overrode the readiness dialog — force advance so
      // we don't re-run the LLM eval (which already ran and said "not yet").
      await onAdvanceStep(true);
    } finally {
      setAdvancing(false);
    }
  };

  const handleRollbackToStep = async (e: React.MouseEvent, stepIndex: number) => {
    e.stopPropagation();
    if (!onRollbackToStep || rollingBack) return;
    setRollingBack(true);
    setRollbackTargetIdx(stepIndex);
    try {
      await onRollbackToStep(stepIndex);
    } finally {
      setRollingBack(false);
      setRollbackTargetIdx(null);
    }
  };

  const handleSkipToStep = (e: React.MouseEvent, stepIndex: number) => {
    e.stopPropagation();
    if (!onSkipToStep || skipping) return;
    setSkipPendingIdx(stepIndex);
  };

  const confirmSkipToStep = async () => {
    const stepIndex = skipPendingIdx;
    if (stepIndex == null || !onSkipToStep || skipping) return;
    onToolEvent?.("skip", {
      fromStepIndex: plan?.currentStepIndex ?? 0,
      toStepIndex: stepIndex,
    });
    setSkipPendingIdx(null);
    setSkipping(true);
    setSkipTargetIdx(stepIndex);
    try {
      await onSkipToStep(stepIndex);
    } finally {
      setSkipping(false);
      setSkipTargetIdx(null);
    }
  };

  const handleRegeneratePlan = async () => {
    if (!onRegeneratePlan || regenerating) return;
    onToolEvent?.("regenerate", {
      currentStepIndex: plan?.currentStepIndex ?? 0,
      reason: regenerateReason || null,
    });
    setShowRegenerateDialog(false);
    setRegenerating(true);
    try {
      await onRegeneratePlan(regenerateReason || undefined);
    } finally {
      setRegenerating(false);
      setRegenerateReason("");
    }
  };

  // Check for corruption
  const isCorrupted = plan && (
    !plan.steps ||
    !Array.isArray(plan.steps) ||
    plan.steps.length === 0 ||
    !plan.goal
  );

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border border-neutral-800 border-t-neutral-400 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">{t('sessionPlanViewer.creating')}</p>
      </div>
    );
  }

  if (error || isCorrupted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm text-red-400 mb-1">
          {isCorrupted ? t('sessionPlan.planCorrupted') : t('sessionPlan.creationFailed')}
        </p>
        <p className="text-xs text-neutral-600 mb-4">
          {isCorrupted ? t('sessionPlan.noSteps') : error}
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm text-neutral-500">{t('sessionPlanViewer.noPlanYet')}</p>
        <p className="text-xs text-neutral-600 mt-1">
          {t('sessionPlan.planWillBeCreated')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Auto/Manual toggle — hidden in UI (manual mode is the default).
          `onToggleAutoAdvance` is still passed in from the parent and the
          state is still honored; remove the `hidden` wrapper to bring the
          toggle back. */}
      {onToggleAutoAdvance && (
        <div className="hidden shrink-0 px-4 pt-4 pb-2" aria-hidden="true">
          <button
            onClick={() => onToggleAutoAdvance(!autoAdvance)}
            tabIndex={-1}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 active:bg-neutral-800/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {autoAdvance ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                )}
              </svg>
              <span className="text-sm font-medium text-neutral-200">
                {autoAdvance ? t('sessionPlan.autoAdvance') : t('sessionPlan.manualMode')}
              </span>
            </div>
            <div className="relative w-9 h-5 rounded-full bg-neutral-700">
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-neutral-200 shadow transition-transform ${autoAdvance ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>
      )}

      {/* Steps list — timeline layout */}
      <div className="relative flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col gap-3 pl-10 pr-4 pt-4 pb-4">
        {/* Vertical timeline connector line */}
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-neutral-700 via-neutral-800 to-transparent pointer-events-none" />

        {plan.steps.map((step, idx) => {
          const isActive = step.status === "in_progress";
          const isCompleted = step.status === "completed";
          const isSkipped = step.status === "skipped";
          const isExpanded = expandedSteps.has(step.id) || (isActive && !expandedSteps.has(step.id + "_collapsed"));

          const textClass = isSkipped
            ? "line-through text-neutral-600"
            : isActive
            ? "text-neutral-100"
            : isCompleted
            ? "text-neutral-500"
            : "text-neutral-400";

          const cardBase = `relative rounded-2xl border transition-all overflow-hidden ${
            isActive
              ? "bg-gradient-to-br from-neutral-800/80 to-neutral-900 border-neutral-700 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_0_0_1px_rgba(255,255,255,0.03)]"
              : isCompleted
              ? "bg-neutral-900/60 border-neutral-800/80 active:bg-neutral-900"
              : "bg-neutral-900/80 border-neutral-800/80 active:bg-neutral-900"
          } ${isSkipped ? "opacity-50" : ""}`;

          // Timeline dot on the left
          const dotClass = isActive
            ? "w-3 h-3 bg-neutral-100 shadow-[0_0_12px_rgba(255,255,255,0.35)] ring-4 ring-neutral-100/10"
            : isCompleted
            ? "w-2.5 h-2.5 bg-neutral-400 ring-2 ring-neutral-800"
            : "w-2.5 h-2.5 bg-neutral-700 ring-2 ring-neutral-900";

          // Collapsed view
          if (!isExpanded) {
            return (
              <div key={step.id} className="relative">
                {/* Timeline dot centered on the line */}
                <div className={`absolute -left-[25px] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${dotClass}`} />
                <button
                  onClick={() => toggleStep(step.id)}
                  className={`w-full min-h-[3rem] text-left ${cardBase}`}
                >
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <span className={`shrink-0 font-mono text-[10px] tabular-nums ${isActive ? "text-neutral-300" : "text-neutral-600"}`}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className={`text-[13px] leading-snug truncate flex-1 ${textClass}`}>
                      {step.description}
                    </span>
                    {isCompleted && (
                      <svg className="shrink-0 w-3.5 h-3.5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <svg className="shrink-0 w-3 h-3 text-neutral-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            );
          }

          // Expanded view — content-sized
          return (
            <div key={step.id} className="relative">
              {/* Timeline dot centered on the line */}
              <div className={`absolute -left-[25px] top-6 -translate-x-1/2 rounded-full transition-all ${dotClass}`} />
              <div className={cardBase}>
                <div className="px-5 py-4">
                  <button
                    onClick={() => isActive ? toggleStep(step.id + "_collapsed") : toggleStep(step.id)}
                    className="w-full flex items-start gap-4 text-left"
                  >
                    <span className={`shrink-0 mt-1 font-mono text-[10px] tabular-nums ${isActive ? "text-neutral-300" : "text-neutral-600"}`}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <p className={`flex-1 min-w-0 leading-relaxed ${isActive ? "text-[15px]" : "text-[13px]"} ${textClass}`}>
                      {step.description}
                    </p>
                    {isCompleted && (
                      <svg className="shrink-0 mt-1 w-3.5 h-3.5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <svg className="shrink-0 mt-1.5 w-3 h-3 text-neutral-600 rotate-90" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Mark Complete button - only on active step in manual mode */}
                  {isActive && !autoAdvance && onAdvanceStep && (
                    <button
                      onClick={handleAdvanceStep}
                      disabled={advancing || analyzingAdvance}
                      className="mt-4 w-full py-2.5 text-sm font-medium rounded-lg bg-neutral-100 text-neutral-900 active:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {advancing || analyzingAdvance ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {t('sessionPlan.markComplete')}
                        </>
                      )}
                    </button>
                  )}

                  {/* Skip to here button — pending steps ahead of current, manual mode */}
                  {!autoAdvance && !isActive && !isCompleted && !isSkipped && onSkipToStep && idx > (plan.currentStepIndex ?? 0) && (
                    <button
                      onClick={(e) => handleSkipToStep(e, idx)}
                      disabled={skipping}
                      className="mt-4 px-3 py-2 text-xs font-medium rounded-lg bg-white/10 border border-white/20 text-white active:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                      {skipping && skipTargetIdx === idx ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Skipping...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                          Skip to here
                        </>
                      )}
                    </button>
                  )}

                  {/* Rollback button - only on completed steps, hidden in auto mode */}
                  {!autoAdvance && isCompleted && onRollbackToStep && (
                    <button
                      onClick={(e) => handleRollbackToStep(e, idx)}
                      disabled={rollingBack}
                      className="mt-4 px-3 py-2 text-xs font-medium rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 active:bg-neutral-800 active:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                      {rollingBack && rollbackTargetIdx === idx ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {t('sessionPlan.rollingBack')}
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                          </svg>
                          {t('sessionPlan.goBackToStep')}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Regenerate Plan button — always visible when plan exists */}
      {onRegeneratePlan && (
        <div className="flex items-center gap-2 px-4 pb-4 pt-2">
          <button
            onClick={() => setShowRegenerateDialog(true)}
            disabled={regenerating}
            className="flex-1 py-3 text-sm font-medium rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 active:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {regenerating ? (
              <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Regenerate Plan
          </button>
        </div>
      )}

      {/* Regenerate Plan Dialog — see desktop twin for rationale. */}
      <ConfirmDialog
        open={showRegenerateDialog}
        onCancel={() => { setShowRegenerateDialog(false); setRegenerateReason(""); }}
        onConfirm={handleRegeneratePlan}
        variant="info"
        title="Regenerate Plan"
        description="This will replace all remaining steps with a fresh plan. Completed steps will be preserved."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        confirmBusy={regenerating}
      >
        <textarea
          value={regenerateReason}
          onChange={(e) => setRegenerateReason(e.target.value)}
          placeholder="Optional: why? (e.g. 'focus more on X')"
          className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-600"
          rows={2}
        />
      </ConfirmDialog>

      {/* Advance Confirmation Dialog — see desktop twin for rationale. */}
      <ConfirmDialog
        open={showAdvanceDialog}
        onCancel={() => {
          const fromStepIndex = plan?.currentStepIndex ?? 0;
          const currentStep = plan?.steps?.[fromStepIndex];
          onToolEvent?.("cancel_advance", {
            source: "client",
            fromStepIndex,
            via: "force_advance_dialog",
            stepId: currentStep?.id,
            stepDescription: currentStep?.description,
            stepType: currentStep?.type,
            reasoning: advanceDialogReasoning.slice(0, 120),
          });
          setShowAdvanceDialog(false);
        }}
        onConfirm={handleForceAdvance}
        variant="warning"
        title={t('sessionPlan.aiSuggestsStaying')}
        description={advanceDialogReasoning}
        confirmLabel={t('sessionPlan.continueAnyway')}
        cancelLabel={t('sessionPlan.stayOnStep')}
      >
        <p className="text-xs text-neutral-500">
          {t('sessionPlan.canStillAdvance')}
        </p>
      </ConfirmDialog>

      {/* Skip-to-step confirmation — see desktop twin for rationale. */}
      {(() => {
        const pendingIdx = skipPendingIdx;
        const fromIdx = plan?.currentStepIndex ?? 0;
        const skippedCount = pendingIdx == null ? 0 : pendingIdx - fromIdx;
        const stepWord = skippedCount === 1 ? "step" : "steps";
        return (
          <ConfirmDialog
            open={pendingIdx != null}
            onCancel={() => setSkipPendingIdx(null)}
            onConfirm={confirmSkipToStep}
            variant="warning"
            title={`Skip ahead ${skippedCount} ${stepWord}?`}
            description={
              "This is irreversible — skipped steps will be marked as complete and you will not be able to return to them in this session.\n\nYour current probes will also be archived and a fresh one generated for the new step."
            }
            confirmLabel="Skip ahead"
            cancelLabel="Stay on step"
            confirmTone="warning"
          />
        );
      })()}
    </div>
  );
}
