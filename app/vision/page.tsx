import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { standardShareSocialMetadata } from "@/lib/og/standard";
import {
  VISION_TOMOGRAPHY_INDUCTION_COPY,
  VISION_TOMOGRAPHY_INDUCTION_PATHS,
} from "@/lib/vision/knowledge-tomography-induction-copy";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/vision",
});

export const metadata: Metadata = {
  title: "Vision",
  description:
    "Uncertain Systems is building self-driving technology for learning — non-invasive systems that raise attention and understanding without asking humans to burn proportionally more energy.",
  alternates: { canonical: "https://uncertain.systems/vision" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const PARTNERS = [
  { name: "TheWiser.org", href: "https://thewiser.org", label: "Learning and knowledge infrastructure project" },
  { name: "Dantes.io", href: "https://dantes.io", label: "Current client project" },
];

export default function VisionPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[68px]">
          Automating Human Learning
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-relaxed text-zinc-400">
          We are building self-driving technology for learning: non-invasive systems that raise attention and
          understanding without asking humans to burn proportionally more energy.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCtaLink
            href="/workspace/new"
            label="Create your Workspace"
            location="vision_hero"
            page="/vision"
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Create your Workspace
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
          <Link
            href="/science"
            className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Read the thesis
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <div className="grid gap-6 md:grid-cols-3">
          <VisionCard
            eyebrow="Problem"
            title="Low ROI Learning"
            body="For most people, learning is physically and mentally expensive. Attention, retention, and deep understanding still require too much effort for the output they get back."
          />
          <VisionCard
            eyebrow="Vision"
            title="Self-Driving Learning"
            body="We are building non-invasive technology that guarantees the same or more human learning with significantly less physical and mental effort."
          />
          <VisionCard
            eyebrow="Goal"
            title="More Attention, Same Energy"
            body="Increase attention markers without a proportional energy cost to the user, then compound that into a full automation stack for human learning."
          />
        </div>
      </section>

      <section
        id="knowledge-tomography-induction"
        data-vision-tomography-induction
        className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12"
        aria-labelledby="vision-tomography-induction-heading"
      >
        <SectionHeading
          id="vision-tomography-induction-heading"
          eyebrow={VISION_TOMOGRAPHY_INDUCTION_COPY.eyebrow}
          title={VISION_TOMOGRAPHY_INDUCTION_COPY.title}
        />
        <p
          className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg"
          data-vision-tomography-induction-lead
        >
          {VISION_TOMOGRAPHY_INDUCTION_COPY.lead}
        </p>
        <article
          className="mt-8 border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
          data-vision-epistemic-foraging
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.eyebrow}
          </p>
          <h3 className="mt-2 text-lg font-medium text-white">
            {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {VISION_TOMOGRAPHY_INDUCTION_COPY.policy.body}
          </p>
        </article>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <VisionCard
            eyebrow={VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.eyebrow}
            title={VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.title}
            body={VISION_TOMOGRAPHY_INDUCTION_COPY.tomography.body}
          />
          <VisionCard
            eyebrow={VISION_TOMOGRAPHY_INDUCTION_COPY.induction.eyebrow}
            title={VISION_TOMOGRAPHY_INDUCTION_COPY.induction.title}
            body={VISION_TOMOGRAPHY_INDUCTION_COPY.induction.body}
          />
        </div>
        <p
          className="mt-6 max-w-3xl text-sm leading-relaxed text-zinc-500 sm:text-base"
          data-vision-tomography-induction-distinction
        >
          {VISION_TOMOGRAPHY_INDUCTION_COPY.distinction}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href={VISION_TOMOGRAPHY_INDUCTION_PATHS.science}
            data-vision-science-link
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            {VISION_TOMOGRAPHY_INDUCTION_COPY.links.scienceLabel}
            <ArrowRight size={14} />
          </Link>
          <Link
            href={VISION_TOMOGRAPHY_INDUCTION_PATHS.epistemicForaging}
            data-vision-epistemic-foraging-link
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            {VISION_TOMOGRAPHY_INDUCTION_COPY.links.foragingLabel}
            <ArrowRight size={14} />
          </Link>
          <Link
            href={VISION_TOMOGRAPHY_INDUCTION_PATHS.knowledgeTomographyPaper}
            data-vision-knowledge-tomography-paper-link
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            {VISION_TOMOGRAPHY_INDUCTION_COPY.links.paperLabel}
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading eyebrow="WHO TRUSTS US" title="Current projects using Uncertain Systems work." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PARTNERS.map((partner) => (
            <a
              key={partner.name}
              href={partner.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-700 sm:p-6"
            >
              <h3 className="text-lg font-medium text-white group-hover:text-zinc-200">{partner.name}</h3>
              <p className="mt-2 text-sm text-zinc-500">{partner.label}</p>
            </a>
          ))}
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string;
  title: string;
  id?: string;
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</div>
      <h2
        id={id}
        className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-1.8px] text-white sm:text-5xl"
      >
        {title}
      </h2>
    </div>
  );
}

function VisionCard({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</p>
      <h3 className="mt-3 text-xl font-medium tracking-[-0.6px] text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}