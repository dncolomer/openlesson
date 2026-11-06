import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { ScrollToHash } from "@/components/science/ScrollToHash";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MarketingDirectoryHero,
} from "@/components/marketing/MarketingDirectoryHero";
import {
  TAP_WHITEPAPER_PATH,
  TAP_STASH_SUBMIT_WHITEPAPER,
} from "@/lib/science/tap-stash-submit-whitepaper";
import {
  KNOWLEDGE_TOMOGRAPHY_WHITEPAPER,
  KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH,
} from "@/lib/science/knowledge-tomography-whitepaper";
import { SCIENCE_FEP_COPY } from "@/lib/science/free-energy-principle-copy";
import {
  SCIENCE_EPISTEMIC_FORAGING_COPY,
  SCIENCE_EPISTEMIC_FORAGING_READINGS,
} from "@/lib/science/epistemic-foraging-copy";
import { SCIENCE_LEARNING_MODEL_COPY, SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";
import {
  SCIENCE_HUB_COPY,
  SCIENCE_HUB_DIRECTORY,
  SCIENCE_HUB_PATH,
} from "@/lib/science/hub";
import {
  VISION_TOMOGRAPHY_INDUCTION_COPY,
  VISION_TOMOGRAPHY_INDUCTION_PATHS,
} from "@/lib/vision/knowledge-tomography-induction-copy";

import { standardShareSocialMetadata } from "@/lib/og/standard";

import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import { MARKETING_MEDIA_FILL_CLASS, MARKETING_SHELL } from "@/lib/marketing/shell";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${SCIENCE_HUB_PATH}`,
});

export const metadata: Metadata = {
  title: "Vision",
  description:
    "Self-driving technology for learning, grounded in a physical model of knowledge: epistemic foraging, configuration, proximity, and transformation with less wasted effort.",
  alternates: { canonical: "https://uncertain.systems/science" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function SciencePage() {
  return (
    <main
      className="relative min-h-screen border border-white/40 bg-[#0e1c2c] text-zinc-200 selection:bg-zinc-700 [&_section[id]]:scroll-mt-24"
      data-science-hub
    >
      <ScrollToHash />
      <PublicPageField image="/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg" />
      <PublicConsoleWash />
      <LandingNav />

      <MarketingDirectoryHero
        eyebrows={[SCIENCE_HUB_COPY.eyebrowVision, SCIENCE_HUB_COPY.eyebrowScience]}
        title={SCIENCE_HUB_COPY.title}
        directoryEyebrow={SCIENCE_HUB_COPY.directoryEyebrow}
        directoryTitle={SCIENCE_HUB_COPY.directoryTitle}
        directoryLead={SCIENCE_HUB_COPY.directoryLead}
        directoryHeadingId="science-directory-heading"
        links={SCIENCE_HUB_DIRECTORY}
        marker="science-hub"
        actions={
          <TrackedCtaLink
            href={SCIENCE_HUB_COPY.workspaceHref}
            label={SCIENCE_HUB_COPY.workspaceCta}
            location="science_hub_hero"
            page={SCIENCE_HUB_PATH}
            className={MARKETING_HERO_PRIMARY_CTA_CLASS}
          >
            {SCIENCE_HUB_COPY.workspaceCta}
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
        }
      >
        <p>{SCIENCE_HUB_COPY.lead}</p>
      </MarketingDirectoryHero>

      <section
        id="why"
        data-science-why
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="science-why-heading"
      >
        <div className="grid items-stretch gap-3 lg:grid-cols-12 lg:gap-5">
          <div
            className="console-copy flex min-h-0 flex-col overflow-hidden lg:col-span-7"
            data-science-why-visual
          >
            <div
              className={`relative min-h-[20rem] flex-1 ${MARKETING_MEDIA_FILL_CLASS} sm:min-h-[24rem] lg:min-h-[28rem]`}
            >
              <Image
                src={SCIENCE_HUB_COPY.whyImageSrc}
                alt={SCIENCE_HUB_COPY.whyImageAlt}
                fill
                className={`object-contain ${MARKETING_MEDIA_FILL_CLASS}`}
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-col lg:col-span-5">
            <div className="console-copy flex h-full flex-col justify-center p-5 sm:p-6 lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                01 · {SCIENCE_HUB_COPY.whyEyebrow}
              </p>
              <h2
                id="science-why-heading"
                className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
              >
                {SCIENCE_HUB_COPY.whyTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
                {SCIENCE_HUB_COPY.whyP1}
              </p>
              <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
                {SCIENCE_HUB_COPY.whyP2}
              </p>
              <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
                {SCIENCE_HUB_COPY.whyP3}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${MARKETING_SHELL} pt-3`}>
        <div className="console-copy overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <section
              id="science-free-energy"
              data-science-free-energy
              className="p-5 sm:p-6 lg:p-7"
              aria-labelledby="science-fep-heading"
            >
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                02 · {SCIENCE_FEP_COPY.eyebrow}
              </p>
              <h2
                id="science-fep-heading"
                className="mt-3 text-xl font-medium tracking-[-0.6px] text-white sm:text-2xl"
              >
                {SCIENCE_FEP_COPY.title}
              </h2>
              <div className="mt-4 space-y-3">
                <p className="text-sm leading-relaxed text-zinc-400">{SCIENCE_FEP_COPY.influence}</p>
                <p className="text-sm leading-relaxed text-zinc-300">{SCIENCE_FEP_COPY.name}</p>
                <p className="text-sm leading-relaxed text-zinc-500">{SCIENCE_FEP_COPY.caveat}</p>
              </div>
            </section>

            <section
              id="science-epistemic-foraging"
              data-science-epistemic-foraging
              className="border-t border-zinc-800/90 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-7"
              aria-labelledby="science-epistemic-foraging-heading"
            >
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {SCIENCE_EPISTEMIC_FORAGING_COPY.eyebrow}
              </p>
              <h2
                id="science-epistemic-foraging-heading"
                className="mt-3 text-xl font-medium tracking-[-0.6px] text-white sm:text-2xl"
              >
                {SCIENCE_EPISTEMIC_FORAGING_COPY.title}
              </h2>
              <div className="mt-4 space-y-3">
                <p className="text-sm leading-relaxed text-zinc-400">
                  {SCIENCE_EPISTEMIC_FORAGING_COPY.definition}
                </p>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {SCIENCE_EPISTEMIC_FORAGING_COPY.platform}
                </p>
                <p className="text-sm leading-relaxed text-zinc-500">
                  {SCIENCE_EPISTEMIC_FORAGING_COPY.caveat}
                </p>
                <Link
                  href={SCIENCE_LEARNING_MODEL_PATH}
                  data-science-learning-model-link
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                >
                  {SCIENCE_LEARNING_MODEL_COPY.title}
                  <ArrowRight size={14} />
                </Link>
              </div>
            </section>
          </div>

          <div
            className="border-t border-zinc-800/90 p-5 sm:p-6 lg:p-7"
            data-science-epistemic-foraging-readings
          >
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              Further reading
            </p>
            <ul className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
              {SCIENCE_EPISTEMIC_FORAGING_READINGS.map((reading) => (
                <li key={reading.id} className="text-sm leading-relaxed text-zinc-400">
                  <a
                    href={reading.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex max-w-full items-start gap-1.5 text-zinc-200 transition hover:text-white"
                  >
                    <span>
                      {reading.authors} ({reading.year}).{" "}
                      <span className="font-medium italic">{reading.title}</span>. {reading.venue}.
                    </span>
                    <ExternalLink
                      size={12}
                      className="mt-1 shrink-0 text-zinc-500 transition group-hover:text-zinc-300"
                      aria-hidden
                    />
                  </a>
                  <p className="mt-1 text-zinc-500">{reading.why}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="knowledge-tomography-induction"
        data-vision-tomography-induction
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="vision-tomography-induction-heading"
      >
        <div className="console-copy overflow-hidden">
          <div className="grid lg:grid-cols-12">
            <div className="flex flex-col justify-center p-5 sm:p-6 lg:col-span-5 lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                03 · {VISION_TOMOGRAPHY_INDUCTION_COPY.eyebrow}
              </p>
              <h2
                id="vision-tomography-induction-heading"
                className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
              >
                {VISION_TOMOGRAPHY_INDUCTION_COPY.title}
              </h2>
              <p
                className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base"
                data-vision-tomography-induction-lead
              >
                {VISION_TOMOGRAPHY_INDUCTION_COPY.lead}
              </p>
              <p
                className="mt-4 text-sm leading-relaxed text-zinc-500"
                data-vision-tomography-induction-distinction
              >
                {VISION_TOMOGRAPHY_INDUCTION_COPY.distinction}
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link
                  href={VISION_TOMOGRAPHY_INDUCTION_PATHS.epistemicForaging}
                  data-vision-epistemic-foraging-link
                  className="inline-flex items-center gap-1.5 text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                >
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.links.foragingLabel}
                  <ArrowRight size={13} />
                </Link>
                <Link
                  href={SCIENCE_LEARNING_MODEL_PATH}
                  data-vision-learning-model-link
                  className="inline-flex items-center gap-1.5 text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                >
                  {SCIENCE_LEARNING_MODEL_COPY.title}
                  <ArrowRight size={13} />
                </Link>
                <Link
                  href={VISION_TOMOGRAPHY_INDUCTION_PATHS.knowledgeTomographyPaper}
                  data-vision-knowledge-tomography-paper-link
                  className="inline-flex items-center gap-1.5 text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                >
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.links.paperLabel}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
            <div className="grid border-t border-zinc-800/90 md:grid-cols-3 lg:col-span-7 lg:grid-cols-1 lg:border-t-0 lg:border-l">
              <article data-vision-epistemic-foraging className="px-5 py-5 sm:px-6 sm:py-6">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  01 · {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.eyebrow}
                </p>
                <h3 className="mt-1.5 text-lg font-medium text-white">
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.body}
                </p>
              </article>
              <article className="border-t border-zinc-800/90 px-5 py-5 sm:px-6 sm:py-6 md:border-t-0 md:border-l lg:border-l-0 lg:border-t">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  02 · {VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.eyebrow}
                </p>
                <h3 className="mt-1.5 text-lg font-medium tracking-[-0.4px] text-white">
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.body}
                </p>
              </article>
              <article className="border-t border-zinc-800/90 px-5 py-5 sm:px-6 sm:py-6 md:border-t-0 md:border-l lg:border-l-0 lg:border-t">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  03 · {VISION_TOMOGRAPHY_INDUCTION_COPY.induction.eyebrow}
                </p>
                <h3 className="mt-1.5 text-lg font-medium tracking-[-0.4px] text-white">
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.induction.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {VISION_TOMOGRAPHY_INDUCTION_COPY.induction.body}
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section
        id="research"
        data-science-research
        className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}
        aria-labelledby="science-research-heading"
      >
        <div className="console-copy overflow-hidden">
          <div className="grid lg:grid-cols-12">
            <div className="flex flex-col justify-center p-5 sm:p-6 lg:col-span-5 lg:p-7">
              <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                04 · Research
              </div>
              <h2
                id="science-research-heading"
                className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
              >
                Methods &amp; planned experiments
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Academic working papers on knowledge tomography, how we externalize cognition as Proof of
                Work, and how we plan to embed that data into a Map of Knowledge toward knowledge induction.
              </p>
            </div>
            <div className="grid border-t border-zinc-800/90 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-1 lg:border-t-0 lg:border-l">
              <Link
                href={KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH}
                data-science-research-link
                data-science-research-link-knowledge-tomography
                className="group block px-5 py-5 sm:px-6 sm:py-6"
              >
                <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                  Working paper · {KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.meta.date}
                </p>
                <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">
                  {KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.meta.shortTitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {KNOWLEDGE_TOMOGRAPHY_WHITEPAPER.meta.description}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition group-hover:text-white">
                  Read the white paper
                  <ArrowRight size={14} />
                </span>
              </Link>
              <Link
                href={TAP_WHITEPAPER_PATH}
                data-science-research-link
                data-science-research-link-tap
                className="group block border-t border-zinc-800/90 px-5 py-5 sm:border-t-0 sm:border-l sm:px-6 sm:py-6 lg:border-l-0 lg:border-t"
              >
                <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                  Working paper · {TAP_STASH_SUBMIT_WHITEPAPER.meta.date}
                </p>
                <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">
                  {TAP_STASH_SUBMIT_WHITEPAPER.meta.shortTitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {TAP_STASH_SUBMIT_WHITEPAPER.meta.description}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition group-hover:text-white">
                  Read the white paper
                  <ArrowRight size={14} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
