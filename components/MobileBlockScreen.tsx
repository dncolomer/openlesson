"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export type MobileBlockProduct = "tap" | "ile" | "session";

export function MobileBlockScreen({
  product = "session",
  showDashboardLink = true,
}: {
  /** Which product is blocked — copy stays desktop-first. */
  product?: MobileBlockProduct;
  /** Hide dashboard CTA on guest TAP/ILE links. */
  showDashboardLink?: boolean;
}) {
  const { t } = useI18n();
  const productLabel =
    product === "tap"
      ? "Think Aloud Protocol"
      : product === "ile"
        ? "Integrated Learning Environment"
        : "this experience";

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] p-6 text-center"
      data-mobile-block-screen
      data-mobile-block-product={product}
    >
      <div className="mb-8">
        <div className="mb-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Uncertain Systems
        </div>
        <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-neutral-700 to-neutral-700" />
      </div>

      <div className="mb-6">
        <svg
          className="mx-auto h-24 w-24 text-neutral-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      <h1 className="mb-3 text-2xl font-semibold text-white" data-mobile-block-title>
        {t("mobileBlock.desktopOnly")}
      </h1>
      <p className="mb-2 max-w-md text-neutral-400" data-mobile-block-description>
        {t("mobileBlock.desktopDescription")}
      </p>
      <p className="mb-8 max-w-md text-sm text-neutral-500" data-mobile-block-switch>
        {productLabel} is designed for desktop. Please switch to a desktop browser to continue.
      </p>

      <div className="mb-8 flex items-center gap-2 text-xs text-neutral-600">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
        <span>{t("mobileBlock.chromeRecommended")}</span>
      </div>

      {showDashboardLink ? (
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-none border border-neutral-700 bg-white/5 px-6 py-3 text-white transition-all hover:border-neutral-600 hover:bg-white/10"
          data-mobile-block-dashboard
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>{t("mobileBlock.returnToDashboard")}</span>
        </Link>
      ) : null}
    </div>
  );
}
