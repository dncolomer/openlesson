"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { ProductStack } from "@/components/ProductStack";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { trackCtaClick } from "@/lib/analytics";

const CTA = "Create your Workspace";
const CTA_HREF = "/workspace/new";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

const steps = [
  {
    title: "Create a Workspace",
    body: "Define the skill, scenario, or conversion goal. Enrich it with documents, tool traces, screen shares, video, or any evidence from humans or agents.",
  },
  {
    title: "Integrate to your product or workflow",
    body: "Augment the UIs, internal tools, and agent dev processes you already run. Wire in Evidence API, Think Aloud links, and practice flows where work happens, not in a separate training layer.",
  },
  {
    title: "Measure learning efficiency",
    body: "Evidence API and Think Aloud Protocol score humans and agents on conversion readiness and gap density, not vanity completion or benchmark pass rates.",
  },
  {
    title: "Close gaps, raise ROI",
    body: "Route humans into the ILE for targeted practice. Use ALE to evolve agent skill.md files until learning efficiency clears the deploy and adoption bar.",
  },
];

const outcomes = [
  "Raise the ROI of learning for agent deployments: fewer failed rollouts, faster time-to-production.",
  "Optimize human learning-to-conversion: adoption, activation, and workflow mastery, not click-through training.",
  "Detect reasoning gaps before they surface in client work, incidents, or bad deploys.",
  "Separate genuine human thinking from AI-fed interview polish and take-home fluff.",
  "Turn real product activity into learning efficiency signals tied to deploy gates, promotion, and compliance.",
  "Close gaps with ILE practice so efficiency gains compound, not one-off completion badges.",
];

export default function B2BLandingPage() {
  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      {bgImage && <div className="fixed inset-0 z-0 bg-cover bg-fixed bg-center" style={{ backgroundImage: `url(${bgImage})` }} />}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="w-full">
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">LEARNING EFFICIENCY • HUMANS & AGENTS</div>
          <h1 className="max-w-5xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">
            Beyond benchmarks for AI.
            <br />
            Beyond tests for humans.
          </h1>
          <div className="mt-7 max-w-5xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>
              openLesson optimizes learning efficiency for humans and agentic systems, measuring
              learning-to-conversion and increasing the ROI of every learning intervention across real
              product workflows.
            </p>
            <p className="text-zinc-500 sm:text-base">
              As humans and agents work inside real products, openLesson turns that activity into
              efficiency signals: evidence that judgment converts into outcomes, not just that a step was
              completed or a benchmark was passed.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
                <HeroPillarTitle lead="Our focus is" highlightLines={["learning", "efficiency"]} fullWidth />
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  Catch thinking in the flow of work. Optimize for understanding that converts.
                </p>
              </div>
              <div className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
                <HeroPillarTitle
                  lead="We drive conversion through"
                  highlight="learning optimization"
                />
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  Make learning show up downstream: adoption, deployment, and real use.
                </p>
              </div>
              <div className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6 md:col-span-2 lg:col-span-1">
                <HeroPillarTitle lead="Our method is" highlight="reasoning augmentation" />
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  Strengthen how people and agents think by engineering interruptions.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryCta location="landing_hero" />
            <a
              href="#products"
              onClick={() => trackCtaClick({ location: "landing_hero", label: "See the products", href: "#products", page: "/" })}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              See the products
            </a>
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Trace Interruption Model • Evidence API • Think Aloud Protocol • ILE • Agentic Learning Environment</p>
        </div>
      </section>

      <section id="products" className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading
          eyebrow="THE PLATFORM"
          title="Products for humans and agents. One Workspace."
        />
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-400">
          Start with a <span className="text-zinc-200">Workspace</span>, powered by the{" "}
          <span className="text-zinc-200">Trace Interruption Model</span> across every product.
          Workspaces accumulate learning signals over time.{" "}
          <span className="text-zinc-200">Evidence API</span> scores humans and agents from artifacts.{" "}
          <span className="text-zinc-200">Think Aloud Protocol</span> and{" "}
          <span className="text-zinc-200">ILE</span> optimize human learning-to-conversion.{" "}
          <span className="text-zinc-200">Agentic Learning Environment</span> evolves agent skill.md files
          as agents learn, because they are not born with skills.
        </p>
        <div className="mt-6">
          <ProductStack />
        </div>
      </section>

      <section id="product" className="relative z-10 mx-auto grid max-w-6xl gap-6 px-6 py-10 sm:gap-8 sm:py-12 lg:grid-cols-[0.88fr_1.12fr]">
        <div>
          <SectionHeading eyebrow="THE LOOP" title="Optimize learning. Maximize conversion." />
          <div className="mt-6">
            <PrimaryCta location="landing_solution" />
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p className="text-white">Interrupt, score, and improve on the same workspace.</p>
          <p className="mt-5">TIM applies across every product, breaking turn-based interactions and probing a closer reasoning layer. Pipe tool traces into Evidence API for human and agentic efficiency scoring. Issue Think Aloud Protocol URLs for live human cognition. Route humans into the ILE to improve. Soon, ALE will evolve agent skill.md files as agents learn from real runs until learning efficiency clears the bar.</p>
          <p className="mt-5 text-zinc-200">
            Optimize learning efficiency, build judgment, and tie every signal to learning-to-conversion:
            deploy gates, adoption metrics, promotion, and compliance at every step.
          </p>
        </div>
      </section>

      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading eyebrow="HOW IT WORKS" title="Workspace → Integrate → Convert" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-700">
              <div className="mb-5 flex size-10 items-center justify-center rounded-sm bg-white text-sm font-semibold text-black">{index + 1}</div>
              <h3 className="text-lg font-medium leading-tight text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-8">
          <SectionHeading eyebrow="OUTCOMES" title="Stop measuring completion. Start measuring learning efficiency." />
          <div className="grid gap-3 sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <div key={outcome} className="flex gap-4 border border-zinc-800 bg-zinc-950/70 p-5">
                <Check className="mt-1 shrink-0 text-white" size={18} />
                <p className="text-sm leading-relaxed text-zinc-300">{outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div className="border border-zinc-800 bg-zinc-950/80 p-8 text-center backdrop-blur-sm sm:p-12">
          <div className="mx-auto mb-6 h-px w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <h2 className="mx-auto max-w-3xl text-4xl font-medium tracking-[-1.6px] text-white sm:text-5xl">Increase the ROI of learning for humans and agents.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">Whether you are gating an agent deployment or confirming a team learned a new tool, openLesson optimizes learning-to-conversion with efficiency signals and helps humans close the gaps when they do not.</p>
          <div className="mt-8 flex justify-center">
            <PrimaryCta location="landing_closing" />
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function PrimaryCta({ compact = false, location = "landing" }: { compact?: boolean; location?: string }) {
  return (
    <TrackedCtaLink
      href={CTA_HREF}
      label={CTA}
      location={location}
      page="/"
      className={`inline-flex items-center justify-center rounded-sm bg-white font-medium text-black transition hover:bg-zinc-200 ${compact ? "px-4 py-2 text-sm" : "min-h-12 px-5 py-3 text-sm"}`}
    >
      {CTA}
      <ArrowRight className="ml-2" size={compact ? 15 : 16} />
    </TrackedCtaLink>
  );
}

function HeroPillarTitle({
  lead,
  highlight,
  highlightLines,
  fullWidth = false,
}: {
  lead: string;
  highlight?: string;
  highlightLines?: string[];
  fullWidth?: boolean;
}) {
  return (
    <div>
      <p className="text-sm leading-snug text-zinc-500">{lead}</p>
      <div className="mt-2.5 text-[1.65rem] font-medium leading-[1.06] tracking-[-0.8px] text-white sm:text-[1.85rem]">
        <span
          className={`border-l-[3px] border-white/30 bg-white/[0.06] px-3 py-1.5 text-white ${
            fullWidth ? "block w-full" : "inline-block"
          }`}
        >
          {highlightLines
            ? highlightLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))
            : highlight}
        </span>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</div>
      <h2 className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-1.8px] text-white sm:text-5xl">{title}</h2>
    </div>
  );
}
