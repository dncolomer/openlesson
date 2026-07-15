"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { useI18n } from "@/lib/i18n";

export default function PricingSuccessPage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 4000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <LandingNav />

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">
          {t('pricing.allSet')}
        </h1>
        <p className="text-sm text-neutral-500 mb-8 max-w-md">
          {t('pricing.subscriptionActive')}
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
        >
          {t('pricing.goToDashboard')}
        </Link>
      </div>
    </main>
  );
}
