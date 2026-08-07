"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";

export default function TermsPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar 
        breadcrumbs={[{ label: t('terms.title') }]}
        showNav={false}
      />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-white mb-2">{t('terms.title')}</h1>
        <p className="text-xs text-neutral-600 mb-8">{t('terms.lastUpdated')}</p>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.agreementHeading')}</h2>
            <p>
              {t('terms.agreementBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.platformDescHeading')}</h2>
            <p className="mb-3">
              {t('terms.platformDescIntro')}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('terms.platformDescItem1')}</li>
              <li>{t('terms.platformDescItem2')}</li>
              <li>{t('terms.platformDescItem3')}</li>
              <li>{t('terms.platformDescItem4')}</li>
              <li>{t('terms.platformDescItem5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.accountHeading')}</h2>
            <p className="mb-3">{t('terms.accountIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('terms.accountItem1')}</li>
              <li>{t('terms.accountItem2')}</li>
              <li>{t('terms.accountItem3')}</li>
              <li>{t('terms.accountItem4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.paymentsHeading')}</h2>
            <p className="mb-3">{t('terms.paymentsIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('terms.paymentsItem1')}</li>
              <li>{t('terms.paymentsItem2')}</li>
              <li>{t('terms.paymentsItem3')}</li>
              <li>{t('terms.paymentsItem4')}</li>
              <li>{t('terms.paymentsItem5')}</li>
              <li>{t('terms.paymentsItem6')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.yourContentHeading')}</h2>
            <p className="mb-3">{t('terms.yourContentIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('terms.yourContentItem1')}</li>
              <li>{t('terms.yourContentItem2')}</li>
              <li>{t('terms.yourContentItem3')}</li>
              <li>{t('terms.yourContentItem4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.aiDisclaimerHeading')}</h2>
            <p>
              {t('terms.aiDisclaimerBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.prohibitedHeading')}</h2>
            <p className="mb-3">{t('terms.prohibitedIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('terms.prohibitedItem1')}</li>
              <li>{t('terms.prohibitedItem2')}</li>
              <li>{t('terms.prohibitedItem3')}</li>
              <li>{t('terms.prohibitedItem4')}</li>
              <li>{t('terms.prohibitedItem5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.ipHeading')}</h2>
            <p>
              {t('terms.ipBody')}{" "}
              <a href="https://github.com/dncolomer/socrates" className="text-neutral-300 hover:text-neutral-300" target="_blank" rel="noopener noreferrer">
                github.com/dncolomer/socrates
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.warrantyHeading')}</h2>
            <p>
              {t('terms.warrantyBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.liabilityHeading')}</h2>
            <p>
              {t('terms.liabilityBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.governingLawHeading')}</h2>
            <p>
              {t('terms.governingLawBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.changesToTermsHeading')}</h2>
            <p>
              {t('terms.changesToTermsBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('terms.contactHeading')}</h2>
            <p className="mb-3">{t('terms.contactIntro')}</p>
            <div className="p-4 rounded-lg bg-neutral-900/50 border border-neutral-800 space-y-1">
              <p><strong className="text-neutral-300">{t('terms.emailLabel')}:</strong> daniel@uncertain.systems</p>
              <p><strong className="text-neutral-300">{t('terms.companyLabel')}:</strong> Uncertain Systems (Daniel Colomer)</p>
              <p><strong className="text-neutral-300">{t('terms.locationLabel')}:</strong> Hamburg, Germany</p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
