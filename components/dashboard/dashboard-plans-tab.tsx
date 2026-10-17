"use client";

import type { Dispatch, SetStateAction } from "react";
import { default as Link } from "next/link";
import { WorkspaceDashboardCard } from "@/components/WorkspaceDashboardCard";
import {
  isDashboardWorkspaceListFilter,
  type DashboardWorkspaceListFilter,
} from "@/lib/dashboard-workspace-filters";
import {
  dashboardCreateHref,
  dashboardProductLabel,
  type DashboardProductTab,
} from "@/lib/dashboard-nav";
import type { Workspace } from "@/lib/storage";

export type DashboardPlansTabProps = {
  archivingWorkspaceId: string | null;
  filteredWorkspaces: Workspace[];
  formatDate: (dateStr: string) => string;
  handleArchivePlan: (workspaceId: string) => Promise<void>;
  handleRestorePlan: (workspaceId: string) => Promise<void>;
  handleTogglePin: (workspace: Workspace) => void;
  paginatedPlans: Workspace[];
  pinnedWorkspaceIds: Set<string>;
  setPlanPage: Dispatch<SetStateAction<number>>;
  setPlanSearch: Dispatch<SetStateAction<string>>;
  setShowArchivedPlans: Dispatch<SetStateAction<boolean>>;
  productTab: DashboardProductTab;
  setWorkspaceVisibilityFilter: Dispatch<SetStateAction<DashboardWorkspaceListFilter>>;
  setWorkspaces: Dispatch<SetStateAction<Workspace[]>>;
  showArchivedWorkspaces: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  totalPlanPages: number;
  workspaceCoverPool: string[] | null;
  workspacePage: number;
  workspacePageSize: 10;
  workspaceSearch: string;
  workspaceVisibilityFilter: DashboardWorkspaceListFilter;
  productEmpty: boolean;
  surface?: "workspaces" | "shop";
};

export function DashboardPlansTab({
    archivingWorkspaceId,
    filteredWorkspaces,
    formatDate,
    handleArchivePlan,
    handleRestorePlan,
    handleTogglePin,
    paginatedPlans,
    pinnedWorkspaceIds,
    setPlanPage,
    productTab,
    setPlanSearch,
    setShowArchivedPlans,
    setWorkspaceVisibilityFilter,
    setWorkspaces,
    showArchivedWorkspaces,
    t,
    totalPlanPages,
    workspaceCoverPool,
    workspacePage,
    workspacePageSize,
    workspaceSearch,
    workspaceVisibilityFilter,
    productEmpty,
    surface = "workspaces",
}: DashboardPlansTabProps) {
  const isShop = surface === "shop";
  const productLabel = dashboardProductLabel(productTab);
  const createHref = dashboardCreateHref(productTab);
  const kicker = isShop ? "Your Shop" : productLabel;
  const heading = isShop
    ? "Workspaces you listed."
    : productTab === "learning"
      ? "Maps you practice on."
      : productTab === "verification"
        ? "Flows that map knowledge."
        : "Flows that map uncertainty.";
  const body = isShop
    ? "Learning maps you listed as All You Can Learn."
    : productTab === "learning"
      ? "Browse Learning workspaces, pin the ones you return to, and start a new map."
      : productTab === "verification"
        ? "Browse Verification workspaces and the verification flows they host."
        : "Browse Calibration workspaces and the calibration flows they host.";
  const emptyTitle = isShop
    ? "No listings yet"
    : `No ${productLabel.toLowerCase()} workspaces yet`;
  const createLabel = `Create ${productLabel} workspace →`;
  return (
          <div
            className="space-y-6"
            data-dashboard-product={productTab}
            data-dashboard-shop={isShop ? "true" : undefined}
          >
            {productEmpty ? (
              <section
                data-dashboard-empty-product
                className="console-copy px-6 py-14 sm:px-10 sm:py-16"
              >
                <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                  <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                    {kicker}
                  </p>
                  <h2 className="text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
                    {emptyTitle}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-neutral-400 sm:text-base">
                    {body}
                  </p>
                  <Link
                    href={createHref}
                    data-dashboard-empty-create
                    className="mt-8 inline-flex h-12 min-w-[220px] items-center justify-center rounded-none bg-white px-8 text-sm font-medium text-black transition hover:bg-neutral-200"
                  >
                    {createLabel}
                  </Link>
                  {isShop ? (
                    <Link
                      href="/all-you-can-learn"
                      className="mt-3 text-sm text-neutral-400 transition hover:text-white"
                    >
                      Browse All You Can Learn
                    </Link>
                  ) : null}
                </div>
              </section>
            ) : (
            <>
            <div className="console-copy px-6 py-7 sm:px-8 sm:py-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                    {kicker}
                  </p>
                  <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
                    {heading}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
                    {body}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {isShop ? (
                    <Link
                      href="/all-you-can-learn"
                      className="inline-flex h-12 items-center justify-center rounded-none border border-white/40 px-6 text-sm text-white transition hover:border-white/80"
                    >
                      Browse catalog
                    </Link>
                  ) : null}
                <Link
                  href={createHref}
                  data-dashboard-product-create
                  className="inline-flex h-12 items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  {createLabel}
                </Link>
                </div>
              </div>
            </div>

            <div className="console-copy p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{t('dashboard.allWorkspaces')}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {isShop ? null : (
                  <label
                    className="flex items-center gap-2 text-xs text-neutral-400"
                    data-workspace-visibility-filter
                  >
                    <span className="text-neutral-500">Visibility</span>
                    <select
                      value={workspaceVisibilityFilter}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (isDashboardWorkspaceListFilter(next)) {
                          setWorkspaceVisibilityFilter(next);
                          setPlanPage(1);
                        }
                      }}
                      className="rounded-none border border-white/40 bg-black px-2 py-1 text-xs text-neutral-300 focus:border-white/70 focus:outline-none"
                      aria-label="Filter workspaces by public, private, or AYCL"
                    >
                      <option value="all">All</option>
                      <option value="public">{t("dashboard.public")}</option>
                      <option value="private">{t("dashboard.private")}</option>
                      <option value="aycl">AYCL</option>
                    </select>
                  </label>
                  )}
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={showArchivedWorkspaces}
                      onChange={(e) => setShowArchivedPlans(e.target.checked)}
                      className="rounded-none border border-white/40 bg-black"
                    />
                    Show archived
                  </label>
                </div>
              </div>
              <input
                type="text"
                placeholder={t('dashboard.searchWorkspaces')}
                value={workspaceSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="mt-3 w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-white/70 focus:outline-none"
              />
            </div>

            {filteredWorkspaces.length === 0 ? (
              <div className="console-copy py-8 text-center text-neutral-500">
                <p className="text-sm">{t('dashboard.noMatchingWorkspaces')}</p>
                <Link href={createHref} className="text-neutral-300 hover:underline mt-2 inline-block text-sm">
                  {t('dashboard.createNewPlan')}
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2" data-workspace-cards-grid>
                {paginatedPlans.map((plan) => (
                  <WorkspaceDashboardCard
                    key={plan.id}
                    plan={plan}
                    imagePool={workspaceCoverPool}
                    formatDate={formatDate}
                    archivingWorkspaceId={archivingWorkspaceId}
                    publicLabel={t("dashboard.public")}
                    privateLabel={t("dashboard.private")}
                    isPinned={pinnedWorkspaceIds.has(plan.id)}
                    onTogglePin={handleTogglePin}
                    onArchive={handleArchivePlan}
                    onRestore={handleRestorePlan}
                    onToggleVisibility={async (workspace) => {
                      try {
                        const isPublic = workspace.is_public ?? false;
                        const res = await fetch(`/api/workspaces/${workspace.id}/visibility`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ is_public: !isPublic }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setWorkspaces((plans) =>
                            plans.map((entry) =>
                              entry.id === workspace.id ? { ...entry, is_public: !isPublic } : entry,
                            ),
                          );
                        }
                      } catch (err) {
                        console.error("Error toggling visibility:", err);
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {totalPlanPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                <p className="text-xs text-neutral-500">
                  {t('dashboard.showingResults', { start: String((workspacePage - 1) * workspacePageSize + 1), end: String(Math.min(workspacePage * workspacePageSize, filteredWorkspaces.length)), total: String(filteredWorkspaces.length) })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                    disabled={workspacePage === 1}
                    className="console-button px-3 py-1 text-xs text-neutral-400 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('dashboard.previous')}
                  </button>
                  <button
                    onClick={() => setPlanPage((p) => Math.min(totalPlanPages, p + 1))}
                    disabled={workspacePage === totalPlanPages}
                    className="console-button px-3 py-1 text-xs text-neutral-400 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('dashboard.next')}
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
  );
}
