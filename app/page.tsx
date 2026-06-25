"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { trackCtaClick } from "@/lib/analytics";
import { READINESS_SCENARIOS } from "@/lib/seo/readiness-scenarios";

const CTA = "Create your Performance Workspace";
const CTA_HREF = "/workspace/new";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

const steps = [
  {
    title: "Create a Performance Workspace",
    body: "Define the skill, decision domain, or scenario that actually matters to you.",
  },
  {
    title: "Think aloud in the ILE",
    body: "Follow the Think-Aloud Protocol: speak your reasoning as you work. Our Selective Thought Interface captures live speech and submitted thought fragments—hesitations, revisions, and causal chains that hidden AI overlays cannot fabricate.",
  },
  {
    title: "Get probed, not fed answers",
    body: "Socratic follow-ups target gaps in genuine cognition. You are scored on how you explore, revise, and defend thinking under challenge—not on polished output you could paste from an assistant.",
  },
  {
    title: "Close gaps with guided practice",
    body: "Gap analysis turns weak signals into the next scenario, block, or probe—not a dead-end score. Humans practice until reasoning improves, with evidence showing progress along the way.",
  },
];

const cognitionPillars = [
  {
    title: "Think-Aloud Protocol",
    body: "A decades-validated method from cognitive science: verbalize reasoning while you work. Speech exposes what polished deliverables hide—skipped steps, circular logic, and unexamined assumptions.",
  },
  {
    title: "Selective Thought Interface",
    body: "Learners submit transcribed thought fragments; the system probes with targeted Socratic questions. The signal is live cognition under inquiry—not a script read from a hidden overlay.",
  },
  {
    title: "Measure gaps, then close them",
    body: "Evaluation scores learning markers from reasoning traces—then routes humans into specific ILE practice and Socratic follow-ups. openLesson is not a pass/fail checker; it is a loop from evidence to remediation.",
  },
];

const outcomes = [
  "Detect hidden skill gaps before they show up in client work or critical decisions.",
  "Separate genuine human thinking from AI-fed interview polish and take-home fluff.",
  "Build human judgment that complements AI tools instead of depending on them.",
  "Create auditable evidence of readiness for compliance, promotion, or high-stakes roles.",
  "Give hiring and L&D teams a defensible signal when real-time cheating tools break traditional screens.",
  "Turn gap findings into targeted practice—so humans improve, not just get labeled.",
];

const SCENARIO_ROTATE_MS = 4500;
const SCENARIO_FADE_MS = 400;

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
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">READINESS EVIDENCE FOR YOU</div>
          <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">AI makes humans look ready. Prove they actually are.</h1>
          <p className="mt-7 max-w-3xl text-xl leading-relaxed tracking-[-0.35px] text-zinc-400">openLesson measures genuine human readiness—and helps people close the gaps AI hides, not just flag them.</p>
          <div className="mt-7 max-w-3xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>As AI tools get better, humans can generate strong-looking outputs earlier in the learning curve without proving they understand the task, context, or decision behind the work.</p>
            <p>This creates a dangerous readiness illusion. Training completion is not performance readiness.</p>
            <p className="text-zinc-200">openLesson reveals weak spots early, then guides targeted practice until cognition catches up.</p>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryCta location="landing_hero" />
            <a
              href="#how"
              onClick={() => trackCtaClick({ location: "landing_hero", label: "See how it works", href: "#how", page: "/" })}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              See how it works
            </a>
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Think-Aloud Protocol • Selective Thought Interface • readiness evidence</p>
        </div>
        <ReadinessVisual />
      </section>

      <ContentSection id="problem" eyebrow="THE PROBLEM" title="The next workplace risk is not AI adoption. It is unverified human readiness.">
        <p>AI gives you instant help, but instant help can hide weak understanding. Real-time assist tools can feed answers during interviews, exams, and live calls—creating candidates and employees who look ready while genuine cognition stays untested.</p>
        <p className="text-white">You have AI. Do you have the judgment to use it well?</p>
        <p>Polished output is not proof of capability. When screens reward scripts and generated work, the only trustworthy signal left is how someone thinks out loud when probed.</p>
      </ContentSection>

      <section id="cognition" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="GENUINE HUMAN THINKING"
          title="Hidden AI cannot fake thinking out loud."
        />
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">
          openLesson solves the AI cheating problem at the signal layer. Instead of trusting deliverables that assistants can manufacture, we measure{" "}
          <span className="text-zinc-200">genuine human cognition</span> through the Think-Aloud Protocol and our Selective Thought Interface—then help humans close the gaps that show up, with guided practice until reasoning holds up under probe.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cognitionPillars.map((pillar) => (
            <div key={pillar.title} className="border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-700">
              <h3 className="text-lg font-medium text-white">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[0.88fr_1.12fr]">
        <div>
          <SectionHeading eyebrow="THE SOLUTION" title="Find the gaps AI hides. Help humans close them." />
          <div className="mt-8">
            <PrimaryCta location="landing_solution" />
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p className="text-white">openLesson turns live thinking into a measure-and-improve loop.</p>
          <p className="mt-5">Practice real scenarios and verbalize reasoning as you go. The ILE captures think-aloud traces; evaluation surfaces specific gaps; targeted blocks and Socratic follow-ups help humans repair weak reasoning—not just document it.</p>
          <p className="mt-5 text-zinc-200">Verify readiness, then build the judgment to match—before a hire, a promotion, or high-stakes work goes wrong.</p>
        </div>
      </section>

      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="HOW IT WORKS" title="From detection to closure" />
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
          <SectionHeading eyebrow="OUTCOMES" title="Stop measuring completion. Start measuring readiness." />
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
          <h2 className="mx-auto max-w-3xl text-4xl font-medium tracking-[-1.6px] text-white sm:text-5xl">Don&apos;t fight AI adoption. Verify the humans behind it.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">You can&apos;t—and shouldn&apos;t—try to roll back AI-enabled work. You should know whether the people using it actually understand the decisions, scenarios, and skills on the line—and help them close the gaps when they don&apos;t. openLesson measures readiness and guides the practice to improve it.</p>
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

function ReadinessVisual() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let fadeTimeout: ReturnType<typeof setTimeout>;

    const interval = setInterval(() => {
      setFading(true);
      fadeTimeout = setTimeout(() => {
        setScenarioIndex((index) => (index + 1) % READINESS_SCENARIOS.length);
        setFading(false);
      }, SCENARIO_FADE_MS);
    }, SCENARIO_ROTATE_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout);
    };
  }, []);

  const scenario = READINESS_SCENARIOS[scenarioIndex];

  return (
    <div className="relative border border-zinc-800/80 bg-zinc-950/75 p-4 shadow-2xl backdrop-blur-sm">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Workspace signal</div>
            <Link
              href={scenario.solutionHref}
              onClick={() =>
                trackCtaClick({
                  location: "landing_widget_title",
                  label: scenario.title,
                  href: scenario.solutionHref,
                  page: "/",
                })
              }
              className={`mt-1 block text-lg font-medium text-white transition-opacity duration-300 hover:text-zinc-200 ${fading ? "opacity-0" : "opacity-100"}`}
              aria-live="polite"
            >
              {scenario.title}
            </Link>
          </div>
          <div className="rounded-sm border border-cyan-400/20 bg-cyan-950/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-cyan-200">Evidence</div>
        </div>

        <div className={`mt-5 grid gap-3 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
          {scenario.signals.map((signal) => (
            <Signal key={signal.label} {...signal} />
          ))}
        </div>

        <div className={`mt-6 border border-zinc-800 bg-[#090909] p-5 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Readiness probe</div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{scenario.probe}</p>
        </div>

        <div className={`mt-4 grid grid-cols-3 gap-3 text-center transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
          {scenario.metrics.map((metric) => (
            <Metric key={metric.label} value={metric.value} label={metric.label} />
          ))}
        </div>

        <div className="mt-5 flex justify-center gap-1.5" aria-hidden="true">
          {READINESS_SCENARIOS.map((item, index) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${index === scenarioIndex ? "w-5 bg-cyan-300/80" : "w-1.5 bg-zinc-700"}`}
            />
          ))}
        </div>

        <TrackedCtaLink
          href={scenario.solutionHref}
          label="Readiness guide"
          location="landing_widget_cta"
          page="/"
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-sm border border-zinc-700 bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 ${fading ? "opacity-0" : "opacity-100"}`}
        >
          Readiness guide
          <ArrowRight size={14} />
        </TrackedCtaLink>
      </div>
    </div>
  );
}

function Signal({ label, value, width, muted = false, alert = false }: { label: string; value: string; width: string; muted?: boolean; alert?: boolean }) {
  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className={alert ? "text-amber-300" : muted ? "text-zinc-500" : "text-cyan-200"}>{value}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <div className={`h-full ${alert ? "bg-amber-300/70" : muted ? "bg-zinc-500" : "bg-cyan-300/80"}`} style={{ width }} />
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="text-2xl font-medium text-white">{value}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[1.4px] text-zinc-600">{label}</div>
    </div>
  );
}
