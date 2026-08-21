"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import type { WorkspaceSectionNavItem } from "@/components/WorkspaceSectionNav";
import {
  ayclUpgradeOfferDescription,
  ayclUpgradeOfferLabel,
} from "@/lib/aycl-shared";
import type { AyclCapabilities } from "@/lib/aycl-shared";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";
import type { WorkspaceInteractionMode } from "@/lib/workspace-mode";
import type { Workspace } from "@/components/workspace-view/types";

export function WorkspaceLoading({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <LoadingStatusMessage message={message} />
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
      <div className="text-red-400">{error || fallback}</div>
      <Link href="/" className="text-neutral-300 hover:text-white hover:underline">
        {homeLabel}
      </Link>
    </div>
  );
}

export function WorkspaceViewChrome({
  isAycl,
  hideNavbar,
  accessBanner,
  ayclCapabilities,
  ayclUpgradePriceLabel,
  ayclUpgradeBusy,
  onUpgrade,
  sections,
  activeSection,
  onSelectSection,
  plan,
  interactionMode,
}: {
  isAycl: boolean;
  hideNavbar: boolean;
  accessBanner?: ReactNode;
  ayclCapabilities: AyclCapabilities | null;
  ayclUpgradePriceLabel: string;
  ayclUpgradeBusy: boolean;
  onUpgrade: () => void;
  sections: WorkspaceSectionNavItem[];
  activeSection: WorkspaceSectionKey;
  onSelectSection: (section: WorkspaceSectionKey) => void;
  plan: Workspace;
  interactionMode: WorkspaceInteractionMode;
}) {
  return (
    <>
      {!hideNavbar ? <Navbar /> : null}
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

      <WorkspaceSectionNav
        sections={sections}
        activeSection={activeSection}
        onChange={onSelectSection}
        variant="bar"
        workspaceTitle={plan.title || plan.root_topic}
        interactionMode={interactionMode}
        showModeToggle={false}
      />
    </>
  );
}
