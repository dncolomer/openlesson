"use client";

import Link from "next/link";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import {
  INSUFFICIENT_CREDITS_COPY,
  insufficientCreditsPricingHref,
  insufficientCreditsRegisterHref,
} from "@/lib/credits/insufficient";

export function InsufficientCreditsIceScreen({
  guest = false,
  overlay = true,
}: {
  guest?: boolean;
  overlay?: boolean;
}) {
  const pricingHref = insufficientCreditsPricingHref();
  return (
    <SessionFinishedScreen
      overlay={overlay}
      frameLabel="Credits"
      kicker={INSUFFICIENT_CREDITS_COPY.kicker}
      title={INSUFFICIENT_CREDITS_COPY.title}
      body={INSUFFICIENT_CREDITS_COPY.body}
      data-insufficient-credits-ice=""
      data-insufficient-credits-guest={guest ? "true" : "false"}
      role="alertdialog"
      aria-modal="true"
      className={overlay ? "z-[240]" : "min-h-screen"}
      actions={
        <>
          <Link
            href={pricingHref}
            data-insufficient-credits-pricing
            className="inline-flex min-w-[12rem] items-center justify-center rounded-none bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            {INSUFFICIENT_CREDITS_COPY.getCredits}
          </Link>
          {guest ? (
            <Link
              href={insufficientCreditsRegisterHref(pricingHref)}
              data-insufficient-credits-register
              className="inline-flex min-w-[12rem] items-center justify-center rounded-none border border-white/40 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
            >
              {INSUFFICIENT_CREDITS_COPY.createAccount}
            </Link>
          ) : null}
        </>
      }
    />
  );
}
