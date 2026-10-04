"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { useI18n } from "@/lib/i18n";
import { ConsolePage } from "@/components/ui/console-frame";

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
    <ConsolePage label="End">
      <LandingNav />

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center border border-white/40 bg-black text-white">
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
          className="border border-white/40 bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-white hover:text-black"
        >
          {t('pricing.goToDashboard')}
        </Link>
      </div>
    </ConsolePage>
  );
}
