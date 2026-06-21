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

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    detail: "forever",
    description: "Explore think-aloud practice before you roll it into real work.",
    features: ["1 starter session", "Basic readiness report", "Start with any topic or scenario"],
  },
  {
    id: "regular_2026" as const,
    name: "Regular",
    price: "$29.99",
    detail: "/mo",
    description: "For individuals and operators who need recurring evidence of real capability, not polished AI-assisted output.",
    features: ["10 sessions per month", "File uploads for workplace context", "Readiness history and reports", "Additional lessons: $4.99 each"],
    checkout: "regular_2026" as const,
    featured: true,
  },
  {
    id: "pro_teams" as const,
    name: "Pro / Teams",
    price: "$499",
    detail: "/mo",
    description: "For teams turning AI-assisted practice into verifiable readiness evidence across critical roles and decisions.",
    features: ["100 lessons per month", "Performance Workspaces for team scenarios", "Readiness evidence and team history", "Additional lessons: $2.99 each", "Priority support"],
    checkout: "pro_teams" as const,
  },
];

export default function PricingPage() {
  const [user, setUser] = useState<UserState | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [extraLessonQuantity, setExtraLessonQuantity] = useState(5);

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
        body: JSON.stringify({ priceType, quantity }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.error) alert("Failed to create checkout: " + data.error);
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to create checkout session. Please try again.");
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
                    <span className="text-4xl font-medium text-white">{plan.price}</span>
                    <span className="text-sm text-neutral-500">{plan.detail}</span>
                  </div>
                  <ul className="mt-8 space-y-3 text-sm text-neutral-400">
                    {plan.features.map((feature) => <li key={feature} className="border-t border-neutral-800 pt-3">{feature}</li>)}
                  </ul>
                  {current ? (
                    <div className="mt-8 rounded-sm border border-neutral-800 px-4 py-3 text-center text-sm text-neutral-500">Current plan</div>
                  ) : plan.checkout ? (
                    <button onClick={() => handleCheckout(plan.checkout)} disabled={loadingPlan === plan.checkout} className="mt-8 w-full rounded-sm bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50">
                      {loadingPlan === plan.checkout ? "Loading..." : plan.id === "pro_teams" ? "Start Pro / Teams →" : "Start Regular →"}
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
              <h2 className="text-2xl font-medium text-white">Additional lessons are $4.99 each, or $2.99 on Pro / Teams.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">Use them when a team needs more practice. Purchased lessons add to the current plan allowance.</p>
            </div>
            <div className="mt-6 grid gap-3 sm:mt-0 sm:min-w-[260px]">
              <label className="text-xs font-medium uppercase tracking-[1.5px] text-neutral-500" htmlFor="extra-lessons">Lessons to add</label>
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
                {loadingPlan === "extra_lesson" ? "Loading..." : `Buy ${extraLessonQuantity} lesson${extraLessonQuantity === 1 ? "" : "s"} →`}
              </button>
            </div>
          </div>

        </section>
        <Footer />
      </div>
    </main>
  );
}
