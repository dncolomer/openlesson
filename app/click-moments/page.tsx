import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Click Moments",
  description: "A library of shareable openLesson click moments.",
};

const moments = [
  {
    href: "/click-moments/blockchain-tx-validation",
    label: "Click Moment 001",
    title: "Blockchain TX validation",
    description: "A learner realizes transaction validation checks a public relation without exposing the signer's private key.",
    source: "Live Helios session",
    image: "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  },
  {
    href: "/click-moments/software-design-clicks",
    label: "Click Moment 002",
    title: "Trading bot design click",
    description: "A learner realizes a trading-bot boundary condition can become a dynamic property used by downstream decision logic.",
    source: "Live Helios session",
    image: "/aesthetics/galactic-stoneworks/HICAGgcaMAAKHXr.jpeg",
  },
];

export default function ClickMomentsPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0a0a0a] text-zinc-200">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(244,63,94,0.12),transparent_30%),linear-gradient(to_bottom,#0a0a0a,#050505)]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <Link href="/" className="text-lg font-semibold tracking-[-0.04em] text-white">
            openLesson
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Shareable learning artifacts
          </p>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16">
          <div className="max-w-4xl">
            <p className="inline-block rounded-sm border border-zinc-800 bg-black/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500">
              Click moments
            </p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.96] tracking-[-0.08em] text-white sm:text-7xl">
              A library of the exact moment something clicks.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Each card captures one specific openLesson learning breakthrough: the quote, the mental model, and the source moment that made it portable.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {moments.map((moment) => (
              <Link
                key={moment.href}
                href={moment.href}
                className="group overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/80 shadow-xl shadow-black/35 transition hover:border-zinc-600 hover:bg-zinc-950"
              >
                <div
                  className="relative aspect-[16/9] bg-cover bg-center grayscale"
                  style={{ backgroundImage: `url(${moment.image})` }}
                >
                  <div className="absolute inset-0 bg-black/45 transition group-hover:bg-black/30" />
                  <div className="absolute left-4 top-4 rounded-sm bg-black/75 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400">
                    {moment.label}
                  </div>
                </div>

                <div className="p-5">
                  <h2 className="text-2xl font-medium leading-tight tracking-[-0.06em] text-white">
                    {moment.title}
                  </h2>
                  <p className="mt-3 min-h-20 text-sm leading-6 text-zinc-400">
                    {moment.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400/70">
                      {moment.source}
                    </p>
                    <span className="text-sm text-zinc-300 transition group-hover:translate-x-1 group-hover:text-white">
                      Inspect -&gt;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
