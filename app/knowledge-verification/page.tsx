import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import { KNOWLEDGE_VERIFICATION_PATH } from "@/lib/marketing/paths";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_PLATFORM_COPY,
  VERIFICATION_PRODUCT_COPY,
  VERIFICATION_SCALE_COPY,
} from "@/lib/marketing/verification-product";
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
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          {VERIFICATION_PRODUCT_COPY.eyebrow}
        </div>
        <h1 className="max-w-5xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[68px]">
          Verify Human Knowledge.
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-relaxed text-zinc-400">
          A Knowledge Verification product for enterprise use cases: confirm that knowledge is actually held, without traditional tests and exams, with the guarantee that results cannot be cheated or faked.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={VERIFICATION_PRODUCT_COPY.pricingHref}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {VERIFICATION_PRODUCT_COPY.pricingCta}
            <ArrowRight className="ml-2" size={16} />
          </Link>
        </div>
      </section>

      <section id="platform" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-2 sm:pb-10">
        <SectionHeading
          eyebrow={VERIFICATION_PLATFORM_COPY.eyebrow}
          title={VERIFICATION_PLATFORM_COPY.title}
        />
        <p className="mt-4 max-w-5xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Every workspace puts people into a shared embedding geometry. Create knowledge regions,
          multi-select users, and read{" "}
          <span className="text-zinc-200">distance to knowledge</span> live: see how people do against your
          defined knowledge regions.
        </p>
        <p className="mt-3 max-w-5xl text-base leading-relaxed text-zinc-500 sm:text-[15px]">
          Create{" "}
          <span className="text-zinc-300">custom knowledge regions</span> from internal expert data and measure
          your workforce readiness without sharing confidential information about your internal systems.
          Regions stay private to the workspace.
        </p>
        <div
          className="mt-6 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
          data-landing-knowledge-visual
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[2918/1656]">
            <Image
              src="/knowledgeg2.png"
              alt="Uncertain Systems Knowledge embeddings: multi-user projection with knowledge regions and knowledge distance"
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
              We help you build a living map of proximity to any kind of knowledge. We ground our results on real
              and genuine work traces, with the guarantee that results cannot be cheated or faked.
            </p>
          </div>
        </div>
      </section>

      <section id="approach" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:pb-10">
        <SectionHeading
          eyebrow={VERIFICATION_APPROACH_COPY.eyebrow}
          title={VERIFICATION_APPROACH_COPY.title}
        />
        <div className="mt-6 border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p>
            Uncertain Systems builds a learning world model from real work: skills, scenarios, proof of work,
            and where reasoning breaks. Our hosted interfaces as well as our API products are all specially
            designed to elicit genuine raw work data from the user while at the same time minimizing the
            disruption of the natural cognitive process.
          </p>
          <p className="mt-5">
            Our conversational interfaces run on top of an interruption model (
            <span className="text-zinc-200">TIM — Trace Interruption Model</span>) that uses the evolving
            learner model to proactively steer the thinking process.
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
        className="relative z-10 mx-auto max-w-6xl px-6 pb-12 sm:pb-16"
        data-landing-scale-section
      >
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
          <div className="min-w-0">
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
                <span className="text-zinc-200">Think Aloud Protocol (TAP)</span> runs live, time-framed
                verification in parallel, without building your own UX. With our{" "}
                <span className="text-zinc-200">Integrated Learning Environment (ILE)</span> we add open-ended
                assignment depth that stays practical as volume grows. We help you surface data that no
                traditional tech can beat.
              </p>
            </div>
          </div>
          <div className="min-w-0 w-full md:justify-self-end">
            <figure
              className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.85)] md:max-w-lg lg:max-w-xl md:ml-auto"
              data-landing-ranking-visual
            >
              <Image
                src="/ranking_app.png"
                alt="Ranking by proximity to a knowledge region bar"
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
