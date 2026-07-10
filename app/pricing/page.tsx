"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  EVIDENCE_SUBMISSIONS_PER_SESSION,
  REGULAR_VOLUME_TIERS,
  TEAM_VOLUME_TIERS,
  DEFAULT_REGULAR_VOLUME,
  DEFAULT_TEAM_VOLUME,
  type PlanId,
} from "@/lib/plans";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const REGULAR_VOLUME_NOTES: Record<number, string> = {
  25: "Solo operator",
  50: "Heavy practice",
  100: "Small cohort",
};

const TEAM_VOLUME_NOTES: Record<number, string> = {
  250: "Pilot team",
  500: "Department",
  1000: "Scaled rollout",
  2500: "Enterprise",
};

const REGULAR_VOLUMES = REGULAR_VOLUME_TIERS.map((tier) => ({
  sessions: tier.blocks,
  evidence: tier.blocks * EVIDENCE_SUBMISSIONS_PER_SESSION,
  workspaces: tier.workspaces,
  price: tier.priceCents / 100,
  note: REGULAR_VOLUME_NOTES[tier.blocks] || "",
}));

const TEAM_VOLUMES = TEAM_VOLUME_TIERS.map((tier) => ({
  sessions: tier.blocks,
  evidence: tier.blocks * EVIDENCE_SUBMISSIONS_PER_SESSION,
  workspaces: tier.workspaces,
  price: tier.priceCents / 100,
  note: TEAM_VOLUME_NOTES[tier.blocks] || "",
}));

const PLANS = [
  {
    id: "regular_2026" as const,
    name: "Individual",
    detail: "from /mo",
    description: "For individuals optimizing learning-to-conversion. Recurring TAP / ILE practice with capped Evidence API throughput.",
    features: [
      "25+ TAP / ILE sessions per month",
      "100+ Evidence API submissions/mo",
      "1+ Workspaces",
      "Readiness history and reports",
    ],
    checkout: "regular_2026" as const,
    volumes: REGULAR_VOLUMES,
    featured: true,
  },
  {
    id: "pro_teams" as const,
    name: "Pro / Teams",
    detail: "from /mo",
    description: "For teams raising the ROI of learning across humans and agents — shared session pool plus Evidence API capacity.",
    features: [
      "250+ shared TAP / ILE sessions per month",
      "1,000+ Evidence API submissions/mo",
      "5+ Workspaces",
      "Org guests and team API keys",
      "Priority support",
    ],
    checkout: "pro_teams" as const,
    volumes: TEAM_VOLUMES,
  },
];

function formatTierPrice(price: number) {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

type VolumeCapacityCardProps = {
  selected: boolean;
  note: string;
  price: number;
  sessions: number;
  evidence: number;
  workspaces: number;
  onSelect: () => void;
};

function VolumeCapacityCard({
  selected,
  note,
  price,
  sessions,
  evidence,
  workspaces,
  onSelect,
}: VolumeCapacityCardProps) {
  const muted = selected ? "text-black/55" : "text-neutral-500";
  const value = selected ? "text-black" : "text-white";
  const divider = selected ? "border-black/10" : "border-neutral-800";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-sm border p-4 text-left transition sm:p-5 ${
        selected
          ? "border-white bg-white text-black"
          : "border-neutral-800 bg-black/40 text-neutral-300 hover:border-neutral-600"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-[1.4px] ${muted}`}>Tier</p>
          <p className={`mt-1 text-sm font-medium ${value}`}>{note || "Standard"}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-medium leading-none tracking-[-0.5px] ${value}`}>
            {formatTierPrice(price)}
          </p>
          <p className={`mt-1 text-xs ${muted}`}>/ month</p>
        </div>
      </div>

      <div className={`mt-4 space-y-3 border-t pt-4 ${divider}`}>
        <CapacityRow
          label="TAP / ILE sessions"
          value={sessions.toLocaleString()}
          suffix="/ mo"
          selected={selected}
        />
        <CapacityRow
          label="Evidence API submissions"
          value={evidence.toLocaleString()}
          suffix="/ mo"
          selected={selected}
        />
        <CapacityRow
          label="Workspaces"
          value={workspaces.toLocaleString()}
          selected={selected}
        />
      </div>
    </button>
  );
}

function CapacityRow({
  label,
  value,
  suffix,
  selected,
}: {
  label: string;
  value: string;
  suffix?: string;
  selected: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`text-sm leading-snug ${selected ? "text-black/70" : "text-neutral-400"}`}>{label}</span>
      <span className={`shrink-0 text-right text-sm font-medium tabular-nums ${selected ? "text-black" : "text-white"}`}>
        {value}
        {suffix ? <span className={`font-normal ${selected ? "text-black/50" : "text-neutral-500"}`}> {suffix}</span> : null}
      </span>
    </div>
  );
}

export default function PricingPage() {
  const [user, setUser] = useState<UserState | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [selectedVolumes, setSelectedVolumes] = useState<Record<string, number>>({
    regular_2026: DEFAULT_REGULAR_VOLUME,
    pro_teams: DEFAULT_TEAM_VOLUME,
  });

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

  const handleCheckout = async (priceType: "regular_2026" | "pro_teams") => {
    if (!user?.authenticated) {
      window.location.href = "/login?redirect=/pricing";
      return;
    }
    setLoadingPlan(priceType);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType, monthlyVolume: selectedVolumes[priceType] }),
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
            <div className="mb-6 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">LEARNING EFFICIENCY • HUMANS & AGENTS</div>
            <h1 className="max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-2.5px] text-white sm:text-6xl">Price learning efficiency, not completion.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-neutral-400">
              Plans meter combined TAP / ILE sessions and monthly Evidence API submissions — so you pay for learning throughput and conversion signal, not vanity block counts.
            </p>
          </div>

          <div className="mt-16 grid gap-5 lg:grid-cols-2">
            {PLANS.map((plan) => {
              const current = user?.authenticated && user.plan === plan.id;
              const volumeOptions = "volumes" in plan && Array.isArray(plan.volumes) ? plan.volumes : [];
              const selectedVolume = volumeOptions.find((option) => option.sessions === selectedVolumes[plan.id]) || volumeOptions[0] || null;
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
                    <span className="text-4xl font-medium text-white">
                      {formatTierPrice((selectedVolume ?? volumeOptions[0])?.price ?? 0)}
                    </span>
                    <span className="text-sm text-neutral-500">{plan.detail}</span>
                  </div>
                  {volumeOptions.length > 0 && (
                    <div className="mt-5 grid gap-3">
                      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">Monthly capacity</div>
                      <div className="grid gap-3">
                        {volumeOptions.map((option) => {
                          const selected = selectedVolumes[plan.id] === option.sessions;
                          return (
                            <VolumeCapacityCard
                              key={option.sessions}
                              selected={selected}
                              note={option.note}
                              price={option.price}
                              sessions={option.sessions}
                              evidence={option.evidence}
                              workspaces={option.workspaces}
                              onSelect={() =>
                                setSelectedVolumes((current) => ({ ...current, [plan.id]: option.sessions }))
                              }
                            />
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
                      {loadingPlan === plan.checkout
                        ? "Loading..."
                        : plan.id === "pro_teams"
                          ? `Start Teams (${selectedVolume?.sessions ?? selectedVolumes.pro_teams} sessions · ${selectedVolume?.workspaces ?? 1} ws) →`
                          : `Start Individual (${selectedVolume?.sessions ?? selectedVolumes.regular_2026} sessions · ${selectedVolume?.workspaces ?? 1} ws) →`}
                    </button>
                  ) : !user?.authenticated ? (
                    <Link href="/register" className="mt-8 block rounded-sm bg-neutral-800 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-neutral-700">Get started →</Link>
                  ) : null}
                </div>
              );
            })}
          </div>

        </section>
        <Footer />
      </div>
    </main>
  );
}