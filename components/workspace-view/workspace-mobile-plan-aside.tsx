"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { MobileColumn, Workspace } from "@/components/workspace-view/types";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";

export function WorkspaceMobilePlanAside({
  mobileColumn,
  plan,
  isOwner,
  copied,
  selectSection,
  onOpenSessions,
  onShare,
}: {
  mobileColumn: MobileColumn;
  plan: Workspace;
  isOwner: boolean;
  copied: boolean;
  selectSection: (section: WorkspaceSectionKey) => void;
  onOpenSessions: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  return (
    <aside className={`${mobileColumn === "plan" ? "flex" : "hidden"} group flex-1 min-h-0 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] overflow-y-auto md:hidden`}>
      <div className="space-y-5 p-4 md:flex-1 md:min-h-0 md:overflow-y-auto md:p-5">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold leading-snug text-white">{plan.title || plan.root_topic}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {plan.is_public && (
              <span className="rounded-none border border-green-500/25 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400/90">
                {t("planView.public")}
              </span>
            )}
            {plan.original_workspace_id && <span className="font-medium text-neutral-400">{t("planView.remixed")}</span>}
          </div>
        </div>

        {plan.description ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAbout")}</p>
            <p className="line-clamp-3 text-sm leading-relaxed text-neutral-500">
              {plan.description}
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionProducts")}</p>
            <div className="flex flex-col gap-1.5">
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => selectSection("settings")}
                  className="w-full rounded-none border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
                >
                  <span className="block text-xs font-medium text-white">{t("planView.productProofOfWorkApi")}</span>
                  <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productProofOfWorkApiHint")}</span>
                </button>
              ) : (
                <Link
                  href="/docs/proof-of-work-api"
                  className="w-full rounded-none border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
                >
                  <span className="block text-xs font-medium text-white">{t("planView.productProofOfWorkApi")}</span>
                  <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productProofOfWorkApiHint")}</span>
                </Link>
              )}

              <button
                type="button"
                onClick={onOpenSessions}
                className="w-full rounded-none border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
              >
                <span className="block text-xs font-medium text-white">{t("planView.productIle")}</span>
                <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productIleHint")}</span>
              </button>
              <div
                className="w-full rounded-none border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-left opacity-80"
                aria-disabled="true"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-400">{t("planView.productAle")}</span>
                  <span className="rounded-none border border-neutral-500/20 bg-neutral-950/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[1px] text-neutral-300/90">
                    {t("planView.productUpcoming")}
                  </span>
                </div>
                <span className="mt-0.5 block text-[10px] text-neutral-600">{t("planView.productAleHint")}</span>
              </div>
            </div>
          </div>

          {plan.is_public && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionShare")}</p>
              <button
                onClick={onShare}
                className="w-full rounded-none border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70 transition-all hover:bg-white/15 hover:text-white"
              >
                {copied ? t("planView.copied") : t("planView.share")}
              </button>
              <Link
                href="/map-of-knowledge"
                className="block w-full rounded-none border border-neutral-600/20 bg-neutral-950/20 px-3 py-2 text-center text-xs text-neutral-300/90 transition-all hover:bg-neutral-950/40"
              >
                Map of Knowledge
              </Link>
            </div>
          )}

          {isOwner && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAccess")}</p>
              <button
                type="button"
                onClick={() => selectSection("settings")}
                className="w-full rounded-none border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-neutral-300 transition-all hover:bg-white/10 hover:text-white"
              >
                {t("planView.sectionSetting")} — {t("planView.sectionAccess")}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
