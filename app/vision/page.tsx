import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";

export const metadata: Metadata = {
  title: "Vision",
  description:
    "Uncertain Systems is building self-driving technology for learning — non-invasive systems that raise attention and understanding without asking humans to burn proportionally more energy.",
  alternates: { canonical: "https://uncertain.systems/vision" },
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const ROADMAP = [
  {
    phase: "Today",
    title: "Learning verification v1",
    body: "Evidence, think-aloud protocol, and gap analysis for humans and agents — the foundation of the stack.",
  },
  {
    phase: "Near-Term",
    title: "Socratic interruption model",
    body: "Predictive interruptions plus other world models layered on live learning signals.",
  },
  {
    phase: "Medium-Term",
    title: "Non-invasive brain-stimulation headset",
    body: "Starting with tDCS — hardware that complements software attention loops.",
  },
  {
    phase: "Future",
    title: "Full automation",
    body: "Hardware, software, and biofeedback loops working as one self-driving learning system.",
  },
];

const AUDIENCES = [
  {
    title: "Individuals",
    body: "People who want to learn deeply without turning every hard topic into a high-friction grind.",
  },
  {
    title: "Enterprises",
    body: "L&D, hiring, and platform teams that need auditable proof someone actually learned a workflow — not just clicked through training or passed a one-shot exam.",
  },
  {
    title: "Educators",
    body: "Schools, academies, and tutors that want practice environments where learners reveal how they think, not just what they answer.",
  },
  {
    title: "Builders",
    body: "Integrators embedding verification into LMS, HRIS, ATS, and CI gates via API — without replacing the front end.",
  },
];

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
        <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          EDU / ACC
        </div>
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

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading eyebrow="THE SCIENCE" title="A more holistic definition of knowledge." />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <SciencePreview number="01" title="Knowledge is proximity" body="How close one brain configuration is to another useful configuration." />
          <SciencePreview number="02" title="Learning is transformation" body="Movement through configuration space — ideally with less wasted effort." />
          <SciencePreview number="03" title="Non-invasive path" body="Start with software attention loops, then add world models, stimulation, and biofeedback." />
        </div>
        <Link
          href="/science"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
        >
          Explore the science
          <ArrowRight size={14} />
        </Link>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading eyebrow="OUR FIRST PRODUCT" title="Beyond benchmarks for AI. Beyond tests for humans." />
        <div className="mt-6 border border-zinc-800 bg-zinc-950/70 p-6 text-lg leading-relaxed text-zinc-400 backdrop-blur-sm sm:p-8">
          <p>
            Uncertain Systems is learning verification infrastructure — not an LMS, course marketplace, or
            leaderboard. It verifies readiness through evidence, proof of work, and cognitive analysis for people
            and AI agents doing knowledge work, built on the same think-aloud science that surfaces real gaps.
          </p>
        </div>
        <blockquote className="mt-8 border-l-[3px] border-white/20 pl-6 text-lg italic leading-relaxed text-zinc-300">
          &ldquo;Identifying the precise gap in my knowledge is what the Socratic method does so well. I
          didn&apos;t realize I didn&apos;t know how that part worked until that direct question was asked of
          me.&rdquo;
          <footer className="mt-4 font-mono text-[11px] not-italic uppercase tracking-[1.6px] text-zinc-600">
            User feedback
          </footer>
        </blockquote>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading eyebrow="ROADMAP" title="From learning verification to the Neo Chair." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ROADMAP.map((item) => (
            <div key={item.phase} className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{item.phase}</p>
              <h3 className="mt-2 text-xl font-medium tracking-[-0.6px] text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <SectionHeading eyebrow="WHO IT IS FOR" title="Learning automation for people, teams, educators, and builders." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {AUDIENCES.map((item) => (
            <div key={item.title} className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
              <h3 className="text-lg font-medium text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:pb-16">
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

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</div>
      <h2 className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-1.8px] text-white sm:text-5xl">{title}</h2>
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

function SciencePreview({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/70 p-5">
      <p className="font-mono text-[10px] text-zinc-600">{number}</p>
      <h3 className="mt-2 text-base font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}