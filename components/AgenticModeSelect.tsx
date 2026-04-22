"use client";

import { useI18n } from "@/lib/i18n";

export function AgenticModeSelect() {
  const { t } = useI18n();

  return (
    <div className="w-full">
      {/* Framework Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* ElizaOS Card */}
        <a
          href="https://github.com/dncolomer/openlesson-elizaos"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-purple-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-slate-800/50">
            <img 
              src="https://avatars.githubusercontent.com/u/186240462?s=200&v=4" 
              alt="ElizaOS" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
            ElizaOS
          </h3>
          <p className="text-sm text-slate-400">
            {t('agenticMode.elizaDescription')}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-purple-400">
            {t('agenticMode.viewOnGitHub')} →
          </span>
        </a>

        {/* OpenClaw Card */}
        <a
          href="https://github.com/dncolomer/openlesson-openclaw"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-blue-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-slate-800/50">
            <img 
              src="https://avatars.githubusercontent.com/u/252820863?s=200&v=4" 
              alt="OpenClaw" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
            OpenClaw
          </h3>
          <p className="text-sm text-slate-400">
            {t('agenticMode.openclawDescription')}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400">
            {t('agenticMode.viewOnGitHub')} →
          </span>
        </a>

        {/* Hermes Card */}
        <a
          href="https://github.com/dncolomer/openlesson-hermes"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-emerald-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-slate-800/50">
            <img 
              src="https://pbs.twimg.com/profile_images/1816254738234761216/TX7TW-Mp_400x400.jpg" 
              alt="Hermes Agent" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
            Hermes
          </h3>
          <p className="text-sm text-slate-400">
            {t('agenticMode.hermesDescription')}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400">
            {t('agenticMode.viewOnGitHub')} →
          </span>
        </a>
      </div>

      {/* API key + Docs CTAs — full-width grid so each fills half the row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <a
          href="/dashboard"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          {t('agenticMode.getApiKey')}
        </a>
        <a
          href="/docs/agentic-v2"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {t('agenticMode.v2FullDocs')}
        </a>
      </div>
    </div>
  );
}
