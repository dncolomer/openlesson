"use client";

import Link from "next/link";
import type { Workspace } from "@/lib/storage";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";

function heroBadge(label: string) {
  return (
    <span className="border border-white/10 bg-black/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300 backdrop-blur-sm">
      {label}
    </span>
  );
}

interface WorkspaceDashboardCardProps {
  plan: Workspace;
  formatDate: (value: string) => string;
  archivingWorkspaceId: string | null;
  publicLabel: string;
  privateLabel: string;
  /** Whether this workspace is pinned to the top of the Dashboard list. */
  isPinned?: boolean;
  onArchive: (workspaceId: string) => void;
  onRestore: (workspaceId: string) => void;
  onToggleVisibility: (plan: Workspace) => void;
  onTogglePin?: (plan: Workspace) => void;
}

export function WorkspaceDashboardCard({
  plan,
  formatDate,
  archivingWorkspaceId,
  publicLabel,
  privateLabel,
  isPinned = false,
  onArchive,
  onRestore,
  onToggleVisibility,
  onTogglePin,
}: WorkspaceDashboardCardProps) {
  const isPublic = plan.is_public ?? false;
  const subtitle =
    plan.root_topic !== plan.title && plan.title
      ? plan.root_topic
      : plan.source_summary || "A guided path toward your next aha moment.";

  return (
    <article
      className="group overflow-hidden rounded-xl border border-neutral-800/90 bg-neutral-950/80 transition hover:border-neutral-600 hover:bg-neutral-900/70"
      data-workspace-dashboard-card
      data-workspace-pinned={isPinned ? "true" : "false"}
    >
      <Link href={`/workspace/${plan.id}`} className="block">
        <WorkspaceCardHero
          workspaceId={plan.id}
          coverImageUrl={plan.cover_image_url}
          fallback="aesthetic"
          heightClassName="h-52 sm:h-56"
          badges={
            <>
              {heroBadge(plan.source_type === "youtube" ? "Video" : "Workspace")}
              {isPublic ? heroBadge("Public") : null}
              {isPinned ? heroBadge("Pinned") : null}
            </>
          }
        />
      </Link>

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/workspace/${plan.id}`} className="block min-w-0 flex-1">
            <h4 className="line-clamp-2 text-xl font-medium leading-snug text-neutral-100 transition group-hover:text-white">
              {plan.title || plan.root_topic}
            </h4>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-500">{subtitle}</p>
          </Link>
          {onTogglePin ? (
            <button
              type="button"
              onClick={() => onTogglePin(plan)}
              data-workspace-pin
              data-workspace-pin-state={isPinned ? "pinned" : "unpinned"}
              aria-pressed={isPinned}
              aria-label={isPinned ? "Unpin workspace" : "Pin workspace"}
              title={isPinned ? "Unpin from top of list" : "Pin to top of list"}
              className={`shrink-0 rounded-md border px-2.5 py-1 text-xs transition ${
                isPinned
                  ? "border-neutral-600/70 bg-neutral-950/40 text-neutral-300 hover:border-white/60 hover:bg-neutral-950/60"
                  : "border-neutral-700 bg-neutral-900/60 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
              }`}
            >
              {isPinned ? "Unpin" : "Pin"}
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          <span>{formatDate(plan.created_at ?? "")}</span>
          <span aria-hidden>•</span>
          <span
            className={
              plan.status === "archived"
                ? "rounded border border-neutral-600/30 px-1.5 py-0.5 text-neutral-300"
                : "capitalize"
            }
          >
            {plan.status}
          </span>
          {(plan.remix_count ?? 0) > 0 ? (
            <>
              <span aria-hidden>•</span>
              <span>{plan.remix_count} remixes</span>
            </>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800/80 pt-4">
          <Link
            href={`/workspace/${plan.id}`}
            className="text-sm font-medium text-neutral-200 transition hover:text-white"
          >
            Open workspace →
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {plan.status === "archived" ? (
              <button
                type="button"
                onClick={() => onRestore(plan.id)}
                disabled={archivingWorkspaceId === plan.id}
                className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
              >
                {archivingWorkspaceId === plan.id ? "Restoring…" : "Restore"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onArchive(plan.id)}
                disabled={archivingWorkspaceId === plan.id}
                className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-neutral-600/40 hover:text-neutral-300 disabled:opacity-50"
              >
                {archivingWorkspaceId === plan.id ? "Archiving…" : "Archive"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleVisibility(plan)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                isPublic
                  ? "border-green-800/80 bg-green-900/30 text-green-400 hover:bg-green-900/50"
                  : "border-neutral-700 bg-neutral-900/60 text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {isPublic ? publicLabel : privateLabel}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
