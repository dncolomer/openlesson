"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";

export default function CookiesPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar 
        breadcrumbs={[{ label: t('cookies.title') }]}
        showNav={false}
      />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-white mb-2">{t('cookies.title')}</h1>
        <p className="text-xs text-neutral-600 mb-8">{t('cookies.lastUpdated')}</p>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('cookies.whatAreCookiesHeading')}</h2>
            <p>
              {t('cookies.whatAreCookiesBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('cookies.howWeUseCookiesHeading')}</h2>
            <p className="mb-3">{t('cookies.howWeUseCookiesIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-neutral-300">{t('cookies.essentialCookiesLabel')}:</strong> {t('cookies.essentialCookiesDesc')}
              </li>
              <li>
                <strong className="text-neutral-300">{t('cookies.paymentCookiesLabel')}:</strong> {t('cookies.paymentCookiesDesc')}
              </li>
              <li>
                <strong className="text-neutral-300">{t('cookies.analyticsLabel')}:</strong> {t('cookies.analyticsDesc')}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('cookies.typesHeading')}</h2>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('cookies.essentialCookiesLabel')}</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs border border-neutral-800 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-neutral-800/50">
                    <th className="text-left px-3 py-2 text-neutral-300 font-medium">{t('cookies.tableHeaderCookie')}</th>
                    <th className="text-left px-3 py-2 text-neutral-300 font-medium">{t('cookies.tableHeaderPurpose')}</th>
                    <th className="text-left px-3 py-2 text-neutral-300 font-medium">{t('cookies.tableHeaderDuration')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  <tr>
                    <td className="px-3 py-2 font-mono text-neutral-500">sb-auth-token</td>
                    <td className="px-3 py-2">{t('cookies.authTokenPurpose')}</td>
                    <td className="px-3 py-2">{t('cookies.durationSession')}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-neutral-500">sb-refresh-token</td>
                    <td className="px-3 py-2">{t('cookies.refreshTokenPurpose')}</td>
                    <td className="px-3 py-2">{t('cookies.duration7Days')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('cookies.whatWeDontUseHeading')}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('cookies.noTrackingCookies')}</li>
              <li>{t('cookies.noAdvertising')}</li>
              <li>{t('cookies.noThirdPartyMarketing')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('cookies.thirdPartyCookiesHeading')}</h2>
            <p className="mb-3">{t('cookies.thirdPartyCookiesIntro')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-neutral-300">Supabase:</strong> {t('cookies.supabaseDesc')}</li>
              <li><strong className="text-neutral-300">Stripe:</strong> {t('cookies.stripeDesc')}</li>
              <li><strong className="text-neutral-300">Vercel:</strong> {t('cookies.vercelAnalyticsDesc')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('cookies.managingCookiesHeading')}</h2>
            <p className="mb-3">
              {t('cookies.managingCookiesIntro')}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{t('cookies.browserChrome')}</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{t('cookies.browserFirefox')}</a></li>
              <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{t('cookies.browserSafari')}</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{t('cookies.browserEdge')}</a></li>
            </ul>
            <p className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-400/80 text-xs">
              <strong>{t('cookies.noteLabel')}:</strong> {t('cookies.disablingNote')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('cookies.updatesHeading')}</h2>
            <p>
              {t('cookies.updatesBody')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">{t('cookies.contactHeading')}</h2>
            <p className="mb-3">{t('cookies.contactIntro')}</p>
            <div className="p-4 rounded-lg bg-neutral-900/50 border border-neutral-800 space-y-1">
              <p><strong className="text-neutral-300">{t('cookies.emailLabel')}:</strong> daniel@uncertain.systems</p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
