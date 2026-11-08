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
import { SCIENCE_FEP_COPY } from "@/lib/science/free-energy-principle-copy";
import {
  SCIENCE_EPISTEMIC_FORAGING_COPY,
  SCIENCE_PAGE_READINGS,
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
import { SCIENCE_ENHANCEMENT_COPY } from "@/lib/science/cognitive-enhancement-copy";
import {
  SCIENCE_HORIZON_COPY,
  SCIENCE_REFERENCES_COPY,
  SCIENCE_SYMBIOSIS_COPY,
} from "@/lib/science/symbiosis-and-horizon-copy";

import { standardShareSocialMetadata } from "@/lib/og/standard";

import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import { MARKETING_MEDIA_FILL_CLASS, MARKETING_SHELL } from "@/lib/marketing/shell";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${SCIENCE_HUB_PATH}`,
});

const SCIENCE_INLINE_LINK_CLASS =
  "font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500";

export const metadata: Metadata = {
  title: "Vision",
  description:
    "Scientific influences, current software, and a longer-term aim: systems that adapt around a mind so difficult knowledge takes less cognitive effort to acquire. The science includes epistemic foraging.",
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
        {SCIENCE_HUB_COPY.lead.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
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
        <div className="console-copy mt-3 overflow-hidden" data-science-why-example>
          <div className="grid lg:grid-cols-12">
            <article className="p-5 sm:p-6 lg:col-span-6 lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {SCIENCE_HUB_COPY.whyProofEyebrow}
              </p>
              <h3 className="mt-2 text-lg font-medium text-white">
                {SCIENCE_HUB_COPY.whyProofTitle}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_HUB_COPY.whyProof}
              </p>
            </article>
            <article className="border-t border-zinc-800/90 p-5 sm:p-6 lg:col-span-6 lg:border-t-0 lg:border-l lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                CONTEXTS
              </p>
              <h3 className="mt-2 text-lg font-medium text-white">Hiring and company expertise</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_HUB_COPY.whyContexts}
              </p>
            </article>
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
                <p className="text-sm leading-relaxed text-zinc-400">
                  {SCIENCE_FEP_COPY.influence}
                </p>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {SCIENCE_FEP_COPY.exploration}
                </p>
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
        id="cognitive-enhancement"
        data-science-enhancement
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="science-enhancement-heading"
      >
        <div className="console-copy overflow-hidden">
          <div className="p-5 sm:p-6 lg:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              04 · {SCIENCE_ENHANCEMENT_COPY.eyebrow}
            </p>
            <h2
              id="science-enhancement-heading"
              className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
            >
              {SCIENCE_ENHANCEMENT_COPY.title}
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              {SCIENCE_ENHANCEMENT_COPY.lead}
            </p>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-zinc-400">
              {SCIENCE_ENHANCEMENT_COPY.taxonomyBefore}
              <a
                href={SCIENCE_ENHANCEMENT_COPY.dreslerHref}
                data-science-dresler-link
                target="_blank"
                rel="noopener noreferrer"
                className={SCIENCE_INLINE_LINK_CLASS}
              >
                {SCIENCE_ENHANCEMENT_COPY.dreslerLinkLabel}
              </a>
              {SCIENCE_ENHANCEMENT_COPY.taxonomyAfter}
            </p>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-500">
              {SCIENCE_ENHANCEMENT_COPY.adaptation}
            </p>
          </div>
          <div className="grid border-t border-zinc-800/90 lg:grid-cols-3">
            <article
              id={SCIENCE_ENHANCEMENT_COPY.behavioral.id}
              data-science-behavioral
              className="p-5 sm:p-6 lg:p-7"
            >
              <h3 className="text-lg font-medium text-white">
                {SCIENCE_ENHANCEMENT_COPY.behavioral.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_ENHANCEMENT_COPY.behavioral.body}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_ENHANCEMENT_COPY.behavioral.product}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                {SCIENCE_ENHANCEMENT_COPY.behavioral.thinkAloud}
              </p>
            </article>
            <article
              id={SCIENCE_ENHANCEMENT_COPY.biochemical.id}
              data-science-biochemical
              className="border-t border-zinc-800/90 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-7"
            >
              <h3 className="text-lg font-medium text-white">
                {SCIENCE_ENHANCEMENT_COPY.biochemical.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_ENHANCEMENT_COPY.biochemical.body}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                {SCIENCE_ENHANCEMENT_COPY.biochemical.status}
              </p>
            </article>
            <article
              id={SCIENCE_ENHANCEMENT_COPY.neural.id}
              data-science-neural
              className="border-t border-zinc-800/90 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-7"
            >
              <h3 className="text-lg font-medium text-white">
                {SCIENCE_ENHANCEMENT_COPY.neural.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                <a
                  href={SCIENCE_ENHANCEMENT_COPY.neural.cinelHref}
                  data-science-cinel-link
                  target="_blank"
                  rel="noopener noreferrer"
                  className={SCIENCE_INLINE_LINK_CLASS}
                >
                  {SCIENCE_ENHANCEMENT_COPY.neural.cinelLinkLabel}
                </a>
                {SCIENCE_ENHANCEMENT_COPY.neural.body}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_ENHANCEMENT_COPY.neural.invasiveness}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                {SCIENCE_ENHANCEMENT_COPY.neural.caveat}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        id="human-ai-symbiosis"
        data-science-symbiosis
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="science-symbiosis-heading"
      >
        <div className="console-copy overflow-hidden p-5 sm:p-6 lg:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            05 · {SCIENCE_SYMBIOSIS_COPY.eyebrow}
          </p>
          <h2
            id="science-symbiosis-heading"
            className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
          >
            {SCIENCE_SYMBIOSIS_COPY.title}
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            {SCIENCE_SYMBIOSIS_COPY.lead}
          </p>
          <p className="mt-4 max-w-4xl text-sm leading-relaxed text-zinc-400">
            <a
              href={SCIENCE_SYMBIOSIS_COPY.lickliderHref}
              data-science-licklider-link
              target="_blank"
              rel="noopener noreferrer"
              className={SCIENCE_INLINE_LINK_CLASS}
            >
              {SCIENCE_SYMBIOSIS_COPY.lickliderLinkLabel}
            </a>
            {SCIENCE_SYMBIOSIS_COPY.lickliderAfter}
          </p>
          <p className="mt-4 max-w-4xl text-sm leading-relaxed text-zinc-300">
            {SCIENCE_SYMBIOSIS_COPY.loopLead}
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-400">
            {SCIENCE_SYMBIOSIS_COPY.loopSoftware}
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-500">
            {SCIENCE_SYMBIOSIS_COPY.cognition}
          </p>
        </div>
      </section>

      <section
        id="software-and-research"
        data-science-horizon
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="science-horizon-heading"
      >
        <div className="console-copy overflow-hidden">
          <div className="p-5 sm:p-6 lg:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              06 · {SCIENCE_HORIZON_COPY.eyebrow}
            </p>
            <h2
              id="science-horizon-heading"
              className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
            >
              {SCIENCE_HORIZON_COPY.title}
            </h2>
          </div>
          <div className="grid border-t border-zinc-800/90 lg:grid-cols-2">
            <article className="p-5 sm:p-6 lg:p-7">
              <h3 className="text-lg font-medium text-white">
                {SCIENCE_HORIZON_COPY.currentEyebrow}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_HORIZON_COPY.current}
              </p>
            </article>
            <article className="border-t border-zinc-800/90 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-7">
              <h3 className="text-lg font-medium text-white">
                {SCIENCE_HORIZON_COPY.horizonEyebrow}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_HORIZON_COPY.horizon}
              </p>
            </article>
          </div>
          <div className="grid border-t border-zinc-800/90 lg:grid-cols-2">
            <article className="p-5 sm:p-6 lg:p-7">
              <h3 className="text-lg font-medium text-white">
                {SCIENCE_HORIZON_COPY.progressEyebrow}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_HORIZON_COPY.progress}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                {SCIENCE_HORIZON_COPY.validation}
              </p>
            </article>
            <article className="border-t border-zinc-800/90 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-7">
              <h3 className="text-lg font-medium text-white">
                {SCIENCE_HORIZON_COPY.ethicsEyebrow}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {SCIENCE_HORIZON_COPY.ethics}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        id="science-references"
        data-science-references
        className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}
        aria-labelledby="science-references-heading"
      >
        <div className="console-copy overflow-hidden p-5 sm:p-6 lg:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            07 · {SCIENCE_REFERENCES_COPY.eyebrow}
          </p>
          <h2
            id="science-references-heading"
            className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
          >
            {SCIENCE_REFERENCES_COPY.title}
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-relaxed text-zinc-500">
            {SCIENCE_REFERENCES_COPY.lead}
          </p>
          <ul className="mt-6 grid gap-x-8 gap-y-4 lg:grid-cols-2" data-science-epistemic-foraging-readings>
            {SCIENCE_PAGE_READINGS.map((reading) => (
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
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
