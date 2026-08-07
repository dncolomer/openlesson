import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import type { ScienceWhitepaper } from "@/lib/science/whitepaper-types";

type ScienceWhitepaperPageProps = {
  paper: ScienceWhitepaper;
};

const PLANNED_SECTION_IDS = new Set(["planned-experiment", "planned-study"]);

export function ScienceWhitepaperPage({ paper }: ScienceWhitepaperPageProps) {
  const experimentSteps = paper.experimentSteps ?? [];

  return (
    <main
      className="relative min-h-screen bg-[#0c0c0c] text-zinc-200 selection:bg-zinc-700 selection:text-white"
      data-science-whitepaper
      data-whitepaper-path={paper.path}
    >
      <LandingNav />

      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-20 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
        <Link
          href="/science"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Science
        </Link>

        {/* Hero / title block — full width */}
        <header className="mt-8 border-b border-zinc-800 pb-10 sm:mt-10 sm:pb-12">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            Research · Working paper
          </p>
          <h1
            className="mt-4 max-w-4xl text-3xl font-medium leading-[1.12] tracking-[-1.2px] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
            data-whitepaper-title
          >
            {paper.meta.title}
          </h1>
          <p className="mt-4 text-sm text-zinc-500 sm:text-[15px]">
            {paper.meta.authors} · {paper.meta.date} · {paper.meta.status} · v{paper.meta.version}
          </p>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg sm:leading-relaxed">
            {paper.meta.description}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {paper.keywords.map((kw) => (
              <li
                key={kw}
                className="rounded-full bg-zinc-900 px-3 py-1 font-mono text-[10px] uppercase tracking-[1.2px] text-zinc-400 ring-1 ring-zinc-800"
              >
                {kw}
              </li>
            ))}
          </ul>
        </header>

        {/* Article shell: sticky TOC + wide body on lg+ */}
        <div className="mt-10 grid grid-cols-1 gap-10 lg:mt-12 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] xl:gap-16">
          {/* Contents — sticky sidebar on large screens */}
          <nav
            className="lg:sticky lg:top-24 lg:self-start"
            aria-label="Paper outline"
          >
            <div className="rounded-xl bg-zinc-900/80 p-4 ring-1 ring-zinc-800 sm:p-5">
              <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                Contents
              </p>
              <ol className="mt-3 list-none space-y-2 text-sm">
                <li>
                  <a
                    href="#abstract"
                    className="block text-zinc-400 transition hover:text-white"
                  >
                    Abstract
                  </a>
                </li>
                {paper.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block text-zinc-400 transition hover:text-white"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="#references"
                    className="block text-zinc-400 transition hover:text-white"
                  >
                    References
                  </a>
                </li>
              </ol>
            </div>
          </nav>

          {/* Main article column — wider reading measure */}
          <article className="min-w-0 max-w-3xl xl:max-w-none">
            <section
              id="abstract"
              data-whitepaper-section="abstract"
              className="rounded-xl bg-zinc-900 p-5 ring-1 ring-zinc-800 sm:p-7"
              aria-labelledby="abstract-heading"
            >
              <h2
                id="abstract-heading"
                className="font-mono text-[11px] uppercase tracking-[1.8px] text-neutral-300/80"
              >
                Abstract
              </h2>
              <p
                className="mt-4 text-base leading-[1.75] text-zinc-200 sm:text-[17px] sm:leading-[1.8]"
                data-whitepaper-abstract
              >
                {paper.abstract}
              </p>
            </section>

            <div className="mt-12 space-y-14 sm:mt-14 sm:space-y-16">
              {paper.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  data-whitepaper-section={section.id}
                  aria-labelledby={`${section.id}-heading`}
                >
                  {section.kicker ? (
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[1.8px] text-zinc-500">
                      {section.kicker}
                    </p>
                  ) : null}
                  <h2
                    id={`${section.id}-heading`}
                    className="text-2xl font-medium tracking-[-0.5px] text-white sm:text-[1.75rem] sm:leading-snug"
                  >
                    {section.heading}
                  </h2>
                  <div className="mt-5 space-y-5 text-base leading-[1.8] text-zinc-300 sm:text-[17px] sm:leading-[1.85]">
                    {section.paragraphs.map((p) => (
                      <p key={p.slice(0, 48)}>{p}</p>
                    ))}
                    {section.bullets && section.bullets.length > 0 ? (
                      <ul className="list-disc space-y-2.5 pl-5 marker:text-zinc-500">
                        {section.bullets.map((b) => (
                          <li key={b.slice(0, 48)} className="pl-1">
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  {PLANNED_SECTION_IDS.has(section.id) && experimentSteps.length > 0 ? (
                    <div
                      className="mt-8 grid gap-3 sm:grid-cols-1 md:grid-cols-3 md:gap-4"
                      data-whitepaper-experiment-steps
                    >
                      {experimentSteps.map((step, index) => (
                        <div
                          key={step.id}
                          data-experiment-step={step.id}
                          className="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800 sm:p-5"
                        >
                          <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-neutral-300/70">
                            Step {index + 1}
                          </p>
                          <h3 className="mt-2 text-base font-medium text-zinc-100">
                            {step.title}
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                            {step.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {section.subsections?.map((sub) => (
                    <div
                      key={sub.id}
                      id={sub.id}
                      data-whitepaper-subsection={sub.id}
                      className="mt-10 border-l-2 border-zinc-700 pl-5 sm:pl-6"
                    >
                      <h3 className="text-lg font-medium tracking-[-0.3px] text-zinc-100 sm:text-xl">
                        {sub.heading}
                      </h3>
                      <div className="mt-4 space-y-4 text-base leading-[1.8] text-zinc-300 sm:text-[17px] sm:leading-[1.85]">
                        {sub.paragraphs.map((p) => (
                          <p key={p.slice(0, 48)}>{p}</p>
                        ))}
                        {sub.bullets && sub.bullets.length > 0 ? (
                          <ul className="list-disc space-y-2.5 pl-5 marker:text-zinc-500">
                            {sub.bullets.map((b) => (
                              <li key={b.slice(0, 48)} className="pl-1">
                                {b}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>

            <section
              id="references"
              data-whitepaper-section="references"
              className="mt-14 border-t border-zinc-800 pt-10 sm:mt-16"
              aria-labelledby="references-heading"
            >
              <h2 id="references-heading" className="text-xl font-medium text-white sm:text-2xl">
                References
              </h2>
              <ol className="mt-5 list-decimal space-y-3.5 pl-5 text-sm leading-relaxed text-zinc-400 sm:text-[15px] sm:leading-relaxed">
                {paper.references.map((ref) => (
                  <li key={ref.id} id={`ref-${ref.id}`} className="pl-1">
                    {ref.citation}
                  </li>
                ))}
              </ol>
            </section>

            <div className="mt-12 flex flex-col gap-4 rounded-xl bg-zinc-900 p-5 ring-1 ring-zinc-800 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="text-sm text-zinc-400">
                Related: science thesis, Map of Knowledge exploration surface.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/science"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 transition hover:text-white"
                >
                  Science
                  <ArrowRight size={14} />
                </Link>
                <Link
                  href="/map-of-knowledge"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 transition hover:text-white"
                >
                  Map of Knowledge
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>

      <Footer />
    </main>
  );
}
