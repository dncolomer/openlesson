import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MarketingDirectoryHero,
} from "@/components/marketing/MarketingDirectoryHero";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import {
  USE_CASES,
  USE_CASES_COPY,
  USE_CASES_DIRECTORY,
  USE_CASES_OTHER,
  USE_CASES_PATH,
} from "@/lib/marketing/use-cases";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${USE_CASES_PATH}`,
});

export const metadata: Metadata = {
  title: "Use cases",
  description: USE_CASES_COPY.lead[1],
  alternates: { canonical: `https://uncertain.systems${USE_CASES_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

function DiscoveryCta({ location }: { location: string }) {
  return (
    <TrackedCtaLink
      href={USE_CASES_COPY.closeHref}
      label={USE_CASES_COPY.closeCta}
      location={location}
      page={USE_CASES_PATH}
      className={MARKETING_HERO_PRIMARY_CTA_CLASS}
    >
      {USE_CASES_COPY.closeCta}
      <ArrowRight className="ml-2" size={16} />
    </TrackedCtaLink>
  );
}

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
          actions={<DiscoveryCta location="use_cases_hero" />}
        >
          {USE_CASES_COPY.lead.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </MarketingDirectoryHero>

        <section
          id="ideas"
          className={`${MARKETING_SHELL} pt-3`}
          data-use-cases-ideas
          aria-labelledby="use-cases-ideas-heading"
        >
          <div className="console-copy overflow-hidden">
            <div className="grid lg:grid-cols-12">
              <div className="p-5 sm:p-6 lg:col-span-5 lg:p-7">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {USE_CASES_COPY.ideasEyebrow}
                </p>
                <h2
                  id="use-cases-ideas-heading"
                  className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
                >
                  {USE_CASES_COPY.ideasTitle}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {USE_CASES_COPY.ideasLead}
                </p>
              </div>
              <div className="grid border-t border-zinc-800/90 sm:grid-cols-2 lg:col-span-7 lg:border-t-0 lg:border-l">
                {USE_CASES_COPY.ideas.map((idea, index) => (
                  <article
                    key={idea.title}
                    className={`p-5 sm:p-6 lg:p-7 ${
                      index > 0 ? "border-t border-zinc-800/90 sm:border-t-0 sm:border-l" : ""
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">
                      {idea.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{idea.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div data-use-cases-list>
          {USE_CASES.map((item, index) => (
            <section
              key={item.id}
              id={item.id}
              className={`${MARKETING_SHELL} pt-3`}
              data-use-case={item.id}
              aria-labelledby={`use-case-${item.id}-heading`}
            >
              <article className="console-copy overflow-hidden p-5 sm:p-6 lg:p-7">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {String(index + 1).padStart(2, "0")} · {item.eyebrow}
                </p>
                <h2
                  id={`use-case-${item.id}-heading`}
                  className="mt-3 max-w-4xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
                >
                  {item.title}
                </h2>
                {item.sections.map((section) => (
                  <div key={section.title} className="mt-7">
                    <h3 className="text-lg font-medium tracking-[-0.4px] text-white sm:text-xl">
                      {section.title}
                    </h3>
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ))}
                {item.example || item.afterExample ? (
                  <div
                    className="mt-7 border-t border-zinc-800/90 pt-5"
                    data-use-case-example
                  >
                    {item.example ? (
                      <>
                        <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                          Illustrative example
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
                          {item.example}
                        </p>
                      </>
                    ) : null}
                    {item.afterExample ? (
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                        {item.afterExample}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-7">
                  <h3 className="text-lg font-medium tracking-[-0.4px] text-white sm:text-xl">
                    {item.close.title}
                  </h3>
                  {item.close.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                  {item.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                    >
                      {link.label}
                      <ArrowRight className="ml-2" size={14} />
                    </Link>
                  ))}
                </div>
                <div className="mt-6">
                  <DiscoveryCta location={`use_case_${item.id}`} />
                </div>
              </article>
            </section>
          ))}
        </div>

        <section
          id="other-directions"
          className={`${MARKETING_SHELL} pt-3`}
          data-use-cases-other
          aria-labelledby="use-cases-other-heading"
        >
          <div className="console-copy overflow-hidden">
            <div className="border-b border-zinc-800/90 p-5 sm:p-6 lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {USE_CASES_COPY.otherEyebrow}
              </p>
              <h2
                id="use-cases-other-heading"
                className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
              >
                {USE_CASES_COPY.otherTitle}
              </h2>
            </div>
            <div className="grid md:grid-cols-3">
              {USE_CASES_OTHER.map((item, index) => (
                <article
                  key={item.title}
                  className={`p-5 sm:p-6 lg:p-7 ${
                    index > 0 ? "border-t border-zinc-800/90 md:border-t-0 md:border-l" : ""
                  }`}
                >
                  <h3 className="text-lg font-medium tracking-[-0.4px] text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="start"
          className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}
          data-use-cases-close
          aria-labelledby="use-cases-close-heading"
        >
          <div className="console-copy overflow-hidden p-5 sm:p-6 lg:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {USE_CASES_COPY.closeEyebrow}
            </p>
            <h2
              id="use-cases-close-heading"
              className="mt-3 max-w-4xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
            >
              {USE_CASES_COPY.closeTitle}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              {USE_CASES_COPY.closeBody}
            </p>
            <div className="mt-7">
              <DiscoveryCta location="use_cases_close" />
            </div>
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
