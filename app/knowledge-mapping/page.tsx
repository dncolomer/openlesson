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
import { KNOWLEDGE_MAPPING_PATH } from "@/lib/marketing/paths";
import {
  MAPPING_PLATFORM_COPY,
  MAPPING_PRODUCT_COPY,
} from "@/lib/marketing/mapping-product";
import {
  MARKETING_MEDIA_FILL_CLASS,
  MARKETING_MEDIA_STAGE_CLASS,
  MARKETING_SHELL,
} from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${KNOWLEDGE_MAPPING_PATH}`,
});

export const metadata: Metadata = {
  title: "Knowledge Mapping",
  description: MAPPING_PRODUCT_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${KNOWLEDGE_MAPPING_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function KnowledgeMappingPage() {
  return (
    <MarketingPageShell>
      <MarketingDirectoryHero
        eyebrows={[MAPPING_PRODUCT_COPY.eyebrow]}
        title={MAPPING_PRODUCT_COPY.title}
        directoryEyebrow={MAPPING_PRODUCT_COPY.directoryEyebrow}
        directoryTitle={MAPPING_PRODUCT_COPY.directoryTitle}
        links={MAPPING_PRODUCT_COPY.thesisLinks}
        marker="mapping"
        actions={
          <>
            <Link href={MAPPING_PRODUCT_COPY.pricingHref} className={MARKETING_HERO_PRIMARY_CTA_CLASS}>
              {MAPPING_PRODUCT_COPY.pricingCta}
              <ArrowRight className="ml-2" size={16} />
            </Link>
            <Link href={MAPPING_PRODUCT_COPY.scienceHref} className={MARKETING_HERO_SECONDARY_CTA_CLASS}>
              {MAPPING_PRODUCT_COPY.scienceCta}
            </Link>
          </>
        }
      >
        <p>{MAPPING_PRODUCT_COPY.lead}</p>
      </MarketingDirectoryHero>

      <section id="platform" className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}>
        <div className="grid items-stretch gap-3 lg:grid-cols-12 lg:gap-5">
          <div className="flex min-h-0 flex-col lg:col-span-5">
            <div className="console-copy flex h-full flex-col p-5 sm:p-6">
              <SectionHeading
                eyebrow={MAPPING_PLATFORM_COPY.eyebrow}
                title={MAPPING_PLATFORM_COPY.title}
              />
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                Every workspace puts people into a shared embedding geometry. Create knowledge regions,
                multi-select users, and read{" "}
                <span className="text-zinc-200">position on the map</span> live: the map shows where
                people sit against your defined knowledge regions.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
                Create{" "}
                <span className="text-zinc-300">custom knowledge regions</span> from internal expert data
                and chart a domain without sharing confidential information about your internal systems.
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
                src={MAPPING_PLATFORM_COPY.imageSrc}
                alt={MAPPING_PLATFORM_COPY.imageAlt}
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
                We help you build a living map of proximity to any kind of knowledge. Knowledge
                regions are the territories. People are positions on that map.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
