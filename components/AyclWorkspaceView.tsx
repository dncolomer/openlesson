"use client";

/**
 * All-You-Can-Learn access: workspace UI clone via WorkspaceView.
 * Full tier = owner-equivalent creation tools; learner tier = practice-only
 * fixed scope (upgrade in-shell). AYCL is only a cloning + access mechanism.
 */

import Link from "next/link";
import { useState } from "react";
import { WorkspaceView, type Block, type Workspace } from "@/components/WorkspaceView";
import {
  ayclOfferLabel,
  normalizeAyclAccessTier,
  type AyclAccessTier,
} from "@/lib/aycl-shared";

interface AyclWorkspaceViewProps {
  accessToken: string;
  ownerUserId: string;
  initialPlan: Workspace;
  initialNodes: Block[];
  /** Purchase tier from access resolution (default full for legacy). */
  accessTier?: AyclAccessTier | string | null;
}

export function AyclWorkspaceView({
  accessToken,
  ownerUserId,
  initialPlan,
  initialNodes,
  accessTier: accessTierProp,
}: AyclWorkspaceViewProps) {
  const [copied, setCopied] = useState(false);
  const accessTier = normalizeAyclAccessTier(accessTierProp);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const accessBanner = (
    <header
      className="flex items-center justify-between gap-3 px-4 py-3"
      data-aycl-access-header
      data-aycl-access-tier={accessTier}
    >
      <div className="min-w-0">
        <Link
          href="/all-you-can-learn"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          All-You-Can-Learn
        </Link>
        <h1 className="truncate text-base font-semibold text-white">
          {initialPlan.title || initialPlan.root_topic}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded border border-neutral-600/30 bg-neutral-800/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300">
            Lifetime access
          </span>
          <span className="rounded border border-neutral-600/25 bg-neutral-800/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300">
            Private copy
          </span>
          <span
            className={
              accessTier === "full"
                ? "rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300"
                : "rounded border border-neutral-500/30 bg-neutral-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300"
            }
            data-aycl-tier-badge
          >
            {ayclOfferLabel(accessTier)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleCopyLink()}
        className="shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10"
      >
        {copied ? "Copied!" : "Copy access link"}
      </button>
    </header>
  );

  return (
    <WorkspaceView
      initialPlan={initialPlan}
      initialNodes={initialNodes}
      ayclToken={accessToken}
      ayclOwnerUserId={ownerUserId}
      ayclAccessTier={accessTier}
      workspaceIdOverride={initialPlan.id}
      hideNavbar
      accessBanner={accessBanner}
    />
  );
}
