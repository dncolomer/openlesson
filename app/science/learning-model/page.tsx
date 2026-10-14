import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { LearningModelExplorer } from "@/components/science/LearningModelExplorer";
import { LearningModelPipelines } from "@/components/science/LearningModelPipelines";
import { LearningModelSchematic } from "@/components/science/LearningModelSchematic";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import {
  LEARNING_MODEL_CATALOG_16,
  LEARNING_MODEL_CATALOG_4,
  LEARNING_MODEL_CATALOG_8,
  LEARNING_MODEL_OBJECTS,
  LEARNING_MODEL_SIZE_COPY,
} from "@/lib/learning-model";
import { standardShareSocialMetadata } from "@/lib/og/standard";
import {
  SCIENCE_LEARNING_MODEL_COPY,
  SCIENCE_LEARNING_MODEL_PATH,
} from "@/lib/science/learning-model-copy";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${SCIENCE_LEARNING_MODEL_PATH}`,
});

export const metadata: Metadata = {
  title: "Learning model",
  description: SCIENCE_LEARNING_MODEL_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${SCIENCE_LEARNING_MODEL_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const CATALOGS = [
  { size: 4 as const, actions: LEARNING_MODEL_CATALOG_4 },
  { size: 8 as const, actions: LEARNING_MODEL_CATALOG_8 },
  { size: 16 as const, actions: LEARNING_MODEL_CATALOG_16 },
];

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
            Science
          </Link>

          <header className="mt-8 border-b border-zinc-800 pb-10 sm:mt-10 sm:pb-12">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-medium leading-[1.12] tracking-[-1.2px] text-white sm:text-4xl lg:text-[2.75rem]">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              {copy.lead}
            </p>
          </header>

          <section className="mt-12" aria-labelledby="learning-model-schematic">
            <h2
              id="learning-model-schematic"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.schematicTitle}
            </h2>
            <div className="mt-6">
              <LearningModelSchematic />
            </div>
          </section>

          <section className="mt-12" aria-labelledby="learning-model-objects">
            <h2
              id="learning-model-objects"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.objectsTitle}
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {LEARNING_MODEL_OBJECTS.map((object) => (
                <article
                  key={object.id}
                  data-learning-model-object={object.id}
                  className="console-copy p-5"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    {object.symbol} · stored {object.stored}
                  </p>
                  <h3 className="mt-2 text-lg text-white">{object.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{object.meaning}</p>
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
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">
              {copy.catalogsLead}
            </p>
            <div className="mt-8 space-y-6">
              {CATALOGS.map((catalog) => (
                <article
                  key={catalog.size}
                  data-learning-model-catalog={catalog.size}
                  className="console-copy p-5 sm:p-6"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    {LEARNING_MODEL_SIZE_COPY[catalog.size].title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {LEARNING_MODEL_SIZE_COPY[catalog.size].body}
                  </p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {catalog.actions.map((action) => (
                      <li key={`${catalog.size}-${action.id}`} className="border border-white/15 px-3 py-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                          {action.label} · {action.kind}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{action.meaning}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16" aria-labelledby="learning-model-explorer-heading">
            <h2
              id="learning-model-explorer-heading"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.explorerTitle}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">
              {copy.explorerLead}
            </p>
            <div className="console-copy mt-6 p-5 sm:p-6">
              <LearningModelExplorer />
            </div>
          </section>

          <section className="mt-16" aria-labelledby="learning-model-modes">
            <h2
              id="learning-model-modes"
              className="text-2xl font-medium tracking-[-0.6px] text-white"
            >
              {copy.pipelinesTitle}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">
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
                Work lands on the generative model
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">
                {copy.projection}
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-500">{copy.caveat}</p>
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
