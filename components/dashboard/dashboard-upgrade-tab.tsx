"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MODULE_LABELS,
  PUBLIC_SKU_CARDS,
  formatUsdFromCents,
  modulesForPlan,
  planDisplayName,
  planFeatureList,
  priceCentsForPlan,
  skuAlreadyCovered,
  type ModuleSkuId,
  type ProductModule,
} from "@/lib/pricing/modules";
import { UNIFIED_PRICING_COPY } from "@/lib/pricing/unified-copy";
import { AYCL_PATH } from "@/lib/marketing/paths";

const usageCardClass = "console-copy rounded-none p-5 sm:p-6";
const usageLabelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";

export function DashboardUpgradeTab({
  plan,
  subscriptionStatus,
  periodEnd,
  isAdmin,
}: {
  plan: string;
  subscriptionStatus: string;
  periodEnd: string | null;
  isAdmin: boolean;
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const owned = modulesForPlan(plan);
  const active = subscriptionStatus === "active";

  const handleCheckout = async (priceType: ModuleSkuId) => {
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

  const buyable = PUBLIC_SKU_CARDS.filter((card) => {
    if (card.id === "trial_3day") return !active || plan === "inactive";
    return !skuAlreadyCovered(plan, card.id);
  });

  return (
    <div data-dashboard-upgrade className="space-y-8">
      <section className={usageCardClass}>
        <p className={usageLabelClass}>Your modules</p>
        <h2 className="mt-2 text-2xl font-medium text-white">
          {isAdmin ? "Platform admin" : planDisplayName(plan)}
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          {active
            ? plan === "trial"
              ? `All modules through ${periodEnd ? new Date(periodEnd).toLocaleDateString() : "the trial window"}.`
              : `Active · ${formatUsdFromCents(priceCentsForPlan(plan))}${plan === "trial" ? " one-time" : "/mo"}`
            : "No active modules. Buy a module or try everything for three days."}
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {(Object.keys(MODULE_LABELS) as ProductModule[]).map((module) => {
            const have = isAdmin || (active && owned.includes(module));
            return (
              <li
                key={module}
                data-dashboard-module={module}
                data-dashboard-module-owned={have ? "true" : "false"}
                className="border-t border-neutral-800 pt-3 text-sm"
              >
                <span className={have ? "text-white" : "text-neutral-500"}>
                  {MODULE_LABELS[module]}
                </span>
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">
                  {have ? "Owned" : "Not owned"}
                </span>
              </li>
            );
          })}
        </ul>
        {active && plan !== "inactive" ? (
          <ul className="mt-6 space-y-1 text-sm text-neutral-500">
            {planFeatureList(plan).map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <p className={usageLabelClass}>Buy more</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {buyable.map((card) => (
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
                onClick={() => handleCheckout(card.id)}
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
