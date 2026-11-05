import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import { ThesisDirectory } from "@/components/science/ThesisDirectory";
import { KNOWLEDGE_VERIFICATION_PATH } from "@/lib/marketing/paths";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_PLATFORM_COPY,
  VERIFICATION_PRODUCT_COPY,
  VERIFICATION_SCALE_COPY,
} from "@/lib/marketing/verification-product";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
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
      <section className={`${MARKETING_SHELL} pt-5 pb-3 sm:pt-6`}>
        <div className="grid items-end gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
                {VERIFICATION_PRODUCT_COPY.eyebrow}
              </div>
            </div>
            <h1 className="max-w-4xl text-4xl font-medium leading-[1.03] tracking-[-2px] text-white sm:text-5xl lg:text-6xl">
              Verify Human Knowledge.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              A Knowledge Verification product for enterprise use cases: confirm that knowledge is actually held, without traditional tests and exams, with the guarantee that results cannot be cheated or faked.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="console-copy p-5 sm:p-6">
              <ThesisDirectory
                links={VERIFICATION_APPROACH_COPY.thesisLinks}
                marker="verification"
                columns="grid-cols-1"
              />
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={VERIFICATION_PRODUCT_COPY.pricingHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  {VERIFICATION_PRODUCT_COPY.pricingCta}
                  <ArrowRight className="ml-2" size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className={`${MARKETING_SHELL} pt-3`}>
        <div className="grid items-stretch gap-3 lg:grid-cols-12 lg:gap-5">
          <div className="flex min-h-0 flex-col lg:col-span-5">
            <div className="console-copy flex h-full flex-col p-5 sm:p-6">
              <SectionHeading
                eyebrow={VERIFICATION_PLATFORM_COPY.eyebrow}
                title={VERIFICATION_PLATFORM_COPY.title}
              />
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                Every workspace puts people into a shared embedding geometry. Create knowledge regions,
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
            <div className="relative min-h-[14rem] flex-1 sm:min-h-[18rem]">
              <Image
                src={VERIFICATION_PLATFORM_COPY.imageSrc}
                alt={VERIFICATION_PLATFORM_COPY.imageAlt}
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
                We help you build a living map of proximity to any kind of knowledge. We ground our results on real
                and genuine work traces, with the guarantee that results cannot be cheated or faked.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="approach" className={`${MARKETING_SHELL} pt-3`}>
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

      <section
        id="scale"
        className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}
        data-landing-scale-section
      >
        <div className="grid items-center gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="min-w-0 lg:col-span-6">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              VERIFICATION AT SCALE
            </div>
            <h2 className="max-w-xl text-3xl font-medium leading-[1.1] tracking-[-1.2px] text-white sm:text-4xl">
              Verify and rank knowledge against your own knowledge regions at scale.
            </h2>
            <div className="mt-4 space-y-3 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
              <p>
                The same measurement stack runs{" "}
                <span className="text-zinc-200">knowledge verification at scale</span> — many people against
                the same knowledge regions — without sharing proprietary skills and specs into a public
                repository or database.
              </p>
              <p>
                Our hosted{" "}
                <span className="text-zinc-200">Calibrate, Learn, and Verify</span> sessions run live,
                time-framed verification in parallel, without building your own UX. Learn adds
                open-ended assignment depth that stays practical as volume grows. We help you surface data
                that no traditional tech can beat.
              </p>
            </div>
          </div>
          <div className="min-w-0 w-full lg:col-span-6">
            <figure
              className="console-copy overflow-hidden rounded-none"
              data-landing-ranking-visual
            >
              <Image
                src={VERIFICATION_SCALE_COPY.imageSrc}
                alt={VERIFICATION_SCALE_COPY.imageAlt}
                width={2080}
                height={1644}
                className="h-auto w-full object-cover object-center"
                sizes="(max-width: 768px) 100vw, 560px"
                priority
              />
            </figure>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
