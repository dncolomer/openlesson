import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MARKETING_HERO_SECONDARY_CTA_CLASS,
  MarketingDirectoryHero,
} from "@/components/marketing/MarketingDirectoryHero";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import { LEARNING_HARNESS_PATH } from "@/lib/marketing/paths";
import { MARKETING_MEDIA_FILL_CLASS, MARKETING_SHELL } from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${LEARNING_HARNESS_PATH}`,
});

export const metadata: Metadata = {
  title: "Build Understanding",
  description: HARNESS_PRODUCT_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${LEARNING_HARNESS_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function AcquisitionPage() {
  return (
    <MarketingPageShell>
      <MarketingDirectoryHero
        data-acquisition-hero
        eyebrows={[HARNESS_PRODUCT_COPY.eyebrow]}
        title={HARNESS_PRODUCT_COPY.title}
        directoryEyebrow={HARNESS_PRODUCT_COPY.directoryEyebrow}
        directoryTitle={HARNESS_PRODUCT_COPY.directoryTitle}
        links={HARNESS_PRODUCT_COPY.thesisLinks}
        marker="harness"
        actions={
          <>
            <TrackedCtaLink
              href={HARNESS_PRODUCT_COPY.discoveryHref}
              label={HARNESS_PRODUCT_COPY.discoveryCta}
              location="harness_hero"
              page={LEARNING_HARNESS_PATH}
              className={MARKETING_HERO_PRIMARY_CTA_CLASS}
            >
              {HARNESS_PRODUCT_COPY.discoveryCta}
              <ArrowRight className="ml-2" size={16} />
            </TrackedCtaLink>
            <TrackedCtaLink
              href={HARNESS_PRODUCT_COPY.workspaceHref}
              label={HARNESS_PRODUCT_COPY.workspaceCta}
              location="harness_hero_workspace"
              page={LEARNING_HARNESS_PATH}
              className={MARKETING_HERO_SECONDARY_CTA_CLASS}
            >
              {HARNESS_PRODUCT_COPY.workspaceCta}
            </TrackedCtaLink>
            <Link href={HARNESS_PRODUCT_COPY.pricingHref} className={MARKETING_HERO_SECONDARY_CTA_CLASS}>
              {HARNESS_PRODUCT_COPY.pricingCta}
            </Link>
          </>
        }
      >
        <p>{HARNESS_PRODUCT_COPY.lead}</p>
        <p>{HARNESS_PRODUCT_COPY.body}</p>
        <p data-harness-epistemic-foraging>
          That policy is{" "}
          <Link
            href={HARNESS_PRODUCT_COPY.foragingHref}
            className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
          >
            epistemic foraging
          </Link>
          : search for information that reduces uncertainty, rather than optimizing for tests and practice
          repetition.
        </p>
      </MarketingDirectoryHero>

      <section className={`${MARKETING_SHELL} pt-3`} data-harness-workflow>
        <div className="console-copy overflow-hidden p-5 sm:p-6 lg:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            {HARNESS_PRODUCT_COPY.workflowEyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
            {HARNESS_PRODUCT_COPY.workflowTitle}
          </h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {HARNESS_PRODUCT_COPY.workflow.map((step, index) => (
              <li key={step.title}>
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-7 border-t border-zinc-800/90 pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {HARNESS_PRODUCT_COPY.exampleEyebrow}
            </p>
            <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">
              {HARNESS_PRODUCT_COPY.exampleTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
              {HARNESS_PRODUCT_COPY.example}
            </p>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-zinc-400">{HARNESS_PRODUCT_COPY.related}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {HARNESS_PRODUCT_COPY.relatedLinks.map((link) => (
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
        </div>
      </section>

      <section className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`} data-harness-model>
        <div className="console-copy overflow-hidden" data-harness-points>
          <div className="grid lg:grid-cols-12">
            <div className={`relative min-h-[20rem] ${MARKETING_MEDIA_FILL_CLASS} sm:min-h-[26rem] lg:col-span-7 lg:min-h-[32rem] xl:col-span-8 xl:min-h-[36rem]`}>
              <Image
                src={HARNESS_PRODUCT_COPY.modelImageSrc}
                alt={HARNESS_PRODUCT_COPY.modelImageAlt}
                fill
                unoptimized
                className="object-contain object-center"
                sizes="(max-width: 1024px) 100vw, 70vw"
                priority
              />
            </div>

            <ol className="grid border-t border-zinc-800/90 md:grid-cols-3 lg:col-span-5 lg:grid-cols-1 lg:border-t-0 lg:border-l xl:col-span-4">
              {HARNESS_PRODUCT_COPY.points.map((point, index) => (
                <li
                  key={point.title}
                  className={`flex flex-col px-5 py-5 sm:px-6 sm:py-6 lg:py-5 ${
                    index > 0
                      ? "border-t border-zinc-800/90 md:border-t-0 md:border-l lg:border-l-0 lg:border-t"
                      : ""
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                    {String(index + 1).padStart(2, "0")} · {point.eyebrow}
                  </p>
                  <h2 className="mt-1.5 text-lg font-medium tracking-[-0.5px] text-white sm:text-xl">
                    {point.title}
                  </h2>
                  <p className="mt-1.5 flex-1 text-[14px] leading-relaxed text-zinc-400 sm:text-[15px]">
                    {point.body}
                  </p>
                  {point.href && point.linkLabel ? (
                    point.href.startsWith("/") ? (
                      <Link
                        href={point.href}
                        className="mt-3 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                      >
                        {point.linkLabel}
                        <ArrowRight className="ml-2" size={14} />
                      </Link>
                    ) : (
                      <a
                        href={point.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                      >
                        {point.linkLabel}
                        <ExternalLink className="ml-2" size={14} />
                      </a>
                    )
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
