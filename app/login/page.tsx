"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      const redirectTo = searchParams.get("redirect") || "/dashboard";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    setError(null);
    setMessage(null);

    if (!email) {
      setError(t('auth.enterEmailForRecovery'));
      return;
    }

    setRecoveryLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setMessage(t('auth.recoveryEmailSent'));
    } catch {
      setError(t('common.error'));
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleMagicLink = async () => {
    setError(null);
    setMessage(null);

    if (!email) {
      setError(t('auth.enterEmailForMagicLink'));
      return;
    }

    setMagicLinkLoading(true);

    try {
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", redirectTo);

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setMessage(t('auth.magicLinkSent'));
    } catch {
      setError(t('common.error'));
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-xl font-semibold text-white mb-1">{t('auth.welcomeBack')}</h2>
      <p className="text-sm text-neutral-500 mb-8">{t('auth.signInSubtitle')}</p>

      <form onSubmit={handleLogin} className="space-y-3.5">
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
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        {message && (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || recoveryLoading || magicLinkLoading}
          className="w-full py-2.5 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-sm font-medium rounded-xl transition-colors mt-2"
        >
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </button>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={loading || recoveryLoading || magicLinkLoading}
          className="w-full py-2.5 border border-neutral-800 hover:border-neutral-700 disabled:border-neutral-900 disabled:text-neutral-700 text-neutral-200 text-sm font-medium rounded-xl transition-colors"
        >
          {magicLinkLoading ? t('auth.sendingMagicLink') : t('auth.emailMagicLink')}
        </button>

        <button
          type="button"
          onClick={handlePasswordRecovery}
          disabled={loading || recoveryLoading || magicLinkLoading}
          className="w-full py-2 text-neutral-400 hover:text-white disabled:text-neutral-700 text-xs font-medium transition-colors"
        >
          {recoveryLoading ? t('auth.sendingRecoveryEmail') : t('auth.forgotPassword')}
        </button>
      </form>

      <p className="text-center text-xs text-neutral-600 mt-6">
        {t('auth.noAccount')}{" "}
        <Link href="/register" className="text-neutral-400 hover:text-white transition-colors">
          {t('auth.signUp')}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar showNav={false} />

      <div className="flex-1 flex items-center justify-center px-6">
        <Suspense fallback={
          <div className="w-full max-w-sm text-center text-neutral-600 text-sm">{t('common.loading')}</div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
