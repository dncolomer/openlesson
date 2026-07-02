"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { type PlanId } from "@/lib/plans";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const REGULAR_VOLUMES = [
  { blocks: 25, price: 49, note: "Solo operator" },
  { blocks: 50, price: 79, note: "Heavy practice" },
  { blocks: 100, price: 129, note: "Small cohort" },
];

const TEAM_VOLUMES = [
  { blocks: 250, price: 399, note: "Pilot team" },
  { blocks: 500, price: 649, note: "Department" },
  { blocks: 1000, price: 999, note: "Scaled rollout" },
  { blocks: 2500, price: 1999, note: "Enterprise" },
];

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    detail: "forever",
    description: "Start proving what you actually understand before committing to a paid workflow.",
    features: ["5 starter blocks", "One Verification Workspace", "Basic GHL readiness report", "Start with any topic or scenario"],
  },
  {
    id: "regular_2026" as const,
    name: "Regular",
    detail: "from /mo",
    description: "For individuals and operators who need recurring evidence of real capability, not polished AI-assisted output.",
    features: ["25+ blocks per month", "File uploads for workplace context", "Readiness history and reports", "Additional blocks: $3.99 each"],
    checkout: "regular_2026" as const,
    volumes: REGULAR_VOLUMES,
    featured: true,
  },
  {
    id: "pro_teams" as const,
    name: "Pro / Teams",
    detail: "from /mo",
    description: "For teams turning AI-assisted practice into verifiable readiness evidence across critical roles and decisions.",
    features: ["250+ shared blocks per month", "Verification Workspaces for team scenarios", "Org guests and team API keys", "Additional blocks: $1.99 each", "Priority support"],
    checkout: "pro_teams" as const,
    volumes: TEAM_VOLUMES,
  },
];

export default function PricingPage() {
  const [user, setUser] = useState<UserState | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [extraLessonQuantity, setExtraLessonQuantity] = useState(5);
  const [selectedVolumes, setSelectedVolumes] = useState<Record<string, number>>({ regular_2026: 25, pro_teams: 250 });

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setUser({ authenticated: false, plan: "free", isAdmin: false });
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("plan, is_admin").eq("id", authUser.id).single();
        setUser({ authenticated: true, plan: (profile?.plan || "free") as PlanId, isAdmin: profile?.is_admin ?? false });
      } catch {
        setUser({ authenticated: false, plan: "free", isAdmin: false });
      }
    };
    load();
  }, []);

  const handleCheckout = async (priceType: "regular_2026" | "pro_teams" | "extra_lesson", quantity = 1) => {
    if (!user?.authenticated) {
      window.location.href = "/login?redirect=/pricing";
      return;
    }
    setLoadingPlan(priceType);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType, quantity, monthlyVolume: selectedVolumes[priceType] }),
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
    <main className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-neutral-200" style={{ backgroundImage: `url(${BACKGROUND})` }}>
      <div className="fixed inset-0 bg-black/78" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-24">
          <div className="max-w-4xl">
            <div className="mb-6 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Performance Readiness</div>
            <h1 className="max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-2.5px] text-white sm:text-6xl">Measure readiness before AI hides the gap.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-neutral-400">Choose the workspace capacity you need to turn think-aloud practice into evidence of judgment, adaptability, and skill. Training completion is not performance readiness.</p>
          </div>

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const current = user?.authenticated && user.plan === plan.id;
              const volumeOptions = "volumes" in plan && Array.isArray(plan.volumes) ? plan.volumes : [];
              const selectedVolume = volumeOptions.find((option) => option.blocks === selectedVolumes[plan.id]) || volumeOptions[0] || null;
              return (
                <div key={plan.id} className={`border bg-neutral-950/80 p-6 backdrop-blur-sm ${plan.featured ? "border-neutral-500" : "border-neutral-800"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-medium text-white">{plan.name}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-500">{plan.description}</p>
                    </div>
                    {plan.featured && <span className="border border-neutral-700 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-400">Popular</span>}
                  </div>
                  <div className="mt-8 flex items-baseline gap-2">
                    <span className="text-4xl font-medium text-white">{selectedVolume ? `$${selectedVolume.price}` : plan.price}</span>
                    <span className="text-sm text-neutral-500">{plan.detail}</span>
                  </div>
                  {volumeOptions.length > 0 && (
                    <div className="mt-5 grid gap-2">
                      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">Monthly volume</div>
                      <div className="grid gap-2">
                        {volumeOptions.map((option) => {
                          const selected = selectedVolumes[plan.id] === option.blocks;
                          return (
                            <button
                              key={option.blocks}
                              type="button"
                              onClick={() => setSelectedVolumes((current) => ({ ...current, [plan.id]: option.blocks }))}
                              className={`flex items-center justify-between rounded-sm border px-3 py-2 text-left transition ${selected ? "border-white bg-white text-black" : "border-neutral-800 bg-black/40 text-neutral-300 hover:border-neutral-600"}`}
                            >
                              <span>
                                <span className="block text-sm font-medium">{option.blocks.toLocaleString()} blocks/mo</span>
                                <span className={`block text-[11px] ${selected ? "text-black/60" : "text-neutral-500"}`}>{option.note}</span>
                              </span>
                              <span className="text-sm font-medium">${option.price}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <ul className="mt-8 space-y-3 text-sm text-neutral-400">
                    {plan.features.map((feature) => <li key={feature} className="border-t border-neutral-800 pt-3">{feature}</li>)}
                  </ul>
                  {current ? (
                    <div className="mt-8 rounded-sm border border-neutral-800 px-4 py-3 text-center text-sm text-neutral-500">Current plan</div>
                  ) : plan.checkout ? (
                    <button onClick={() => handleCheckout(plan.checkout)} disabled={loadingPlan === plan.checkout} className="mt-8 w-full rounded-sm bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50">
                      {loadingPlan === plan.checkout ? "Loading..." : plan.id === "pro_teams" ? `Start Teams (${selectedVolumes.pro_teams}/mo) →` : `Start Regular (${selectedVolumes.regular_2026}/mo) →`}
                    </button>
                  ) : !user?.authenticated ? (
                    <Link href="/register" className="mt-8 block rounded-sm bg-neutral-800 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-neutral-700">Get started →</Link>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-8 border border-neutral-800 bg-neutral-950/80 p-6 backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">Need more capacity?</div>
              <h2 className="text-2xl font-medium text-white">Additional blocks are $3.99 each, or $1.99 on Pro / Teams.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">Use them when a team needs more practice. Purchased blocks add to the current plan allowance.</p>
            </div>
            <div className="mt-6 grid gap-3 sm:mt-0 sm:min-w-[260px]">
              <label className="text-xs font-medium uppercase tracking-[1.5px] text-neutral-500" htmlFor="extra-lessons">Blocks to add</label>
              <input
                id="extra-lessons"
                type="number"
                min="1"
                max="500"
                value={extraLessonQuantity}
                onChange={(event) => setExtraLessonQuantity(Math.max(1, Math.min(500, Number(event.target.value) || 1)))}
                className="rounded-sm border border-neutral-800 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-neutral-500"
              />
              <button onClick={() => handleCheckout("extra_lesson", extraLessonQuantity)} disabled={loadingPlan === "extra_lesson"} className="w-full rounded-sm bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50">
                {loadingPlan === "extra_lesson" ? "Loading..." : `Buy ${extraLessonQuantity} block${extraLessonQuantity === 1 ? "" : "s"} →`}
              </button>
            </div>
          </div>

        </section>
        <Footer />
      </div>
    </main>
  );
}
