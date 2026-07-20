"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

type ConsentDetails = {
  client_name: string;
  scopes: string[];
  resource: string;
};

export default function OAuthConsentPage() {
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/oauth/consent/details")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Unable to load authorization request");
        }
        return res.json();
      })
      .then((data) => setDetails(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  const handleDecision = async (decision: "approve" | "deny") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errObj = data?.error;
        const message =
          typeof errObj === "object" && errObj && typeof errObj.message === "string"
            ? errObj.message
            : typeof data.message === "string"
              ? data.message
              : typeof errObj === "string"
                ? errObj
                : "Authorization failed";
        throw new Error(message);
      }
      if (data.redirect_to) {
        window.location.href = data.redirect_to;
        return;
      }
      throw new Error("Missing redirect");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-neutral-200">
      <Navbar showNav={false} />
      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-xl items-center px-6 py-16">
        <div className="w-full rounded-md border border-neutral-800 bg-neutral-950/80 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">MCP OAuth</p>
          <h1 className="mt-3 text-2xl font-medium text-white">Authorize MCP access</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            An MCP client is requesting access to your Uncertain Systems Proof-of-Work API through OAuth.
          </p>

          {error && (
            <p className="mt-4 rounded-sm border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {details && (
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <p className="text-neutral-500">Client</p>
                <p className="mt-1 text-white">{details.client_name}</p>
              </div>
              <div>
                <p className="text-neutral-500">Resource</p>
                <p className="mt-1 break-all text-neutral-300">{details.resource}</p>
              </div>
              <div>
                <p className="text-neutral-500">Requested scopes</p>
                <ul className="mt-2 space-y-1">
                  {details.scopes.map((scope) => (
                    <li key={scope} className="rounded-sm border border-neutral-800 px-3 py-2 text-neutral-300">
                      {scope}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!details || busy}
              onClick={() => handleDecision("approve")}
              className="rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
            >
              Allow access
            </button>
            <button
              type="button"
              disabled={!details || busy}
              onClick={() => handleDecision("deny")}
              className="rounded-sm border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
            >
              Deny
            </button>
            <Link href="/dashboard" className="px-2 py-2 text-sm text-neutral-500 transition hover:text-white">
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}