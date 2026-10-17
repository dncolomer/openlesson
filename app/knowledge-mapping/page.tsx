import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import { ThesisDirectory } from "@/components/science/ThesisDirectory";
import { KNOWLEDGE_MAPPING_PATH } from "@/lib/marketing/paths";
import {
  MAPPING_PLATFORM_COPY,
  MAPPING_PRODUCT_COPY,
} from "@/lib/marketing/mapping-product";
import { AccelerandoRun } from "@/components/AccelerandoGlyphs";
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
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
            {MAPPING_PRODUCT_COPY.eyebrow}
          </div>
          <AccelerandoRun text={MAPPING_PRODUCT_COPY.eyebrow} className="text-[11px]" />
        </div>
        <h1 className="max-w-5xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[68px]">
          Map Human Knowledge.
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-relaxed text-zinc-400">
          A Knowledge Mapping product for science use cases: knowledge regions as a living map of a
          domain — proximity, coverage, and the path through what is held — rather than as a
          verification exam.
        </p>
        <div className="mt-8 max-w-4xl">
          <ThesisDirectory links={MAPPING_PRODUCT_COPY.thesisLinks} marker="mapping" />
        </div>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={MAPPING_PRODUCT_COPY.scienceHref}
            className="inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {MAPPING_PRODUCT_COPY.scienceCta}
            <ArrowRight className="ml-2" size={16} />
          </Link>
        </div>
      </section>

      <section id="platform" className="relative z-10 mx-auto max-w-7xl px-6 pb-12 pt-2 sm:pb-16">
        <SectionHeading
          eyebrow={MAPPING_PLATFORM_COPY.eyebrow}
          title={MAPPING_PLATFORM_COPY.title}
        />
        <p className="mt-4 max-w-5xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Every workspace puts people into a shared embedding geometry. Create knowledge regions,
          multi-select users, and read{" "}
          <span className="text-zinc-200">position on the map</span> live: the map shows where
          people sit against your defined knowledge regions.
        </p>
        <p className="mt-3 max-w-5xl text-base leading-relaxed text-zinc-500 sm:text-[15px]">
          Create{" "}
          <span className="text-zinc-300">custom knowledge regions</span> from internal expert data
          and chart a domain without sharing confidential information about your internal systems.
          Regions stay private to the workspace.
        </p>
        <div
          className="console-copy mt-6 overflow-hidden rounded-none shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
          data-landing-knowledge-visual
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[2918/1656]">
            <Image
              src="/knowledgeg2.png"
              alt="Uncertain Systems Knowledge embeddings: multi-user projection with knowledge regions as a map of the domain"
              fill
              className="object-cover object-top"
              sizes="(max-width: 1152px) 100vw, 1152px"
              priority
            />
          </div>
          <div className="border-t border-zinc-800/90 px-4 py-3 sm:px-5 sm:py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
              Knowledge · Embeddings · Knowledge regions · Proof of Work
            </p>
            <p className="mt-1.5 max-w-5xl text-sm leading-relaxed text-zinc-400">
              We help you build a living map of proximity to any kind of knowledge. Knowledge
              regions are the territories. People are positions on that map.
            </p>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
