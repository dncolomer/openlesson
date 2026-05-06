"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const hasExchangedRecoveryCode = useRef(false);
  const { t } = useI18n();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code || hasExchangedRecoveryCode.current) return;
    hasExchangedRecoveryCode.current = true;

    let cancelled = false;
    setSessionLoading(true);

    const exchangeRecoveryCode = async () => {
      try {
        const { error: authError } = await createClient().auth.exchangeCodeForSession(code);
        if (!cancelled && authError) setError(authError.message);
        if (!cancelled && !authError) window.history.replaceState(null, "", window.location.pathname);
      } catch {
        if (!cancelled) setError(t('common.error'));
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };

    exchangeRecoveryCode();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ password });

      if (authError) {
        setError(authError.message);
        return;
      }

      setPassword("");
      setMessage(t('auth.passwordUpdated'));
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
          <h2 className="text-xl font-semibold text-white mb-1">{t('auth.resetPassword')}</h2>
          <p className="text-sm text-neutral-500 mb-8">{t('auth.resetPasswordSubtitle')}</p>

          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <label htmlFor="password" className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                {t('auth.newPassword')}
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

            {message && (
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || sessionLoading}
              className="w-full py-2.5 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-sm font-medium rounded-xl transition-colors mt-2"
            >
              {sessionLoading ? t('auth.verifyingRecoveryLink') : loading ? t('auth.updatingPassword') : t('auth.updatePassword')}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-600 mt-6">
            <Link href="/login" className="text-neutral-400 hover:text-white transition-colors">
              {t('auth.backToSignIn')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
