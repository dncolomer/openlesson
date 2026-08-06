import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/tapbench",
});

export const metadata: Metadata = {
  title: "TAPBench",
  description:
    "An agentic Think Aloud Protocol benchmark: measure how genuine agent thinking traces are, and chart how agents know things on a Map of Knowledge.",
  alternates: { canonical: "https://uncertain.systems/tapbench" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg";

/** Example agent run for the public LP (illustrative only). */
const INTERACTION_TIMELINE = [
  {
    t: "t = 0",
    actor: "Operator",
    action: "Mints a TAPBench link for a workspace exercise (duration locked).",
  },
  {
    t: "t + 0",
    actor: "Agent",
    action: "Opens the link, loads skills.md and the timed session brief.",
  },
  {
    t: "t + 2m",
    actor: "Agent",
    action: "Buffers thinking units via proof-of-work upload into the stash buffer.",
  },
  {
    t: "t + 6m",
    actor: "Agent",
    action: "Stash flush: System 1 trace (fast, associative process) into durable PoW.",
  },
  {
    t: "t + 11m",
    actor: "Agent",
    action: "More buffer uploads as the exercise continues under the clock.",
  },
  {
    t: "t + 14m",
    actor: "Agent",
    action: "Submit flush: System 2 trace (deliberate answer path) into durable PoW.",
  },
  {
    t: "t + 15m",
    actor: "Session",
    action: "Timer ends. Further stash/submit is rejected; traces stay for scoring.",
  },
] as const;

/**
 * Public project landing for TAPBench (Projects & Community).
 * Session resolve lives at /tapbench/[token].
 */
export default function TapbenchProjectLandingPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-tapbench-project-landing
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />

      <LandingNav />

      {/* Recent benchmark results: coming soon (top of page) */}
      <section
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-10 pb-10 sm:pt-14 sm:pb-12"
        data-tapbench-landing-results
      >
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Recent benchmark results
        </div>
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-zinc-500">
          Public leaderboard and scoring tables are not live yet. Placeholder slots below.
        </p>

        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-tapbench-results-coming-soon
        >
          {["Process scores", "Genuineness vs human TAP", "Distance on Map of Knowledge"].map(
            (label) => (
              <div
                key={label}
                className="flex min-h-[120px] flex-col items-center justify-center rounded-sm border border-dashed border-zinc-700 bg-zinc-950/50 px-4 py-8 text-center"
                data-tapbench-results-placeholder
              >
                <div className="font-mono text-[10px] tracking-[2px] text-zinc-600">
                  COMING SOON
                </div>
                <p className="mt-2 text-xs text-zinc-500">{label}</p>
              </div>
            )
          )}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-8 sm:pb-10">
        <div
          className="mb-4 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500"
          data-tapbench-landing-kicker
        >
          TAPBENCH
        </div>
        <h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-[-1.2px] text-white sm:text-4xl lg:text-[42px]">
          Think Aloud benchmarks for agents.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          TAPBench is an agentic benchmark with a dual purpose: a practical toolkit for scoring
          agent thinking traces against human Think Aloud Protocol, and a longer path toward a Map
          of Knowledge that shows how agents know things.
        </p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl space-y-6 px-6 pb-12">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          <div data-tapbench-landing-purpose-a>
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Purpose 1: Toolkit
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Run Think Aloud Protocol style benchmarks against agents. Timed exercises, stash and
              submit traces, and compare how close agent reasoning looks to genuine human process
              data, not only final answers.
            </p>
          </div>

          <div data-tapbench-landing-purpose-b>
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Purpose 2: Horizon
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Over time, build an agentic{" "}
              <Link
                href="/map-of-knowledge"
                className="text-zinc-100 underline-offset-2 hover:text-white hover:underline"
                data-tapbench-landing-map-link
              >
                Map of Knowledge
              </Link>
              : where agent systems sit in knowledge space, how that topology differs from humans,
              and what that implies for evaluation and alignment.
            </p>
          </div>
        </div>

        <div className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-4 text-xs leading-relaxed text-zinc-500">
          Operators mint TAPBench links from a workspace under Settings, Knowledge Links. Agents
          open the link, work the exercise, and flush proof of work through the Stash and Submit
          API until the session expires.
        </div>
      </section>

      {/* What makes TAPBench special: Stash / Submit */}
      <section
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-14 sm:pb-16"
        data-tapbench-landing-special
      >
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          What makes TAPBench special
        </div>
        <h2 className="max-w-2xl text-xl font-medium tracking-tight text-white sm:text-2xl">
          Stash and Submit, not a single answer dump
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Most agent evals grade the final reply. TAPBench grades the process. During a timed
          session the agent buffers intermediate proof of work, then flushes it in two modes that
          mirror human Think Aloud Protocol:
        </p>

        <div
          className="mt-6 grid gap-4 sm:grid-cols-2"
          data-tapbench-landing-stash-submit
        >
          <div className="rounded-sm border border-zinc-800 bg-zinc-950/70 p-5">
            <div className="font-mono text-[10px] tracking-[2px] text-cyan-700/90">STASH</div>
            <h3 className="mt-2 text-sm font-medium text-zinc-100">System 1 flush</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Fast, associative process traces. The agent records how it is thinking while still
              mid-exercise: hunches, partial models, tool checks, wrong turns that still show
              work.
            </p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950/70 p-5">
            <div className="font-mono text-[10px] tracking-[2px] text-cyan-700/90">SUBMIT</div>
            <h3 className="mt-2 text-sm font-medium text-zinc-100">System 2 flush</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Deliberate answer-path traces. The agent commits a more structured line of reasoning
              toward a solution, still under the session clock and still as proof of work, not
              just a chat message.
            </p>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-xs leading-relaxed text-zinc-500">
          Both paths land as durable proof of work on the same workspace knowledge substrate as
          human TAP. That is what makes agent runs comparable to people, and what feeds regions on
          the Map of Knowledge later.
        </p>
      </section>

      {/* Example interaction timeline */}
      <section
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-14 sm:pb-16"
        data-tapbench-landing-timeline
      >
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Example interaction
        </div>
        <h2 className="text-lg font-medium tracking-tight text-white sm:text-xl">
          A 15-minute agent session
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500">
          Illustrative timeline. Real sessions vary by exercise length and how often the agent
          buffers and flushes.
        </p>

        <ol className="mt-6 space-y-0 rounded-sm border border-zinc-800 bg-zinc-950/70">
          {INTERACTION_TIMELINE.map((step, i) => (
            <li
              key={`${step.t}-${step.actor}-${i}`}
              className="flex gap-4 border-b border-zinc-800/80 px-4 py-3 last:border-0 sm:gap-6 sm:px-5 sm:py-3.5"
              data-tapbench-timeline-step
            >
              <div className="w-16 shrink-0 font-mono text-[11px] text-zinc-500 sm:w-20">
                {step.t}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {step.actor}
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-300">{step.action}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Bottom CTA */}
      <section
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-20"
        data-tapbench-landing-cta
      >
        <div className="rounded-sm border border-zinc-800 bg-zinc-950/75 px-5 py-8 text-center sm:px-8 sm:py-10">
          <h2 className="text-lg font-medium tracking-tight text-white sm:text-xl">
            Want to run TAPBench?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
            If you want to benchmark agents on your own workspace material, or contribute human TAP
            baselines, get in touch.
          </p>
          <a
            href="mailto:tapbench@uncertain.systems?subject=TAPBench"
            className="mt-5 inline-flex items-center justify-center rounded-sm bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            data-tapbench-landing-cta-email
          >
            tapbench@uncertain.systems
          </a>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
