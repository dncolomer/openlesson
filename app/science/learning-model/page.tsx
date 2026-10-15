import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { LearningModelCatalogs } from "@/components/science/LearningModelCatalogs";
import { LearningModelFactorCopy } from "@/components/science/LearningModelFactorCopy";
import { LearningModelObjectGlyph } from "@/components/science/LearningModelMarks";
import { LearningModelPipelines } from "@/components/science/LearningModelPipelines";
import { LearningModelScene } from "@/components/science/LearningModelScene";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import { LEARNING_MODEL_OBJECTS, LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import { standardShareSocialMetadata } from "@/lib/og/standard";
import {
  SCIENCE_LEARNING_MODEL_COPY,
  SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS,
  SCIENCE_LEARNING_MODEL_PATH,
} from "@/lib/science/learning-model-copy";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${SCIENCE_LEARNING_MODEL_PATH}`,
});

export const metadata: Metadata = {
  title: LEARNING_MODEL_PUBLIC_LABEL,
  description: SCIENCE_LEARNING_MODEL_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${SCIENCE_LEARNING_MODEL_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function ScienceLearningModelPage() {
  const copy = SCIENCE_LEARNING_MODEL_COPY;
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-science-learning-model
    >
      <PublicConsoleWash />
      <div className="relative z-10">
        <LandingNav />
        <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
          <Link
            href="/science"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft size={14} />
            Vision
          </Link>

          <header className="mt-8 border-b border-zinc-800 pb-10 sm:mt-10 sm:pb-12">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 text-3xl font-medium leading-[1.12] tracking-[-1.2px] text-white sm:text-4xl lg:text-[2.75rem]">
              {copy.title}
            </h1>
            <p className="mt-6 text-base leading-relaxed text-zinc-400 sm:text-lg">
              {copy.lead}
            </p>
          </header>

          <section className="mt-12" aria-labelledby="learning-model-foundation">
            <h2
              id="learning-model-foundation"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.foundationTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              {copy.foundation}
            </p>
          </section>

          <section className="mt-12" aria-labelledby="learning-model-how">
            <h2
              id="learning-model-how"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.howTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">{copy.how}</p>
          </section>

          <section className="mt-12" aria-labelledby="learning-model-explorer-heading">
            <h2
              id="learning-model-explorer-heading"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.explorerTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              <LearningModelFactorCopy text={copy.explorerLead} />
            </p>
            <div className="console-copy mt-6 overflow-hidden p-0 sm:p-0">
              <div className="p-4 sm:p-5">
                <LearningModelScene />
              </div>
            </div>
          </section>

          <section className="mt-16" aria-labelledby="learning-model-concepts">
            <h2
              id="learning-model-concepts"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.conceptsTitle}
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {LEARNING_MODEL_OBJECTS.map((concept) => (
                <article
                  key={concept.id}
                  data-learning-model-concept={concept.id}
                  className="console-copy flex gap-4 p-5 sm:p-6"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-clip border border-white/25 text-zinc-200 [clip-path:inset(0)]">
                    <LearningModelObjectGlyph id={concept.id} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      {concept.symbol}
                    </p>
                    <h3 className="mt-1 text-lg text-white">{concept.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                      {SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS[concept.id] ?? concept.meaning}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16" aria-labelledby="learning-model-catalogs">
            <h2
              id="learning-model-catalogs"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.catalogsTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              {copy.catalogsLead}
            </p>
            <div className="mt-6">
              <LearningModelCatalogs />
            </div>
          </section>

          <section className="mt-16" aria-labelledby="learning-model-modes">
            <h2
              id="learning-model-modes"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.pipelinesTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              {copy.pipelinesLead}
            </p>
            <div className="mt-6">
              <LearningModelPipelines />
            </div>
          </section>

          <section className="mt-16" aria-labelledby="learning-model-projection">
            <article className="console-copy p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {copy.projectionTitle}
              </p>
              <h2
                id="learning-model-projection"
                className="mt-3 text-2xl font-medium tracking-[-0.6px] text-white"
              >
                {copy.projectionHeading}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400">
                {copy.projection}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-500">{copy.caveat}</p>
            </article>
          </section>

          <p className="mt-12">
            <Link
              href="/science#science-epistemic-foraging"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-white"
            >
              Epistemic foraging
              <ArrowRight size={14} />
            </Link>
          </p>
        </div>
        <Footer />
      </div>
    </main>
  );
}
