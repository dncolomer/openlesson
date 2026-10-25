"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS, ConsolePage } from "@/components/ui/console-frame";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import type { WorkspaceSectionNavItem } from "@/components/WorkspaceSectionNav";
import {
  ayclUpgradeOfferDescription,
  ayclUpgradeOfferLabel,
} from "@/lib/aycl-shared";
import type { AyclCapabilities } from "@/lib/aycl-shared";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";
import type { Workspace } from "@/components/workspace-view/types";
import { dashboardHrefForTab } from "@/lib/dashboard-nav";
import { workspaceProductShell } from "@/lib/workspace-kind";
import { useI18n } from "@/lib/i18n";

export function WorkspaceDashboardLink({
  className = "shrink-0 py-2.5 pl-12 pr-3 text-sm text-neutral-400 transition-colors hover:text-white sm:pl-14",
}: {
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <Link
      href={dashboardHrefForTab("home")}
      data-workspace-back-dashboard
      className={className}
    >
      {t("nav.dashboard")}
    </Link>
  );
}

export function WorkspaceLoading({ message }: { message: string }) {
  return (
    <div
      data-console-frame=""
      data-workspace-shell=""
      className="relative flex min-h-screen items-center justify-center overflow-hidden border border-white/40 bg-black"
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <p data-console-frame-label="" className={`absolute left-3 top-3 z-[4] ${CONSOLE_LABEL_CLASS}`}>
        Map
      </p>
      <div className="relative z-[2]">
        <LoadingStatusMessage message={message} />
      </div>
    </div>
  );
}

export function WorkspaceLoadError({
  error,
  fallback,
  homeLabel,
}: {
  error: string;
  fallback: string;
  homeLabel: string;
}) {
  return (
    <ConsolePage label="Map">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="max-w-md border border-white/30 bg-black px-4 py-3 text-sm text-white/80">{error || fallback}</div>
        <Link href="/" className="text-neutral-300 hover:text-white hover:underline">
          {homeLabel}
        </Link>
      </div>
    </ConsolePage>
  );
}

export function WorkspaceViewChrome({
  isAycl,
  accessBanner,
  ayclCapabilities,
  ayclUpgradePriceLabel,
  ayclUpgradeBusy,
  onUpgrade,
  sections,
  activeSection,
  onSelectSection,
  plan,
  playView = false,
}: {
  isAycl: boolean;
  accessBanner?: ReactNode;
  ayclCapabilities: AyclCapabilities | null;
  ayclUpgradePriceLabel: string;
  ayclUpgradeBusy: boolean;
  onUpgrade: () => void;
  sections: WorkspaceSectionNavItem[];
  activeSection: WorkspaceSectionKey;
  onSelectSection: (section: WorkspaceSectionKey) => void;
  plan: Workspace;
  playView?: boolean;
}) {
  const productShell = workspaceProductShell(plan.workspace_kind);
  const title = plan.title || plan.root_topic;
  return (
    <>
      <p
        data-console-frame-label=""
        className={`pointer-events-none absolute left-3 top-3 z-[4] ${CONSOLE_LABEL_CLASS}`}
      >
        Map
      </p>
      {accessBanner ? (
        <div className="shrink-0 border-b border-neutral-800/60" data-workspace-access-banner>
          {accessBanner}
        </div>
      ) : null}

      {isAycl && ayclCapabilities?.canUpgrade ? (
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-600/20 bg-neutral-800/10 px-4 py-2"
          data-aycl-upgrade-bar
        >
          <p className="text-[11px] text-neutral-200/90">
            {ayclUpgradeOfferDescription()}{" "}
            <span className="font-medium text-white" data-aycl-upgrade-price>
              {ayclUpgradePriceLabel}
            </span>{" "}
            one-time.
          </p>
          <button
            type="button"
            data-aycl-upgrade-cta
            disabled={ayclUpgradeBusy}
            onClick={() => void onUpgrade()}
            className="rounded-none bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {ayclUpgradeBusy ? "Redirecting…" : ayclUpgradeOfferLabel()}
          </button>
        </div>
      ) : null}

      {playView || productShell !== "learning" ? (
        <div
          data-workspace-play-view={playView ? "" : undefined}
          className="flex shrink-0 items-center justify-between border-b border-neutral-800/60 bg-[#0b0b0b]"
        >
          <WorkspaceDashboardLink />
          {title ? (
            <p className="min-w-0 truncate px-3 py-2.5 text-right text-sm font-medium text-neutral-200">
              {title}
            </p>
          ) : null}
        </div>
      ) : (
      <div
        data-workspace-product-shell="learning"
        data-learning-workspace-shell=""
      >
        <WorkspaceSectionNav
          sections={sections}
          activeSection={activeSection}
          onChange={onSelectSection}
          variant="bar"
          workspaceTitle={plan.title || plan.root_topic}
          leading={<WorkspaceDashboardLink />}
        />
      </div>
      )}
    </>
  );
}
