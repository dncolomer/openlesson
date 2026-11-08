import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MARKETING_HERO_SECONDARY_CTA_CLASS,
  MarketingDirectoryHero,
} from "@/components/marketing/MarketingDirectoryHero";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { KNOWLEDGE_VERIFICATION_PATH } from "@/lib/marketing/paths";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_FLOW_COPY,
  VERIFICATION_PLATFORM_COPY,
  VERIFICATION_PRODUCT_COPY,
} from "@/lib/marketing/verification-product";
import {
  MARKETING_MEDIA_FILL_CLASS,
  MARKETING_MEDIA_STAGE_CLASS,
  MARKETING_SHELL,
} from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${KNOWLEDGE_VERIFICATION_PATH}`,
});

export const metadata: Metadata = {
  title: "Knowledge Verification",
  description: VERIFICATION_PRODUCT_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${KNOWLEDGE_VERIFICATION_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function KnowledgeVerificationPage() {
  return (
    <MarketingPageShell>
      <MarketingDirectoryHero
        eyebrows={[VERIFICATION_PRODUCT_COPY.eyebrow]}
        title={VERIFICATION_PRODUCT_COPY.title}
        directoryEyebrow={VERIFICATION_APPROACH_COPY.directoryEyebrow}
        directoryTitle={VERIFICATION_APPROACH_COPY.directoryTitle}
        links={VERIFICATION_APPROACH_COPY.thesisLinks}
        marker="verification"
        actions={
          <>
            <TrackedCtaLink
              href={VERIFICATION_PRODUCT_COPY.discoveryHref}
              label={VERIFICATION_PRODUCT_COPY.discoveryCta}
              location="verification_hero"
              page={KNOWLEDGE_VERIFICATION_PATH}
              className={MARKETING_HERO_PRIMARY_CTA_CLASS}
            >
              {VERIFICATION_PRODUCT_COPY.discoveryCta}
              <ArrowRight className="ml-2" size={16} />
            </TrackedCtaLink>
            <Link href={VERIFICATION_PRODUCT_COPY.pricingHref} className={MARKETING_HERO_SECONDARY_CTA_CLASS}>
              {VERIFICATION_PRODUCT_COPY.pricingCta}
            </Link>
          </>
        }
      >
        <p>{VERIFICATION_PRODUCT_COPY.lead}</p>
        <p>{VERIFICATION_PRODUCT_COPY.body}</p>
      </MarketingDirectoryHero>

      <section id="platform" className={`${MARKETING_SHELL} pt-3`}>
        <div className="grid items-stretch gap-3 lg:grid-cols-12 lg:gap-5">
          <div className="flex min-h-0 flex-col lg:col-span-5">
            <div className="console-copy flex h-full flex-col p-5 sm:p-6">
              <SectionHeading
                eyebrow={VERIFICATION_PLATFORM_COPY.eyebrow}
                title={VERIFICATION_PLATFORM_COPY.title}
              />
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                {VERIFICATION_PLATFORM_COPY.p1}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
                {VERIFICATION_PLATFORM_COPY.p2}
              </p>
            </div>
          </div>
          <div
            className="console-copy flex min-h-0 flex-col overflow-hidden rounded-none shadow-[0_0_0_1px_rgba(255,255,255,0.03)] lg:col-span-7"
            data-landing-knowledge-visual
          >
            <div className={`${MARKETING_MEDIA_STAGE_CLASS} ${MARKETING_MEDIA_FILL_CLASS}`}>
              <Image
                src={VERIFICATION_PLATFORM_COPY.imageSrc}
                alt={VERIFICATION_PLATFORM_COPY.imageAlt}
                fill
                className={`object-contain ${MARKETING_MEDIA_FILL_CLASS}`}
                sizes="(max-width: 1024px) 100vw, 60vw"
                priority
              />
            </div>
            <div className="border-t border-zinc-800/90 px-4 py-3 sm:px-5 sm:py-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                {VERIFICATION_PLATFORM_COPY.visualCaption}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {VERIFICATION_PLATFORM_COPY.visualBody}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="flow" className={`${MARKETING_SHELL} pt-3`} data-verification-flow>
        <div className="console-copy overflow-hidden p-5 sm:p-6 lg:p-7">
          <SectionHeading
            eyebrow={VERIFICATION_FLOW_COPY.eyebrow}
            title={VERIFICATION_FLOW_COPY.title}
          />
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {VERIFICATION_FLOW_COPY.steps.map((step, index) => (
              <li key={step.title}>
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {VERIFICATION_FLOW_COPY.aiNote}
          </p>
        </div>
      </section>

      <section id="approach" className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}>
        <SectionHeading
          eyebrow={VERIFICATION_APPROACH_COPY.eyebrow}
          title={VERIFICATION_APPROACH_COPY.title}
        />
        <div className="console-copy mt-6 p-6 text-lg leading-relaxed text-zinc-400 sm:p-8">
          <p>{VERIFICATION_APPROACH_COPY.p1}</p>
          <p className="mt-5">{VERIFICATION_APPROACH_COPY.p2}</p>
          <p className="mt-5">{VERIFICATION_APPROACH_COPY.p3}</p>
          <p className="mt-5" data-landing-epistemic-foraging>
            The session searches for information that reduces uncertainty about what is held. That policy is{" "}
            <Link
              href={VERIFICATION_APPROACH_COPY.foragingHref}
              className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
            >
              epistemic foraging
            </Link>
            .
          </p>
          <p className="mt-5 text-base">{VERIFICATION_APPROACH_COPY.related}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-base">
            {VERIFICATION_APPROACH_COPY.relatedLinks.map((link) => (
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
    </MarketingPageShell>
  );
}
