"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

interface SessionStep {
  id: string;
  type: string;
  description: string;
  order: number;
  status: string;
}

interface PreviewData {
  goal: string;
  strategy: string;
  description?: string;
  steps: SessionStep[];
}

interface PreviewSessionModalProps {
  blockTitle: string;
  nodeDescription: string;
  planTopic: string;
  planningPrompt?: string;
  onClose: () => void;
  onStartSession?: () => void;
}

function useTypeConfig() {
  const { t } = useI18n();
  return {
    question: { icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: t('sessionPlan.question'), color: "text-neutral-300 bg-neutral-800/10" },
    task: { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", label: t('sessionPlan.task'), color: "text-emerald-400 bg-emerald-500/10" },
    suggestion: { icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", label: t('sessionPlan.suggestion'), color: "text-neutral-300 bg-neutral-800/10" },
    checkpoint: { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", label: t('sessionPlan.checkpoint'), color: "text-neutral-300 bg-neutral-800/10" },
    feedback: { icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z", label: t('sessionPlan.feedback'), color: "text-neutral-300 bg-neutral-800/10" },
  } as Record<string, { icon: string; label: string; color: string }>;
}

function ExpandableSection({ icon, label, labelColor, text }: { icon: React.ReactNode; label: string; labelColor: string; text: string }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 120;

  return (
    <button
      onClick={() => isLong && setExpanded(!expanded)}
      className={`w-full text-left rounded-none bg-neutral-900/50 border border-neutral-800/40 p-3.5 transition-all ${isLong ? "cursor-pointer hover:bg-neutral-800/40" : "cursor-default"}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className={`text-[11px] font-medium uppercase tracking-wider ${labelColor}`}>{label}</span>
      </div>
      <p className={`text-sm text-neutral-300 leading-relaxed ${expanded ? "" : isLong ? "line-clamp-2" : ""}`}>
        {text}
      </p>
      {isLong && !expanded && (
        <span className="text-[10px] text-neutral-600 mt-1 inline-block">{t('previewSession.tapToExpand')}</span>
      )}
    </button>
  );
}

function StepCard({ step, index }: { step: SessionStep; index: number }) {
  const { t } = useI18n();
  const typeConfig = useTypeConfig();
  const config = typeConfig[step.type] || typeConfig.question;

  return (
    <div className="w-full text-left rounded-none border bg-neutral-900/40 border-neutral-800/50 px-3.5 py-2.5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.color}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">{t('previewSession.stepN', { n: index + 1 })}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.color}`}>{config.label}</span>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">{step.description}</p>
        </div>
      </div>
    </div>
  );
}

export function PreviewSessionModal({
  blockTitle,
  nodeDescription,
  planTopic,
  planningPrompt,
  onClose,
  onStartSession,
}: PreviewSessionModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    async function generate() {
      try {
        const res = await fetch("/api/workspace/preview-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockTitle, nodeDescription, planTopic, planningPrompt }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to generate preview");
        }
        const data = await res.json();
        setPreview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    generate();
  }, [blockTitle, nodeDescription, planTopic, planningPrompt]);

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111] border border-neutral-800 rounded-none sm:rounded-none w-full sm:max-w-2xl lg:max-w-3xl max-h-[85vh] sm:max-h-[80vh] flex flex-col sm:mx-4 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-3 sm:pt-5 pb-3 border-b border-neutral-800/50">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="text-base font-semibold text-white truncate">{blockTitle}</h3>
            {nodeDescription && (
              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{nodeDescription}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white rounded-none transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <LoadingStatusMessage tone="subtle" message={t("previewSession.planningSession")} />
              <p className="text-[11px] text-neutral-600">{t('previewSession.mayTakeFewSeconds')}</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-red-400 text-sm mb-1">{error}</p>
              <button onClick={onClose} className="text-xs text-neutral-500 hover:text-white transition-colors">
                {t('previewSession.close')}
              </button>
            </div>
          )}

          {preview && (
            <div className="space-y-5">
              {/* Goal & Strategy — stacked, expandable */}
              <div className="space-y-2">
                <ExpandableSection
                  icon={<svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>}
                   label={t('previewSession.goal')}
                  labelColor="text-emerald-400"
                  text={preview.goal}
                />
                <ExpandableSection
                  icon={<svg className="w-3.5 h-3.5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>}
                   label={t('previewSession.strategy')}
                  labelColor="text-neutral-300"
                  text={preview.strategy}
                />
              </div>

              {/* Steps header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">{t('previewSession.stepsPlanned', { count: preview.steps.length })}</span>
              </div>

              {/* Steps list — expandable cards */}
              <div className="space-y-2">
                {preview.steps.map((step, idx) => (
                  <StepCard key={step.id || idx} step={step} index={idx} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(preview || error) && (
          <div className="flex items-center gap-3 px-5 py-4 border-t border-neutral-800/50">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 rounded-none transition-colors font-medium"
            >
              {t('previewSession.close')}
            </button>
            {preview && onStartSession && (
              <button
                onClick={onStartSession}
                className="flex-1 px-4 py-2.5 bg-white hover:bg-white text-black text-sm font-medium rounded-none transition-colors"
              >
                {t('previewSession.startSession')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
