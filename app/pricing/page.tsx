"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingNav } from "@/components/LandingNav";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { hasProductAccess, type PlanId } from "@/lib/plans";
import { HARNESS_PRICING_COPY } from "@/lib/pricing/harness-copy";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

type PricingPlanId = "trial_3day" | "api_metered";

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

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
        <section className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 sm:py-20">
          <div className="mb-8 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            {HARNESS_PRICING_COPY.eyebrow}
          </div>
          <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
            Learning Harness pricing
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            {HARNESS_PRICING_COPY.lead}
          </p>
          <Link
            href={HARNESS_PRICING_COPY.ayclHref}
            data-testid="pricing-aycl-link"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            {HARNESS_PRICING_COPY.ayclCta}
            <span className="ml-2 font-normal text-neutral-700">{HARNESS_PRICING_COPY.ayclLabel}</span>
            <ArrowRight className="ml-2" size={16} />
          </Link>
          {needsPlan && (
            <div className="mt-6 rounded-sm border border-neutral-600/30 bg-neutral-800/10 px-4 py-3 text-sm text-neutral-200">
              Choose a plan to continue. Start the Learning Harness or try unlimited for 3 days for $14.99.
            </div>
          )}

          <div
            data-testid="pricing-layout"
            className="mt-10 w-full"
          >
            <div
              data-testid="pricing-plans"
              className="w-full border border-neutral-500 bg-neutral-950/80 p-5 backdrop-blur-sm sm:p-8"
            >
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                {HARNESS_PRICING_COPY.monthlyLabel}
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-3xl">
                  <h2 className="text-2xl font-medium text-white">Learning Harness</h2>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                    {HARNESS_PRICING_COPY.monthlyBody}
                  </p>
                </div>
                <span className="border border-neutral-600/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300/90">
                  $24.99 / mo
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-medium tracking-[-1px] text-white">$24.99</span>
                <span className="text-sm text-neutral-500">/ month</span>
              </div>

              <ul className="mt-6 grid gap-2 sm:grid-cols-2 sm:gap-x-8">
                {HARNESS_PRICING_COPY.features.map((feature) => (
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
                    data-testid="checkout-start-harness"
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
                      : "Try unlimited for 3 days for $14.99"}
                  </button>
                )}
              </div>

              <p className="mt-4 text-xs text-neutral-600">
                Public registration on this page is for the Learning Harness only. Knowledge Verification
                is a separate enterprise product.
              </p>
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
