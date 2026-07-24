"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LandingNav } from "@/components/LandingNav";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  API_METERED_PLATFORM_FEE_CENTS,
  formatIleSessionPrice,
  formatPowApiCallPrice,
  formatTapSessionPrice,
  TRIAL_PRICE_CENTS,
  hasProductAccess,
  type PlanId,
} from "@/lib/plans";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

type PricingPlanId = "trial_3day" | "api_metered";

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const API_METERED_PLATFORM_PRICE = API_METERED_PLATFORM_FEE_CENTS / 100;

const PLANS: Array<{
  id: PricingPlanId;
  name: string;
  tag?: string;
  description: string;
  features: string[];
  checkout: PricingPlanId;
  metered?: boolean;
  trial?: boolean;
  featured?: boolean;
}> = [
  {
    id: "trial_3day",
    name: "3-Day Trial",
    tag: "Try it",
    description:
      "Pay once, get full access for 3 days. After checkout you’ll create your account — no email confirmation step.",
    features: [
      "Full product access for 3 days",
      "Unlimited Proof-of-Work submissions",
      "Unlimited Workspaces",
      "One-time $19.99 — no subscription",
    ],
    checkout: "trial_3day",
    trial: true,
  },
  {
    id: "api_metered",
    name: "API Metered",
    tag: "Metered",
    description:
      "The sole ongoing plan: platform access plus metered usage. External API PoW, TAP sessions, and ILE sessions each have their own rate. TAP/ILE-generated PoW is not billed as API PoW.",
    features: [
      "Unlimited product usage (no monthly cap)",
      `${formatPowApiCallPrice()} per external/API-direct PoW submission`,
      `${formatTapSessionPrice()} per TAP session`,
      `${formatIleSessionPrice()} per ILE session`,
      `$${API_METERED_PLATFORM_PRICE}/mo platform access`,
      "Unlimited Workspaces + API keys + MCP",
      "Internal TAP/ILE PoW not charged as API PoW",
    ],
    checkout: "api_metered",
    metered: true,
    featured: true,
  },
];

function formatTierPrice(price: number) {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserState | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<PricingPlanId>("trial_3day");

  const activePlan = useMemo(
    () => PLANS.find((plan) => plan.id === activePlanId) ?? PLANS[0],
    [activePlanId],
  );

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
        if (plan === "api_metered") {
          setActivePlanId("api_metered");
        } else if (plan === "trial") {
          setActivePlanId("trial_3day");
        }
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

  const isCurrentPlan =
    user?.authenticated &&
    ((activePlan.id === "trial_3day" && user.plan === "trial") || user.plan === activePlan.id);
  const checkoutLabel =
    loadingPlan === activePlan.checkout
      ? "Loading..."
      : activePlan.trial
        ? `Pay $${(TRIAL_PRICE_CENTS / 100).toFixed(2)} — 3 days full access →`
        : `Start API Metered (${formatTierPrice(API_METERED_PLATFORM_PRICE)}/mo + usage) →`;

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-neutral-200"
      style={{ backgroundImage: `url(${BACKGROUND})` }}
    >
      <div className="fixed inset-0 bg-black/78" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <LandingNav />
        <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 sm:py-20">
          <div className="mb-8 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            LEARNING EFFICIENCY • HUMANS & AGENTS
          </div>
          <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
            Pricing built on proof of work.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            Start with a 3-day trial, then stay on API Metered — one tier with clear usage rates.
            External API PoW is billed separately from TAP and ILE sessions so product usage never
            double-charges internal PoW.
          </p>
          {needsPlan && (
            <div className="mt-6 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Choose a plan to continue. Try the 3-day trial ($19.99) or start API Metered.
            </div>
          )}

          {/* Plan selector */}
          <div className="mt-10">
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">1 · Choose plan</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PLANS.map((plan) => {
                const selected = activePlanId === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setActivePlanId(plan.id)}
                    className={`rounded-sm border px-4 py-2.5 text-sm font-medium transition ${
                      selected
                        ? "border-white bg-white text-black"
                        : "border-neutral-700 bg-neutral-950/60 text-neutral-300 hover:border-neutral-500"
                    }`}
                  >
                    {plan.name}
                    {plan.tag && (
                      <span
                        className={`ml-2 font-mono text-[9px] uppercase tracking-[1px] ${
                          selected ? "text-black/45" : "text-neutral-500"
                        }`}
                      >
                        {plan.tag}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Single plan detail panel */}
          <div
            className={`mt-8 border bg-neutral-950/80 p-6 backdrop-blur-sm sm:p-8 ${
              activePlan.featured ? "border-neutral-500" : "border-neutral-800"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-medium text-white">{activePlan.name}</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">{activePlan.description}</p>
              </div>
              {activePlan.tag && (
                <span
                  className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] ${
                    activePlan.metered
                      ? "border-amber-500/40 text-amber-200/90"
                      : "border-neutral-700 text-neutral-400"
                  }`}
                >
                  {activePlan.tag}
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-medium tracking-[-1px] text-white">
                {activePlan.trial
                  ? `$${(TRIAL_PRICE_CENTS / 100).toFixed(2)}`
                  : formatTierPrice(API_METERED_PLATFORM_PRICE)}
              </span>
              <span className="text-sm text-neutral-500">
                {activePlan.trial ? "one-time" : "+ usage / mo"}
              </span>
            </div>

            {activePlan.metered ? (
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
            ) : null}

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {activePlan.features.map((feature) => (
                <li key={feature} className="border-t border-neutral-800 pt-3 text-sm text-neutral-400">
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {isCurrentPlan ? (
                <div className="rounded-sm border border-neutral-800 px-4 py-3 text-center text-sm text-neutral-500">
                  Current plan
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCheckout(activePlan.checkout)}
                  disabled={loadingPlan === activePlan.checkout}
                  className="w-full rounded-sm bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50 sm:w-auto sm:min-w-[280px]"
                >
                  {checkoutLabel}
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-neutral-600">
            API Metered bills platform + usage on each invoice. External API PoW is separate from
            TAP ($1) and ILE ($10) session rates.
          </p>
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
