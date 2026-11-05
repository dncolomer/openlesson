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
import { MARKETING_SHELL } from "@/lib/marketing/shell";
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
      <section className={`${MARKETING_SHELL} pt-5 pb-3 sm:pt-6`}>
        <div className="grid items-end gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
                {MAPPING_PRODUCT_COPY.eyebrow}
              </div>
            </div>
            <h1 className="max-w-4xl text-4xl font-medium leading-[1.03] tracking-[-2px] text-white sm:text-5xl lg:text-6xl">
              Map Human Knowledge.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              A Knowledge Mapping product for science use cases: knowledge regions as a living map of a
              domain — proximity, coverage, and the path through what is held — rather than as a
              verification exam.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="console-copy p-5 sm:p-6">
              <ThesisDirectory
                links={MAPPING_PRODUCT_COPY.thesisLinks}
                marker="mapping"
                columns="grid-cols-1"
              />
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={MAPPING_PRODUCT_COPY.pricingHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  {MAPPING_PRODUCT_COPY.pricingCta}
                  <ArrowRight className="ml-2" size={16} />
                </Link>
                <Link
                  href={MAPPING_PRODUCT_COPY.scienceHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-none border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                >
                  {MAPPING_PRODUCT_COPY.scienceCta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

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
            <div className="relative min-h-[14rem] flex-1 sm:min-h-[18rem]">
              <Image
                src={MAPPING_PLATFORM_COPY.imageSrc}
                alt={MAPPING_PLATFORM_COPY.imageAlt}
                fill
                className="object-cover object-top"
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
