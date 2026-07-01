"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type PublicWorkspaceForkCalloutProps = {
  isLoggedIn: boolean;
  loginHref: string;
  onFork: () => void;
  variant?: "dark" | "light";
};

export function PublicWorkspaceForkCallout({
  isLoggedIn,
  loginHref,
  onFork,
  variant = "dark",
}: PublicWorkspaceForkCalloutProps) {
  const { t } = useI18n();
  const isLight = variant === "light";

  return (
    <div
      className={
        isLight
          ? "rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3"
          : "rounded-md border border-amber-500/25 bg-amber-950/20 px-3 py-2.5"
      }
    >
      <p
        className={
          isLight
            ? "text-xs font-semibold text-amber-950"
            : "text-xs font-medium text-amber-100/90"
        }
      >
        {t("sessionItem.forkDetailTitle")}
      </p>
      <p
        className={
          isLight
            ? "mt-1 text-[11px] leading-relaxed text-amber-900/75"
            : "mt-1 text-[11px] leading-relaxed text-neutral-400"
        }
      >
        {t("sessionItem.forkDetailBody")}
      </p>
      <div className="mt-2.5">
        {isLoggedIn ? (
          <button
            type="button"
            onClick={onFork}
            className={
              isLight
                ? "rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
                : "rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200"
            }
          >
            {t("sessionItem.forkDetailCta")}
          </button>
        ) : (
          <Link
            href={loginHref}
            className={
              isLight
                ? "inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
                : "inline-block rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200"
            }
          >
            {t("sessionItem.forkDetailSignInCta")}
          </Link>
        )}
      </div>
    </div>
  );
}