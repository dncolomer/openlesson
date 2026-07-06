"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { ProductStack } from "@/components/ProductStack";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { trackCtaClick } from "@/lib/analytics";

const CTA = "Create your Verification Workspace";
const CTA_HREF = "/workspace/new";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

const steps = [
  {
    title: "Set up a knowledge workspace",
    body: "Define the skill, scenario, or decision domain. Enrich it with documents, tool traces, screen shares, video, or any evidence from humans or agents performing real work.",
  },
  {
    title: "Verify learning with software tools",
    body: "Evidence API scores artifacts and tool traces continuously. Think Aloud Protocol captures live human cognition under probe. Both go beyond quizzes, benchmarks, and completion rates.",
  },
  {
    title: "Get gap analysis, not pass/fail theater",
    body: "Marker scores, severity-ranked gaps, and auditable rationale — not a single snapshot score or leaderboard accuracy.",
  },
  {
    title: "Augment learning where gaps appear",
    body: "ILE routes humans into targeted practice. ALE helps skill developers iterate agent skills. Verification findings drive what gets practiced next.",
  },
];

const outcomes = [
  "Verify agent skills and tool use from workspace evidence before production deploys.",
  "Confirm humans learned how to use a workflow or tool — not just clicked through training.",
  "Detect hidden gaps before they surface in client work, incidents, or bad deploys.",
  "Separate genuine human thinking from AI-fed interview polish and take-home fluff.",
  "Create auditable readiness evidence from proof of work inside the knowledge workspace.",
  "Close gaps with ILE and ALE so verification leads to improvement, not just labels.",
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

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl items-center px-6 py-20">
        <div className="w-full">
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">KNOWLEDGE WORKSPACE • VERIFY & AUGMENT</div>
          <h1 className="max-w-5xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">Verify and augment learning where knowledge work happens.</h1>
          <div className="mt-7 max-w-5xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>openLesson is a knowledge workspace with software tools that verify learning through evidence, proof of work, and cognitive analysis — then augment it with targeted practice for people and AI agents.</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="border border-cyan-400/20 bg-cyan-950/20 p-5 sm:p-6">
                <p className="text-lg leading-relaxed text-zinc-300 sm:text-xl">
                  <span className="font-medium text-cyan-200">Verify</span> learning with software tools.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  <span className="text-zinc-200">Evidence API</span> scores artifacts and tool traces from the workspace.{" "}
                  <span className="text-zinc-200">Think Aloud Protocol</span> captures live human cognition under probe.{" "}
                  <span className="font-medium text-white">No exam. No benchmark theater.</span>
                </p>
              </div>
              <div className="border border-violet-400/20 bg-violet-950/20 p-5 sm:p-6">
                <p className="text-lg leading-relaxed text-zinc-300 sm:text-xl">
                  <span className="font-medium text-violet-200">Augment</span> learning where gaps appear.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  <span className="text-zinc-200">ILE</span> routes humans into targeted practice.{" "}
                  <span className="text-zinc-200">ALE</span> helps skill developers iterate agent skills. Verification findings drive what gets practiced next — not generic content libraries.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryCta location="landing_hero" />
            <a
              href="#products"
              onClick={() => trackCtaClick({ location: "landing_hero", label: "See the tools", href: "#products", page: "/" })}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              See the tools
            </a>
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Evidence API • Think Aloud Protocol • ILE • Agentic Learning Environment</p>
        </div>
      </section>

      <section id="products" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="SOFTWARE TOOLS"
          title="Four tools. One knowledge workspace."
        />
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">
          Everything runs inside a{" "}
          <span className="text-zinc-200">Verification Workspace</span>.{" "}
          <span className="text-zinc-200">Evidence API</span> and{" "}
          <span className="text-zinc-200">Think Aloud Protocol</span> verify learning.{" "}
          <span className="text-zinc-200">ILE</span> and{" "}
          <span className="text-zinc-200">Agentic Learning Environment</span> augment it when gaps surface.
        </p>
        <div className="mt-10">
          <ProductStack />
        </div>
      </section>

      <section id="product" className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[0.88fr_1.12fr]">
        <div>
          <SectionHeading eyebrow="THE LOOP" title="Verify learning. Augment the gaps." />
          <div className="mt-8">
            <PrimaryCta location="landing_solution" />
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p className="text-white">One workspace for knowledge work, verification, and improvement.</p>
          <p className="mt-5">Pipe tool traces into Evidence API. Issue Think Aloud Protocol URLs for live human cognition. Route humans into the ILE to practice what broke. Iterate agent skills in ALE until verification scores clear the bar.</p>
          <p className="mt-5 text-zinc-200">Verify learning, augment where it falls short, and prove improvement with auditable evidence at every step.</p>
        </div>
      </section>

      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="HOW IT WORKS" title="Workspace → Verify → Augment" />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-700">
              <div className="mb-5 flex size-10 items-center justify-center rounded-sm bg-white text-sm font-semibold text-black">{index + 1}</div>
              <h3 className="text-lg font-medium leading-tight text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <SectionHeading eyebrow="OUTCOMES" title="Stop measuring completion. Start verifying learning." />
          <div className="grid gap-3 sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <div key={outcome} className="flex gap-4 border border-zinc-800 bg-zinc-950/70 p-5">
                <Check className="mt-1 shrink-0 text-cyan-300" size={18} />
                <p className="text-sm leading-relaxed text-zinc-300">{outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="border border-zinc-800 bg-zinc-950/80 p-8 text-center backdrop-blur-sm sm:p-12">
          <div className="mx-auto mb-6 h-px w-24 bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <h2 className="mx-auto max-w-3xl text-4xl font-medium tracking-[-1.6px] text-white sm:text-5xl">Verify learning. Augment where it breaks.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">Whether you are gating an agent deployment or confirming a team learned a new tool, openLesson verifies learning with evidence inside a knowledge workspace — and augments it when gaps appear.</p>
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

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-cyan-300/70">{eyebrow}</div>
      <h2 className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-1.8px] text-white sm:text-5xl">{title}</h2>
    </div>
  );
}