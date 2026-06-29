"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { ProductStack } from "@/components/ProductStack";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { trackCtaClick } from "@/lib/analytics";

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
    body: "Define the skill, scenario, or decision domain. Enrich it programmatically with documents, screen shares, video, EEG data, or any human-generated evidence.",
  },
  {
    title: "Verify with evidence or think-aloud",
    body: "Choose your verification path: send unstructured artifacts to the Evidence API for continuous scoring, or issue Think-Aloud Protocol URLs for hosted cognitive verification.",
  },
  {
    title: "Get continuous scores and gap analysis",
    body: "Both verification products return marker scores, severity-ranked gaps, and auditable rationale—not a single pass/fail snapshot.",
  },
  {
    title: "Improve in the ILE",
    body: "Gap findings route humans into the Integrated Learning Environment for targeted practice. Scores improve as cognition catches up—with evidence at every step.",
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

const SKILL_MARKERS = [
  { label: "Definitions", score: 82 },
  { label: "Causal reasoning", score: 54 },
  { label: "Application", score: 71 },
  { label: "Exception judgment", score: 38 },
  { label: "Repair", score: 61 },
];

const GAP_SUMMARY = [
  { skill: "Exception judgment", severity: "High", detail: "Cannot weigh blast radius when policy edge cases appear." },
  { skill: "Causal reasoning", severity: "Medium", detail: "Skips intermediate steps when explaining tradeoffs under probe." },
];

const ACTION_STEPS = [
  { step: "Complete Think-Aloud verification", status: "Done" },
  { step: "Practice exception scenarios in ILE", status: "Open", ileHref: "/ile/blocks/exception-judgment" },
  { step: "Re-verify with Evidence API", status: "Scheduled" },
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
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">THREE PRODUCTS • ONE WORKSPACE</div>
          <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">AI makes humans look ready. Prove they actually are.</h1>
          <div className="mt-7 max-w-3xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>As AI tools get better, humans can generate strong-looking outputs without proving they understand the task, context, or decision behind the work.</p>
            <p className="text-zinc-200">openLesson scores genuine human cognition—then closes the gaps AI hides.</p>
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
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Evidence API • Think-Aloud Verification • Integrated Learning Environment</p>
        </div>
        <SkillSnapshotWidget />
      </section>

      <ContentSection id="problem" eyebrow="THE PROBLEM" title="The biggest AI risk isn't hallucinations or inaccuracies. It's unverified human readiness.">
        <p>AI gives you instant help, but instant help can hide weak understanding. Real-time assist tools can feed answers during interviews, exams, and live calls—creating candidates and employees who look ready while genuine cognition stays untested.</p>
        <p className="text-white">You have AI. Do you have the judgment to use it well?</p>
        <p>Polished output is not proof of capability. When screens reward scripts and generated work, the only trustworthy signal left is how someone thinks out loud when probed.</p>
      </ContentSection>

      <section id="products" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="THE PLATFORM"
          title="Three products. One Performance Workspace."
        />
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">
          Everything runs on{" "}
          <span className="text-zinc-200">Performance Workspaces</span>—environments you create and enrich with any documents or human-generated data. Two Human Knowledge Verification products score cognition; the Integrated Learning Environment helps humans improve.
        </p>
        <div className="mt-10">
          <ProductStack />
        </div>
      </section>

      <section id="product" className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[0.88fr_1.12fr]">
        <div>
          <SectionHeading eyebrow="THE LOOP" title="Verify cognition. Close the gaps." />
          <div className="mt-8">
            <PrimaryCta location="landing_solution" />
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p className="text-white">Headless or hosted—you choose how to verify.</p>
          <p className="mt-5">Pipe unstructured evidence into the API for continuous scoring, or issue Think-Aloud Protocol URLs when you need live cognition under probe. Both products surface the same gap analysis—then route humans into the ILE to improve.</p>
          <p className="mt-5 text-zinc-200">Verify readiness, build judgment, and prove improvement—with auditable evidence at every step.</p>
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

function SkillSnapshotWidget() {
  const overallScore = Math.round(
    SKILL_MARKERS.reduce((sum, marker) => sum + marker.score, 0) / SKILL_MARKERS.length,
  );

  return (
    <div className="relative border border-zinc-800/80 bg-zinc-950/75 p-4 shadow-2xl backdrop-blur-sm">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Skill profile</div>
            <p className="mt-1 text-lg font-medium text-white">Compliance exception review</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Overall</div>
            <div className="mt-1 text-2xl font-medium text-white">{overallScore}</div>
          </div>
        </div>

        <div className="mt-4">
          <SkillSpiderChart markers={SKILL_MARKERS} />
        </div>

        <div className="mt-5 border border-zinc-800 bg-[#090909] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Gap summary</div>
          <ul className="mt-3 space-y-3">
            {GAP_SUMMARY.map((gap) => (
              <li key={gap.skill} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <span className="text-zinc-200">{gap.skill}</span>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{gap.detail}</p>
                </div>
                <span
                  className={`shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1px] ${
                    gap.severity === "High"
                      ? "border-amber-400/30 bg-amber-950/40 text-amber-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {gap.severity}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Action steps</div>
          <ol className="mt-3 space-y-2.5">
            {ACTION_STEPS.map((action, index) => (
              <li key={action.step} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-zinc-800 font-mono text-[10px] text-zinc-400">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {action.ileHref ? (
                    <button
                      type="button"
                      onClick={() =>
                        trackCtaClick({
                          location: "landing_widget_ile",
                          label: action.step,
                          href: action.ileHref!,
                          page: "/",
                        })
                      }
                      className="group text-left"
                    >
                      <span className="text-cyan-200 underline decoration-cyan-400/40 underline-offset-2 transition group-hover:text-cyan-100">
                        {action.step}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] text-zinc-600">{action.ileHref}</span>
                    </button>
                  ) : (
                    <span className="text-zinc-300">{action.step}</span>
                  )}
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] uppercase tracking-[1px] ${
                    action.status === "Done"
                      ? "text-emerald-400/80"
                      : action.status === "Open"
                        ? "text-cyan-300"
                        : "text-zinc-600"
                  }`}
                >
                  {action.status}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function SkillSpiderChart({ markers }: { markers: { label: string; score: number }[] }) {
  const size = 280;
  const center = size / 2;
  const radius = 72;

  const points = markers.map((marker, index) => {
    const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
    const value = Math.max(0, Math.min(100, marker.score)) / 100;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: center + cos * radius * value,
      y: center + sin * radius * value,
      labelX: center + cos * (radius + 28),
      labelY: center + sin * (radius + 28),
      textAnchor: (Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end") as "middle" | "start" | "end",
      score: marker.score,
      label: marker.label,
      low: marker.score < 50,
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[280px]" role="img" aria-label="Skill spider chart">
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon
          key={level}
          points={markers
            .map((_, index) => {
              const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
              return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
        />
      ))}
      {markers.map((_, index) => {
        const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
        return (
          <line
            key={`axis-${index}`}
            x1={center}
            y1={center}
            x2={center + Math.cos(angle) * radius}
            y2={center + Math.sin(angle) * radius}
            stroke="rgba(255,255,255,0.06)"
          />
        );
      })}
      <polygon
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="rgba(34,211,238,0.12)"
        stroke="rgba(34,211,238,0.7)"
        strokeWidth="1.5"
      />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="3" fill={point.low ? "#fbbf24" : "#67e8f9"} />
          <text
            x={point.labelX}
            y={point.labelY}
            textAnchor={point.textAnchor}
            dominantBaseline="middle"
            className="fill-zinc-500 text-[8px]"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
