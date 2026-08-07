"use client";

import { Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/components/WorkspaceView";

interface WorkspaceIdentityPanelProps {
  plan: Workspace;
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
  copied: boolean;
  onShare: () => void;
  onPlanUpdate: (plan: Workspace) => void;
  onShowRemixModal: () => void;
  publicLoginHref: string;
  variant?: "embedded" | "compact" | "floating";
}

/**
 * Display-only workspace identity chrome (title/status badges + share).
 * Title and description owner edit live under Settings.
 * Public workspaces contribute to the Map of Knowledge (not fork-gated).
 */
export function WorkspaceIdentityPanel({
  plan,
  copied,
  onShare,
  variant = "embedded",
}: WorkspaceIdentityPanelProps) {
  const { t } = useI18n();
  const isCompact = variant === "compact";
  const isFloating = variant === "floating";

  const showShare = Boolean(plan.is_public);

  const iconButtonClass =
    "flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white";

  const badges = (
    <>
      {plan.is_public && (
        <span className="rounded border border-green-500/25 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400/90">
          {t("planView.public")}
        </span>
      )}
      {plan.is_all_you_can_learn && (
        <span className="rounded border border-neutral-600/25 bg-neutral-800/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300/90">
          Paid
        </span>
      )}
      {plan.original_workspace_id && (
        <span className="text-[10px] font-medium text-neutral-400">{t("planView.remixed")}</span>
      )}
    </>
  );

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      {showShare && (
        <button
          type="button"
          onClick={onShare}
          className={iconButtonClass}
          title={copied ? t("planView.copied") : t("planView.share")}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div
      className={`shrink-0 px-3 sm:px-4 ${
        isFloating
          ? "py-2.5"
          : isCompact
            ? "border-b border-neutral-800/60 bg-black/25 py-2 backdrop-blur-sm"
            : "border-b border-neutral-800/60 bg-black/25 py-2.5 backdrop-blur-sm"
      }`}
      data-identity-display-only
    >
      <div className={`flex items-start justify-between gap-3 ${isCompact ? "items-center" : ""}`}>
        <div className="min-w-0 flex-1 space-y-1">
          <div className={`flex min-w-0 items-center gap-2 ${isCompact ? "flex-wrap" : ""}`}>
            <h1 className={`truncate font-semibold text-white ${isCompact ? "text-sm" : "text-base"}`}>
              {plan.title || plan.root_topic}
            </h1>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">{badges}</div>
          </div>

          {!isCompact && plan.description ? (
            <p className="max-w-3xl text-left text-xs leading-relaxed text-neutral-500 line-clamp-2">
              {plan.description}
            </p>
          ) : null}
        </div>

        {actions}
      </div>
    </div>
  );
}
