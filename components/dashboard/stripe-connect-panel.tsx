"use client";

import { useEffect, useState } from "react";

export function StripeConnectPanel() {
  const [status, setStatus] = useState<{
    connected: boolean;
    chargesEnabled: boolean;
    accountId: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stripe/connect/status")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.connected === "boolean") {
          setStatus({
            connected: data.connected,
            chargesEnabled: Boolean(data.chargesEnabled),
            accountId: data.accountId ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error?.message || "Could not start Stripe Connect");
    } catch {
      setError("Could not start Stripe Connect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="console-copy rounded-none p-5 sm:p-6" data-aycl-stripe-connect>
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
        AYCL Shop payouts
      </p>
      <h3 className="mt-2 text-xl font-medium text-white">Connect Stripe</h3>
      <p className="mt-2 text-sm text-neutral-500">
        Connect your Stripe account to receive payouts from All You Can Learn maps you list.
      </p>
      <p className="mt-3 text-sm text-neutral-300">
        {status?.chargesEnabled
          ? "Connected and ready for payouts."
          : status?.connected
            ? "Onboarding started. Finish Stripe Connect to receive payouts."
            : "Not connected."}
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="mt-4 rounded-none border border-neutral-600 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-400 disabled:opacity-50"
      >
        {busy ? "Loading..." : status?.chargesEnabled ? "Manage Stripe account" : "Connect Stripe"}
      </button>
    </section>
  );
}
