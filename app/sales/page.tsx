import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PITCH_INDEX } from "@/lib/sales/pitch-index";
import { SALES_PRODUCT_CARDS } from "@/lib/sales/product-cards";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";

export const metadata: Metadata = {
  title: "Sales",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const BACKGROUND_IMAGE = PITCH_ASSETS.aesthetics.title;

export default function SalesIndexPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-sales-index
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-16 sm:pt-16">
        <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          SALES
        </div>
        <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.4px] text-white sm:text-6xl lg:text-[64px]">
          Sales materials
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
          Product cards and pitch decks for Uncertain Systems. Share direct links — noindex.
        </p>

        <section className="mt-12" data-product-card-links>
          <h2 className="font-mono text-[11px] uppercase tracking-[1.8px] text-zinc-500">
            Product cards
          </h2>
          <ul className="mt-4 space-y-4">
            {SALES_PRODUCT_CARDS.map((card) => (
              <li key={card.path}>
                <Link
                  href={card.path}
                  className="group flex flex-col gap-3 border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                      {card.eyebrow}
                    </p>
                    <h3 className="mt-2 text-xl font-medium tracking-[-0.6px] text-white sm:text-2xl">
                      {card.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
                      {card.oneLine}
                    </p>
                    <p className="mt-3 font-mono text-xs text-zinc-600">{card.path}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-zinc-300 transition group-hover:text-white">
                    Open card
                    <ArrowRight size={14} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="font-mono text-[11px] uppercase tracking-[1.8px] text-zinc-500">
            Pitch decks
          </h2>
          <ul className="mt-4 space-y-4" data-pitch-links>
            {PITCH_INDEX.map((entry) => {
              if (entry.comingSoon) {
                return (
                  <li key={entry.path}>
                    <div
                      className="flex flex-col gap-3 border border-zinc-900/80 bg-zinc-950/40 p-5 opacity-45 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                      data-pitch-coming-soon
                      aria-disabled="true"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-600">
                          {entry.vertical}
                        </p>
                        <h3 className="mt-2 text-xl font-medium tracking-[-0.6px] text-zinc-500 sm:text-2xl">
                          {entry.title}
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                          {entry.description}
                        </p>
                        <p className="mt-3 font-mono text-xs text-zinc-700">{entry.path}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.4px] text-zinc-600">
                        Coming soon
                      </span>
                    </div>
                  </li>
                );
              }

              return (
                <li key={entry.path}>
                  <Link
                    href={entry.path}
                    className="group flex flex-col gap-3 border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                        {entry.vertical}
                      </p>
                      <h3 className="mt-2 text-xl font-medium tracking-[-0.6px] text-white sm:text-2xl">
                        {entry.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
                        {entry.description}
                      </p>
                      <p className="mt-3 font-mono text-xs text-zinc-600">{entry.path}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-zinc-300 transition group-hover:text-white">
                      Open deck
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">
          Product cards · Pitch decks · Noindex · Subscription-exempt
        </p>
      </div>
    </main>
  );
}
