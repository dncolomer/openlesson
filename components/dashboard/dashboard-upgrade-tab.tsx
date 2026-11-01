"use client";

import { useState } from "react";
import Link from "next/link";
import { CREDIT_PACK_CARDS } from "@/lib/pricing/modules";
import { UNIFIED_PRICING_COPY } from "@/lib/pricing/unified-copy";
import { FLOW_SESSION_CREDIT_COST, STARTER_CREDIT_GRANT } from "@/lib/credits/constants";
import type { CreditPackSkuId } from "@/lib/credits/constants";
import { AYCL_PATH } from "@/lib/marketing/paths";

const usageCardClass = "console-copy rounded-none p-5 sm:p-6";
const usageLabelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";

export function DashboardUpgradeTab({
  balance,
}: {
  plan?: string;
  subscriptionStatus?: string;
  periodEnd?: string | null;
  isAdmin?: boolean;
  balance?: number;
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleCheckout = async (priceType: CreditPackSkuId) => {
    setLoadingPlan(priceType);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.error) alert("Failed to create checkout: " + data.error);
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to create checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div data-dashboard-upgrade className="space-y-8">
      <section className={usageCardClass}>
        <p className={usageLabelClass}>Credits</p>
        <h2 className="mt-2 text-2xl font-medium text-white">Buy credits</h2>
        <p className="mt-2 text-sm text-neutral-500">
          {typeof balance === "number" ? `Balance ${balance}. ` : ""}
          Free signup includes {STARTER_CREDIT_GRANT} credits. Each Calibrate, Learn, Verify, or
          Solve session costs {FLOW_SESSION_CREDIT_COST} credits. Creating a Learning Map or
          Knowledge Region is free.
        </p>
      </section>

      <section>
        <p className={usageLabelClass}>Credit packs</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {CREDIT_PACK_CARDS.map((card) => (
            <article key={card.id} className={usageCardClass} data-dashboard-buy-sku={card.id}>
              <p className={usageLabelClass}>{card.eyebrow}</p>
              <h3 className="mt-2 text-xl font-medium text-white">{card.name}</h3>
              <p className="mt-2 text-sm text-neutral-500">{card.body}</p>
              <p className="mt-4 text-2xl font-medium text-white">
                {card.priceLabel}
                <span className="ml-2 text-sm font-normal text-neutral-500">{card.cadence}</span>
              </p>
              <button
                type="button"
                data-dashboard-buy-credits
                onClick={() => handleCheckout(card.id as CreditPackSkuId)}
                disabled={loadingPlan === card.id}
                className="mt-6 w-full rounded-none bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
              >
                {loadingPlan === card.id ? "Loading..." : card.cta}
              </button>
            </article>
          ))}
          <article className={usageCardClass} data-dashboard-buy-sku="custom">
            <p className={usageLabelClass}>{UNIFIED_PRICING_COPY.custom.eyebrow}</p>
            <h3 className="mt-2 text-xl font-medium text-white">
              {UNIFIED_PRICING_COPY.custom.name}
            </h3>
            <p className="mt-2 text-sm text-neutral-500">{UNIFIED_PRICING_COPY.custom.body}</p>
            <a
              href={UNIFIED_PRICING_COPY.custom.mailto}
              className="mt-6 inline-flex w-full items-center justify-center rounded-none border border-neutral-600 px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-400 hover:bg-neutral-900"
            >
              {UNIFIED_PRICING_COPY.custom.cta}
            </a>
          </article>
        </div>
      </section>

      <Link
        href={AYCL_PATH}
        className="inline-flex text-sm text-neutral-300 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
      >
        Browse All You Can Learn
      </Link>
    </div>
  );
}
