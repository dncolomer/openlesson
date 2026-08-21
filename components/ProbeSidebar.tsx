"use client";

import { useEffect, useCallback } from "react";
import { ProbeCard } from "./ProbeCard";
import type { Probe } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

interface ProbeSidebarProps {
  probes: Probe[];
  problem: string;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
  onMarkAllRead: () => void;
  newProbeId?: string | null;
}

export function ProbeSidebar({
  probes,
  problem,
  isOpen,
  onToggle,
  unreadCount,
  onMarkAllRead,
  newProbeId,
}: ProbeSidebarProps) {
  const { t } = useI18n();
  // Keyboard shortcut: ? to toggle
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Collapsed Badge (always visible in header area) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-4 right-4 z-40 w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center hover:bg-neutral-700 transition-colors"
          title="Toggle probes (press ?)"
        >
          <span className="text-neutral-300 font-bold text-sm">?</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full text-black text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="w-80 h-full bg-neutral-900 border-l border-neutral-800 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{t('probes.title')}</h3>
              {probes.length > 0 && (
                <span className="text-xs text-neutral-500">
                  ({probes.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {t('probes.markRead')}
                </button>
              )}
              <button
                onClick={onToggle}
                className="w-8 h-8 rounded-none bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Probes List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {probes.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <p className="text-sm">{t('probes.noProbesYet')}</p>
                <p className="text-xs mt-1">
                  {t('probes.probesWillAppear')}
                </p>
              </div>
            ) : (
              probes
                .slice()
                .reverse()
                .map((probe) => (
                  <ProbeCard
                    key={probe.id}
                    probe={probe}
                    problem={problem}
                    isNew={probe.id === newProbeId}
                  />
                ))
            )}
          </div>

          {/* Footer hint */}
          <div className="p-3 border-t border-neutral-800 text-center">
            <span className="text-xs text-neutral-600">
              {t('probes.pressToToggle')}
            </span>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onToggle}
        />
      )}
    </>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
