"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS, ConsolePage } from "@/components/ui/console-frame";
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
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";

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
      <p
        data-console-frame-label=""
        className={
          hideNavbar
            ? `pointer-events-none absolute left-3 top-3 z-[4] ${CONSOLE_LABEL_CLASS}`
            : `pointer-events-none shrink-0 px-4 pt-2 sm:px-6 ${CONSOLE_LABEL_CLASS}`
        }
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

      <p
        className="shrink-0 border-b border-neutral-800 bg-neutral-950 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400"
        data-workspace-product-shell={
          isKnowledgeRegionWorkspace(plan.workspace_kind) ? "verification" : "learning"
        }
        {...(isKnowledgeRegionWorkspace(plan.workspace_kind)
          ? { "data-verification-workspace-shell": true }
          : { "data-learning-workspace-shell": true })}
      >
        {isKnowledgeRegionWorkspace(plan.workspace_kind)
          ? "Verification workspace"
          : "Learning workspace"}
      </p>

      <WorkspaceSectionNav
        sections={sections}
        activeSection={activeSection}
        onChange={onSelectSection}
        variant="bar"
        workspaceTitle={plan.title || plan.root_topic}
        interactionMode={interactionMode}
      />
    </>
  );
}
