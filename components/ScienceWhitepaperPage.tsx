import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import type { ScienceWhitepaper } from "@/lib/science/whitepaper-types";
import { MARKETING_SHELL } from "@/lib/marketing/shell";

type ScienceWhitepaperPageProps = {
  paper: ScienceWhitepaper;
};

const PLANNED_SECTION_IDS = new Set(["planned-experiment", "planned-study"]);

export function ScienceWhitepaperPage({ paper }: ScienceWhitepaperPageProps) {
  const experimentSteps = paper.experimentSteps ?? [];

  return (
    <main
      className="relative min-h-screen border border-white/40 bg-[#0e1c2c] text-zinc-200 selection:bg-zinc-700 selection:text-white [&_section[id]]:scroll-mt-24"
      data-console-frame=""
      data-science-whitepaper
      data-whitepaper-path={paper.path}
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

        <header className="mt-4 grid items-stretch gap-3 lg:grid-cols-12">
          <div className="console-copy flex h-full flex-col justify-center p-5 sm:p-6 lg:col-span-7 lg:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              Research · Working paper
            </p>
            <h1
              className="mt-3 text-3xl font-medium leading-[1.12] tracking-[-1.2px] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
              data-whitepaper-title
            >
              {paper.meta.title}
            </h1>
            <p className="mt-4 text-sm text-zinc-500 sm:text-[15px]">
              {paper.meta.authors} · {paper.meta.date} · {paper.meta.status} · v{paper.meta.version}
            </p>
          </div>
          <div className="console-copy flex h-full flex-col justify-center p-5 sm:p-6 lg:col-span-5">
            <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">{paper.meta.description}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {paper.keywords.map((kw) => (
                <li
                  key={kw}
                  className="console-chip rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-[1.2px] text-zinc-400"
                >
                  {kw}
                </li>
              ))}
            </ul>
          </div>
        </header>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-12">
          <nav
            className="console-copy p-5 sm:p-6 lg:sticky lg:top-24 lg:col-span-4 lg:self-start xl:col-span-3"
            aria-label="Paper outline"
          >
            <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">Contents</p>
            <ol className="mt-3 list-none space-y-0 text-sm">
              <li className="border-t border-zinc-800/90">
                <a
                  href="#abstract"
                  className="block py-2.5 text-zinc-300 transition hover:text-white"
                >
                  Abstract
                </a>
              </li>
              {paper.sections.map((section) => (
                <li key={section.id} className="border-t border-zinc-800/90">
                  <a
                    href={`#${section.id}`}
                    className="block py-2.5 text-zinc-300 transition hover:text-white"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
              <li className="border-t border-zinc-800/90">
                <a
                  href="#references"
                  className="block py-2.5 text-zinc-300 transition hover:text-white"
                >
                  References
                </a>
              </li>
            </ol>
          </nav>

          <article className="min-w-0 space-y-3 lg:col-span-8 xl:col-span-9">
            <section
              id="abstract"
              data-whitepaper-section="abstract"
              className="console-copy p-5 sm:p-7"
              aria-labelledby="abstract-heading"
            >
              <h2
                id="abstract-heading"
                className="font-mono text-[11px] uppercase tracking-[1.8px] text-zinc-500"
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

            {paper.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                data-whitepaper-section={section.id}
                className="console-copy p-5 sm:p-7"
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
                    className="mt-8 overflow-hidden border-t border-zinc-800/90"
                    data-whitepaper-experiment-steps
                  >
                    <div className="grid md:grid-cols-3">
                      {experimentSteps.map((step, index) => (
                        <div
                          key={step.id}
                          data-experiment-step={step.id}
                          className={`px-0 py-5 md:px-5 md:py-5 ${
                            index > 0 ? "border-t border-zinc-800/90 md:border-t-0 md:border-l" : ""
                          }`}
                        >
                          <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                            {String(index + 1).padStart(2, "0")} · Step {index + 1}
                          </p>
                          <h3 className="mt-2 text-base font-medium text-zinc-100">{step.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {section.subsections?.map((sub) => (
                  <div
                    key={sub.id}
                    id={sub.id}
                    data-whitepaper-subsection={sub.id}
                    className="mt-8 border-t border-zinc-800/90 pt-6"
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

            <section
              id="references"
              data-whitepaper-section="references"
              className="console-copy p-5 sm:p-7"
              aria-labelledby="references-heading"
            >
              <h2 id="references-heading" className="text-xl font-medium text-white sm:text-2xl">
                References
              </h2>
              <ol className="mt-5 list-decimal space-y-3.5 pl-5 text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                {paper.references.map((ref) => (
                  <li key={ref.id} id={`ref-${ref.id}`} className="pl-1">
                    {ref.citation}
                  </li>
                ))}
              </ol>
            </section>

            <div className="console-copy flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="text-sm text-zinc-400">Related: the combined vision and science thesis.</p>
              <Link
                href="/science"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 transition hover:text-white"
              >
                Vision
                <ArrowRight size={14} />
              </Link>
            </div>
          </article>
        </div>
      </div>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
