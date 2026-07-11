"use client";

import { CommunityPlans } from "@/components/CommunityWorkspaces";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";

export default function CommunityPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            {t('communityPlans.title')}
          </h1>
          <p className="text-neutral-500 text-base max-w-lg mx-auto leading-relaxed">
            {t('communityPlans.description')}
          </p>
        </div>

        <CommunityPlans user={null} />
      </div>

      <Footer />
    </main>
  );
}
