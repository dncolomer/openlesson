"use client";

import { useCallback, useState } from "react";
import {
  AYCL_TOKEN_STORAGE_KEY,
  AYCL_UPGRADE_PRICE_LABEL,
} from "@/lib/aycl-shared";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

export function useWorkspaceChrome(input: {
  ayclToken?: string;
  workspaceId: string;
}) {
  const { ayclToken, workspaceId } = input;
  const [ayclUpgradeBusy, setAyclUpgradeBusy] = useState(false);
  const [ayclUpgradePriceLabel, setAyclUpgradePriceLabel] = useState<string>(
    AYCL_UPGRADE_PRICE_LABEL,
  );

  const startAyclUpgradeCheckout = useCallback(async () => {
    if (!ayclToken || ayclUpgradeBusy) return;
    setAyclUpgradeBusy(true);
    try {
      // Success page rebuilds /learn/{token} from sessionStorage after Stripe.
      try {
        sessionStorage.setItem(AYCL_TOKEN_STORAGE_KEY, ayclToken);
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceType: "all_you_can_learn",
          ayclToken,
          // Optional; server resolves source workspace from the purchase.
          ...(workspaceId ? { workspaceId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(errorMessageFromBody(data, "Upgrade checkout failed"));
      }
      // Echo token if server returns it (upgrade reuses same access token).
      if (typeof data.ayclAccessToken === "string" && data.ayclAccessToken) {
        try {
          sessionStorage.setItem(AYCL_TOKEN_STORAGE_KEY, data.ayclAccessToken);
        } catch {
          /* ignore */
        }
      }
      window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upgrade checkout failed");
      setAyclUpgradeBusy(false);
    }
  }, [ayclToken, ayclUpgradeBusy, workspaceId]);

  return {
    ayclUpgradeBusy,
    ayclUpgradePriceLabel,
    setAyclUpgradePriceLabel,
    startAyclUpgradeCheckout,
  };
}
