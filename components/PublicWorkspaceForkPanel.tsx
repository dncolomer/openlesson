"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type PublicWorkspaceForkPanelProps = {
  variant?: "fullscreen" | "inline";
  isLoggedIn: boolean;
  loginHref: string;
  onFork: () => void;
};

export function PublicWorkspaceForkPanel({
  variant = "fullscreen",
  isLoggedIn,
  loginHref,
  onFork,
}: PublicWorkspaceForkPanelProps) {
  const { t } = useI18n();
  const isInline = variant === "inline";

  const content = (
    <>
        <div className={`mb-4 flex items-center justify-center border border-white/25 bg-white/10 ${isInline ? "h-10 w-10 rounded-full" : "h-11 w-11 rounded-lg"}`}>
          <svg className={`text-white/80 ${isInline ? "h-4 w-4" : "h-5 w-5"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.935-2.186 2.25 2.25 0 00-3.935 2.186z"
            />
          </svg>
        </div>

        <h2 className={`font-semibold text-white ${isInline ? "text-lg" : "text-xl sm:text-2xl"}`}>
          {t("planView.forkToEditTitle")}
        </h2>
        <p className={`mt-2.5 leading-relaxed text-neutral-400 ${isInline ? "text-sm" : "mt-3 text-sm sm:text-base"}`}>
          {t("planView.forkToEditBody")}
        </p>

        <ul className={`space-y-2 text-neutral-300 ${isInline ? "mt-4 text-xs" : "mt-5 text-sm"}`}>
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

        <div className={`flex flex-col gap-2.5 ${isInline ? "mt-5" : "mt-7 sm:flex-row"}`}>
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
    </>
  );

  if (isInline) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-black/20 px-4 py-5 sm:px-5">
        <div className="mx-auto flex w-full max-w-[760px] flex-col items-center">
          <div className="w-full rounded-md border border-white/20 bg-white/[0.04] p-4 sm:p-5">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-lg rounded-xl border border-neutral-700/80 bg-neutral-950/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-8">
        {content}
      </div>
    </div>
  );
}