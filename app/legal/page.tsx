"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";

export default function LegalPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar 
        breadcrumbs={[{ label: t('legal.title') }]}
        showNav={false}
      />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-white mb-2">{t('legal.title')}</h1>
        <p className="text-xs text-neutral-600 mb-8">{t('legal.lastUpdated')}</p>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.companyInfoHeading')}</h2>
            <div className="p-4 rounded-lg bg-neutral-900/50 border border-neutral-800 space-y-1">
              <p><strong className="text-neutral-300">{t('legal.companyNameLabel')}:</strong> Uncertain Systems</p>
              <p><strong className="text-neutral-300">{t('legal.ownerLabel')}:</strong> Daniel Colomer</p>
              <p><strong className="text-neutral-300">{t('legal.locationLabel')}:</strong> Hamburg, Germany</p>
              <p><strong className="text-neutral-300">{t('legal.contactEmailLabel')}:</strong> daniel@uncertain.systems</p>
              <p><strong className="text-neutral-300">{t('legal.websiteLabel')}:</strong> uncertain.systems</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.platformDescHeading')}</h2>
            <p className="mb-3">
              {t('legal.platformDescIntro')}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('legal.platformDescItem1')}</li>
              <li>{t('legal.platformDescItem2')}</li>
              <li>{t('legal.platformDescItem3')}</li>
              <li>{t('legal.platformDescItem4')}</li>
              <li>{t('legal.platformDescItem5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.ipRightsHeading')}</h2>
            <p className="mb-3">{t('legal.ipRightsIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('legal.ipRightsItem1')}</li>
              <li>{t('legal.ipRightsItem2')}</li>
              <li>{t('legal.ipRightsItem3')}</li>
              <li>{t('legal.ipRightsItem4')}</li>
            </ul>
            <p className="mt-3">
              {t('legal.ipRightsProtected')}
            </p>
            <p className="mt-3">
              {t('legal.openSourceNote')}{" "}
              <a href="https://github.com/dncolomer/socrates" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">
                github.com/dncolomer/socrates
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.userContentHeading')}</h2>
            <p>
              {t('legal.userContentBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.aiDisclaimerHeading')}</h2>
            <p>
              {t('legal.aiDisclaimerIntro')}
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>{t('legal.aiDisclaimerItem1')}</li>
              <li>{t('legal.aiDisclaimerItem2')}</li>
              <li>{t('legal.aiDisclaimerItem3')}</li>
              <li>{t('legal.aiDisclaimerItem4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.liabilityHeading')}</h2>
            <p className="mb-3">
              {t('legal.liabilityIntro')}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('legal.liabilityItem1')}</li>
              <li>{t('legal.liabilityItem2')}</li>
              <li>{t('legal.liabilityItem3')}</li>
              <li>{t('legal.liabilityItem4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.externalLinksHeading')}</h2>
            <p>
              {t('legal.externalLinksBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.governingLawHeading')}</h2>
            <p>
              {t('legal.governingLawBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('legal.contactHeading')}</h2>
            <p className="mb-3">{t('legal.contactIntro')}</p>
            <div className="p-4 rounded-lg bg-neutral-900/50 border border-neutral-800 space-y-1">
              <p><strong className="text-neutral-300">{t('legal.emailLabel')}:</strong> daniel@uncertain.systems</p>
              <p><strong className="text-neutral-300">{t('legal.locationLabel')}:</strong> Hamburg, Germany</p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
