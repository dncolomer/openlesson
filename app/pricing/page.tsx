"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingNav } from "@/components/LandingNav";
import { Footer } from "@/components/Footer";
import { UNIFIED_PRICING_COPY } from "@/lib/pricing/unified-copy";
import {
  PRICING_PAGE_SKUS,
  skuAlreadyCovered,
  type ModuleSkuId,
} from "@/lib/pricing/modules";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import { usePricingCheckout } from "@/components/pricing/use-pricing-checkout";

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const SKU_SECTION_ID: Record<Exclude<ModuleSkuId, "module_author">, string> = {
  trial_3day: "try-everything",
  module_learn: "learning",
  module_verify: "verification",
  module_calibrate: "calibration",
  bundle_verify_calibrate: "bundle",
};

function CheckoutButton({
  sku,
  cta,
  owned,
  loading,
  highlighted,
  onCheckout,
}: {
  sku: ModuleSkuId;
  cta: string;
  owned: boolean;
  loading: boolean;
  highlighted?: boolean;
  onCheckout: (sku: ModuleSkuId) => void;
}) {
  if (owned) {
    return <span className="text-sm text-neutral-500">Current</span>;
  }
  return (
    <button
      type="button"
      data-testid={`checkout-${sku}`}
      onClick={() => onCheckout(sku)}
      disabled={loading}
      className={
        highlighted
          ? "rounded-none bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
          : "rounded-none border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-400 disabled:opacity-50"
      }
    >
      {loading ? "Loading..." : cta}
    </button>
  );
}

function PricingPageContent() {
  const { user, needsPlan, loadingPlan, handleCheckout, currentPlan, isOnTrial } =
    usePricingCheckout();

  return (
    <main
      data-console-frame=""
      className="relative min-h-screen border border-white/40 bg-black bg-cover bg-fixed bg-center text-neutral-200"
      style={{ backgroundImage: `url(${BACKGROUND})` }}
    >
      <div className="fixed inset-0 z-0 bg-black/78" />
      <PublicConsoleWash />
      <div className="relative z-10 flex min-h-screen flex-col">
        <LandingNav />
        <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:py-20">
          <div className="console-copy p-5 sm:p-8">
          <div className="console-chip mb-8 inline-block rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            {UNIFIED_PRICING_COPY.eyebrow}
          </div>
          <h1 className="text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
            {UNIFIED_PRICING_COPY.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-neutral-400 sm:text-lg">
            {UNIFIED_PRICING_COPY.lead}
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link
              href={UNIFIED_PRICING_COPY.ayclHref}
              data-testid="pricing-aycl-link"
              className="inline-flex items-center text-neutral-200 underline decoration-neutral-700 underline-offset-4 hover:text-white"
            >
              {UNIFIED_PRICING_COPY.ayclCta}
              <span className="ml-1.5 text-neutral-500">{UNIFIED_PRICING_COPY.ayclLabel}</span>
            </Link>
            <Link
              href={UNIFIED_PRICING_COPY.authoringHref}
              data-testid="pricing-authoring-link"
              className="inline-flex items-center text-neutral-200 underline decoration-neutral-700 underline-offset-4 hover:text-white"
            >
              {UNIFIED_PRICING_COPY.authoringCta}
              <ArrowRight className="ml-1.5" size={14} />
            </Link>
          </div>
          {needsPlan && (
            <p className="mt-6 text-sm text-neutral-300">{UNIFIED_PRICING_COPY.needsPlan}</p>
          )}

          <div data-testid="pricing-layout" className="mt-12 w-full">
            <div data-testid="pricing-plans" className="divide-y divide-neutral-800 border-y border-neutral-800">
              {PRICING_PAGE_SKUS.map((card) => {
                const owned =
                  Boolean(user?.authenticated) &&
                  card.id !== "trial_3day" &&
                  skuAlreadyCovered(currentPlan, card.id);
                const trialOwned = card.id === "trial_3day" && isOnTrial;
                return (
                  <div
                    key={card.id}
                    id={SKU_SECTION_ID[card.id as Exclude<ModuleSkuId, "module_author">]}
                    data-testid={`pricing-sku-${card.id}`}
                    className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <h2 className="text-lg font-medium text-white">{card.name}</h2>
                      <p className="mt-1 text-sm text-neutral-500">
                        {card.priceLabel} {card.cadence}
                      </p>
                    </div>
                    <CheckoutButton
                      sku={card.id}
                      cta={card.cta}
                      owned={owned || trialOwned}
                      loading={loadingPlan === card.id}
                      highlighted={card.highlighted}
                      onCheckout={handleCheckout}
                    />
                  </div>
                );
              })}

              <div id="mapping">
              <div
                id="custom"
                data-testid="pricing-sku-custom"
                className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h2 className="text-lg font-medium text-white">
                    {UNIFIED_PRICING_COPY.custom.name}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {UNIFIED_PRICING_COPY.custom.body}
                  </p>
                </div>
                <a
                  href={UNIFIED_PRICING_COPY.custom.mailto}
                  className="rounded-none border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-400"
                >
                  {UNIFIED_PRICING_COPY.custom.cta}
                </a>
              </div>
              </div>
            </div>
          </div>
          </div>
        </section>
        <Footer />
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingPageContent />
    </Suspense>
  );
}
