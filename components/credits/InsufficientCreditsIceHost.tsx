"use client";

import { useEffect, useState } from "react";
import { InsufficientCreditsIceScreen } from "@/components/credits/InsufficientCreditsIceScreen";
import {
  INSUFFICIENT_CREDITS_EVENT,
  installInsufficientCreditsFetchGuard,
} from "@/lib/credits/insufficient";
import { createClient } from "@/lib/supabase/client";

/**
 * Global out-of-credits ice. Any 402 `insufficient_credits` fetch opens it.
 * Guests also get Create an account; signed-in runners go to pricing.
 */
export function InsufficientCreditsIceHost() {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState(true);

  useEffect(() => {
    installInsufficientCreditsFetchGuard();
    const onOpen = () => setOpen(true);
    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, onOpen);
    return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setGuest(!data.user);
      })
      .catch(() => {
        if (!cancelled) setGuest(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;
  return <InsufficientCreditsIceScreen guest={guest} overlay />;
}
