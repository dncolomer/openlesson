"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { trackSignupCompleted } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";
import { tierLabel } from "@/lib/admin/tiers";

interface VerifiedCheckout {
  email: string;
  plan: string;
  priceType: string;
  claimable: boolean;
  claimed: boolean;
  periodEnd: string | null;
}

function RegisterForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [checkout, setCheckout] = useState<VerifiedCheckout | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const sessionId = searchParams.get("session_id");
  const inviteReturnUrl = searchParams.get("returnUrl");

  useEffect(() => {
    if (inviteReturnUrl?.startsWith("/invite/")) {
      setVerifying(false);
      return;
    }

    if (!sessionId) {
      router.replace("/pricing");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) {
            setError(data.error || "Invalid checkout session");
            setVerifying(false);
          }
          return;
        }
        if (!cancelled) {
          setCheckout(data);
          if (data.claimed) {
            setError("This checkout has already been used. Sign in to continue.");
          } else if (!data.claimable) {
            setError("This checkout is no longer available.");
          }
          setVerifying(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not verify payment. Try again from pricing.");
          setVerifying(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, inviteReturnUrl, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !checkout?.claimable) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "email_exists") {
          setError("An account with this email already exists.");
        } else {
          setError(data.error || t("common.error"));
        }
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: checkout.email,
        password,
      });

      if (signInError) {
        setError("Account created but sign-in failed. Please log in.");
        router.push(`/login?redirect=${encodeURIComponent("/dashboard")}`);
        return;
      }

      trackSignupCompleted({ hasReferral: false });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (inviteReturnUrl?.startsWith("/invite/")) {
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-100 text-sm">
        Organization invites use a separate flow.{" "}
        <Link href={inviteReturnUrl} className="underline">
          Return to your invite
        </Link>{" "}
        and sign in, or choose a plan on{" "}
        <Link href="/pricing" className="underline">
          pricing
        </Link>
        .
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="animate-pulse space-y-3.5">
        <div className="h-10 bg-neutral-800 rounded-xl" />
        <div className="h-10 bg-neutral-800 rounded-xl" />
        <div className="h-10 bg-neutral-800 rounded-xl" />
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-xs">
          {error || "Payment required before creating an account."}
        </div>
        <Link
          href="/pricing"
          className="block w-full py-2.5 text-center bg-white hover:bg-neutral-200 text-black text-sm font-medium rounded-xl transition-colors"
        >
          View plans
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <p className="text-sm text-emerald-400">
          Payment confirmed — {tierLabel(checkout.plan)}. Create your password to finish setup.
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-3.5">
        <div>
          <label htmlFor="email" className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            value={checkout.email}
            readOnly
            className="w-full px-3.5 py-2.5 bg-neutral-900/50 border border-neutral-800 rounded-xl text-neutral-400 text-sm cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-neutral-600 transition-colors"
            minLength={6}
            required
            disabled={!checkout.claimable}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {error}
            {error.includes("already exists") && (
              <span>
                {" "}
                <Link href="/login" className="underline">
                  Sign in
                </Link>
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !checkout.claimable}
          className="w-full py-2.5 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-sm font-medium rounded-xl transition-colors mt-2"
        >
          {loading ? t("auth.creatingAccount") : "Create account →"}
        </button>
      </form>
    </>
  );
}

export default function RegisterPage() {
  const { t } = useI18n();

  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
          <Navbar showNav={false} />
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
              <h2 className="text-xl font-semibold text-white mb-1">{t("auth.createAccount")}</h2>
              <p className="text-sm text-neutral-500 mb-8">Confirming your payment…</p>
              <div className="animate-pulse space-y-3.5">
                <div className="h-10 bg-neutral-800 rounded-xl" />
                <div className="h-10 bg-neutral-800 rounded-xl" />
              </div>
            </div>
          </div>
        </main>
      }
    >
      <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
        <Navbar showNav={false} />

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <h2 className="text-xl font-semibold text-white mb-1">{t("auth.createAccount")}</h2>
            <p className="text-sm text-neutral-500 mb-8">
              You&apos;ve paid — set a password to activate your account.
            </p>
            <RegisterForm />

            <p className="text-center text-xs text-neutral-600 mt-6">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="text-neutral-400 hover:text-white transition-colors">
                {t("auth.signInLink")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </Suspense>
  );
}