import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MarketingDirectoryHero,
} from "@/components/marketing/MarketingDirectoryHero";
import { KNOWLEDGE_VERIFICATION_PATH } from "@/lib/marketing/paths";
import {
  VERIFICATION_APPROACH_COPY,
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
          <Link href={VERIFICATION_PRODUCT_COPY.pricingHref} className={MARKETING_HERO_PRIMARY_CTA_CLASS}>
            {VERIFICATION_PRODUCT_COPY.pricingCta}
            <ArrowRight className="ml-2" size={16} />
          </Link>
        }
      >
        <p>{VERIFICATION_PRODUCT_COPY.lead}</p>
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
                Our flows put humans and agents into a shared embedding geometry. Create knowledge regions,
                multi-select users, and read{" "}
                <span className="text-zinc-200">distance to knowledge</span> live: see how people do against your
                defined knowledge regions.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
                Create{" "}
                <span className="text-zinc-300">custom knowledge regions</span> from internal expert data and measure
                your workforce readiness without sharing confidential information about your internal systems.
                Regions stay private to the workspace.
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
                Knowledge · Embeddings · Knowledge regions · Proof of Work
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                We help you build a living map of proximity to any kind of knowledge. We ground our results on real
                and genuine work traces, with the guarantee that results cannot be cheated or faked.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="approach" className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}>
        <SectionHeading
          eyebrow={VERIFICATION_APPROACH_COPY.eyebrow}
          title={VERIFICATION_APPROACH_COPY.title}
        />
        <div className="console-copy mt-6 p-6 text-lg leading-relaxed text-zinc-400 sm:p-8">
          <p>
            Uncertain Systems builds a learning world model from real work: skills, scenarios, proof of work,
            and where reasoning breaks. Our hosted interfaces as well as our API products are all specially
            designed to elicit genuine raw work data from the user while at the same time minimizing the
            disruption of the natural cognitive process.
          </p>
          <p className="mt-5">
            Our conversational interfaces run on a{" "}
            <span className="text-zinc-200">Free Energy Principle</span> approach based on
            epistemic foraging: the evolving learner model searches for information that reduces
            uncertainty, and steers the thinking process toward what is still unknown.
          </p>
          <p className="mt-5">{VERIFICATION_APPROACH_COPY.p3}</p>
          <p className="mt-5" data-landing-epistemic-foraging>
            The harness searches for information that reduces uncertainty about what is held. That policy is{" "}
            <Link
              href={VERIFICATION_APPROACH_COPY.foragingHref}
              className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
            >
              epistemic foraging
            </Link>
            .
          </p>
        </div>
      </section>
    </MarketingPageShell>
  );
}
