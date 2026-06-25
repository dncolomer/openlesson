"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { SOLUTION_PAGES } from "@/lib/seo/solution-pages";

const productLinks = [
  { labelKey: "footer.platform", href: "/platform" },
  { labelKey: "footer.pricing", href: "/pricing" },
  { labelKey: "footer.agenticApi", href: "/docs/agentic-v2" },
];

const resourceLinks = [
  { labelKey: "footer.skillFile", href: "/skill.md" },
  { labelKey: "footer.github", href: "https://github.com/dncolomer/openlesson", external: true },
];

const legalLinks = [
  { labelKey: "footer.privacy", href: "/privacy" },
  { labelKey: "footer.terms", href: "/terms" },
  { labelKey: "footer.cookies", href: "/cookies" },
  { labelKey: "footer.legalNotice", href: "/legal" },
];

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-neutral-900 bg-[#050505]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-8 border-b border-neutral-900">
          <div className="col-span-2 md:col-span-1">
            <p className="text-sm font-medium text-neutral-300">openLesson</p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              {t('footer.seoBlurb')}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              {t('footer.product')}
            </h3>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-neutral-500 hover:text-white transition-colors">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              {t('footer.solutions')}
            </h3>
            <ul className="space-y-3">
              {SOLUTION_PAGES.map((solution) => (
                <li key={solution.slug}>
                  <Link href={solution.path} className="text-sm text-neutral-500 hover:text-white transition-colors">
                    {solution.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              {t('footer.resources')}
            </h3>
            <ul className="space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-500 hover:text-white transition-colors">
                      {t(link.labelKey)}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-sm text-neutral-500 hover:text-white transition-colors">
                      {t(link.labelKey)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              {t('footer.legal')}
            </h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-neutral-500 hover:text-white transition-colors">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 py-6">
          <a href="https://x.com/uncertainsys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs font-medium hover:bg-neutral-900 hover:text-white transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            {t('footer.twitter')}
          </a>
          <a href="mailto:daniel@uncertain.systems" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs font-medium hover:bg-neutral-900 hover:text-white transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            {t('footer.email')}
          </a>
        </div>

        <div className="text-center pt-3">
            <p className="text-[11px] text-neutral-600 mb-1">
            &copy; {currentYear} {t('footer.copyright')}
          </p>
          <p className="text-[11px] text-neutral-700 tracking-widest uppercase">
            {t('footer.tagline')}
          </p>
        </div>
      </div>
    </footer>
  );
}
