"use client";

import Link from "next/link";
import {
  GitBranch,
  Link2,
} from "lucide-react";
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

function planShareSlug(plan: Workspace) {
  const title = plan.title || plan.root_topic || "plan";
  return encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan");
}

/**
 * Display-only workspace identity chrome (title/status badges + share/fork).
 * Title and description owner edit live under Settings.
 */
export function WorkspaceIdentityPanel({
  plan,
  workspaceId,
  isOwner,
  currentUserId,
  copied,
  onShare,
  onShowRemixModal,
  publicLoginHref,
  variant = "embedded",
}: WorkspaceIdentityPanelProps) {
  const { t } = useI18n();
  const isCompact = variant === "compact";
  const isFloating = variant === "floating";

  const showShare = plan.is_public || plan.is_group;
  const showFork =
    (isOwner && plan.is_public) ||
    (currentUserId && !isOwner && !plan.is_group) ||
    (!currentUserId && !plan.is_group);
  const showGroupParticipant = currentUserId && !isOwner && plan.is_group;
  const showSignInToJoin = !currentUserId && plan.is_group;

  const iconButtonClass =
    "flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white";

  const badges = (
    <>
      {plan.is_group && (
        <span className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300">
          {t("planView.group")}
        </span>
      )}
      {plan.is_public && (
        <span className="rounded border border-green-500/25 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400/90">
          {t("planView.public")}
        </span>
      )}
      {plan.is_public && (plan.remix_count ?? 0) > 0 && (
        <span className="text-[10px] text-neutral-500">
          {plan.remix_count}{" "}
          {(plan.remix_count || 0) === 1 ? t("planView.fork") : t("planView.forks", { count: plan.remix_count || 0 })}
        </span>
      )}
      {plan.is_all_you_can_learn && (
        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300/90">
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

      {showFork &&
        (currentUserId ? (
          <button
            type="button"
            onClick={onShowRemixModal}
            className={iconButtonClass}
            title={t("planView.forkRemix")}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link href="/pricing" className={iconButtonClass} title={t("planView.forkRemix")}>
            <GitBranch className="h-3.5 w-3.5" />
          </Link>
        ))}

      {showGroupParticipant && (
        <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-neutral-300">
          {t("planView.groupParticipant")}
        </span>
      )}

      {showSignInToJoin && (
        <Link
          href={`/login?redirect=/p/${workspaceId}/${planShareSlug(plan)}`}
          className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-neutral-200 transition-all hover:bg-white/15"
        >
          {t("planView.signInToJoin")}
        </Link>
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
