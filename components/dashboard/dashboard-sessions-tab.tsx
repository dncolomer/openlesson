"use client";

import type { Dispatch, SetStateAction } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { default as Link } from "next/link";
import { getIlePostSessionPath, type Session } from "@/lib/storage";

export type DashboardSessionsTabProps = {
  filteredSessions: Session[];
  formatDate: (dateStr: string) => string;
  formatDuration: (ms: number) => string;
  handleDeleteSession: (id: string) => Promise<void>;
  handleStartOverSession: (id: string) => Promise<void>;
  paginatedSessions: Session[];
  router: AppRouterInstance;
  sessionPage: number;
  sessionPageSize: 10;
  sessionSearch: string;
  sessionStatusFilter: Set<string>;
  setSessionPage: Dispatch<SetStateAction<number>>;
  setSessionSearch: Dispatch<SetStateAction<string>>;
  setSessionStatusFilter: Dispatch<SetStateAction<Set<string>>>;
  t: (key: string, params?: Record<string, string | number>) => string;
  totalSessionPages: number;
};

export function DashboardSessionsTab({
    filteredSessions,
    formatDate,
    formatDuration,
    handleDeleteSession,
    handleStartOverSession,
    paginatedSessions,
    router,
    sessionPage,
    sessionPageSize,
    sessionSearch,
    sessionStatusFilter,
    setSessionPage,
    setSessionSearch,
    setSessionStatusFilter,
    t,
    totalSessionPages,
}: DashboardSessionsTabProps) {
  return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('dashboard.allSessions')}</h2>
              <Link href="/" className="text-sm text-neutral-300 hover:text-neutral-300 transition-colors">
                {t('dashboard.startNewSession')}
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder={t('dashboard.searchSessions')}
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-none px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                />
              </div>
              <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-none px-3 py-2">
                {[
                  { value: "active", label: t('dashboard.active') },
                  { value: "paused", label: t('dashboard.paused') },
                  { value: "completed", label: t('dashboard.completed') },
                ].map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={sessionStatusFilter.has(opt.value)}
                      onChange={() => {
                        setSessionStatusFilter((prev) => {
                          const next = new Set(prev);
                          if (next.has(opt.value)) {
                            next.delete(opt.value);
                          } else {
                            next.add(opt.value);
                          }
                          return next;
                        });
                      }}
                      className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-600 text-neutral-200 focus:ring-1 focus:ring-neutral-600 focus:ring-offset-0 accent-neutral-200"
                    />
                    <span className="text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 border border-neutral-800 rounded-none">
                <p className="text-sm">{t('dashboard.noMatchingSessions')}</p>
                <Link href="/" className="text-neutral-300 hover:underline mt-2 inline-block text-sm">
                  {t('dashboard.startYourFirstSession')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedSessions.map((session) => {
                  const isCompleted = session.status === "completed";
                  return (
                  <Link
                    key={session.id}
                    href={isCompleted ? getIlePostSessionPath(session) : `/session?id=${session.id}`}
                    className="block rounded-none border border-neutral-800 bg-neutral-900/50 overflow-hidden hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">
                          {session.problem}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {formatDate(session.startedAt)} · {formatDuration(session.durationMs)} ·{" "}
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                              session.status === "completed"
                                ? "bg-green-900/30 text-green-400"
                                : "bg-neutral-950/30 text-neutral-300"
                            }`}
                          >
                            {session.status === "completed" ? t('dashboard.completed') : t('dashboard.active')}
                          </span>
                          {session.workspaceTitle && (
                            <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] bg-neutral-950/30 text-neutral-300">
                              {session.workspaceTitle}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center ml-4 gap-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/session/analytics?id=${session.id}`);
                          }}
                          className="p-1.5 text-neutral-600 hover:text-neutral-300 transition-colors"
                          title={t('dashboard.sessionAnalytics')}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </button>
                        {isCompleted && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStartOverSession(session.id);
                            }}
                            className="p-1.5 text-neutral-600 hover:text-neutral-300 transition-colors"
                            title={t('dashboard.startOver')}
                            aria-label={t('dashboard.startOver')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}

            {totalSessionPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                <p className="text-xs text-neutral-500">
                  {t('dashboard.showingResults', { start: String((sessionPage - 1) * sessionPageSize + 1), end: String(Math.min(sessionPage * sessionPageSize, filteredSessions.length)), total: String(filteredSessions.length) })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                    disabled={sessionPage === 1}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.previous')}
                  </button>
                  <button
                    onClick={() => setSessionPage((p) => Math.min(totalSessionPages, p + 1))}
                    disabled={sessionPage === totalSessionPages}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    {t('dashboard.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
  );
}
