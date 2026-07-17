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

function extractInviteToken(searchParams: URLSearchParams): string | null {
  const direct = searchParams.get("inviteToken") || searchParams.get("invite");
  if (direct?.trim()) return direct.trim();

  const returnUrl = searchParams.get("returnUrl");
  if (!returnUrl) return null;
  try {
    const path = returnUrl.startsWith("http")
      ? new URL(returnUrl).pathname
      : returnUrl.split("?")[0];
    const match = path.match(/^\/invite\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [checkout, setCheckout] = useState<VerifiedCheckout | null>(null);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const sessionId = searchParams.get("session_id");
  const inviteToken = extractInviteToken(searchParams);
  const invitePath = inviteToken ? `/invite/${inviteToken}` : null;

  useEffect(() => {
    if (inviteToken) {
      setVerifying(false);
      setInviteLoading(true);
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(`/api/invite/accept?token=${encodeURIComponent(inviteToken)}`);
          const data = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setError(data.error || "Invalid invite link");
            return;
          }
          if (data.invite?.organization?.name) {
            setInviteOrgName(data.invite.organization.name);
          }
          if (data.invite?.is_used) {
            setError("This invite has already been used. Sign in instead.");
          } else {
            setError(null);
          }
        } catch {
          if (!cancelled) setError("Failed to load invite details");
        } finally {
          if (!cancelled) setInviteLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
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
  }, [sessionId, inviteToken, router]);

  const handleInviteRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken,
          email: email.trim(),
          password,
        }),
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
        email: data.email || email.trim(),
        password,
      });

      if (signInError) {
        setError("Account created but sign-in failed. Please log in.");
        router.push(`/login?redirect=${encodeURIComponent(invitePath || "/dashboard")}`);
        return;
      }

      trackSignupCompleted({ hasReferral: false });

      if (data.joined) {
        router.push("/dashboard");
      } else {
        // Join failed server-side; land on invite page to retry accept.
        router.push(invitePath || "/dashboard");
      }
      router.refresh();
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

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

  // ── Invite signup ──────────────────────────────────────────────────────────
  if (inviteToken) {
    if (inviteLoading) {
      return (
        <div className="animate-pulse space-y-3.5">
          <div className="h-10 bg-neutral-800 rounded-xl" />
          <div className="h-10 bg-neutral-800 rounded-xl" />
          <div className="h-10 bg-neutral-800 rounded-xl" />
        </div>
      );
    }

    return (
      <>
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
            Organization invite
          </p>
          <p className="mt-1 text-sm text-neutral-300">
            {inviteOrgName
              ? `Create an account to join ${inviteOrgName}. No payment required — you'll use the organization's plan.`
              : "Create an account to accept this organization invite. No payment required."}
          </p>
        </div>

        <form onSubmit={handleInviteRegister} className="space-y-3.5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[11px] uppercase tracking-wider text-neutral-500"
            >
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-neutral-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[11px] uppercase tracking-wider text-neutral-500"
            >
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-neutral-600 focus:outline-none"
              minLength={6}
              required
            />
            <p className="mt-1 text-[11px] text-neutral-600">At least 6 characters</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
              {error}
              {(error.includes("already exists") || error.includes("already been used")) && (
                <span>
                  {" "}
                  <Link
                    href={`/login?redirect=${encodeURIComponent(invitePath || "/dashboard")}`}
                    className="underline"
                  >
                    Sign in
                  </Link>
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!error?.toLowerCase().includes("invalid invite")}
            className="mt-2 w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600"
          >
            {loading ? t("auth.creatingAccount") : "Create account & join →"}
          </button>
        </form>
      </>
    );
  }

  // ── Paid checkout signup ───────────────────────────────────────────────────
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
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          {error || "Payment required before creating an account."}
        </div>
        <Link
          href="/pricing"
          className="block w-full rounded-xl bg-white py-2.5 text-center text-sm font-medium text-black transition-colors hover:bg-neutral-200"
        >
          View plans
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <p className="text-sm text-emerald-400">
          Payment confirmed — {tierLabel(checkout.plan)}. Create your password to finish setup.
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-3.5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[11px] uppercase tracking-wider text-neutral-500"
          >
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            value={checkout.email}
            readOnly
            className="w-full cursor-not-allowed rounded-xl border border-neutral-800 bg-neutral-900/50 px-3.5 py-2.5 text-sm text-neutral-400"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[11px] uppercase tracking-wider text-neutral-500"
          >
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-neutral-600 focus:outline-none"
            minLength={6}
            required
            disabled={!checkout.claimable}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
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
          className="mt-2 w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600"
        >
          {loading ? t("auth.creatingAccount") : "Create account →"}
        </button>
      </form>
    </>
  );
}

function RegisterShell() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const inviteToken = extractInviteToken(searchParams);
  const invitePath = inviteToken ? `/invite/${inviteToken}` : null;

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0a]">
      <Navbar showNav={false} />

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h2 className="mb-1 text-xl font-semibold text-white">{t("auth.createAccount")}</h2>
          <p className="mb-8 text-sm text-neutral-500">
            {inviteToken
              ? "Set your email and password to join the organization."
              : "You've paid — set a password to activate your account."}
          </p>
          <RegisterForm />

          <p className="mt-6 text-center text-xs text-neutral-600">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link
              href={
                invitePath
                  ? `/login?redirect=${encodeURIComponent(invitePath)}`
                  : "/login"
              }
              className="text-neutral-400 transition-colors hover:text-white"
            >
              {t("auth.signInLink")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  const { t } = useI18n();

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col bg-[#0a0a0a]">
          <Navbar showNav={false} />
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="w-full max-w-sm">
              <h2 className="mb-1 text-xl font-semibold text-white">{t("auth.createAccount")}</h2>
              <p className="mb-8 text-sm text-neutral-500">Loading…</p>
              <div className="animate-pulse space-y-3.5">
                <div className="h-10 rounded-xl bg-neutral-800" />
                <div className="h-10 rounded-xl bg-neutral-800" />
              </div>
            </div>
          </div>
        </main>
      }
    >
      <RegisterShell />
    </Suspense>
  );
}
