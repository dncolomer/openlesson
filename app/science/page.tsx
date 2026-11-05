import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { ScrollToHash } from "@/components/science/ScrollToHash";
import { ThesisDirectory } from "@/components/science/ThesisDirectory";
import {
  getPlatformPitchSlide,
  PLATFORM_THESIS_SLIDE_INDEX,
} from "@/lib/sales/platform-pitch-deck";
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
  SCIENCE_HUB_WHY,
} from "@/lib/science/hub";
import {
  VISION_TOMOGRAPHY_INDUCTION_COPY,
  VISION_TOMOGRAPHY_INDUCTION_PATHS,
} from "@/lib/vision/knowledge-tomography-induction-copy";

import { standardShareSocialMetadata } from "@/lib/og/standard";

import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import { MARKETING_SHELL } from "@/lib/marketing/shell";

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

/** Platform pitch slide 10 (thesis) — rendered at the top of /science. */
const thesisSlide = getPlatformPitchSlide(PLATFORM_THESIS_SLIDE_INDEX);

export default function SciencePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0e1c2c] text-zinc-200 selection:bg-zinc-700 [&_section[id]]:scroll-mt-24"
      data-science-hub
    >
      <ScrollToHash />
      <PublicPageField image="/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg" />
      <PublicConsoleWash />
      <LandingNav />

      <section className={`${MARKETING_SHELL} pt-5 pb-3 sm:pt-6`}>
        <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-7">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
                {SCIENCE_HUB_COPY.eyebrowVision}
              </div>
              <div className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
                {SCIENCE_HUB_COPY.eyebrowScience}
              </div>
            </div>
            <h1 className="max-w-4xl text-[1.75rem] font-medium leading-[1.08] tracking-[-1px] text-white sm:text-5xl sm:tracking-[-2px] lg:text-6xl">
              {SCIENCE_HUB_COPY.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              {SCIENCE_HUB_COPY.lead}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <TrackedCtaLink
                href={SCIENCE_HUB_COPY.workspaceHref}
                label={SCIENCE_HUB_COPY.workspaceCta}
                location="science_hub_hero"
                page={SCIENCE_HUB_PATH}
                className="inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                {SCIENCE_HUB_COPY.workspaceCta}
                <ArrowRight className="ml-2" size={16} />
              </TrackedCtaLink>
            </div>
          </div>
          <div
            className="console-copy p-5 sm:p-6 lg:col-span-5"
            aria-labelledby="science-directory-heading"
          >
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {SCIENCE_HUB_COPY.directoryEyebrow}
            </p>
            <h2
              id="science-directory-heading"
              className="mt-2 text-lg font-medium tracking-[-0.4px] text-white"
            >
              {SCIENCE_HUB_COPY.directoryTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {SCIENCE_HUB_COPY.directoryLead}
            </p>
            <div className="mt-2">
              <ThesisDirectory
                links={SCIENCE_HUB_DIRECTORY}
                marker="science-hub"
                columns="grid-cols-1"
                tone="index"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="why"
        data-science-why
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="science-why-heading"
      >
        <div className="console-copy p-5 sm:p-6 lg:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            {SCIENCE_HUB_COPY.whyEyebrow}
          </p>
          <h2
            id="science-why-heading"
            className="mt-3 max-w-3xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
          >
            {SCIENCE_HUB_COPY.whyTitle}
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
            {SCIENCE_HUB_WHY.map((card) => (
              <article key={card.title}>
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{card.eyebrow}</p>
                <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Platform pitch slide 10 — Our thesis */}
      {thesisSlide ? (
        <section
          id="science-thesis-slide"
          data-science-pitch-slide={PLATFORM_THESIS_SLIDE_INDEX}
          data-science-slide-kicker={thesisSlide.kicker ?? ""}
          aria-labelledby="science-thesis-heading"
          className={`${MARKETING_SHELL} pt-3`}
        >
          <div className="console-copy p-5 sm:p-6 lg:p-7">
            {thesisSlide.kicker ? (
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {thesisSlide.kicker}
              </p>
            ) : null}
            <h2
              id="science-thesis-heading"
              className="mt-3 max-w-4xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
            >
              {thesisSlide.title}
            </h2>

            <div className="mt-6 space-y-6">
              {(thesisSlide.highlights ?? []).map((item, index) => {
                const label = thesisSlide.highlightLabels?.[index];
                const image = thesisSlide.highlightImages?.[index];
                const imageAlt = thesisSlide.highlightImageAlts?.[index];
                const imageSource = thesisSlide.highlightImageSources?.[index];
                return (
                  <div
                    key={`hl-${index}`}
                    data-science-pitch-highlight
                    className="grid items-start gap-4 sm:grid-cols-12 sm:gap-6"
                  >
                    {image ? (
                      <figure className="sm:col-span-4">
                        <Image
                          src={image}
                          alt={imageAlt || label || "Thesis illustration"}
                          width={480}
                          height={320}
                          className="h-auto w-full object-contain"
                        />
                        {imageSource ? (
                          <figcaption className="mt-1.5 font-mono text-[9px] uppercase tracking-[1.4px] text-zinc-500">
                            {imageSource}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                    <div className={image ? "sm:col-span-8" : "sm:col-span-12"}>
                      {label ? (
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[1.8px] text-zinc-500">
                          {label}
                        </p>
                      ) : null}
                      <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
                        {item}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {(thesisSlide.cards ?? []).length > 0 ? (
              <div
                data-science-pitch-cards
                className="mt-6 grid gap-5 border-t border-white/15 pt-6 sm:grid-cols-3"
              >
                {(thesisSlide.cards ?? []).map((card) => (
                  <div key={card.label}>
                    {card.image ? (
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                        <Image
                          src={card.image}
                          alt={card.imageAlt || card.label}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 640px) 100vw, 33vw"
                        />
                      </div>
                    ) : null}
                    <p className="mt-3 text-sm font-medium text-white">{card.label}</p>
                    {card.body ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{card.body}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={`${MARKETING_SHELL} pt-3`}>
        <div className="grid gap-3 lg:grid-cols-2">
          <section
            id="science-free-energy"
            data-science-free-energy
            className="console-copy p-5 sm:p-6"
            aria-labelledby="science-fep-heading"
          >
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {SCIENCE_FEP_COPY.eyebrow}
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
              <p className="text-sm leading-relaxed text-zinc-300">
                {SCIENCE_FEP_COPY.name}
              </p>
              <p className="text-sm leading-relaxed text-zinc-500">
                {SCIENCE_FEP_COPY.caveat}
              </p>
            </div>
          </section>

          <section
            id="science-epistemic-foraging"
            data-science-epistemic-foraging
            className="console-copy p-5 sm:p-6"
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
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
              >
                {SCIENCE_LEARNING_MODEL_COPY.title}
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </div>

        <div className="console-copy mt-3 p-5 sm:p-6" data-science-epistemic-foraging-readings>
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
      </section>

      <section
        id="knowledge-tomography-induction"
        data-vision-tomography-induction
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="vision-tomography-induction-heading"
      >
        <div className="console-copy p-5 sm:p-6 lg:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            {VISION_TOMOGRAPHY_INDUCTION_COPY.eyebrow}
          </p>
          <h2
            id="vision-tomography-induction-heading"
            className="mt-3 max-w-3xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
          >
            {VISION_TOMOGRAPHY_INDUCTION_COPY.title}
          </h2>
          <p
            className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base"
            data-vision-tomography-induction-lead
          >
            {VISION_TOMOGRAPHY_INDUCTION_COPY.lead}
          </p>
          <div className="mt-6 grid gap-6 border-t border-white/15 pt-6 md:grid-cols-3">
            <article data-vision-epistemic-foraging>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.eyebrow}
              </p>
              <h3 className="mt-2 text-lg font-medium text-white">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.body}
              </p>
            </article>
            <article>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.eyebrow}
              </p>
              <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.body}
              </p>
            </article>
            <article>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.induction.eyebrow}
              </p>
              <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.induction.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {VISION_TOMOGRAPHY_INDUCTION_COPY.induction.body}
              </p>
            </article>
          </div>
          <p
            className="mt-6 text-sm leading-relaxed text-zinc-500"
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
      </section>

      <section
        id="research"
        data-science-research
        className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}
        aria-labelledby="science-research-heading"
      >
        <div className="console-copy p-5 sm:p-6 lg:p-7">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Research</div>
          <h2
            id="science-research-heading"
            className="mt-3 max-w-3xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
          >
            Methods &amp; planned experiments
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Academic working papers on knowledge tomography, how we externalize cognition as Proof of
            Work, and how we plan to embed that data into a Map of Knowledge toward knowledge induction.
          </p>
          <div className="mt-6 grid gap-6 border-t border-white/15 pt-6 sm:grid-cols-2">
            <Link
              href={KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH}
              data-science-research-link
              data-science-research-link-knowledge-tomography
              className="group block"
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
              className="group block"
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
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
