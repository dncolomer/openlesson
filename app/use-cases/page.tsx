import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { MarketingDirectoryHero } from "@/components/marketing/MarketingDirectoryHero";
import {
  USE_CASES,
  USE_CASES_COPY,
  USE_CASES_DIRECTORY,
  USE_CASES_PATH,
} from "@/lib/marketing/use-cases";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${USE_CASES_PATH}`,
});

export const metadata: Metadata = {
  title: "Use cases",
  description: USE_CASES_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${USE_CASES_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function UseCasesPage() {
  return (
    <MarketingPageShell>
      <div data-use-cases-page>
        <MarketingDirectoryHero
          data-use-cases-hero
          eyebrows={[USE_CASES_COPY.eyebrow]}
          title={USE_CASES_COPY.title}
          directoryEyebrow={USE_CASES_COPY.directoryEyebrow}
          directoryTitle={USE_CASES_COPY.directoryTitle}
          directoryLead={USE_CASES_COPY.directoryLead}
          links={USE_CASES_DIRECTORY}
          marker="use-cases"
        >
          <p>{USE_CASES_COPY.lead}</p>
        </MarketingDirectoryHero>

        <section className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`} data-use-cases-list>
          <div className="console-copy overflow-hidden">
            {USE_CASES.map((item, index) => {
              const external = item.productHref.startsWith("http");
              const linkClass =
                "mt-4 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500";
              return (
                <article
                  key={item.id}
                  id={item.id}
                  className={`p-5 sm:p-6 lg:p-7 ${index > 0 ? "border-t border-zinc-800/90" : ""}`}
                  data-use-case={item.id}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                    {String(index + 1).padStart(2, "0")} · {item.product}
                  </p>
                  <h2 className="mt-2 text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">{item.body}</p>
                  {external ? (
                    <a
                      href={item.productHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {item.hrefLabel}
                      <ExternalLink className="ml-2" size={14} />
                    </a>
                  ) : (
                    <Link href={item.productHref} className={linkClass}>
                      {item.hrefLabel}
                      <ArrowRight className="ml-2" size={14} />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
