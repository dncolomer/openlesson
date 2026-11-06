import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { LearningModelFactorCopy } from "@/components/science/LearningModelFactorCopy";
import { LearningModelObjectGlyph } from "@/components/science/LearningModelMarks";
import { LearningModelPipelines } from "@/components/science/LearningModelPipelines";
import { LearningModelScene } from "@/components/science/LearningModelScene";
import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
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
      className="relative min-h-screen border border-white/40 bg-[#0e1c2c] text-zinc-200 selection:bg-zinc-700"
      data-science-learning-model
    >
      <PublicPageField />
      <PublicConsoleWash />
      <LandingNav />
      <div className={`${MARKETING_SHELL} pt-5 pb-12 sm:pt-6 sm:pb-14`}>
        <Link
          href="/science"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Vision
        </Link>

        <section className="mt-4 grid items-stretch gap-3 lg:grid-cols-12">
          <header className="console-copy flex h-full flex-col justify-center p-5 sm:p-6 lg:col-span-7 lg:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-medium leading-[1.12] tracking-[-1.2px] text-white sm:text-4xl lg:text-[2.75rem]">
              {copy.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg">{copy.lead}</p>
          </header>
          <ol className="console-copy h-full overflow-hidden lg:col-span-5">
            <li className="px-5 py-5 sm:px-6 sm:py-6">
              <h2
                id="learning-model-foundation"
                className="text-lg font-medium tracking-[-0.4px] text-white sm:text-xl"
              >
                {copy.foundationTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy.foundation}</p>
            </li>
            <li className="border-t border-zinc-800/90 px-5 py-5 sm:px-6 sm:py-6">
              <h2
                id="learning-model-how"
                className="text-lg font-medium tracking-[-0.4px] text-white sm:text-xl"
              >
                {copy.howTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy.how}</p>
            </li>
          </ol>
        </section>

        <section className="mt-3" aria-labelledby="learning-model-explorer-heading">
          <div className="console-copy overflow-hidden">
            <div className="grid lg:grid-cols-12">
              <div className="flex flex-col justify-center p-5 sm:p-6 lg:col-span-4 lg:p-7">
                <h2
                  id="learning-model-explorer-heading"
                  className="text-2xl font-medium tracking-[-0.6px] text-white"
                >
                  {copy.explorerTitle}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  <LearningModelFactorCopy text={copy.explorerLead} />
                </p>
              </div>
              <div className="min-h-[22rem] border-t border-zinc-800/90 lg:col-span-8 lg:border-t-0 lg:border-l">
                <div className="p-4 sm:p-5">
                  <LearningModelScene />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-3" aria-labelledby="learning-model-concepts">
          <div className="console-copy overflow-hidden">
            <div className="border-b border-zinc-800/90 px-5 py-5 sm:px-6 sm:py-6">
              <h2
                id="learning-model-concepts"
                className="text-2xl font-medium tracking-[-0.6px] text-white"
              >
                {copy.conceptsTitle}
              </h2>
            </div>
            <div className="grid md:grid-cols-2">
              {LEARNING_MODEL_OBJECTS.map((concept, index) => (
                <article
                  key={concept.id}
                  data-learning-model-concept={concept.id}
                  className={`flex gap-4 p-5 sm:p-6 ${
                    index % 2 === 1 ? "md:border-l md:border-zinc-800/90" : ""
                  } ${index > 1 ? "border-t border-zinc-800/90" : index === 1 ? "border-t border-zinc-800/90 md:border-t-0" : ""}`}
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
          </div>
        </section>

        <section className="mt-3" aria-labelledby="learning-model-modes">
          <div className="console-copy overflow-hidden">
            <div className="px-5 py-5 sm:px-6 sm:py-6 lg:px-7">
              <h2
                id="learning-model-modes"
                className="text-2xl font-medium tracking-[-0.6px] text-white"
              >
                {copy.pipelinesTitle}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-zinc-400">{copy.pipelinesLead}</p>
            </div>
            <div className="border-t border-zinc-800/90">
              <LearningModelPipelines />
            </div>
          </div>
        </section>

        <section className="mt-3" aria-labelledby="learning-model-projection">
          <article className="console-copy p-5 sm:p-6 lg:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              {copy.projectionTitle}
            </p>
            <h2
              id="learning-model-projection"
              className="mt-3 text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.projectionHeading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">{copy.projection}</p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">{copy.caveat}</p>
          </article>
        </section>

        <p className="mt-6">
          <Link
            href="/science#science-epistemic-foraging"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-white"
          >
            Epistemic foraging
            <ArrowRight size={14} />
          </Link>
        </p>
      </div>
      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
