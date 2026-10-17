"use client";

import { Suspense } from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { usePricingCheckout } from "@/components/pricing/use-pricing-checkout";
import { HARNESS_PRICING_PATH } from "@/lib/marketing/paths";
import { AUTHORING_PRICING_COPY } from "@/lib/pricing/authoring-copy";
import { AUTHORING_SKU_CARD, skuAlreadyCovered } from "@/lib/pricing/modules";

function AuthoringPricingContent() {
  const { user, loadingPlan, handleCheckout, currentPlan } = usePricingCheckout();
  const owned =
    Boolean(user?.authenticated) && skuAlreadyCovered(currentPlan, AUTHORING_SKU_CARD.id);
  const { package: coursePackage } = AUTHORING_PRICING_COPY;

  return (
    <MarketingPageShell>
      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 pt-14 pb-16 sm:pt-16 sm:pb-20">
        <div className="console-copy p-5 sm:p-8">
        <div className="console-chip mb-8 inline-block px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          {AUTHORING_PRICING_COPY.eyebrow}
        </div>
        <h1 className="text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
          {AUTHORING_PRICING_COPY.title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg">
          {AUTHORING_PRICING_COPY.lead}
        </p>
        <Link
          href={HARNESS_PRICING_PATH}
          className="mt-4 inline-block text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white"
        >
          All modules
        </Link>

        <div
          id="authoring"
          data-testid="pricing-sku-module_author"
          className="mt-12 flex flex-col gap-3 border-y border-neutral-800 py-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h2 className="text-lg font-medium text-white">{AUTHORING_SKU_CARD.name}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {AUTHORING_SKU_CARD.priceLabel} {AUTHORING_SKU_CARD.cadence} ·{" "}
              {AUTHORING_SKU_CARD.body}
            </p>
          </div>
          {owned ? (
            <span className="text-sm text-neutral-500">Current</span>
          ) : (
            <button
              type="button"
              data-testid="checkout-module_author"
              onClick={() => handleCheckout(AUTHORING_SKU_CARD.id)}
              disabled={loadingPlan === AUTHORING_SKU_CARD.id}
              className="rounded-none border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-400 disabled:opacity-50"
            >
              {loadingPlan === AUTHORING_SKU_CARD.id ? "Loading..." : AUTHORING_SKU_CARD.cta}
            </button>
          )}
        </div>

        <article data-testid="authoring-40h-package" className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
            {coursePackage.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-medium text-white">{coursePackage.name}</h2>
          <p className="mt-4 text-4xl font-medium tracking-[-1px] text-white">
            {coursePackage.price}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {coursePackage.body}
          </p>
        </article>

        <div data-testid="authoring-contact" className="mt-10">
          <h2 className="text-xl font-medium text-white">{AUTHORING_PRICING_COPY.contactTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Contact{" "}
            <a
              href={AUTHORING_PRICING_COPY.contactMailto}
              className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white"
            >
              {AUTHORING_PRICING_COPY.contactEmail}
            </a>{" "}
            for more details and custom packages.
          </p>
          <a
            href={AUTHORING_PRICING_COPY.contactMailto}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {AUTHORING_PRICING_COPY.contactCta}
          </a>
        </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}

export default function AuthoringPricingPage() {
  return (
    <Suspense fallback={null}>
      <AuthoringPricingContent />
    </Suspense>
  );
}
