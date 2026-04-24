"use client";

import { useState } from "react";
import { type SessionPlan, type ToolAction } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { ConfirmDialog } from "./ui/ConfirmDialog";

/**
 * Telemetry callback: fires on every user interaction in this panel.
 * SessionView wires this to `logTool("session_plan", action, metadata)`
 * so events are persisted to Supabase `session_tool` AND surfaced in the
 * Logs UI.
 */
export type SessionPlanToolEvent = (
  action: ToolAction,
  metadata?: Record<string, unknown>,
) => void;

interface SessionPlanViewerProps {
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
  onOpenResources?: (stepDescription: string) => void;
  onOpenPractice?: (stepDescription: string) => void;
  onAskAssistant?: (stepDescription: string) => void;
  onToolEvent?: SessionPlanToolEvent;
  isSessionActive?: boolean;
}

export function SessionPlanViewer({ plan, loading, error, onAdvanceStep, onRollbackToStep, onSkipToStep, onRegeneratePlan, autoAdvance = true, onToggleAutoAdvance, sessionId, onOpenResources, onOpenPractice, onAskAssistant, onToolEvent, isSessionActive = false }: SessionPlanViewerProps) {
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
  // Separate "pending confirmation" index from the "in flight" index so
  // the ConfirmDialog has one source of truth for open/closed state and
  // the spinner on the button only shows once the user actually confirms.
  const [skipPendingIdx, setSkipPendingIdx] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateReason, setRegenerateReason] = useState("");

  const toggleStep = (stepId: string) => {
    // stepId may be suffixed with "_collapsed" when collapsing an
    // expanded-active step; strip that for telemetry.
    const bareId = stepId.replace(/_collapsed$/, "");
    const willCollapse = expandedSteps.has(stepId);
    onToolEvent?.(willCollapse ? "step_collapse" : "step_expand", {
      stepId: bareId,
      currentStepIndex: plan?.currentStepIndex,
    });
    setExpandedSteps((prev) => {
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

    // Capture the current step's descriptive context at click time so the
    // downstream tool-event log (and the xAI file it becomes) can later be
    // analysed for "student thought this step was done" signals even if
    // the plan drifts afterwards.
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
              // Readiness was just checked by /api/session-plan/update;
              // force the advance so /api/session-plan/advance-step doesn't
              // redundantly re-run the slow xAI eval (which blew the 60s
              // Vercel timeout).
              await onAdvanceStep(true);
            } finally {
              setAdvancing(false);
            }
          } else {
            // Disagreement: student clicked Complete but the LLM eval
            // judged the step not yet done. Log it so we can later learn
            // where student self-assessment diverges from the model.
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
    onToolEvent?.("rollback", {
      targetStepIndex: stepIndex,
      fromStepIndex: plan?.currentStepIndex ?? 0,
    });
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
    // Open confirmation. Actual skip runs in `confirmSkipToStep`.
    setSkipPendingIdx(stepIndex);
  };

  const confirmSkipToStep = async () => {
    const stepIndex = skipPendingIdx;
    if (stepIndex == null || !onSkipToStep || skipping) return;
    const fromIdx = plan?.currentStepIndex ?? 0;
    const skippedCount = stepIndex - fromIdx;
    onToolEvent?.("skip", {
      fromStepIndex: fromIdx,
      toStepIndex: stepIndex,
      skippedCount,
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
      totalSteps: plan?.steps?.length ?? 0,
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



  // Enhanced validation - check for various corruption states
  const isCorrupted = plan && (
    !plan.steps || 
    !Array.isArray(plan.steps) || 
    plan.steps.length === 0 ||
    !plan.goal
  );
  
  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">{t('sessionPlanViewer.creating')}</p>
      </div>
    );
  }

  if (error || isCorrupted) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-sm text-red-400">
          {isCorrupted ? t('sessionPlan.planCorrupted') : t('sessionPlan.creationFailed')}
        </p>
        <p className="text-xs text-neutral-600 mt-1">
          {isCorrupted ? t('sessionPlan.noSteps') : error}
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-neutral-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
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
    <div className="h-full w-full flex flex-col px-6 py-5 overflow-hidden">
      {/* Steps list - timeline layout */}
      <div className="relative flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col gap-3 pl-10 pr-2">
        {/* Vertical timeline connector line (centered in the 40px left gutter at x=15) */}
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-neutral-700 via-neutral-800 to-transparent pointer-events-none" />
        {plan.steps.map((step, idx) => {
          const isActive = step.status === "in_progress";
          const isCompleted = step.status === "completed";
          const isSkipped = step.status === "skipped";
          const isExpanded = expandedSteps.has(step.id) || (isActive && !expandedSteps.has(step.id + "_collapsed"));

          // Common row layout: left accent · index · description · chevron
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
              ? "bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-900 hover:border-neutral-800"
              : "bg-neutral-900/80 border-neutral-800/80 hover:bg-neutral-900 hover:border-neutral-700"
          } ${isSkipped ? "opacity-50" : ""}`;

          // Timeline dot on the left — larger, ring-style
          const dotClass = isActive
            ? "w-3 h-3 bg-neutral-100 shadow-[0_0_12px_rgba(255,255,255,0.35)] ring-4 ring-neutral-100/10"
            : isCompleted
            ? "w-2.5 h-2.5 bg-neutral-400 ring-2 ring-neutral-800"
            : "w-2.5 h-2.5 bg-neutral-700 ring-2 ring-neutral-900";

          // Collapsed view
          if (!isExpanded) {
            const canSkip = !autoAdvance && !isActive && !isCompleted && !isSkipped && !!onSkipToStep && idx > (plan.currentStepIndex ?? 0);
            return (
              <div key={step.id} className="relative group">
                {/* Timeline dot — centered on the line (x=15 in container, row starts at x=40) */}
                <div className={`absolute -left-[25px] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${dotClass}`} />
                {/* Expand/collapse — full row, but leave room on right for skip button */}
                <button
                  onClick={() => toggleStep(step.id)}
                  className={`w-full flex-1 min-h-[3rem] text-left ${cardBase}`}
                >
                  <div className={`flex items-center gap-4 px-5 py-3.5 ${canSkip ? "pr-24" : ""}`}>
                    <span className={`shrink-0 font-mono text-[11px] tabular-nums ${isActive ? "text-neutral-300" : "text-neutral-600"}`}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className={`text-[15px] leading-snug truncate flex-1 ${textClass}`}>
                      {step.description}
                    </span>
                    {isCompleted && (
                      <svg className="shrink-0 w-3.5 h-3.5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <svg className="shrink-0 w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
                {/* Skip to here — sibling of the expand button to avoid nested <button> */}
                {canSkip && (
                  <button
                    onClick={(e) => handleSkipToStep(e, idx)}
                    disabled={skipping}
                    title="Skip to this step"
                    className="absolute right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 px-2 py-1 text-[10px] font-medium rounded-md bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                  >
                    {skipping && skipTargetIdx === idx ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : "Skip to"}
                  </button>
                )}
              </div>
            );
          }

          // Expanded view — content-sized
          return (
            <div key={step.id} className="relative flex-[0_0_auto]">
              {/* Timeline dot — centered on the line */}
              <div className={`absolute -left-[25px] top-6 -translate-x-1/2 rounded-full transition-all ${dotClass}`} />
              <div className={cardBase}>
              <div className="px-5 py-4">
                <button
                  onClick={() => isActive ? toggleStep(step.id + "_collapsed") : toggleStep(step.id)}
                  className="w-full flex items-start gap-4 text-left"
                >
                  <span className={`shrink-0 mt-1 font-mono text-[11px] tabular-nums ${isActive ? "text-neutral-300" : "text-neutral-600"}`}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <p className={`flex-1 min-w-0 leading-relaxed ${isActive ? "text-[17px]" : "text-[15px]"} ${textClass}`}>
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

                {/* Step action buttons — only for active step */}
                {isActive && (
                  <div className={`@container grid gap-2 mt-4 ${!autoAdvance && onAdvanceStep ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    {!autoAdvance && onAdvanceStep && (
                      <button
                        onClick={handleAdvanceStep}
                        disabled={advancing || analyzingAdvance}
                        title={t('sessionPlan.complete')}
                        className="py-2.5 text-[11px] font-medium rounded-lg bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                      >
                        {advancing || analyzingAdvance ? (
                          <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <>
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden @[18rem]:inline truncate">{t('sessionPlan.complete')}</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onToolEvent?.("open_resources", {
                          stepId: step.id,
                          stepIndex: idx,
                          stepPreview: step.description.slice(0, 60),
                        });
                        onOpenResources?.(step.description);
                      }}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.resources')}
                      className="py-1.5 text-[11px] font-medium rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="hidden @[18rem]:inline truncate">{t('sessionPlan.resources')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onToolEvent?.("open_practice", {
                          stepId: step.id,
                          stepIndex: idx,
                          stepPreview: step.description.slice(0, 60),
                        });
                        onOpenPractice?.(step.description);
                      }}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.practice')}
                      className="py-1.5 text-[11px] font-medium rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="hidden @[18rem]:inline truncate">{t('sessionPlan.practice')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onToolEvent?.("ask_assistant", {
                          stepId: step.id,
                          stepIndex: idx,
                          stepPreview: step.description.slice(0, 60),
                        });
                        onAskAssistant?.(step.description);
                      }}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.ask')}
                      className="py-1.5 text-[11px] font-medium rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <span className="hidden @[18rem]:inline truncate">{t('sessionPlan.ask')}</span>
                    </button>
                  </div>
                )}

                {/* Skip to here button — pending steps ahead of current, manual mode */}
                {!autoAdvance && !isActive && !isCompleted && !isSkipped && onSkipToStep && idx > (plan.currentStepIndex ?? 0) && (
                  <div className="@container mt-2.5">
                    <button
                      onClick={(e) => handleSkipToStep(e, idx)}
                      disabled={skipping}
                      title="Skip to this step"
                      className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                      {skipping && skipTargetIdx === idx ? (
                        <>
                          <svg className="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="hidden @[14rem]:inline truncate">Skipping...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                          <span className="hidden @[14rem]:inline truncate">Skip to here</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Rollback button - only on completed steps, hidden in auto mode */}
                {!autoAdvance && isCompleted && onRollbackToStep && (
                  <div className="@container mt-2.5">
                    <button
                      onClick={(e) => handleRollbackToStep(e, idx)}
                      disabled={rollingBack}
                      title={t('sessionPlan.goBackToStep')}
                      className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                      {rollingBack && rollbackTargetIdx === idx ? (
                        <>
                          <svg className="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="hidden @[14rem]:inline truncate">{t('sessionPlan.rollingBack')}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                          </svg>
                          <span className="hidden @[14rem]:inline truncate">{t('sessionPlan.goBackToStep')}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan control actions — manual mode only */}
      {!autoAdvance && isSessionActive && onRegeneratePlan && (
        <div className="flex items-center gap-2 pt-3 mt-1 border-t border-neutral-800/60 px-1">
          <button
            onClick={() => setShowRegenerateDialog(true)}
            disabled={regenerating}
            title="Regenerate remaining steps"
            className="flex-1 py-2 text-[11px] font-medium rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {regenerating ? (
              <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>Regenerate Plan</span>
          </button>
        </div>
      )}

      {/* Regenerate Plan Dialog — optional textarea body so the user can
          explain why; wired through as the `reason` argument on the
          parent-provided onRegeneratePlan callback. */}
      <ConfirmDialog
        open={showRegenerateDialog}
        onCancel={() => { setShowRegenerateDialog(false); setRegenerateReason(""); }}
        onConfirm={handleRegeneratePlan}
        variant="info"
        title="Regenerate Remaining Steps"
        description="This will replace all remaining steps with a fresh plan. Completed steps will be preserved."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        confirmBusy={regenerating}
      >
        <textarea
          value={regenerateReason}
          onChange={(e) => setRegenerateReason(e.target.value)}
          placeholder="Optional: why are you regenerating? (e.g. 'I want to focus more on X')"
          className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-600"
          rows={2}
        />
      </ConfirmDialog>

      {/* Advance Confirmation Dialog — shown when the readiness eval
          says "not yet" but the user wants to override anyway. */}
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

      {/* Skip-to-step confirmation — irreversible, so we force an
          explicit acknowledgement. Opens when a canSkip button is
          clicked; confirming kicks off the async skip flow which also
          archives active probes and regenerates a fresh one for the
          new current step (see handleSkipToStep in SessionView). */}
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
