"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar 
        breadcrumbs={[{ label: t('privacy.title') }]}
        showNav={false}
      />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-white mb-2">{t('privacy.title')}</h1>
        <p className="text-xs text-neutral-600 mb-8">{t('privacy.lastUpdated')}</p>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.introHeading')}</h2>
            <p>
              {t('privacy.introBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.infoCollectHeading')}</h2>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('privacy.personalInfoSubheading')}</h3>
            <p className="mb-3">{t('privacy.personalInfoIntro')}</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>{t('privacy.personalInfoItem1')}</li>
              <li>{t('privacy.personalInfoItem2')}</li>
              <li>{t('privacy.personalInfoItem3')}</li>
              <li>{t('privacy.personalInfoItem4')}</li>
              <li>{t('privacy.personalInfoItem5')}</li>
              <li>{t('privacy.personalInfoItem6')}</li>
            </ul>
            <p className="mb-3">
              {t('privacy.personalInfoTypes')}
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('privacy.autoCollectedSubheading')}</h3>
            <p>
              {t('privacy.autoCollectedBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.howWeUseHeading')}</h2>
            <p className="mb-3">{t('privacy.howWeUseIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('privacy.howWeUseItem1')}</li>
              <li>{t('privacy.howWeUseItem2')}</li>
              <li>{t('privacy.howWeUseItem3')}</li>
              <li>{t('privacy.howWeUseItem4')}</li>
              <li>{t('privacy.howWeUseItem5')}</li>
              <li>{t('privacy.howWeUseItem6')}</li>
              <li>{t('privacy.howWeUseItem7')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.thirdPartyHeading')}</h2>
            <p className="mb-3">{t('privacy.thirdPartyIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-neutral-300">Supabase</strong> — {t('privacy.thirdPartySupabase')}</li>
              <li><strong className="text-neutral-300">xAI</strong> — {t('privacy.thirdPartyXai')}</li>
              <li><strong className="text-neutral-300">Stripe</strong> — {t('privacy.thirdPartyStripe')}</li>
              <li><strong className="text-neutral-300">Vercel</strong> — {t('privacy.thirdPartyVercel')}</li>
            </ul>
            <p className="mt-3">{t('privacy.noSellData')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.dataSecurityHeading')}</h2>
            <p>
              {t('privacy.dataSecurityBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.gdprHeading')}</h2>
            <p className="mb-3">
              {t('privacy.gdprIntro')}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-neutral-300">{t('privacy.gdprAccess')}:</strong> {t('privacy.gdprAccessDesc')}</li>
              <li><strong className="text-neutral-300">{t('privacy.gdprRectification')}:</strong> {t('privacy.gdprRectificationDesc')}</li>
              <li><strong className="text-neutral-300">{t('privacy.gdprErasure')}:</strong> {t('privacy.gdprErasureDesc')}</li>
              <li><strong className="text-neutral-300">{t('privacy.gdprRestriction')}:</strong> {t('privacy.gdprRestrictionDesc')}</li>
              <li><strong className="text-neutral-300">{t('privacy.gdprPortability')}:</strong> {t('privacy.gdprPortabilityDesc')}</li>
              <li><strong className="text-neutral-300">{t('privacy.gdprObjection')}:</strong> {t('privacy.gdprObjectionDesc')}</li>
              <li><strong className="text-neutral-300">{t('privacy.gdprWithdraw')}:</strong> {t('privacy.gdprWithdrawDesc')}</li>
            </ul>
            <p className="mt-3">{t('privacy.gdprContact')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.anonymizedDataHeading')}</h2>
            <p className="mb-3">
              {t('privacy.anonymizedDataIntro')}
            </p>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('privacy.whatWeCollectSubheading')}</h3>
            <p className="mb-3">{t('privacy.whatWeCollectIntro')}</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li><strong className="text-neutral-300">{t('privacy.transcriptsOnlyLabel')}:</strong> {t('privacy.transcriptsOnlyDesc')}</li>
              <li><strong className="text-neutral-300">{t('privacy.transcriptsAudioLabel')}:</strong> {t('privacy.transcriptsAudioDesc')}</li>
            </ul>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('privacy.howWeAnonymizeSubheading')}</h3>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>{t('privacy.anonymizeItem1')}</li>
              <li>{t('privacy.anonymizeItem2')}</li>
              <li>{t('privacy.anonymizeItem3')}</li>
            </ul>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('privacy.yourControlSubheading')}</h3>
            <p>
              {t('privacy.yourControlBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.dataRetentionHeading')}</h2>
            <p>
              {t('privacy.dataRetentionBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.childrenHeading')}</h2>
            <p>
              {t('privacy.childrenBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.changesHeading')}</h2>
            <p>
              {t('privacy.changesBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('privacy.contactHeading')}</h2>
            <p className="mb-3">{t('privacy.contactIntro')}</p>
            <div className="p-4 rounded-lg bg-neutral-900/50 border border-neutral-800 space-y-1">
              <p><strong className="text-neutral-300">{t('privacy.emailLabel')}:</strong> daniel@uncertain.systems</p>
              <p><strong className="text-neutral-300">{t('privacy.companyLabel')}:</strong> Uncertain Systems (Daniel Colomer)</p>
              <p><strong className="text-neutral-300">{t('privacy.locationLabel')}:</strong> Hamburg, Germany</p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
