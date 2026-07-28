"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  API_METERED_PLATFORM_FEE_CENTS,
  formatIleSessionPrice,
  formatPowApiCallPrice,
  formatTapSessionPrice,
  hasProductAccess,
  type PlanId,
} from "@/lib/plans";
import {
  estimateScenarioMonthly,
  formatEstimateUsd,
  PRICING_SCENARIOS,
  type PricingScenarioConfig,
  type PricingScenarioSlug,
  type ScenarioSliderKey,
  type ScenarioSliderValues,
} from "@/lib/pricing/scenarios";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

type PricingPlanId = "trial_3day" | "api_metered";

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const API_METERED_PLATFORM_PRICE = API_METERED_PLATFORM_FEE_CENTS / 100;

const METERED_FEATURES = [
  "Unlimited product usage (no monthly cap)",
  `${formatPowApiCallPrice()} per external/API-direct PoW submission`,
  `${formatTapSessionPrice()} per TAP session`,
  `${formatIleSessionPrice()} per ILE session`,
  `$${API_METERED_PLATFORM_PRICE}/mo platform access`,
  "Unlimited Workspaces + API keys + MCP",
  "Internal TAP/ILE PoW not charged as API PoW",
];

function formatTierPrice(price: number) {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

function defaultSliderState(scenario: PricingScenarioConfig): ScenarioSliderValues {
  const values: ScenarioSliderValues = {};
  for (const slider of scenario.sliders) {
    values[slider.key] = slider.defaultValue;
  }
  return values;
}

function ScenarioPanel() {
  const [activeSlug, setActiveSlug] = useState<PricingScenarioSlug>(
    PRICING_SCENARIOS[0].slug,
  );
  const [sliderByScenario, setSliderByScenario] = useState<
    Partial<Record<PricingScenarioSlug, ScenarioSliderValues>>
  >(() => {
    const init: Partial<Record<PricingScenarioSlug, ScenarioSliderValues>> = {};
    for (const s of PRICING_SCENARIOS) {
      init[s.slug] = defaultSliderState(s);
    }
    return init;
  });

  const activeScenario =
    PRICING_SCENARIOS.find((s) => s.slug === activeSlug) ?? PRICING_SCENARIOS[0];
  const sliderValues =
    sliderByScenario[activeScenario.slug] ?? defaultSliderState(activeScenario);
  const estimate = useMemo(
    () => estimateScenarioMonthly(activeScenario, sliderValues),
    [activeScenario, sliderValues],
  );

  const setSlider = (key: ScenarioSliderKey, value: number) => {
    setSliderByScenario((prev) => ({
      ...prev,
      [activeScenario.slug]: {
        ...(prev[activeScenario.slug] ?? defaultSliderState(activeScenario)),
        [key]: value,
      },
    }));
  };

  return (
    <div
      data-testid="pricing-scenarios"
      className="border border-neutral-800 bg-neutral-950/80 p-5 backdrop-blur-sm sm:p-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
        Real-world cost scenarios
      </p>
      <h2 className="mt-2 text-lg font-medium text-white">
        See API Metered under product use cases
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">
        Estimates use the same platform and usage rates as billing. Adjust volume
        with the sliders — totals update live.
      </p>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Use-case scenarios"
        className="mt-5 flex flex-wrap gap-1.5"
      >
        {PRICING_SCENARIOS.map((scenario) => {
          const selected = activeSlug === scenario.slug;
          return (
            <button
              key={scenario.slug}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`scenario-tab-${scenario.slug}`}
              onClick={() => setActiveSlug(scenario.slug)}
              className={`rounded-sm border px-2.5 py-1.5 text-left text-xs font-medium transition sm:text-[13px] ${
                selected
                  ? "border-white bg-white text-black"
                  : "border-neutral-700 bg-neutral-950/60 text-neutral-300 hover:border-neutral-500"
              }`}
            >
              {scenario.title}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        data-testid={`scenario-panel-${activeScenario.slug}`}
        className="mt-5"
      >
        <p className="text-sm leading-relaxed text-neutral-400">{activeScenario.context}</p>
        <Link
          href={activeScenario.salesPath}
          className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[1px] text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
        >
          Sales product →
        </Link>

        {/* Sliders */}
        <div className="mt-5 space-y-5">
          {activeScenario.sliders.map((slider) => {
            const value = sliderValues[slider.key] ?? slider.defaultValue;
            return (
              <div key={slider.key} data-testid={`slider-${slider.key}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor={`scenario-${activeScenario.slug}-${slider.key}`}
                    className="text-sm font-medium text-neutral-200"
                  >
                    {slider.label}
                  </label>
                  <span className="font-mono text-sm tabular-nums text-white">
                    {value.toLocaleString()}
                  </span>
                </div>
                <input
                  id={`scenario-${activeScenario.slug}-${slider.key}`}
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={value}
                  onChange={(e) => setSlider(slider.key, Number(e.target.value))}
                  className="mt-2 w-full accent-white"
                />
                <p className="mt-1 text-xs text-neutral-600">{slider.hint}</p>
              </div>
            );
          })}
        </div>

        {/* Live estimate */}
        <div
          data-testid="scenario-estimate"
          className="mt-6 border border-neutral-700 bg-black/40 p-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
            Estimated monthly (API Metered)
          </p>
          <p
            data-testid="scenario-estimate-total"
            className="mt-2 text-3xl font-medium tracking-[-1px] text-white"
          >
            {formatEstimateUsd(estimate.totalUsd)}
            <span className="ml-1 text-sm font-normal text-neutral-500">/ mo</span>
          </p>
          <ul className="mt-3 space-y-1 text-xs text-neutral-400">
            <li>
              Platform{" "}
              <span className="text-neutral-200">
                {formatEstimateUsd(estimate.platformUsd)}
              </span>
            </li>
            <li>
              Usage{" "}
              <span className="text-neutral-200">
                {formatEstimateUsd(estimate.usageUsd)}
              </span>
              <span className="text-neutral-600">
                {" "}
                (
                {estimate.units.externalPowCount > 0 && (
                  <>{estimate.units.externalPowCount.toLocaleString()} API PoW</>
                )}
                {estimate.units.externalPowCount > 0 &&
                  (estimate.units.tapSessionCount > 0 ||
                    estimate.units.ileSessionCount > 0) &&
                  " · "}
                {estimate.units.tapSessionCount > 0 && (
                  <>{estimate.units.tapSessionCount.toLocaleString()} TAP</>
                )}
                {estimate.units.tapSessionCount > 0 &&
                  estimate.units.ileSessionCount > 0 &&
                  " · "}
                {estimate.units.ileSessionCount > 0 && (
                  <>{estimate.units.ileSessionCount.toLocaleString()} ILE</>
                )}
                {estimate.units.externalPowCount === 0 &&
                  estimate.units.tapSessionCount === 0 &&
                  estimate.units.ileSessionCount === 0 &&
                  "no metered usage"}
                )
              </span>
            </li>
          </ul>
        </div>

        {/* Assumptions */}
        <div data-testid="scenario-assumptions" className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
            Assumptions
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-neutral-500">
            {activeScenario.assumptions.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserState | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) {
          setUser({ authenticated: false, plan: "inactive", isAdmin: false });
          setNeedsPlan(searchParams.get("required") === "1");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "plan, is_admin, subscription_status, organization_id, token_tier, token_validity_expires_at, current_period_end",
          )
          .eq("id", authUser.id)
          .single();

        let orgBilling: {
          id: string;
          plan: string | null;
          subscription_status: string | null;
          current_period_end: string | null;
          billing_mode: string | null;
          archived_at: string | null;
        } | null = null;
        if (profile?.organization_id) {
          const { data: org } = await supabase
            .from("organizations")
            .select("id, plan, subscription_status, current_period_end, billing_mode, archived_at")
            .eq("id", profile.organization_id)
            .maybeSingle();
          orgBilling = org;
        }

        // Display plan from org (product truth), not demoted personal profile
        const plan = (
          (orgBilling?.plan as PlanId | undefined) ||
          (profile?.plan as PlanId | undefined) ||
          "inactive"
        ) as PlanId;
        setUser({
          authenticated: true,
          plan,
          isAdmin: profile?.is_admin ?? false,
        });
        setNeedsPlan(
          searchParams.get("required") === "1" ||
            !hasProductAccess(
              profile
                ? {
                    plan: (profile.plan || "inactive") as PlanId,
                    subscription_status: profile.subscription_status ?? "inactive",
                    is_admin: profile.is_admin ?? false,
                    organization_id: profile.organization_id,
                    token_tier: profile.token_tier,
                    token_validity_expires_at: profile.token_validity_expires_at,
                    current_period_end: profile.current_period_end ?? null,
                  }
                : null,
              orgBilling,
            ),
        );
      } catch {
        setUser({ authenticated: false, plan: "inactive", isAdmin: false });
        setNeedsPlan(searchParams.get("required") === "1");
      }
    };
    load();
  }, [searchParams]);

  const handleCheckout = async (priceType: PricingPlanId) => {
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

  const isOnMetered = user?.authenticated && user.plan === "api_metered";
  const isOnTrial = user?.authenticated && user.plan === "trial";

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-neutral-200"
      style={{ backgroundImage: `url(${BACKGROUND})` }}
    >
      <div className="fixed inset-0 bg-black/78" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <LandingNav />
        <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 sm:py-20">
          <div className="mb-8 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            LEARNING EFFICIENCY • HUMANS & AGENTS
          </div>
          <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
            Pricing built on proof of work.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            One ongoing plan — API Metered — with clear usage rates. External API PoW is billed
            separately from TAP and ILE sessions so product usage never double-charges internal PoW.
            Explore real-world cost scenarios on the right.
          </p>
          {needsPlan && (
            <div className="mt-6 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Choose a plan to continue. Start API Metered or try everything unlimited for 3 days for $19.99.
            </div>
          )}

          {/* Two-column: metered plan left, scenarios right — tops aligned */}
          <div
            data-testid="pricing-layout"
            className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10"
          >
            {/* LEFT: single API Metered card + Start / trial CTAs */}
            <div
              data-testid="pricing-plans"
              className="border border-neutral-500 bg-neutral-950/80 p-5 backdrop-blur-sm sm:p-6"
            >
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                Plan
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-medium text-white">API Metered</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
                    Platform access plus metered usage. External API PoW, TAP sessions, and ILE
                    sessions each have their own rate. TAP/ILE-generated PoW is not billed as API
                    PoW.
                  </p>
                </div>
                <span className="border border-amber-500/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/90">
                  Metered
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-medium tracking-[-1px] text-white">
                  {formatTierPrice(API_METERED_PLATFORM_PRICE)}
                </span>
                <span className="text-sm text-neutral-500">+ usage / mo</span>
              </div>

              <div className="mt-3 space-y-1 text-sm text-neutral-400">
                <p>
                  + <span className="text-white">{formatPowApiCallPrice()}</span> per external/API
                  Proof-of-Work submission
                </p>
                <p>
                  + <span className="text-white">{formatTapSessionPrice()}</span> per TAP session
                </p>
                <p>
                  + <span className="text-white">{formatIleSessionPrice()}</span> per ILE session
                </p>
              </div>

              <ul className="mt-6 grid gap-2">
                {METERED_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="border-t border-neutral-800 pt-3 text-sm text-neutral-400"
                  >
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                {isOnMetered ? (
                  <div className="flex-1 rounded-sm border border-neutral-800 px-4 py-3 text-center text-sm text-neutral-500">
                    Current plan
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="checkout-start-metered"
                    onClick={() => handleCheckout("api_metered")}
                    disabled={loadingPlan === "api_metered"}
                    className="flex-1 rounded-sm bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
                  >
                    {loadingPlan === "api_metered" ? "Loading..." : "Start"}
                  </button>
                )}
                {isOnTrial ? (
                  <div className="flex-1 rounded-sm border border-neutral-800 px-4 py-3 text-center text-sm text-neutral-500">
                    On trial
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="checkout-trial-3day"
                    onClick={() => handleCheckout("trial_3day")}
                    disabled={loadingPlan === "trial_3day" || isOnMetered}
                    className="flex-1 rounded-sm border border-neutral-600 bg-transparent px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-400 hover:bg-neutral-900 disabled:opacity-50"
                  >
                    {loadingPlan === "trial_3day"
                      ? "Loading..."
                      : "Try everything unlimited for 3 days for $19.99"}
                  </button>
                )}
              </div>

              <p className="mt-4 text-xs text-neutral-600">
                API Metered bills platform + usage on each invoice. External API PoW is separate
                from TAP ($1) and ILE ($10) session rates. TAP/ILE-generated PoW is not charged as
                API PoW.
              </p>
            </div>

            {/* RIGHT: tabbed real-world scenarios */}
            <ScenarioPanel />
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
