import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import {
  getPlatformPitchSlide,
  PLATFORM_THESIS_SLIDE_INDEX,
} from "@/lib/sales/platform-pitch-deck";
import {
  TAP_WHITEPAPER_PATH,
  TAP_STASH_SUBMIT_WHITEPAPER,
} from "@/lib/science/tap-stash-submit-whitepaper";

import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/science",
});

export const metadata: Metadata = {
  title: "Science",
  description:
    "A holistic model of knowledge: knowledge configuration, proximity, transformation, and a non-invasive path to self-driving learning.",
  alternates: { canonical: "https://uncertain.systems/science" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg";

const PRINCIPLES = [
  {
    number: "01",
    title: "Knowledge Configuration",
    subtitle: "The full physical state of a human brain at a specific point in time.",
    body: "Every moment of thought, memory, and skill lives in a unique configuration of neural activity. Understanding learning means understanding how one configuration relates to another — not just what was answered on a test.",
  },
  {
    number: "02",
    title: "Knowledge = Proximity",
    subtitle: "A useful configuration is close enough to retrieve, apply, and transform.",
    body: "Knowledge is not a binary flag. It is how near your current brain state is to a configuration where you can reliably retrieve, apply, and transform what you need. Closeness — not completion percentage — is the meaningful signal.",
  },
  {
    number: "03",
    title: "Learning = Transformation",
    subtitle: "Learning is movement through configuration space, ideally with less wasted effort.",
    body: "To learn is to move from one configuration toward another useful one. The goal of educational technology should be to shorten that path — reducing wasted effort while preserving depth of understanding.",
  },
  {
    number: "04",
    title: "Non-Invasive Path",
    subtitle: "Start with software attention loops, then add world models, stimulation, and biofeedback.",
    body: "We begin with software: attention loops, Socratic questioning, and proof-of-work verification. Over time we layer world models, non-invasive stimulation, and biofeedback — building toward self-driving learning without asking humans to burn proportionally more energy.",
  },
];

/** Platform pitch slide 10 (thesis) — rendered at the top of /science. */
const thesisSlide = getPlatformPitchSlide(PLATFORM_THESIS_SLIDE_INDEX);

export default function SciencePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          SCIENCE
        </div>
        <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[68px]">
          A holistic model of knowledge.
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-relaxed text-zinc-400">
          Uncertain Systems is grounded in a physical view of learning: knowledge configuration space, proximity
          as the measure of knowing, and education technology as a path toward transformation with less wasted effort.
        </p>
      </section>

      {/* Platform pitch slide 10 — Our thesis — at top of science content */}
      {thesisSlide ? (
        <section
          id="science-thesis-slide"
          data-science-pitch-slide={PLATFORM_THESIS_SLIDE_INDEX}
          data-science-slide-kicker={thesisSlide.kicker ?? ""}
          aria-labelledby="science-thesis-heading"
          className="relative z-10 mx-auto max-w-6xl px-6 pb-10 sm:pb-12"
        >
          <article className="border border-zinc-800 bg-zinc-950/75 p-6 backdrop-blur-sm sm:p-8">
            {thesisSlide.kicker ? (
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-cyan-200/80">
                {thesisSlide.kicker}
              </p>
            ) : null}
            <h2
              id="science-thesis-heading"
              className="max-w-4xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl lg:text-[34px] lg:leading-tight"
            >
              {thesisSlide.title}
            </h2>

            {(thesisSlide.highlights ?? []).map((item, index) => {
              const label = thesisSlide.highlightLabels?.[index];
              const image = thesisSlide.highlightImages?.[index];
              const imageAlt = thesisSlide.highlightImageAlts?.[index];
              const imageSource = thesisSlide.highlightImageSources?.[index];
              return (
                <div
                  key={`hl-${index}`}
                  data-science-pitch-highlight
                  className="mt-6 rounded-sm border border-white/20 bg-white/[0.05] p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                    {image ? (
                      <figure className="w-full shrink-0 sm:w-48">
                        <div className="overflow-hidden rounded-sm border border-zinc-800 bg-black/40">
                          <Image
                            src={image}
                            alt={imageAlt || label || "Thesis illustration"}
                            width={480}
                            height={320}
                            className="h-auto w-full object-contain"
                          />
                        </div>
                        {imageSource ? (
                          <figcaption className="mt-1.5 font-mono text-[9px] uppercase tracking-[1.4px] text-zinc-500">
                            {imageSource}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      {label ? (
                        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[1.8px] text-cyan-200/90">
                          {label}
                        </p>
                      ) : null}
                      <p className="text-base font-medium leading-relaxed text-zinc-100 sm:text-lg">
                        {item}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {(thesisSlide.cards ?? []).length > 0 ? (
              <div
                data-science-pitch-cards
                className="mt-6 grid gap-3 sm:grid-cols-3"
              >
                {(thesisSlide.cards ?? []).map((card) => (
                  <div
                    key={card.label}
                    className="flex flex-col overflow-hidden border border-zinc-800 bg-black/30"
                  >
                    {card.image ? (
                      <div className="relative aspect-[16/10] w-full border-b border-zinc-800 bg-black/50">
                        <Image
                          src={card.image}
                          alt={card.imageAlt || card.label}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 640px) 100vw, 33vw"
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-sm font-medium text-white">{card.label}</p>
                      {card.body ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{card.body}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <div className="space-y-6">
          {PRINCIPLES.map((principle) => (
            <article
              key={principle.number}
              className="border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-sm sm:p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                <p className="shrink-0 font-mono text-3xl font-medium tracking-tight text-zinc-600 sm:w-16">
                  {principle.number}
                </p>
                <div>
                  <h2 className="text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">{principle.title}</h2>
                  <p className="mt-2 text-base font-medium text-zinc-300">{principle.subtitle}</p>
                  <p className="mt-4 text-base leading-relaxed text-zinc-400">{principle.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="research"
        data-science-research
        className="relative z-10 mx-auto max-w-6xl px-6 pb-10 sm:pb-12"
        aria-labelledby="science-research-heading"
      >
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Research</div>
        <h2
          id="science-research-heading"
          className="max-w-3xl text-3xl font-medium leading-[1.08] tracking-[-1.4px] text-white sm:text-4xl"
        >
          Methods &amp; planned experiments
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
          Academic working papers on how we externalize cognition as Proof of Work and how we plan to
          embed that data into a Map of Knowledge.
        </p>
        <Link
          href={TAP_WHITEPAPER_PATH}
          data-science-research-link
          className="mt-6 group block border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-600 sm:p-6"
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
            Working paper · {TAP_STASH_SUBMIT_WHITEPAPER.meta.date}
          </p>
          <h3 className="mt-2 text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">
            {TAP_STASH_SUBMIT_WHITEPAPER.meta.shortTitle}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            {TAP_STASH_SUBMIT_WHITEPAPER.meta.description}
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition group-hover:text-white">
            Read the white paper
            <ArrowRight size={14} />
          </span>
        </Link>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
          <p className="text-base leading-relaxed text-zinc-400">
            This model drives everything we build — from learning verification and think-aloud protocol today,
            to predictive interruption models and non-invasive hardware tomorrow.
          </p>
          <Link
            href="/vision"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
          >
            See our vision
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
