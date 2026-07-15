"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { ProductTable } from "@/components/ProductTable";
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
              href="#products"
              onClick={() => trackCtaClick({ location: "landing_hero", label: "See the products", href: "#products", page: "/" })}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              See the products
            </a>
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">Trace Interruption Model • Proof-of-Work API • Think Aloud Protocol • ILE • Agentic Learning Environment</p>
        </div>
      </section>

      <section id="approach" className="relative z-10 mx-auto max-w-6xl px-6 pb-4 sm:pb-6">
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

      <section id="products" className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading eyebrow="PRODUCTS" title="A Product Suite for Humans and AI Agents" />
        <p className="mt-3 max-w-2xl text-sm text-zinc-500">
          Verify and augment learning for humans and agents — same workspace, linked product pages below.
        </p>
        <div className="mt-5">
          <ProductTable />
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
      <Link
        href={pillar.path}
        onClick={() =>
          trackCtaClick({
            location: "landing_hero_pillar",
            label: "Learn more",
            href: pillar.path,
            page: "/",
          })
        }
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
      >
        Learn more
        <ArrowRight size={14} />
      </Link>
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
