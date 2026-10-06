"use client";

import { DEFAULT_MODEL } from "@/lib/xai-models";
import { DEFAULT_PROMPTS, PROMPT_META, type PromptKey } from "@/lib/prompts";

export type DashboardConfigTabProps = {
  providerInfo: { defaultModel: string; hasXAIKey: boolean; } | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DashboardConfigTab({
    providerInfo,
    t,
}: DashboardConfigTabProps) {
  return (
          <div className="space-y-8">
            {/* AI Provider Status */}
            <div className="rounded-none border border-neutral-800 bg-neutral-900/50 p-5">
              <h2 className="text-lg font-semibold mb-3">{t('dashboard.aiProvider')}</h2>
              {providerInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-neutral-800/10 text-neutral-300 border border-neutral-600/20">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.982 10.622 20.54 3h-1.554l-5.693 6.618L8.745 3H3.5l6.876 10.007L3.5 21h1.554l6.012-6.989L15.868 21h5.245l-7.131-10.378Zm-2.128 2.474-.697-.997-5.543-7.93H8l4.474 6.4.697.996 5.815 8.318h-2.387l-4.745-6.787Z"/></svg>
                      xAI Direct
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t('dashboard.defaultModel')} <code className="text-neutral-400">{providerInfo.defaultModel}</code>
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className={providerInfo.hasXAIKey ? "text-emerald-500" : "text-red-500"}>
                      {providerInfo.hasXAIKey ? t('dashboard.xAiConfigured') : t('dashboard.xAiNotSet')}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">{t('dashboard.loadingProvider')}</p>
              )}
            </div>

            {/* Model Selection - LOCKED */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold">{t('dashboard.modelSelection')}</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-neutral-800/10 text-neutral-300 border border-neutral-600/20 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t('dashboard.editableComingSoon')}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: t('dashboard.tutorModel'), desc: t('dashboard.tutorModelDesc') },
                  { label: t('dashboard.askingModel'), desc: t('dashboard.askingModelDesc') },
                  { label: t('dashboard.plannerModel'), desc: t('dashboard.plannerModelDesc') },
                  { label: t('dashboard.coderModel'), desc: t('dashboard.coderModelDesc') },
                ].map((slot) => (
                  <div key={slot.label} className="p-4 rounded-none border border-neutral-800 bg-neutral-900/50">
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      {slot.label}
                    </label>
                    <p className="text-xs text-neutral-500 mb-3">{slot.desc}</p>
                    <div className="w-full bg-neutral-950 border border-neutral-700 rounded-none px-3 py-2 text-sm text-neutral-300">
                      Grok 4.5 <span className="text-neutral-500">({DEFAULT_MODEL})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prompt Customization - LOCKED */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold">{t('dashboard.promptModifications')}</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-neutral-800/10 text-neutral-300 border border-neutral-600/20 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t('dashboard.editableComingSoon')}
                </span>
              </div>

              <div className="space-y-4">
                {(Object.keys(DEFAULT_PROMPTS) as PromptKey[]).map((key) => {
                  const meta = PROMPT_META[key];
                  return (
                    <div
                      key={key}
                      className="rounded-none border border-neutral-800 bg-neutral-900/50 p-4 opacity-60"
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm text-neutral-200 font-medium">{meta.label}</h4>
                          </div>
                          <p className="text-[11px] text-neutral-600 mt-0.5">{meta.description}</p>
                        </div>
                      </div>
                      <textarea
                        value={DEFAULT_PROMPTS[key]}
                        readOnly={true}
                        rows={6}
                        spellCheck={false}
                        className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-none p-3 text-xs text-neutral-500 font-mono leading-relaxed resize-none cursor-not-allowed"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
  );
}
