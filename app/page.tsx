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
            A Human Learning Harness.
            <br />
            Learn without a tutor. Verify without a test.
          </h1>
          <div className="mt-7 max-w-5xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>
              Uncertain Systems is a Human Learning Harness for knowledge acquisition and knowledge verification.
            </p>
            <p className="text-zinc-500 sm:text-base">
              Verify knowledge without a test — uncheatable proof that it is actually held. Optimize so people learn
              faster without a tutor. Augment thinking: you can outsource knowledge, you cannot outsource your learning.
            </p>
          </div>
          <div className="mt-6 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {HERO_PILLAR_PAGES.map((pillar) => (
              <HeroPillarCard key={pillar.path} pillar={pillar} />
            ))}
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
        </div>
      </section>

      <section id="platform" className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-2 sm:pb-10">
        <SectionHeading
          eyebrow="PLATFORM"
          title="See skill as distance in knowledge space."
        />
        <p className="mt-4 max-w-5xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Every workspace puts people into a shared embedding geometry. Create knowledge regions,
          multi-select users, and read{" "}
          <span className="text-zinc-200">distance to knowledge</span> live: see how people do against your
          defined knowledge regions.
        </p>
        <p className="mt-3 max-w-5xl text-base leading-relaxed text-zinc-500 sm:text-[15px]">
          Create{" "}
          <span className="text-zinc-300">custom knowledge regions</span> from internal expert data and measure
          your workforce readiness without sharing confidential information about your internal systems.
          Regions stay private to the workspace.
        </p>
        <div
          className="mt-6 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
          data-landing-knowledge-visual
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[2918/1656]">
            <Image
              src="/knowledgeg2.png"
              alt="Uncertain Systems Knowledge embeddings: multi-user projection with knowledge regions and knowledge distance"
              fill
              className="object-cover object-top"
              sizes="(max-width: 1152px) 100vw, 1152px"
              priority
            />
          </div>
          <div className="border-t border-zinc-800/90 px-4 py-3 sm:px-5 sm:py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
              Knowledge · Embeddings · Knowledge regions · Proof of Work
            </p>
            <p className="mt-1.5 max-w-5xl text-sm leading-relaxed text-zinc-400">
              We help you build a living map of proximity to any kind of knowledge. We ground our results on real
              and genuine work traces rather than tests, benchmarks or project uploads that can be easily cheated
              and faked.
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
            Uncertain Systems builds a learning world model from real work: skills, scenarios, proof of work,
            and where reasoning breaks, instead of stitching together linear funnel analytics. Our hosted
            interfaces as well as our API products are all specially designed to elicit genuine raw work data
            from the user while at the same time minimizing the disruption of the natural cognitive process.
          </p>
          <p className="mt-5">
            We go beyond LLM judged tests and benchmarks. Our conversational interfaces run on top of an
            interruption model (
            <span className="text-zinc-200">TIM — Trace Interruption Model</span>) that uses the evolving
            learner model to proactively steer the thinking process.
          </p>
          <p className="mt-5">
            We score whether people actually hold the knowledge. We optimize routes for the next practice or
            coaching step when gaps show up in the model. We augment by helping you outsource the right type of
            thinking but not the actual learning.
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
              Verify and rank knowledge against your own knowledge regions at volume.
            </h2>
            <div className="mt-4 space-y-3 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
              <p>
                The same measurement stack runs{" "}
                <span className="text-zinc-200">knowledge verification at scale</span> — many people against
                the same knowledge regions — without sharing proprietary skills and specs into a public
                repository or database.
              </p>
              <p>
                Our hosted{" "}
                <span className="text-zinc-200">Think Aloud Protocol (TAP)</span> runs live, time-framed
                verification in parallel, not one session at a time, without building your own UX. With our{" "}
                <span className="text-zinc-200">Integrated Learning Environment (ILE)</span> we add open-ended
                assignment depth that stays practical as volume grows. We help you surface data that no
                traditional tech can beat.
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
                alt="Ranking by proximity to a knowledge region bar"
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
}: {
  pillar: (typeof HERO_PILLAR_PAGES)[number];
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col border border-zinc-800 bg-zinc-950/70 p-6 sm:p-7 lg:p-8">
      <HeroPillarTitle highlightLines={pillar.titleLines} />
      <ul className="mt-5 flex-1 space-y-2.5 text-[15px] leading-relaxed text-zinc-400 sm:text-base">
        {pillar.cardSummary.map((item) => (
          <li key={item} className="max-w-none">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroPillarTitle({ highlightLines }: { highlightLines: string[] }) {
  return (
    <div className="w-full text-[1.5rem] font-medium leading-[1.08] tracking-[-0.8px] text-white sm:text-[1.7rem]">
      <span className="block w-full border-l-[3px] border-white/30 bg-white/[0.06] px-3.5 py-2 text-white sm:px-4 sm:py-2.5">
        {highlightLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
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
