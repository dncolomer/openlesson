"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LandingNav } from "@/components/LandingNav";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  API_METERED_PLATFORM_FEE_CENTS,
  POW_API_CALL_PRICE_CENTS,
  REGULAR_VOLUME_TIERS,
  TEAM_VOLUME_TIERS,
  DEFAULT_REGULAR_VOLUME,
  DEFAULT_TEAM_VOLUME,
  TRIAL_PRICE_CENTS,
  hasProductAccess,
  type PlanId,
} from "@/lib/plans";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

type PricingPlanId = "trial_3day" | "regular_2026" | "pro_teams" | "api_metered";

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

function tierSizingSummary(submissions: number): string {
  const streaming = Math.max(1, Math.round(submissions / 30));
  const batched = Math.max(1, Math.round(submissions / 4));
  if (streaming === batched) {
    return `Typically ~${streaming} active user — usage depends on integration cadence`;
  }
  return `Typically ~${streaming}–${batched} active users — depends on how often you submit proof`;
}

const REGULAR_VOLUME_NOTES: Record<number, string> = {
  100: "Solo operator",
  250: "Heavy practice",
  500: "Small cohort",
};

const TEAM_VOLUME_NOTES: Record<number, string> = {
  1000: "Pilot team",
  2500: "Department",
  5000: "Scaled rollout",
  10000: "Enterprise",
};

const REGULAR_VOLUMES = REGULAR_VOLUME_TIERS.map((tier) => ({
  proof_of_work: tier.proofOfWork,
  price: tier.priceCents / 100,
  note: REGULAR_VOLUME_NOTES[tier.proofOfWork] || "",
}));

const TEAM_VOLUMES = TEAM_VOLUME_TIERS.map((tier) => ({
  proof_of_work: tier.proofOfWork,
  price: tier.priceCents / 100,
  note: TEAM_VOLUME_NOTES[tier.proofOfWork] || "",
}));

const API_METERED_PLATFORM_PRICE = API_METERED_PLATFORM_FEE_CENTS / 100;
const API_METERED_CALL_PRICE = POW_API_CALL_PRICE_CENTS / 100;

const PLANS: Array<{
  id: PricingPlanId;
  name: string;
  tag?: string;
  description: string;
  features: string[];
  checkout: PricingPlanId;
  volumes: typeof REGULAR_VOLUMES | null;
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
    volumes: null,
    trial: true,
  },
  {
    id: "regular_2026",
    name: "Individual",
    tag: "Popular",
    description:
      "For individuals optimizing learning-to-conversion. One meter: Proof-of-Work submissions. TAP, ILE, and API usage all draw from the same pool.",
    features: [
      "100+ Proof-of-Work submissions/mo",
      "Unlimited Workspaces",
      "Readiness history and reports",
    ],
    checkout: "regular_2026",
    volumes: REGULAR_VOLUMES,
    featured: true,
  },
  {
    id: "pro_teams",
    name: "Pro / Teams",
    description:
      "For teams raising the ROI of learning across humans and agents — shared Proof-of-Work capacity for the whole organization.",
    features: [
      "1,000+ Proof-of-Work submissions/mo",
      "Unlimited Workspaces",
      "Org guests and team API keys",
      "Priority support",
    ],
    checkout: "pro_teams",
    volumes: TEAM_VOLUMES,
  },
  {
    id: "api_metered",
    name: "API Metered",
    tag: "Metered",
    description:
      "For integrators and agent builders who need unlimited Proof-of-Work API scale. No monthly submission cap — pay per API call on your invoice.",
    features: [
      "Unlimited Proof-of-Work API usage",
      `$${API_METERED_CALL_PRICE.toFixed(2)} per API submission (billed monthly)`,
      `$${API_METERED_PLATFORM_PRICE}/mo platform access`,
      "Unlimited Workspaces + API keys + MCP",
      "TAP / ILE not metered per API call",
    ],
    checkout: "api_metered",
    volumes: null,
    metered: true,
  },
];

function formatTierPrice(price: number) {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

type VolumeTierPillProps = {
  selected: boolean;
  label: string;
  price: number;
  submissions: number;
  onSelect: () => void;
};

function VolumeTierPill({ selected, label, price, submissions, onSelect }: VolumeTierPillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 rounded-sm border px-4 py-3 text-left transition ${
        selected
          ? "border-white bg-white text-black"
          : "border-neutral-700 bg-neutral-950/60 text-neutral-300 hover:border-neutral-500"
      }`}
    >
      <p className={`font-mono text-[10px] uppercase tracking-[1.4px] ${selected ? "text-black/50" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className={`mt-1 text-lg font-medium tabular-nums ${selected ? "text-black" : "text-white"}`}>
        {formatTierPrice(price)}
        <span className={`text-xs font-normal ${selected ? "text-black/45" : "text-neutral-500"}`}> /mo</span>
      </p>
      <p className={`mt-1 text-xs tabular-nums ${selected ? "text-black/60" : "text-neutral-500"}`}>
        {submissions.toLocaleString()} submissions
      </p>
    </button>
  );
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserState | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<PricingPlanId>("trial_3day");
  const [selectedVolumes, setSelectedVolumes] = useState<Record<string, number>>({
    regular_2026: DEFAULT_REGULAR_VOLUME,
    pro_teams: DEFAULT_TEAM_VOLUME,
  });

  const activePlan = useMemo(
    () => PLANS.find((plan) => plan.id === activePlanId) ?? PLANS[0],
    [activePlanId],
  );

  const selectedVolume = useMemo(() => {
    if (!activePlan.volumes?.length) return null;
    return (
      activePlan.volumes.find((option) => option.proof_of_work === selectedVolumes[activePlan.id]) ||
      activePlan.volumes[0]
    );
  }, [activePlan, selectedVolumes]);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) {
          setUser({ authenticated: false, plan: "free", isAdmin: false });
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
        const plan = (profile?.plan || "free") as PlanId;
        setUser({
          authenticated: true,
          plan,
          isAdmin: profile?.is_admin ?? false,
        });
        if (plan === "regular_2026" || plan === "pro_teams" || plan === "api_metered") {
          setActivePlanId(plan);
        }
        setNeedsPlan(
          searchParams.get("required") === "1" ||
            !hasProductAccess(
              profile
                ? {
                    plan,
                    subscription_status: profile.subscription_status ?? "inactive",
                    is_admin: profile.is_admin ?? false,
                    organization_id: profile.organization_id,
                    token_tier: profile.token_tier,
                    token_validity_expires_at: profile.token_validity_expires_at,
                    current_period_end: profile.current_period_end ?? null,
                  }
                : null,
            ),
        );
      } catch {
        setUser({ authenticated: false, plan: "free", isAdmin: false });
        setNeedsPlan(searchParams.get("required") === "1");
      }
    };
    load();
  }, [searchParams]);

  const handleCheckout = async (priceType: PricingPlanId) => {
    setLoadingPlan(priceType);
    try {
      const monthlyVolume =
        priceType === "regular_2026"
          ? selectedVolumes.regular_2026
          : priceType === "pro_teams"
            ? selectedVolumes.pro_teams
            : 1;
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType, monthlyVolume }),
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
        : activePlan.metered
          ? `Start API Metered (${formatTierPrice(API_METERED_PLATFORM_PRICE)}/mo + usage) →`
          : activePlan.id === "pro_teams"
            ? `Start Teams (${(selectedVolume?.proof_of_work ?? selectedVolumes.pro_teams).toLocaleString()} submissions/mo) →`
            : `Start Individual (${(selectedVolume?.proof_of_work ?? selectedVolumes.regular_2026).toLocaleString()} submissions/mo) →`;

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
            You pay for how much proof of work you send — artifacts, tool traces, and session evidence
            submitted across TAP, ILE, the API, and every other product on one shared meter. Volume scales
            with the measurement work on our side: scoring, gap analysis, and building the learning world
            models that power verification, optimization, and augmentation.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-500">
            Pay first, then create your account. Stripe checkout collects your email — no separate
            confirmation step.
          </p>
          {needsPlan && (
            <div className="mt-6 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Choose a plan to continue. Try the 3-day trial ($19.99) or pick a monthly plan.
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

          {/* Volume tier selector — horizontal, above details */}
          {activePlan.volumes && activePlan.volumes.length > 0 && (
            <div className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                2 · Monthly capacity
              </p>
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {activePlan.volumes.map((option) => (
                  <VolumeTierPill
                    key={option.proof_of_work}
                    selected={selectedVolumes[activePlan.id] === option.proof_of_work}
                    label={option.note || "Standard"}
                    price={option.price}
                    submissions={option.proof_of_work}
                    onSelect={() =>
                      setSelectedVolumes((current) => ({
                        ...current,
                        [activePlan.id]: option.proof_of_work,
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          )}

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
                  : activePlan.metered
                    ? formatTierPrice(API_METERED_PLATFORM_PRICE)
                    : formatTierPrice(selectedVolume?.price ?? 0)}
              </span>
              <span className="text-sm text-neutral-500">
                {activePlan.trial ? "one-time" : activePlan.metered ? "+ usage / mo" : "/ month"}
              </span>
            </div>

            {activePlan.metered ? (
              <p className="mt-3 text-sm text-neutral-400">
                + <span className="text-white">${API_METERED_CALL_PRICE.toFixed(2)}</span> per Proof-of-Work API
                submission on your monthly invoice
              </p>
            ) : selectedVolume ? (
              <div className="mt-4 rounded-sm border border-neutral-800 bg-black/30 px-4 py-3 text-sm text-neutral-400">
                <span className="text-white">{selectedVolume.proof_of_work.toLocaleString()}</span> Proof-of-Work
                submissions / mo · {tierSizingSummary(selectedVolume.proof_of_work)}
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
            Individual and Teams bundle submissions per month. API Metered bills platform + per-call usage on each
            invoice.
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