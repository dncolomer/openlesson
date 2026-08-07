import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Software Design Click Moment",
  description: "A shareable Uncertain Systems card capturing the software design click moment.",
};

const backgroundImage = "/aesthetics/galactic-stoneworks/HICAGgcaMAAKHXr.jpeg";

const stages = [
  {
    label: "01",
    title: "Preparation / Impasse",
    points: [
      "Designing a trading bot with rules, thresholds, and execution constraints in play",
      "A boundary condition is treated like an isolated edge case",
      "The learner has the pieces, but not the downstream connection yet",
    ],
  },
  {
    label: "02",
    title: "Incubation",
    points: [
      "Questioning surfaces what the bot needs to know after the boundary is crossed",
      "The edge case starts behaving like signal, not just validation",
      "Static constraints begin mapping onto the bot's changing state",
    ],
  },
  {
    label: "03",
    title: "Illumination / The Click",
    points: [
      "The boundary condition clicks as a dynamic property downstream",
      "The bot can carry that condition forward into later decisions",
      "Design shifts from guarding an input to shaping the bot's behavior",
    ],
  },
  {
    label: "04",
    title: "Verification & Afterglow",
    points: [
      "Re-articulating the boundary as part of the trading system's state",
      "Seeing how one design choice propagates through execution logic",
      "Confidence grows because the bot's behavior now has a clearer model",
    ],
  },
];

function HeliosMark() {
  return (
    <div className="relative flex size-20 items-center justify-center rounded-full border border-neutral-600/60 bg-neutral-950/50 shadow-[0_0_0_5px_rgba(103,232,249,0.08),0_0_42px_rgba(103,232,249,0.16)]">
      <div className="absolute inset-1.5 rounded-full border border-neutral-600/35" />
      <span className="font-serif text-3xl text-white">H</span>
    </div>
  );
}

function SourceVideo() {
  return (
    <div className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/85">
      <iframe
        className="aspect-video w-full"
        src="https://www.youtube.com/embed/JIPgomzuQ3U"
        title="Software design click moment source video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

export default function SoftwareDesignClicksPage() {
  return (
    <main
      className="relative flex min-h-screen items-start justify-center overflow-x-hidden bg-[#0a0a0a] p-4 text-zinc-200 sm:p-8"
      style={{ backgroundImage: `url(${backgroundImage})`, backgroundPosition: "center", backgroundSize: "cover" }}
    >
      <div className="absolute inset-0 bg-[#0a0a0a]/78" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(103,232,249,0.12),transparent_30%),linear-gradient(to_bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.7))]" />

      <article className="relative z-10 w-full max-w-[1080px] rounded-md border border-zinc-800 bg-zinc-950/88 shadow-2xl shadow-black/70 backdrop-blur-sm">
        <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/[0.035] to-transparent" />

        <div className="relative flex flex-col p-[5.6%]">
          <header className="flex items-start justify-between gap-8">
            <div>
              <p className="inline-block rounded-sm border border-zinc-800 bg-black/70 px-3 py-1 font-mono text-[clamp(9px,1vw,12px)] uppercase tracking-[0.32em] text-zinc-500">
                Uncertain Systems Click Moment 002
              </p>
              <h1 className="mt-6 max-w-[760px] text-[clamp(46px,7.2vw,86px)] font-medium leading-[0.92] tracking-[-0.08em] text-white">
                The moment a trading-bot edge case becomes design signal.
              </h1>
            </div>
            <div className="hidden shrink-0 text-center sm:block">
              <HeliosMark />
              <p className="mt-3 text-sm text-zinc-300">Helios</p>
              <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-neutral-300" />
            </div>
          </header>

          <div className="mt-[5%] grid flex-1 gap-[4%] lg:grid-cols-[0.92fr_1.08fr]">
            <section className="flex min-h-0 flex-col justify-between rounded-sm border border-zinc-800 bg-black/35 p-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400/70">Real learner quote</p>
                <blockquote className="mt-5 text-[clamp(24px,3.2vw,42px)] font-medium leading-[1.03] tracking-[-0.07em] text-white">
                  &quot;Oh, so that condition should become part of what the bot knows later.&quot;
                </blockquote>
              </div>

              <div className="mt-5">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">Source moment</p>
                <SourceVideo />
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">Key insight</p>
                <p className="mt-3 text-[clamp(18px,2.1vw,27px)] leading-tight tracking-[-0.05em] text-zinc-100">
                  A boundary condition in a trading bot can become a dynamic property that downstream logic uses to make better decisions.
                </p>
              </div>
            </section>

            <section className="flex min-h-0 flex-col gap-3">
              <div className="grid flex-1 grid-rows-4 gap-3">
                {stages.map((stage) => (
                  <div key={stage.label} className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 rounded-sm border border-zinc-800 bg-black/35 p-5">
                    <div>
                      <p className="flex size-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/80 font-mono text-[11px] text-zinc-400">{stage.label}</p>
                    </div>
                    <div>
                      <h2 className="text-[clamp(21px,2.25vw,31px)] font-medium leading-none tracking-[-0.06em] text-white">{stage.title}</h2>
                      <ul className="mt-4 space-y-2 text-[clamp(13px,1.2vw,16px)] leading-snug text-zinc-400">
                        {stage.points.map((point) => (
                          <li key={point} className="flex gap-2">
                            <span className="mt-0.5 text-neutral-300">-</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer className="mt-8 flex flex-col items-stretch justify-between gap-4 border-t border-zinc-800 pt-5 sm:mt-[4%] sm:flex-row sm:items-end sm:gap-6">
            <div className="rounded-sm border border-zinc-800 bg-black/25 p-4 text-center sm:border-0 sm:bg-transparent sm:p-0 sm:text-left">
              <p className="text-xl font-semibold tracking-[-0.04em] text-white">Uncertain Systems</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:hidden">
                {['Think aloud', 'Get probed', 'Feel the click'].map((item) => (
                  <span key={item} className="rounded-sm border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 sm:block">Think aloud / get probed / feel the click</p>
            </div>
            <p className="hidden max-w-[34ch] text-right text-sm leading-5 text-zinc-500 sm:block">
              Captured from a live trading-bot design session.
            </p>
          </footer>
        </div>
      </article>
    </main>
  );
}
