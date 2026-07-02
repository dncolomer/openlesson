"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { ProductStack } from "@/components/ProductStack";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { VerificationExamplesWidget } from "@/components/VerificationExamplesWidget";
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
    title: "Create a Verification Workspace",
    body: "Define the skill, scenario, or decision domain. Enrich it with documents, tool traces, screen shares, video, or any evidence from humans or agents.",
  },
  {
    title: "Verify learning, not just outputs",
    body: "Evidence API scores humans and agents from artifacts. Think Aloud Protocol captures live human cognition under probe. Both go beyond quizzes and benchmarks.",
  },
  {
    title: "Get continuous scores and gap analysis",
    body: "Marker scores, severity-ranked gaps, and auditable rationale, not a single pass/fail snapshot or leaderboard accuracy.",
  },
  {
    title: "Humans improve in the ILE",
    body: "Gap findings route people into the Integrated Learning Environment for targeted practice. Agents get clearer deploy gates from Evidence API traces.",
  },
];

const outcomes = [
  "Verify agent skills and tool use before production, not just benchmark pass rates.",
  "Confirm humans learned how to use a tool or workflow, not just clicked through training.",
  "Detect hidden gaps before they show up in client work, incidents, or bad deploys.",
  "Separate genuine human thinking from AI-fed interview polish and take-home fluff.",
  "Create auditable readiness evidence for compliance, promotion, or high-stakes roles.",
  "Close gaps with ILE practice so verification leads to improvement, not just labels.",
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

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.03fr_0.97fr]">
        <div>
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">LEARNING VERIFICATION • HUMANS & AGENTS</div>
          <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">Beyond benchmarks for AI. Beyond quizzes for humans.</h1>
          <div className="mt-7 max-w-3xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>openLesson verifies that learning actually happened for people using tools and for agents deployed to production. Polished outputs and leaderboard scores are not proof.</p>
            <div className="border border-cyan-400/20 bg-cyan-950/20 p-5 sm:p-6">
              <p className="text-lg leading-relaxed text-zinc-300 sm:text-xl">
                Our focus is{" "}
                <span className="font-medium text-cyan-200">learning verification</span>.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                <span className="text-zinc-200">Evidence API</span> verifies humans and agents.
                <span className="text-zinc-200"> Think Aloud Protocol</span> and{" "}
                <span className="text-zinc-200">ILE</span> serve human learning.
                openLesson helps skill.md developers test and evolve agent skills in the{" "}
                <span className="text-zinc-200">Agentic Learning Environment</span>.{" "}
                <span className="font-medium text-white">No exam. No benchmark theater.</span>
              </p>
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
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Evidence API • Think Aloud Protocol • ILE • Agentic Learning Environment</p>
        </div>
        <VerificationExamplesWidget />
      </section>

      <ContentSection id="problem" eyebrow="THE PROBLEM" title="Completion metrics and benchmark scores hide unverified readiness.">
        <p>Humans finish courses without learning how to use the tools. Agents pass eval suites without reliable tool use in production. AI assist makes both problems worse: strong-looking outputs with shallow understanding underneath.</p>
        <p className="text-white">You deployed the copilot. Did anyone, human or agent, actually learn the workflow?</p>
        <p>Quizzes reward recall. Benchmarks reward pattern matching. The only trustworthy signals are evidence traces and live reasoning under probe.</p>
      </ContentSection>

      <section id="products" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="THE PLATFORM"
          title="Four products. One Verification Workspace."
        />
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">
          Everything runs on{" "}
          <span className="text-zinc-200">Verification Workspaces</span>.{" "}
          <span className="text-zinc-200">Evidence API</span> verifies humans and agents from artifacts.{" "}
          <span className="text-zinc-200">Think Aloud Protocol</span> and{" "}
          <span className="text-zinc-200">ILE</span> focus on human learning.{" "}
          <span className="text-zinc-200">Agentic Learning Environment</span> helps skill developers test and evolve agent skills.
        </p>
        <div className="mt-10">
          <ProductStack />
        </div>
      </section>

      <section id="product" className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[0.88fr_1.12fr]">
        <div>
          <SectionHeading eyebrow="THE LOOP" title="Verify learning. Close the gaps." />
          <div className="mt-8">
            <PrimaryCta location="landing_solution" />
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p className="text-white">Verify, learn, and evolve on the same workspace.</p>
          <p className="mt-5">Pipe tool traces into Evidence API for human and agentic scoring. Issue Think Aloud Protocol URLs for live human cognition. Route humans into the ILE to improve. Soon, skill developers will use the Agentic Learning Environment to iterate agent skills until verification scores clear the bar.</p>
          <p className="mt-5 text-zinc-200">Verify learning, build judgment, and prove improvement with auditable evidence at every step.</p>
        </div>
      </section>

      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="HOW IT WORKS" title="Workspace → Verify → Improve" />
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
          <SectionHeading eyebrow="OUTCOMES" title="Stop measuring completion. Start measuring learning." />
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
          <h2 className="mx-auto max-w-3xl text-4xl font-medium tracking-[-1.6px] text-white sm:text-5xl">Verify humans and agents, not just their outputs.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">Whether you are gating an agent deployment or confirming a team learned a new tool, openLesson measures learning with evidence, and helps humans close the gaps when they do not.</p>
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

function ContentSection({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-8 py-14 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">{children}</div>
      </div>
    </section>
  );
}