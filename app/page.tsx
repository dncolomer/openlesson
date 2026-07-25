"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { trackCtaClick } from "@/lib/analytics";
import { HERO_PILLAR_PAGES } from "@/lib/seo/use-case-page";

const CTA = "Create your Workspace";
const CTA_HREF = "/workspace/new";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
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
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">VERIFICATION . OPTIMIZATION . AUGMENTATION</div>
          <h1 className="max-w-5xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">
            Beyond benchmarks for AI.
            <br />
            Beyond tests for humans.
          </h1>
          <div className="mt-7 max-w-5xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>
              Uncertain Systems is built on three verticals for human and agentic learning:{" "}
              <span className="text-zinc-200">verification</span>,{" "}
              <span className="text-zinc-200">optimization</span>, and{" "}
              <span className="text-zinc-200">augmentation</span>.
            </p>
            <p className="text-zinc-500 sm:text-base">
              Verify skills before hire, deploy, or certify. Optimize learning until adoption and outcomes
              improve. Augment how people think inside onboarding, courses, and prep.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {HERO_PILLAR_PAGES.map((pillar, index) => (
                <HeroPillarCard key={pillar.path} pillar={pillar} wideOnMd={index === 2} />
              ))}
            </div>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryCta location="landing_hero" />
            <a
              href="#platform"
              onClick={() => trackCtaClick({ location: "landing_hero", label: "See the platform", href: "#platform", page: "/" })}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              See the platform
            </a>
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Trace Interruption Model • Proof-of-Work API • Stash API • Think Aloud Protocol • ILE • Agentic Learning Environment</p>
        </div>
      </section>

      <section id="platform" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-2 sm:pb-10">
        <SectionHeading
          eyebrow="PLATFORM"
          title="See skill as distance in knowledge space."
        />
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Every workspace projects people and roles into a shared embedding geometry. Overlay role regions,
          multi-select subjects, and read{" "}
          <span className="text-zinc-200">knowledge distance</span> live — who is already in region for Backend,
          who sits outside SRE, and how the team cohort is moving over time.
        </p>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-500 sm:text-[15px]">
          Create{" "}
          <span className="text-zinc-300">custom knowledge regions</span> from internal experts, including{" "}
          <span className="text-zinc-300">private</span> ones when “knowing X” is proprietary — then evaluate
          candidates and teammates against that geometry.
        </p>
        <div
          className="mt-6 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
          data-landing-knowledge-visual
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[2918/1656]">
            <Image
              src="/knowledgeg2.png"
              alt="Uncertain Systems Knowledge embeddings — multi-user projection with role regions and knowledge distance"
              fill
              className="object-cover object-top"
              sizes="(max-width: 1152px) 100vw, 1152px"
              priority
            />
          </div>
          <div className="border-t border-zinc-800/90 px-4 py-3 sm:px-5 sm:py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
              Knowledge · Embeddings · Role regions · Proof of Work
            </p>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Same stack that powers verification, optimization, and augmentation — a living map of proximity to
              “knowing X,” grounded in real work traces rather than multiple-choice pass rates.
            </p>
          </div>
        </div>
      </section>

      <section id="approach" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:pb-10">
        <SectionHeading
          eyebrow="THE APPROACH"
          title="A learning world model, not linear analytics."
        />
        <div className="mt-6 border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p>
            Uncertain Systems builds a learning world model from real work — skills, scenarios, proof of work, and
            where reasoning breaks — instead of stitching together linear funnel analytics. The Trace
            Interruption Model uses that live picture to drive verification, optimization, and augmentation
            in context.
          </p>
          <p className="mt-5 text-zinc-300">
            <span className="text-zinc-200">Verification</span> scores whether humans and agents can
            perform before hire, deploy, or certify.{" "}
            <span className="text-zinc-200">Optimization</span> routes the next practice or coaching step
            when gaps show up in the model.{" "}
            <span className="text-zinc-200">Augmentation</span> interrupts shallow fluency with probes tuned
            to what the workspace already knows. One model, three verticals — embedded in your existing
            tools.
          </p>
        </div>
      </section>

      {/* Last content section before footer */}
      <section
        id="scale"
        className="relative z-10 mx-auto max-w-6xl px-6 pb-12 sm:pb-16"
        data-landing-scale-section
      >
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
          <div className="min-w-0">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              VERIFICATION AT SCALE
            </div>
            <h2 className="max-w-xl text-3xl font-medium leading-[1.1] tracking-[-1.2px] text-white sm:text-4xl">
              Hire, screen, and rank against your bar — at volume.
            </h2>
            <div className="mt-4 space-y-3 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
              <p>
                The same measurement stack scales human verification — from{" "}
                <span className="text-zinc-200">recruitment at volume</span> to internal mobility and agent
                deploy gates — without stuffing proprietary skill into a public quiz bank.
              </p>
              <p>
                Hosted{" "}
                <span className="text-zinc-200">TAP</span> links run live, time-framed screening for high-volume
                hiring without building your own UX.{" "}
                <span className="text-zinc-200">ILE</span> adds open-ended assignment depth when judgment and
                tradeoffs matter. Compare applicants on the same role region; surface reasoning multiple-choice
                cannot fake.
              </p>
            </div>
          </div>
          <div className="min-w-0 w-full md:justify-self-end">
            <figure
              className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.85)] md:max-w-lg lg:max-w-xl md:ml-auto"
              data-landing-ranking-visual
            >
              <Image
                src="/ranking_app.png"
                alt="Candidate ranking by proximity to a knowledge region bar"
                width={2080}
                height={1644}
                className="h-auto w-full object-cover object-center"
                sizes="(max-width: 768px) 100vw, 560px"
                priority
              />
            </figure>
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

function HeroPillarCard({
  pillar,
  wideOnMd = false,
}: {
  pillar: (typeof HERO_PILLAR_PAGES)[number];
  wideOnMd?: boolean;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6 ${
        wideOnMd ? "md:col-span-2 lg:col-span-1" : ""
      }`}
    >
      <HeroPillarTitle lead={pillar.lead} highlightLines={pillar.titleLines} fullWidth />
      <ul className="mt-3 space-y-1 text-sm leading-snug text-zinc-400">
        {pillar.cardSummary.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function HeroPillarTitle({
  lead,
  highlightLines,
  fullWidth = false,
}: {
  lead: string;
  highlightLines: string[];
  fullWidth?: boolean;
}) {
  return (
    <div>
      <p className="text-sm leading-snug text-zinc-500">{lead}</p>
      <div className="mt-2 text-[1.45rem] font-medium leading-[1.05] tracking-[-0.8px] text-white sm:text-[1.6rem]">
        <span
          className={`border-l-[3px] border-white/30 bg-white/[0.06] px-3 py-1.5 text-white ${
            fullWidth ? "block w-full" : "inline-block"
          }`}
        >
          {highlightLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
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
