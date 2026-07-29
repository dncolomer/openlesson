"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Calendar } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { DEMO_BOOKING_URL } from "@/lib/seo/product-page";

const PAGE_PATH = "/skill-verification";
const CTA_WORKSPACE = "Create your Workspace";
const CTA_WORKSPACE_HREF = "/workspace/new";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

const AUDIENCES = [
  {
    eyebrow: "Recruitment teams",
    title: "Screen hard skills without burning interviewer hours",
    body: "Run consistent skill evaluations across every campaign. Candidates complete a private link on their own time; you get role rankings and strength/weakness packs before live interviews.",
  },
  {
    eyebrow: "HR in fast-scaling startups",
    title: "Scale hiring without inventing a new process every week",
    body: "When headcount doubles, resume screens and ad-hoc coding tests fall apart. Use the same verification stack for high-volume roles and keep a shared bar across the funnel.",
  },
  {
    eyebrow: "Recruitment service providers",
    title: "Offer hard-skill verification as a productized service",
    body: "Agencies and RPOs often struggle to deliver real hard-skill verification at client scale. White-label the signal: role rankings, comparable cohorts, and report-driven shortlists you can stand behind.",
  },
] as const;

const SKILL_CHECK = {
  title: "Self-Service Skill Check",
  eyebrow: "Verification · ~15 min",
  oneLine:
    "Candidates open a private link, complete a timed think-aloud evaluation, and you receive a role ranking plus per-candidate strength and weakness reports.",
  bullets: [
    "Fully self-service and parallelizable, hundreds of applicants without calendar load",
    "Think Aloud Protocol dialog captures reasoning, not just a final answer",
    "Role ranking + optional per-candidate breakdown for first-cut decisions",
    "Standalone links or API into ATS / recruiting stack",
  ],
  when: [
    "Top-of-funnel or first technical / skill screen at volume",
    "Senior interview time is the bottleneck",
    "AI-polished CVs look the same and you need early process signal",
  ],
  comparison: [
    { without: "Screeners and engineers bottleneck volume", with: "Dozens of evaluations run async in parallel" },
    { without: "Weak candidates reach expensive interviews", with: "Role-ranked shortlist before HM time" },
    { without: "Every interviewer invents a bar", with: "Same exercise and markers for the whole cohort" },
  ],
} as const;

const TAKE_HOME = {
  title: "Self-Service Take-Home",
  eyebrow: "Verification · multi-block work sample",
  oneLine:
    "Candidates complete an open-ended, multi-block assignment in-product (discussion, diagrams, notes), and you get role rankings without the classic take-home cost curve.",
  bullets: [
    "Real work artifacts produced in-session, not a silent weekend PDF",
    "Structured and scoreable across a full hiring cohort",
    "Makes take-homes viable on volume roles that previously skipped them",
    "Lowers reviewer load on premium / senior pipelines",
  ],
  when: [
    "After a light screen or Self-Service Skill Check, as a work sample",
    "Roles that should have a take-home but review cost blocked it",
    "High-profile pipelines where take-home quality matters and reviewer load is painful",
  ],
  comparison: [
    { without: "Take-homes only for a few premium roles", with: "Viable work samples at higher volume" },
    { without: "Multi-day lag and uneven grading", with: "Structured multi-block journey + role ranking" },
    { without: "Senior engineers grade every packet", with: "Reports first; humans on exceptions and finals" },
  ],
} as const;

export function SkillVerificationLanding() {
  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-page="skill-verification"
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      {bgImage ? (
        <div
          className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      ) : null}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <LandingNav />

      {/* Hero */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          HARD SKILL VERIFICATION · HIRING AT SCALE
        </div>
        <h1 className="max-w-5xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">
          Verify hard skills before you hire,
          <br />
          without the fear of AI-faked test results.
        </h1>
        <div className="mt-7 max-w-5xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
          <p>
            Built for{" "}
            <span className="text-zinc-200">recruitment teams</span>,{" "}
            <span className="text-zinc-200">HR teams in fast-scaling startups</span>, and{" "}
            <span className="text-zinc-200">recruitment service providers</span> that need real hard-skill
            signal, not another resume filter AI can game.
          </p>
          <p className="text-zinc-500 sm:text-base">
            Two self-service verification products:{" "}
            <span className="text-zinc-200">Self-Service Skill Check</span> for fast, parallel screening, and{" "}
            <span className="text-zinc-200">Self-Service Take-Home</span> for deeper work-sample depth without
            the classic take-home cost curve.
          </p>
        </div>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCtaLink
            href={DEMO_BOOKING_URL}
            label="Book a demo"
            location="skill_verification_hero_demo"
            page={PAGE_PATH}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            <Calendar size={16} />
            Book a demo
          </TrackedCtaLink>
          <TrackedCtaLink
            href={CTA_WORKSPACE_HREF}
            label={CTA_WORKSPACE}
            location="skill_verification_hero_workspace"
            page={PAGE_PATH}
            className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            {CTA_WORKSPACE}
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
        </div>
      </section>

      {/* Problem / ICP */}
      <section id="who" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-2 sm:pb-10">
        <SectionHeading
          eyebrow="WHO IT'S FOR"
          title="When hard-skill verification is the bottleneck."
        />
        <p className="mt-4 max-w-5xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Recruitment teams drowning in volume, startup HR scaling headcount faster than process, and service
          providers who cannot productize genuine skill checks for clients, all hit the same wall: weak early
          signal, expensive interviews, and take-homes that do not scale.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {AUDIENCES.map((audience) => (
            <div
              key={audience.eyebrow}
              className="flex min-h-0 min-w-0 flex-col border border-zinc-800 bg-zinc-950/70 p-6 sm:p-7"
            >
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {audience.eyebrow}
              </div>
              <h3 className="text-[1.35rem] font-medium leading-[1.1] tracking-[-0.6px] text-white">
                {audience.title}
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-zinc-400 sm:text-base">{audience.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Products overview strip */}
      <section id="products" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:pb-10">
        <SectionHeading
          eyebrow="TWO VERIFICATION PRODUCTS"
          title="Screen fast. Sample deep. Same measurement stack."
        />
        <p className="mt-4 max-w-5xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Use Self-Service Skill Check for early, parallel skill signal. Layer Self-Service Take-Home when you
          need assignment-level depth. Both produce role rankings and per-candidate strengths and gaps.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-5">
          <ProductSummaryCard
            title={SKILL_CHECK.title}
            tag="~15 min · screening speed"
            body="Timed think-aloud evaluation via private link. Ideal for top-of-funnel volume and first technical cuts."
          />
          <ProductSummaryCard
            title={TAKE_HOME.title}
            tag="Multi-block · work-sample depth"
            body="Open-ended assignment journey in-product. Ideal after a light screen or for roles that need real work evidence."
          />
        </div>
      </section>

      {/* Skill Check deep dive */}
      <section id="skill-check" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:pb-10">
        <div className="grid items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
          <div className="min-w-0">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {SKILL_CHECK.eyebrow}
            </div>
            <h2 className="max-w-xl text-3xl font-medium leading-[1.1] tracking-[-1.2px] text-white sm:text-4xl">
              {SKILL_CHECK.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-[15px]">{SKILL_CHECK.oneLine}</p>
            <ul className="mt-5 space-y-2.5 text-[15px] leading-relaxed text-zinc-400">
              {SKILL_CHECK.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">When to use</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
                {SKILL_CHECK.when.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="min-w-0 w-full">
            <figure className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.85)]">
              <Image
                src="/ranking_app.png"
                alt="Role ranking UI, candidates ordered by skill proximity with strengths and gaps"
                width={2080}
                height={1644}
                className="h-auto w-full object-cover object-center"
                sizes="(max-width: 768px) 100vw, 560px"
                priority
              />
              <figcaption className="border-t border-zinc-800/90 px-4 py-3 font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500 sm:px-5">
                Client deliverable · role ranking + per-candidate detail
              </figcaption>
            </figure>
            <ComparisonPanel
              withoutLabel="Without Skill Check"
              withLabel="With Self-Service Skill Check"
              rows={SKILL_CHECK.comparison}
            />
          </div>
        </div>
      </section>

      {/* Take-Home deep dive */}
      <section id="take-home" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:pb-10">
        <div className="grid items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
          <div className="min-w-0 md:order-2">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {TAKE_HOME.eyebrow}
            </div>
            <h2 className="max-w-xl text-3xl font-medium leading-[1.1] tracking-[-1.2px] text-white sm:text-4xl">
              {TAKE_HOME.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-[15px]">{TAKE_HOME.oneLine}</p>
            <ul className="mt-5 space-y-2.5 text-[15px] leading-relaxed text-zinc-400">
              {TAKE_HOME.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">When to use</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
                {TAKE_HOME.when.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="min-w-0 w-full md:order-1">
            <figure className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.85)]">
              <Image
                src="/knowledgeg2.png"
                alt="Knowledge embeddings with role regions, multi-block take-home signal projected into knowledge space"
                width={2918}
                height={1656}
                className="h-auto w-full object-cover object-top"
                sizes="(max-width: 768px) 100vw, 560px"
              />
              <figcaption className="border-t border-zinc-800/90 px-4 py-3 font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500 sm:px-5">
                In-product signal · multi-block work in knowledge space
              </figcaption>
            </figure>
            <ComparisonPanel
              withoutLabel="Without Take-Home product"
              withLabel="With Self-Service Take-Home"
              rows={TAKE_HOME.comparison}
            />
          </div>
        </div>
      </section>

      {/* Funnel */}
      <section id="funnel" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:pb-10">
        <SectionHeading
          eyebrow="HIRING FUNNEL"
          title="Where each product sits in the process."
        />
        <div className="mt-6 border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-sm sm:p-8">
          <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-zinc-400 sm:text-[13px]">
{`Apply
  → resume / early screen (optional)
  → Self-Service Skill Check (~15 min)   ← fast hard-skill screen
  → HM / tech interview
  → Self-Service Take-Home               ← deeper work sample
  → Offer`}
          </pre>
          <p className="mt-5 text-base leading-relaxed text-zinc-500 sm:text-[15px]">
            Skill Check maximizes screening speed and parallel volume. Take-Home adds work-sample depth when
            the bar demands it. Both feed the same ranking and strengths/gaps reporting model so hiring
            managers stay calibrated across stages.
          </p>
        </div>
      </section>

      {/* Scale visual band */}
      <section id="scale" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:pb-10">
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            VERIFICATION AT SCALE
          </div>
          <h2 className="max-w-3xl text-3xl font-medium leading-[1.1] tracking-[-1.2px] text-white sm:text-4xl">
            Hire, screen, and rank against your own knowledge requirements, without leaking proprietary specs.
          </h2>
          <p className="mt-5 max-w-4xl">
            The same stack that powers Self-Service Skill Check and Self-Service Take-Home scales human
            verification from recruitment campaigns to agency delivery. Hosted Think Aloud Protocol (TAP)
            sessions and multi-block Integrated Learning Environment (ILE) journeys give you process signal
            traditional tests and polished portfolio uploads cannot fake.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="relative z-10 mx-auto max-w-6xl px-6 pb-12 sm:pb-16">
        <div className="border border-zinc-800 bg-zinc-950/80 p-8 sm:p-10">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            NEXT STEP
          </div>
          <h2 className="max-w-2xl text-3xl font-medium leading-[1.1] tracking-[-1.2px] text-white sm:text-4xl">
            Run a pilot on one high-volume role.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
            Bring a real job description. We configure Self-Service Skill Check and/or Self-Service Take-Home
            for that role, send candidate links, and calibrate rankings with your hiring managers.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackedCtaLink
              href={DEMO_BOOKING_URL}
              label="Book a demo"
              location="skill_verification_footer_demo"
              page={PAGE_PATH}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              <Calendar size={16} />
              Book a demo
            </TrackedCtaLink>
            <TrackedCtaLink
              href={CTA_WORKSPACE_HREF}
              label={CTA_WORKSPACE}
              location="skill_verification_footer_workspace"
              page={PAGE_PATH}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              {CTA_WORKSPACE}
              <ArrowRight className="ml-2" size={16} />
            </TrackedCtaLink>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</div>
      <h2 className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-1.8px] text-white sm:text-5xl">
        {title}
      </h2>
    </div>
  );
}

function ProductSummaryCard({
  title,
  tag,
  body,
}: {
  title: string;
  tag: string;
  body: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col border border-zinc-800 bg-zinc-950/70 p-6 sm:p-7 lg:p-8">
      <div className="w-full text-[1.5rem] font-medium leading-[1.08] tracking-[-0.8px] text-white sm:text-[1.7rem]">
        <span className="block w-full border-l-[3px] border-white/30 bg-white/[0.06] px-3.5 py-2 text-white sm:px-4 sm:py-2.5">
          {title}
        </span>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">{tag}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 sm:text-base">{body}</p>
    </div>
  );
}

function ComparisonPanel({
  withoutLabel,
  withLabel,
  rows,
}: {
  withoutLabel: string;
  withLabel: string;
  rows: readonly { without: string; with: string }[];
}) {
  return (
    <div className="mt-4 overflow-hidden border border-zinc-800/90 bg-zinc-950/70">
      <div className="grid grid-cols-2 border-b border-zinc-800 bg-zinc-950/80">
        <div className="px-3 py-2.5 text-xs font-medium text-zinc-500 sm:px-4 sm:text-sm">{withoutLabel}</div>
        <div className="px-3 py-2.5 text-xs font-medium text-zinc-300 sm:px-4 sm:text-sm">{withLabel}</div>
      </div>
      {rows.map((row) => (
        <div key={row.without} className="grid grid-cols-2 border-t border-zinc-800/90 first:border-t-0">
          <div className="px-3 py-2.5 text-xs leading-relaxed text-zinc-500 sm:px-4 sm:text-sm">{row.without}</div>
          <div className="px-3 py-2.5 text-xs leading-relaxed text-zinc-300 sm:px-4 sm:text-sm">{row.with}</div>
        </div>
      ))}
    </div>
  );
}
