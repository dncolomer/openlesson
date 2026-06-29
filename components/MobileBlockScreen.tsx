"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function MobileBlockScreen() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] p-6 text-center">
      {/* Logo */}
      <div className="mb-8">
        <div className="text-4xl font-bold text-white mb-2">
          open<span className="text-cyan-400">Lesson</span>
        </div>
        <div className="w-16 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 mx-auto rounded-full" />
      </div>

      {/* Icon */}
      <div className="mb-6">
        <svg
          className="w-24 h-24 text-neutral-600 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Message */}
      <h1 className="text-2xl font-semibold text-white mb-3">
        {t('mobileBlock.desktopOnly')}
      </h1>
      <p className="text-neutral-400 max-w-md mb-8">
        {t('mobileBlock.desktopDescription')}
      </p>

      {/* Browser recommendation */}
      <div className="flex items-center gap-2 text-xs text-neutral-600 mb-8">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        <span>{t('mobileBlock.chromeRecommended')}</span>
      </div>

      {/* Back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-neutral-700 hover:border-neutral-600 rounded-xl text-white transition-all"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        <span>{t('mobileBlock.returnToDashboard')}</span>
      </Link>
    </div>
  );
}
