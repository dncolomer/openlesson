"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasProductAccess, type PlanId } from "@/lib/plans";
import type { ModuleSkuId } from "@/lib/pricing/modules";

export interface PricingUserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

export function usePricingCheckout() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<PricingUserState | null>(null);
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

  const currentPlan = user?.plan ?? "inactive";
  const isOnTrial = Boolean(user?.authenticated && currentPlan === "trial");

  return { user, needsPlan, loadingPlan, handleCheckout, currentPlan, isOnTrial };
}
