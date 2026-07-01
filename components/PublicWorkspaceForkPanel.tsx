"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type PublicWorkspaceForkPanelProps = {
  authorUsername?: string;
  isLoggedIn: boolean;
  loginHref: string;
  onFork: () => void;
};

export function PublicWorkspaceForkPanel({
  authorUsername,
  isLoggedIn,
  loginHref,
  onFork,
}: PublicWorkspaceForkPanelProps) {
  const { t } = useI18n();

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-lg rounded-xl border border-neutral-700/80 bg-neutral-950/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
          <svg className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.935-2.186 2.25 2.25 0 00-3.935 2.186z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-white sm:text-2xl">{t("planView.forkToEditTitle")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-base">
          {authorUsername
            ? t("planView.forkToEditBodyWithAuthor", { author: authorUsername })
            : t("planView.forkToEditBody")}
        </p>

        <ul className="mt-5 space-y-2.5 text-sm text-neutral-300">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500" />
            <span>{t("planView.forkToEditPointBrowse")}</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500" />
            <span>{t("planView.forkToEditPointBuilder")}</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500" />
            <span>{t("planView.forkToEditPointOwnCopy")}</span>
          </li>
        </ul>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={onFork}
              className="flex-1 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              {t("planView.forkToEditCta")}
            </button>
          ) : (
            <Link
              href={loginHref}
              className="flex-1 rounded-md bg-white px-4 py-2.5 text-center text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              {t("planView.forkToEditSignInCta")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}