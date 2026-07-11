"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { trackSignupCompleted } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";

function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralPartner, setReferralPartner] = useState<{ username: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
      fetch(`/api/referral/register?code=${encodeURIComponent(ref)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.username) {
            setReferralPartner({ username: data.username });
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,

      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // If there was a referral code, link it after registration
      if (referralCode) {
        try {
          // Wait a moment for profile to be created
          await new Promise((resolve) => setTimeout(resolve, 1000));
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await fetch("/api/referral/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ referralCode, userId: user.id }),
            });
          }
        } catch (err) {
          console.error("Failed to link referral:", err);
        }
      }

      trackSignupCompleted({ hasReferral: Boolean(referralCode) });
      router.push("/pricing?required=1");
      router.refresh();
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar showNav={false} />

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold text-white mb-1">{t('auth.createAccount')}</h2>
          <p className="text-sm text-neutral-500 mb-8">{t('auth.registerSubtitle')}</p>

          {referralPartner ? (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <p className="text-sm text-emerald-400">
                {t('auth.referralMessage', { username: referralPartner.username })}
              </p>
            </div>
          ) : referralCode ? (
            <div className="mb-4 p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <p className="text-sm text-neutral-400">
                {t('auth.referralFallback')}
              </p>
            </div>
          ) : null}

          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label htmlFor="email" className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-neutral-600 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-neutral-600 transition-colors"
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-sm font-medium rounded-xl transition-colors mt-2"
            >
              {loading ? t('auth.creatingAccount') : t('auth.createAccountBtn')}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-600 mt-6">
            {t('auth.alreadyHaveAccount')}{" "}
            <Link href="/login" className="text-neutral-400 hover:text-white transition-colors">
              {t('auth.signInLink')}
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
    <Suspense fallback={
      <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
        <Navbar showNav={false} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <h2 className="text-xl font-semibold text-white mb-1">{t('auth.createAccount')}</h2>
            <p className="text-sm text-neutral-500 mb-8">{t('auth.registerSubtitle')}</p>
            <div className="animate-pulse space-y-3.5">
              <div className="h-10 bg-neutral-800 rounded-xl" />
              <div className="h-10 bg-neutral-800 rounded-xl" />
              <div className="h-10 bg-neutral-800 rounded-xl" />
              <div className="h-10 bg-neutral-800 rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  );
}
