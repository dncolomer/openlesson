"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, Menu } from "lucide-react";
import { Footer } from "@/components/Footer";

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
    body: "Define the skill, decision domain, or scenario that actually matters for your team.",
  },
  {
    title: "Think aloud with Socratic coaching",
    body: "Team members work through real problems out loud while the AI probes for depth, adaptability, and reasoning quality.",
  },
  {
    title: "See clear readiness evidence",
    body: "Get objective insight into individual and team judgment, not just completion rates or polished final answers.",
  },
  {
    title: "Close gaps with targeted practice",
    body: "Turn weak signals into specific follow-up scenarios before gaps become expensive real-world mistakes.",
  },
];

const outcomes = [
  "Detect hidden skill gaps before they show up in client work or critical decisions.",
  "Move beyond vanity metrics like training completion and seat activity.",
  "Build human judgment that complements AI tools instead of depending on them.",
  "Create auditable evidence of readiness for compliance, promotion, or high-stakes roles.",
  "Reduce the growing risk of AI-masked underperformance.",
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

      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-[#0a0a0a]/86 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-base font-semibold tracking-tight text-white transition hover:text-zinc-300">openLesson</Link>
          <nav className="hidden items-center gap-7 text-sm text-zinc-500 md:flex" aria-label="B2B landing page navigation">
            <a href="#product" className="transition hover:text-white">Product</a>
            <a href="#teams" className="transition hover:text-white">For Teams</a>
            <a href="#how" className="transition hover:text-white">How it Works</a>
            <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="px-2 py-2 text-sm text-zinc-500 transition hover:text-white">Login</Link>
            <PrimaryCta compact />
          </div>
          <button className="rounded-sm border border-zinc-800 p-2 text-zinc-400 md:hidden" aria-label="Open navigation"><Menu size={18} /></button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.03fr_0.97fr]">
        <div>
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">READINESS EVIDENCE FOR AI-ENABLED TEAMS</div>
          <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">AI makes your team look ready. Prove they actually are.</h1>
          <p className="mt-7 max-w-3xl text-xl leading-relaxed tracking-[-0.35px] text-zinc-400">openLesson helps teams build and measure the judgment, adaptability, and skill that AI cannot replace.</p>
          <div className="mt-7 max-w-3xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>As AI tools get better, employees can generate strong-looking outputs earlier in the learning curve without proving they understand the task, context, or decision behind the work.</p>
            <p>This creates a dangerous readiness illusion for managers. Training completion is not performance readiness.</p>
            <p className="text-zinc-200">openLesson reveals the gaps early, before they impact real work.</p>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryCta />
            <a href="#how" className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white">See how it works</a>
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Think-aloud practice • Socratic probes • readiness evidence</p>
        </div>
        <ReadinessVisual />
      </section>

      <ContentSection id="teams" eyebrow="THE PROBLEM" title="The next workplace risk is not AI adoption. It is unverified human readiness.">
        <p>AI gives employees instant help, but instant help can hide weak understanding. When people rely on AI without building the underlying skill, managers only discover the gap after mistakes happen.</p>
        <p className="text-white">Your employees have AI. Do they have the judgment to use it well?</p>
        <p>Polished output is not proof of capability. Stop letting AI-assisted employees wing critical work.</p>
      </ContentSection>

      <section id="product" className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[0.88fr_1.12fr]">
        <div>
          <SectionHeading eyebrow="THE SOLUTION" title="Find the skill gaps AI is hiding." />
          <div className="mt-8">
            <PrimaryCta />
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p className="text-white">openLesson turns AI-assisted practice into readiness evidence.</p>
          <p className="mt-5">Instead of another training that checks a box, your team practices real scenarios by thinking aloud. The Socratic AI listens to their reasoning, probes for depth, and surfaces exactly where judgment is strong and where it is still forming.</p>
          <p className="mt-5 text-zinc-200">Before people use AI in critical work, know what they actually understand.</p>
        </div>
      </section>

      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="HOW IT WORKS" title="From practice to proof" />
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
          <h2 className="mx-auto max-w-3xl text-4xl font-medium tracking-[-1.6px] text-white sm:text-5xl">Your team may be AI-enabled. Are they performance-ready?</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">Create a workspace for the real decisions, scenarios, and skills your organization cannot afford to leave unverified.</p>
          <div className="mt-8 flex justify-center">
            <PrimaryCta />
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function PrimaryCta({ compact = false }: { compact?: boolean }) {
  return (
    <Link href={CTA_HREF} className={`inline-flex items-center justify-center rounded-sm bg-white font-medium text-black transition hover:bg-zinc-200 ${compact ? "px-4 py-2 text-sm" : "min-h-12 px-5 py-3 text-sm"}`}>
      {CTA}
      <ArrowRight className="ml-2" size={compact ? 15 : 16} />
    </Link>
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
  return (
    <div className="relative border border-zinc-800/80 bg-zinc-950/75 p-4 shadow-2xl backdrop-blur-sm">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Workspace signal</div>
            <div className="mt-1 text-lg font-medium text-white">Client escalation readiness</div>
          </div>
          <div className="rounded-sm border border-cyan-400/20 bg-cyan-950/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-cyan-200">Evidence</div>
        </div>

        <div className="mt-5 grid gap-3">
          <Signal label="Explains tradeoffs without script" value="Strong" width="82%" />
          <Signal label="Updates judgment when facts change" value="Forming" width="54%" muted />
          <Signal label="Identifies AI failure modes" value="Gap" width="34%" alert />
        </div>

        <div className="mt-6 border border-zinc-800 bg-[#090909] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Socratic probe</div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">If the AI-generated recommendation is confidently wrong, what evidence would make you stop and revise your decision?</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Metric value="14" label="reasoning traces" />
          <Metric value="5" label="hidden gaps" />
          <Metric value="2" label="critical risks" />
        </div>
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
