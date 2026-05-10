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
    description: "Try Open Lesson and get a feel for think-aloud learning.",
    features: ["1 session", "Basic learning report", "Start with any topic"],
  },
  {
    id: "regular" as const,
    name: "Regular",
    price: "$4.99",
    detail: "/mo",
    description: "For learners who want steady plans and follow-through.",
    features: ["5 sessions per month", "File uploads", "Plan history", "Adaptive learning paths"],
    checkout: "regular" as const,
    featured: true,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$14.99",
    detail: "/mo",
    description: "For serious learning across codebases, videos, math, and more.",
    features: ["Unlimited sessions", "Priority support", "Uploads and history", "Agent API access"],
    checkout: "pro" as const,
  },
];

export default function PricingPage() {
  const [user, setUser] = useState<UserState | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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

  const handleCheckout = async (priceType: "regular" | "pro" | "extra_lesson") => {
    if (!user?.authenticated) {
      window.location.href = "/login?redirect=/pricing";
      return;
    }
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
            <div className="mb-6 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Upgrade</div>
            <h1 className="max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-2.5px] text-white sm:text-6xl">More aha moments. Less friction.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-neutral-400">Choose the amount of guided think-aloud learning you want. Keep the interface quiet, the plan clear, and the learning moving.</p>
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
                      {loadingPlan === plan.checkout ? "Loading..." : "Upgrade →"}
                    </button>
                  ) : !user?.authenticated ? (
                    <Link href="/register" className="mt-8 block rounded-sm bg-neutral-800 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-neutral-700">Get started →</Link>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-8 border border-neutral-800 bg-neutral-950/80 p-6 backdrop-blur-sm lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div>
              <div className="mb-4 inline-block border border-neutral-800 bg-black/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                $UNSYS Option
              </div>
              <h2 className="text-2xl font-medium text-white">Stake $UNSYS for access.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
                Prefer crypto-native access? Stake $UNSYS once and unlock recurring Open Lesson benefits based on your tier.
              </p>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-400 lg:mt-0 lg:min-w-[360px]">
              <div className="flex justify-between border-t border-neutral-800 pt-3">
                <span>1M $UNSYS</span>
                <span className="text-neutral-300">Regular discount</span>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-3">
                <span>2M $UNSYS</span>
                <span className="text-neutral-300">Regular access</span>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-3">
                <span>5M $UNSYS</span>
                <span className="text-neutral-300">Pro access</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 lg:mt-0 lg:w-[220px]">
              <a
                href="https://pump.fun/coin/Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm bg-white px-4 py-3 text-center text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                Buy $UNSYS →
              </a>
              <a
                href="https://uncertain.systems/investors"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm border border-neutral-700 px-4 py-3 text-center text-xs font-medium text-neutral-400 transition hover:border-neutral-500 hover:text-white"
              >
                Become a partner
              </a>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    </main>
  );
}
