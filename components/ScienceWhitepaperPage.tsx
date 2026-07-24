import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import type { TapWhitepaper } from "@/lib/science/tap-stash-submit-whitepaper";
import { TAP_WHITEPAPER_EXPERIMENT_STEPS } from "@/lib/science/tap-stash-submit-whitepaper";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";

const BACKGROUND_IMAGE = PITCH_ASSETS.aesthetics.science;

type ScienceWhitepaperPageProps = {
  paper: TapWhitepaper;
};

export function ScienceWhitepaperPage({ paper }: ScienceWhitepaperPageProps) {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-science-whitepaper
      data-whitepaper-path={paper.path}
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/82" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.18),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.55),transparent_32%)]" />

      <LandingNav />

      <article className="relative z-10 mx-auto w-full max-w-3xl px-6 pt-10 pb-16 sm:pt-12">
        <Link
          href="/science"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Science
        </Link>

        <header className="mt-8 border-b border-zinc-800 pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            Research · Working paper
          </p>
          <h1
            className="mt-4 text-3xl font-medium leading-[1.15] tracking-[-1.2px] text-white sm:text-4xl"
            data-whitepaper-title
          >
            {paper.meta.title}
          </h1>
          <p className="mt-4 text-sm text-zinc-500">
            {paper.meta.authors} · {paper.meta.date} · {paper.meta.status} · v{paper.meta.version}
          </p>
          <p className="mt-5 text-base leading-relaxed text-zinc-400">{paper.meta.description}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {paper.keywords.map((kw) => (
              <li
                key={kw}
                className="rounded-sm border border-zinc-800 bg-zinc-950/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.2px] text-zinc-500"
              >
                {kw}
              </li>
            ))}
          </ul>
        </header>

        <section
          id="abstract"
          data-whitepaper-section="abstract"
          className="mt-10 border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
          aria-labelledby="abstract-heading"
        >
          <h2 id="abstract-heading" className="font-mono text-[11px] uppercase tracking-[1.8px] text-cyan-200/80">
            Abstract
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-300" data-whitepaper-abstract>
            {paper.abstract}
          </p>
        </section>

        <nav
          className="mt-8 border border-zinc-800/80 bg-zinc-950/40 p-4 text-sm text-zinc-500"
          aria-label="Paper outline"
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-600">Contents</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            {paper.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-zinc-400 transition hover:text-white">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
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
                className="text-2xl font-medium tracking-[-0.6px] text-white sm:text-[28px]"
              >
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-zinc-400">
                {section.paragraphs.map((p) => (
                  <p key={p.slice(0, 48)}>{p}</p>
                ))}
                {section.bullets && section.bullets.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5 marker:text-zinc-600">
                    {section.bullets.map((b) => (
                      <li key={b.slice(0, 48)}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {section.id === "planned-experiment" ? (
                <div
                  className="mt-6 space-y-3"
                  data-whitepaper-experiment-steps
                >
                  {TAP_WHITEPAPER_EXPERIMENT_STEPS.map((step, index) => (
                    <div
                      key={step.id}
                      data-experiment-step={step.id}
                      className="border border-zinc-800 bg-zinc-950/60 p-4"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-cyan-200/70">
                        Step {index + 1}
                      </p>
                      <h3 className="mt-1.5 text-base font-medium text-zinc-100">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{step.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {section.subsections?.map((sub) => (
                <div
                  key={sub.id}
                  id={sub.id}
                  data-whitepaper-subsection={sub.id}
                  className="mt-8 border-l border-zinc-800 pl-4 sm:pl-5"
                >
                  <h3 className="text-lg font-medium tracking-[-0.3px] text-zinc-100">{sub.heading}</h3>
                  <div className="mt-3 space-y-3 text-base leading-relaxed text-zinc-400">
                    {sub.paragraphs.map((p) => (
                      <p key={p.slice(0, 48)}>{p}</p>
                    ))}
                    {sub.bullets && sub.bullets.length > 0 ? (
                      <ul className="list-disc space-y-2 pl-5 marker:text-zinc-600">
                        {sub.bullets.map((b) => (
                          <li key={b.slice(0, 48)}>{b}</li>
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
          className="mt-12 border-t border-zinc-800 pt-8"
          aria-labelledby="references-heading"
        >
          <h2 id="references-heading" className="text-xl font-medium text-white">
            References
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-500">
            {paper.references.map((ref) => (
              <li key={ref.id} id={`ref-${ref.id}`}>
                {ref.citation}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-12 flex flex-col gap-3 border border-zinc-800 bg-zinc-950/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">
            Related: science thesis, Map of Knowledge exploration surface.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/science"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
            >
              Science
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/map-of-knowledge"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
            >
              Map of Knowledge
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </article>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
