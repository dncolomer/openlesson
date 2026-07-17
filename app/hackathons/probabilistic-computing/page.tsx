import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, MapPin, Trophy, Users } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";

export const metadata: Metadata = {
  title: "Probabilistic Computing Hackathon · ETH Zurich",
  description:
    "Past event: a 1-day hackathon at ETH Zurich on probabilistic and thermodynamic computing — Energy-Based Models, THRML, lectures, team builds, and demos. Hosted with Extropic and EFCL.",
  alternates: {
    canonical: "https://uncertain.systems/hackathons/probabilistic-computing",
  },
  openGraph: {
    title: "Probabilistic Computing Hackathon · ETH Zurich | Uncertain Systems",
    description:
      "Past event: build with probabilistic and thermodynamic computing — EBMs, THRML, Extropic, and Uncertain Systems.",
    url: "https://uncertain.systems/hackathons/probabilistic-computing",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Probabilistic Computing Hackathon" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Probabilistic Computing Hackathon · ETH Zurich",
    description:
      "Past event on probabilistic and thermodynamic computing at ETH Zurich.",
    images: ["/opengraph-image"],
  },
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

const LEARNING_PLAN_HREF =
  "/p/62479ef7-c142-407a-995f-a5bba429a20b/probabilistic-computing-and-extropic-ai-approach";

const AGENDA = [
  {
    time: "12:30",
    title: "Lecture",
    body: "Intro to probabilistic computing — theory and practice.",
  },
  {
    time: "14:00",
    title: "Extropic CEO Guillaume Verdon",
    body: "Session with Extropic’s CEO.",
  },
  {
    time: "14:30",
    title: "Hackathon",
    body: "Teams of 1 to 4 build projects with organizer and mentor support.",
  },
  {
    time: "18:30",
    title: "Dinner break",
    body: "Food, reset, and final project preparation.",
  },
  {
    time: "19:00",
    title: "Demos",
    body: "Short demos from each team followed by judging.",
  },
  {
    time: "19:30",
    title: "Announce winners",
    body: "Prize announcements, closing remarks, and next steps for the community.",
  },
] as const;

const WINNING_PROJECTS = [
  {
    place: "1st",
    prize: "$1,500",
    title: "Winning project — placeholder",
    team: "Team name TBD",
    description:
      "Short write-up of the winning build will go here: problem, approach, and what made it stand out.",
  },
  {
    place: "2nd",
    prize: "$1,000",
    title: "Runner-up project — placeholder",
    team: "Team name TBD",
    description:
      "Placeholder for the second-place project. Link to demos, repos, and write-ups once published.",
  },
  {
    place: "3rd",
    prize: "$500",
    title: "Third-place project — placeholder",
    team: "Team name TBD",
    description:
      "Placeholder for the third-place project. Lifetime access packages below will unpack the ideas behind the winners.",
  },
] as const;

const LIFETIME_PACKAGES = [
  {
    id: "winner-1",
    badge: "1st place · Coming soon",
    title: "Lifetime access: winning project deep-dive",
    description:
      "A curated learning environment built around the 1st-place project — concepts, practice paths, and the stack the team used. Pay once, fork yours for life.",
  },
  {
    id: "winner-2",
    badge: "2nd place · Coming soon",
    title: "Lifetime access: runner-up project deep-dive",
    description:
      "Placeholder package so you can study the 2nd-place approach end-to-end — theory, implementation notes, and follow-on experiments.",
  },
  {
    id: "winner-3",
    badge: "3rd place · Coming soon",
    title: "Lifetime access: third-place project deep-dive",
    description:
      "Placeholder package for the 3rd-place project. Will ship as an editorially curated workspace once the materials are ready.",
  },
] as const;

const SPONSORS = [
  {
    name: "Extropic",
    role: "Technology, content, prizes, and logistics",
    href: "https://extropic.ai/",
  },
  {
    name: "ETH Zurich + EFCL",
    role: "Venue and local community partner",
    href: "https://efcl.ethz.ch/",
  },
  {
    name: "Uncertain Systems",
    role: "Education sponsor · All-You-Can-Learn",
    href: "https://uncertain.systems",
  },
] as const;

export default function ProbabilisticComputingHackathonPage() {
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
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-10 pb-8 sm:px-6 sm:pt-14 sm:pb-10">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-zinc-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li>
              <Link
                href="/all-you-can-learn?tab=hackathons"
                className="transition hover:text-white"
              >
                Hackathons
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li className="text-zinc-400">Probabilistic Computing</li>
          </ol>
        </nav>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="rounded-sm border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-400">
            Past event
          </span>
          <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/90">
            Registration closed
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            ETH Zurich · 1-day hackathon
          </span>
        </div>

        <h1 className="max-w-4xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl lg:text-[56px]">
          Probabilistic Computing Hackathon
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
          Build with probabilistic and thermodynamic computing.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-500">
          A hands-on day for learning Energy-Based Models, the THRML framework, and emerging computing
          paradigms designed for the next generation of AI systems — theory, guided practice, and a
          team-based hackathon.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetaCard label="Date" value="June 10, 2026" />
          <MetaCard label="Start" value="12:30 CEST" />
          <MetaCard label="Location" value="Andreasstrasse 5, Zurich · Room S15" />
          <MetaCard label="Capacity" value="Under 80 participants" />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#winners"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            <Trophy size={16} />
            View winners
          </a>
          <a
            href="#lifetime"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-zinc-700 px-5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Lifetime access packages
            <ArrowRight size={14} />
          </a>
          <Link
            href="/all-you-can-learn?tab=hackathons"
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
          >
            All hackathons
          </Link>
        </div>
      </section>

      {/* About */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <SectionLabel>About the event</SectionLabel>
        <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
          Educational deep-dive plus real hackathon.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">
          The event introduced probabilistic computing chips, Energy-Based Models, and THRML through
          theory, guided practice, and a team-based build day.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/75 p-5 backdrop-blur-sm sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Core topics</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li className="flex gap-2">
                <span className="text-zinc-600">·</span>
                Probabilistic and thermodynamic computing
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-600">·</span>
                Energy-Based Models
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-600">·</span>
                THRML framework
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/75 p-5 backdrop-blur-sm sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Audience</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li className="flex gap-2">
                <span className="text-zinc-600">·</span>
                ETH students and researchers
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-600">·</span>
                Industry professionals
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-600">·</span>
                Teams of 1 to 4 participants
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section id="agenda" className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <SectionLabel>Agenda</SectionLabel>
        <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
          Started at 12:30.
        </h2>
        <p className="mt-3 text-sm text-zinc-500">All times CEST, Zurich.</p>

        <ol className="mt-8 space-y-0 border-l border-zinc-800 pl-6">
          {AGENDA.map((item) => (
            <li key={item.time} className="relative pb-8 last:pb-0">
              <span className="absolute -left-[1.9rem] top-1.5 h-2.5 w-2.5 rounded-full border border-zinc-600 bg-[#0a0a0a]" />
              <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-zinc-500">{item.time}</p>
              <h3 className="mt-1 text-lg font-medium text-white">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Winners */}
      <section id="winners" className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <SectionLabel>Results</SectionLabel>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
              Winning projects
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              $3,000 prize pool — 1st $1,500 · 2nd $1,000 · 3rd $500. Project write-ups and demos will be
              filled in here; placeholders for now.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {WINNING_PROJECTS.map((project) => (
            <article
              key={project.place}
              className="flex flex-col overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm"
            >
              <div className="border-b border-zinc-800/80 bg-zinc-900/40 px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/90">
                    {project.place} place
                  </span>
                  <span className="text-sm font-medium text-white">{project.prize}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-medium text-white">{project.title}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users size={12} />
                  {project.team}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-500">{project.description}</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                  Demo / repo · Coming soon
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Lifetime packages for winners */}
      <section id="lifetime" className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <SectionLabel>Study the winners</SectionLabel>
        <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
          Lifetime access packages
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
          We will ship All-You-Can-Learn packages built around the winning projects — so anyone can
          understand how they worked, not just watch a demo. Placeholders until the packages are live.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {LIFETIME_PACKAGES.map((pkg) => (
            <article
              key={pkg.id}
              className="flex flex-col rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/50 p-5 backdrop-blur-sm"
            >
              <span className="w-fit border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/90">
                {pkg.badge}
              </span>
              <h3 className="mt-4 text-base font-medium leading-snug text-white">{pkg.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">{pkg.description}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
                <div>
                  <p className="text-sm font-medium text-zinc-400">Price TBD</p>
                  <p className="text-xs text-zinc-600">One-time · Fork yours for life</p>
                </div>
                <span className="rounded-sm border border-zinc-800 px-3 py-2 text-xs text-zinc-600">
                  Not yet available
                </span>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Browse other lifetime packages on{" "}
          <Link
            href="/all-you-can-learn?tab=lifetime"
            className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white"
          >
            All-You-Can-Learn
          </Link>
          .
        </p>
      </section>

      {/* Prep material */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm">
          <div className="grid md:grid-cols-2">
            <div
              className="min-h-[180px] bg-cover bg-center md:min-h-full"
              style={{
                backgroundImage:
                  "url(https://cdn.sanity.io/images/otrk6k1t/production/7ef4d9c0fcf06719cb7ddd7ebdb20b02a2355793-1736x1284.webp?auto=format&fit=max&q=75&w=868)",
              }}
            />
            <div className="p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                Optional preparation
              </p>
              <h2 className="mt-3 text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">
                Probabilistic Computing and Extropic AI approach
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                Fork the custom learning plan and adapt it to your level, needs, and interests — still
                useful after the event.
              </p>
              <Link
                href={LEARNING_PLAN_HREF}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-white transition hover:text-zinc-300"
              >
                Open learning plan
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Technology + education context */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/75 p-6 backdrop-blur-sm">
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              Technology context
            </p>
            <h2 className="mt-3 text-xl font-medium text-white">About Extropic</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Extropic is building energy-efficient computers for the AI-powered future by rethinking
              computing from physics fundamentals.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-zinc-300">Core focus</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  Thermodynamic and probabilistic computing for generative AI and probabilistic
                  workloads, targeting orders-of-magnitude lower power for inference and generation.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-300">Key technology</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  Thermodynamic Sampling Units, the XTR-0 / X0 platform, and THRML — an open-source
                  Python library for thermodynamic algorithms and TSU simulation.
                </p>
              </div>
            </div>
            <a
              href="https://extropic.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
            >
              extropic.ai
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/75 p-6 backdrop-blur-sm">
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              Education context
            </p>
            <h2 className="mt-3 text-xl font-medium text-white">About Uncertain Systems</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Uncertain Systems accelerates technical education around emerging computing paradigms —
              clear lessons, hands-on projects, and public learning infrastructure.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-zinc-300">Education accelerationism</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  Shorten the path from frontier research to practical understanding for students,
                  researchers, and builders.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-300">Why it matters</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  Probabilistic and thermodynamic computing will need a new generation of practitioners.
                  We turn complex ideas into learnable, buildable material.
                </p>
              </div>
            </div>
            <Link
              href="/all-you-can-learn"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
            >
              All-You-Can-Learn
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* Sponsors */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <SectionLabel>Sponsors and partners</SectionLabel>
        <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white">Supported by</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {SPONSORS.map((sponsor) => (
            <a
              key={sponsor.name}
              href={sponsor.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-zinc-800/90 bg-zinc-950/75 p-5 backdrop-blur-sm transition hover:border-zinc-600"
            >
              <p className="font-medium text-white">{sponsor.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{sponsor.role}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Closed registration */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 pb-16 sm:px-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                Registration
              </p>
              <h2 className="mt-2 text-xl font-medium text-white sm:text-2xl">This event is closed.</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
                The Probabilistic Computing Hackathon at ETH Zurich has concluded. Follow winning
                projects and lifetime packages above, or get in touch about hosting a future event.
              </p>
              <p className="mt-4 flex items-start gap-2 text-sm text-zinc-500">
                <MapPin size={14} className="mt-0.5 shrink-0 text-zinc-600" />
                Andreasstrasse 5, 8050 Zurich, Switzerland — Room S15
              </p>
            </div>
            <div className="shrink-0 space-y-3">
              <a
                href="mailto:uncertainsystems@gmail.com"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200 sm:w-auto"
              >
                Host a hackathon with us
              </a>
              <p className="text-center text-xs text-zinc-600 sm:text-left">
                Organizer: Daniel Colomer
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{children}</p>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/75 px-4 py-3 backdrop-blur-sm">
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">{label}</p>
      <p className="mt-1.5 text-sm font-medium leading-snug text-zinc-200">{value}</p>
    </div>
  );
}
